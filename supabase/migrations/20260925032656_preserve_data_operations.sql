-- Additive upgrade. Never deletes business rows. Public access is intentional:
-- owner requested no login. RPCs are NOT a substitute for authentication.
create schema if not exists gka_private;
revoke all on schema gka_private from public, anon, authenticated;
create table gka_private.upgrade_backup (table_name text primary key, rows jsonb not null, captured_at timestamptz default now());
do $$ declare t text; begin
  foreach t in array array['drivers','kasbons','cicilans','absens','gajian','gajian_detail','suppliers','supplier_tagihan','supplier_bayar','slips'] loop
    execute format('insert into gka_private.upgrade_backup(table_name,rows) select %L,coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r',t,t);
  end loop;
end $$;
alter table public.drivers add column is_active boolean not null default true;
alter table public.kasbons add column employee_id uuid references public.drivers(id);
alter table public.absens add column employee_id uuid references public.drivers(id), add column kind text not null default 'Tidak hadir', add column note text, add column voided_at timestamptz, add column void_reason text;
alter table public.cicilans add column note text, add column voided_at timestamptz, add column void_reason text, add column payroll_run_id uuid;
alter table public.supplier_bayar add column note text, add column voided_at timestamptz, add column void_reason text;
update public.kasbons k set employee_id=d.id from public.drivers d where k.driver_name=d.name;
update public.absens a set employee_id=d.id from public.drivers d where a.driver_name=d.name;
create index kasbons_employee_idx on public.kasbons(employee_id);
create index absens_employee_date_idx on public.absens(employee_id,tanggal);
create index cicilans_parent_idx on public.cicilans(kasbon_id);
create index supplier_bayar_parent_idx on public.supplier_bayar(tagihan_id);
create index supplier_tagihan_supplier_idx on public.supplier_tagihan(supplier_id);
create table public.attendance_periods(id uuid primary key default gen_random_uuid(),periode text not null unique check(periode ~ '^\d{4}-(0[1-9]|1[0-2])$'),closed_at timestamptz not null default now(),reason text not null);
create table public.payroll_runs(id uuid primary key default gen_random_uuid(),periode text not null unique check(periode ~ '^\d{4}-(0[1-9]|1[0-2])$'),tanggal date not null,holidays date[] not null default '{}',created_at timestamptz not null default now(),status text not null default 'final' check(status='final'));
create table public.payroll_items(id uuid primary key default gen_random_uuid(),run_id uuid not null references public.payroll_runs(id),employee_id uuid not null references public.drivers(id),driver_name text not null,jabatan text,gaji_pokok bigint not null,hari_kerja integer not null,hari_absen integer not null,tunjangan_hadir bigint not null,potongan_pinjaman bigint not null,total bigint not null,unique(run_id,employee_id),check(total>=0),check(potongan_pinjaman>=0));
alter table public.cicilans add constraint cicilans_payroll_run_fk foreign key(payroll_run_id) references public.payroll_runs(id);
create index payroll_items_employee_idx on public.payroll_items(employee_id);
create index cicilans_payroll_idx on public.cicilans(payroll_run_id);
create table public.audit_log(id uuid primary key default gen_random_uuid(),table_name text not null,record_id text not null,action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());
create table gka_private.requests(id uuid primary key,action text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
-- Shared serialization lock also covers writes from the old application.
create function gka_private.guard_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(7192401);
  if tg_op='DELETE' then raise exception 'Data tidak boleh dihapus. Gunakan pembatalan atau nonaktifkan.'; end if;
  if tg_table_name='absens' then
    if exists(select 1 from public.attendance_periods where periode=to_char(new.tanggal,'YYYY-MM')) or (tg_op='UPDATE' and exists(select 1 from public.attendance_periods where periode=to_char(old.tanggal,'YYYY-MM'))) then raise exception 'Periode absensi sudah ditutup.'; end if;
    if tg_op='INSERT' and exists(select 1 from public.absens a where a.driver_name=new.driver_name and a.tanggal=new.tanggal and a.voided_at is null) then raise exception 'Absen pada tanggal ini sudah tercatat.'; end if;
    if tg_op='UPDATE' and (old.voided_at is not null or new.voided_at is null or length(trim(coalesce(new.void_reason,'')))<3 or (to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason')) then raise exception 'Catatan absen hanya dapat dibatalkan dengan alasan.'; end if;
  end if;
  return new;
end $$;
create function gka_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(table_name,record_id,action,before_data,after_data) values(tg_table_name,new.id::text,tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new)); return new;
end $$;
revoke all on function gka_private.guard_write(), gka_private.audit_change() from public;
do $$ declare t text; begin
 foreach t in array array['drivers','kasbons','cicilans','absens','gajian','gajian_detail','suppliers','supplier_tagihan','supplier_bayar','slips','attendance_periods','payroll_runs','payroll_items'] loop
  execute format('create trigger gka_guard before insert or update or delete on public.%I for each row execute function gka_private.guard_write()',t);
  execute format('create trigger gka_audit after insert or update on public.%I for each row execute function gka_private.audit_change()',t);
 end loop;
 foreach t in array array['attendance_periods','payroll_runs','payroll_items','audit_log'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy gka_read on public.%I for select to anon,authenticated using(true)',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to anon,authenticated',t);
 end loop;
end $$;
-- Payments validate against current balance and update status in the SAME transaction.
create function gka_private.payment_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare owed bigint; already_paid bigint; loan_date date;
begin
 perform pg_advisory_xact_lock(7192401);
 if tg_op='UPDATE' then
  if old.voided_at is not null or new.voided_at is null or length(trim(coalesce(new.void_reason,'')))<3 or (to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason') then raise exception 'Pembayaran hanya dapat dibatalkan dengan alasan; nominal asli tidak boleh diubah.'; end if;
  if tg_table_name='cicilans' and old.payroll_run_id is not null then raise exception 'Potongan payroll final tidak dapat dibatalkan terpisah.'; end if;
  if tg_table_name='cicilans' and exists(select 1 from public.kasbons other join public.kasbons target on target.id=new.kasbon_id where other.driver_name=target.driver_name and other.is_active and other.id<>target.id) then raise exception 'Tidak dapat membuka kasbon lama ketika ada kasbon baru aktif.'; end if;
 else
  if new.nominal<=0 or new.tanggal>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Nominal atau tanggal pembayaran tidak valid.'; end if;
  if tg_table_name='cicilans' then
   select total_potong,tanggal_kasbon into owed,loan_date from public.kasbons where id=new.kasbon_id for update;
   select coalesce(sum(nominal),0) into already_paid from public.cicilans where kasbon_id=new.kasbon_id and voided_at is null;
   if new.tanggal<loan_date then raise exception 'Pembayaran tidak boleh sebelum tanggal kasbon.'; end if;
  else
   select nominal into owed from public.supplier_tagihan where id=new.tagihan_id for update;
   select coalesce(sum(nominal),0) into already_paid from public.supplier_bayar where tagihan_id=new.tagihan_id and voided_at is null;
  end if;
  if owed is null or new.nominal>owed-already_paid then raise exception 'Pembayaran melebihi saldo terbaru. Muat ulang data.'; end if;
 end if;
 return new;
end $$;
create function gka_private.payment_status() returns trigger language plpgsql security definer set search_path='' as $$
declare total_paid bigint; settled date;
begin
 if tg_table_name='cicilans' then
  select coalesce(sum(nominal),0),max(tanggal) into total_paid,settled from public.cicilans where kasbon_id=new.kasbon_id and voided_at is null;
  update public.kasbons set is_active=total_paid<total_potong,tanggal_lunas=case when total_paid>=total_potong then settled else null end where id=new.kasbon_id;
 else
  select coalesce(sum(nominal),0) into total_paid from public.supplier_bayar where tagihan_id=new.tagihan_id and voided_at is null;
  update public.supplier_tagihan set is_lunas=total_paid>=nominal where id=new.tagihan_id;
 end if;
 return new;
end $$;
revoke all on function gka_private.payment_guard(),gka_private.payment_status() from public;
create trigger payment_guard before insert or update on public.cicilans for each row execute function gka_private.payment_guard();
create trigger payment_status after insert or update on public.cicilans for each row execute function gka_private.payment_status();
create trigger payment_guard before insert or update on public.supplier_bayar for each row execute function gka_private.payment_guard();
create trigger payment_status after insert or update on public.supplier_bayar for each row execute function gka_private.payment_status();
create function gka_private.loan_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare employee public.drivers; settled date; expected_fee integer;
begin
 perform pg_advisory_xact_lock(7192401);
 select * into employee from public.drivers where id=new.employee_id or (new.employee_id is null and name=new.driver_name) for update;
 if not found or not employee.is_active then raise exception 'Karyawan tidak aktif atau tidak ditemukan.'; end if;
 if exists(select 1 from public.kasbons where employee_id=employee.id and is_active) then raise exception 'Masih ada kasbon aktif.'; end if;
 select max(tanggal_lunas) into settled from public.kasbons where employee_id=employee.id and not is_active;
 if new.nominal<1000 or new.tanggal_kasbon>(now() at time zone 'Asia/Jakarta')::date or new.tanggal_kasbon<settled then raise exception 'Nominal minimal Rp1.000 dan tanggal harus setelah pelunasan terakhir, tidak di masa depan.'; end if;
 expected_fee=case when settled is not null and new.tanggal_kasbon-settled<30 then 50000 else 0 end;
 new.employee_id=employee.id; new.driver_name=employee.name; new.fee=expected_fee; new.total_potong=new.nominal+expected_fee; new.is_active=true; new.tanggal_lunas=null; return new;
end $$;
revoke all on function gka_private.loan_guard() from public;
create trigger loan_guard before insert on public.kasbons for each row execute function gka_private.loan_guard();

-- Restricted command surface. SECURITY DEFINER is intentional for the no-login
-- product: clients may invoke enumerated operations, never arbitrary SQL.
create function gka_private.command(p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare saved gka_private.requests; result jsonb; eid uuid; rid uuid; employee public.drivers; loan public.kasbons; pay public.cicilans; billpay public.supplier_bayar; absence public.absens; per text; trans_date date; holidays date[]; workdays integer; absentdays integer; deduction bigint; allowance bigint; salary bigint; debt bigint; run_id uuid; item jsonb; expected jsonb; cuts jsonb; holiday date; reason text;
begin
 perform pg_advisory_xact_lock(7192401);
 if p_request_id is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Permintaan tidak valid.'; end if;
 select * into saved from gka_private.requests where id=p_request_id;
 if found then
  if saved.action<>p_action or saved.payload<>p_payload then raise exception 'Permintaan sebelumnya sudah tersimpan. Muat ulang data.'; end if;
  return saved.result;
 end if;
 reason=trim(coalesce(p_payload->>'reason',''));
 if p_action in ('employee_status','void_payment','void_absence','close_attendance') and length(reason)<3 then raise exception 'Alasan minimal 3 karakter.'; end if;
 if p_action='employee' then
  if length(trim(coalesce(p_payload->>'name','')))<2 or (p_payload->>'gaji_pokok')::bigint<0 or coalesce(p_payload->>'jabatan','') not in ('Sopir','Sales','Admin','Kolektor') then raise exception 'Data karyawan tidak valid.'; end if;
  eid=nullif(p_payload->>'id','')::uuid;
  if exists(select 1 from public.drivers where lower(trim(name))=lower(trim(p_payload->>'name')) and (eid is null or id<>eid)) then raise exception 'Nama karyawan sudah digunakan.'; end if;
  if eid is null then
   insert into public.drivers(name,jabatan,gaji_pokok) values(trim(p_payload->>'name'),p_payload->>'jabatan',(p_payload->>'gaji_pokok')::integer) returning id into eid;
  else
   update public.drivers set name=trim(p_payload->>'name'),jabatan=p_payload->>'jabatan',gaji_pokok=(p_payload->>'gaji_pokok')::integer where id=eid;
   if not found then raise exception 'Karyawan tidak ditemukan.'; end if;
   -- Legacy names remain historical snapshots; joins use employee_id.
  end if;
  result=jsonb_build_object('id',eid);
 elsif p_action='employee_status' then
  eid=(p_payload->>'id')::uuid;
  if not (p_payload->>'is_active')::boolean and exists(select 1 from public.kasbons where employee_id=eid and is_active) then raise exception 'Lunaskan kasbon sebelum menonaktifkan karyawan.'; end if;
  update public.drivers set is_active=(p_payload->>'is_active')::boolean where id=eid;
  if not found then raise exception 'Karyawan tidak ditemukan.'; end if;
  result=jsonb_build_object('id',eid,'reason',reason);
 elsif p_action='loan' then
  select * into employee from public.drivers where id=(p_payload->>'employee_id')::uuid;
  insert into public.kasbons(employee_id,driver_name,nominal,fee,total_potong,tanggal_kasbon) values(employee.id,employee.name,(p_payload->>'nominal')::integer,0,0,(p_payload->>'tanggal')::date) returning id into rid;
  result=jsonb_build_object('id',rid);
 elsif p_action='loan_payment' then
  insert into public.cicilans(kasbon_id,nominal,tanggal,note) values((p_payload->>'kasbon_id')::uuid,(p_payload->>'nominal')::integer,(p_payload->>'tanggal')::date,nullif(trim(p_payload->>'note'),'')) returning id into rid;
  result=jsonb_build_object('id',rid);
 elsif p_action='supplier' then
  if length(trim(coalesce(p_payload->>'name','')))<2 then raise exception 'Nama supplier minimal 2 karakter.'; end if;
  if exists(select 1 from public.suppliers where lower(trim(name))=lower(trim(p_payload->>'name'))) then raise exception 'Nama supplier sudah digunakan.'; end if;
  insert into public.suppliers(name) values(trim(p_payload->>'name')) returning id into rid; result=jsonb_build_object('id',rid);
 elsif p_action='invoice' then
  if (p_payload->>'nominal')::bigint<=0 or length(trim(coalesce(p_payload->>'keterangan','')))<1 then raise exception 'Data tagihan tidak valid.'; end if;
  insert into public.supplier_tagihan(supplier_id,keterangan,nominal,jatuh_tempo) values((p_payload->>'supplier_id')::uuid,trim(p_payload->>'keterangan'),(p_payload->>'nominal')::integer,(p_payload->>'jatuh_tempo')::date) returning id into rid; result=jsonb_build_object('id',rid);
 elsif p_action='supplier_payment' then
  insert into public.supplier_bayar(tagihan_id,nominal,tanggal,note) values((p_payload->>'tagihan_id')::uuid,(p_payload->>'nominal')::integer,(p_payload->>'tanggal')::date,nullif(trim(p_payload->>'note'),'')) returning id into rid; result=jsonb_build_object('id',rid);
 elsif p_action='void_payment' then
  rid=(p_payload->>'id')::uuid;
  if p_payload->>'kind'='kasbon' then update public.cicilans set voided_at=now(),void_reason=reason where id=rid;
  elsif p_payload->>'kind'='supplier' then update public.supplier_bayar set voided_at=now(),void_reason=reason where id=rid;
  else raise exception 'Jenis pembayaran tidak valid.'; end if;
  if not found then raise exception 'Pembayaran tidak ditemukan.'; end if; result=jsonb_build_object('id',rid);
 elsif p_action='absence' then
  select * into employee from public.drivers where id=(p_payload->>'employee_id')::uuid and is_active;
  if not found then raise exception 'Karyawan tidak aktif.'; end if;
  trans_date=(p_payload->>'tanggal')::date;
  if trans_date>(now() at time zone 'Asia/Jakarta')::date or extract(dow from trans_date)=0 then raise exception 'Tanggal absen harus sudah terjadi dan bukan hari Minggu.'; end if;
  if coalesce(p_payload->>'kind','') not in ('Tidak hadir','Sakit','Izin','Cuti') then raise exception 'Jenis absen tidak valid.'; end if;
  insert into public.absens(employee_id,driver_name,tanggal,kind,note) values(employee.id,employee.name,trans_date,p_payload->>'kind',p_payload->>'note') returning id into rid; result=jsonb_build_object('id',rid);
 elsif p_action='void_absence' then
  update public.absens set voided_at=now(),void_reason=reason where id=(p_payload->>'id')::uuid returning id into rid;
  if not found then raise exception 'Absen tidak ditemukan.'; end if; result=jsonb_build_object('id',rid);
 elsif p_action='close_attendance' then
  per=p_payload->>'periode';
  if per>to_char(now() at time zone 'Asia/Jakarta','YYYY-MM') then raise exception 'Tidak dapat menutup periode mendatang.'; end if;
  insert into public.attendance_periods(periode,reason) values(per,reason) returning id into rid; result=jsonb_build_object('id',rid);
 elsif p_action='payroll' then
  per=p_payload->>'periode'; trans_date=(p_payload->>'tanggal')::date;
  if per !~ '^\d{4}-(0[1-9]|1[0-2])$' or per>to_char(now() at time zone 'Asia/Jakarta','YYYY-MM') or trans_date>(now() at time zone 'Asia/Jakarta')::date or to_char(trans_date,'YYYY-MM')<per then raise exception 'Periode atau tanggal payroll tidak valid.'; end if;
  if exists(select 1 from public.payroll_runs where periode=per) then raise exception 'Payroll periode ini sudah final.'; end if;
  select coalesce(array_agg(distinct x::date),'{}') into holidays from jsonb_array_elements_text(coalesce(p_payload->'holidays','[]')) x;
  foreach holiday in array holidays loop if to_char(holiday,'YYYY-MM')<>per then raise exception 'Tanggal libur harus dalam periode payroll.'; end if; end loop;
  select count(*) into workdays from generate_series((per||'-01')::date,((per||'-01')::date+interval '1 month - 1 day')::date,interval '1 day') dt where extract(dow from dt)<>0 and not(dt::date=any(holidays));
  if workdays<1 then raise exception 'Tidak ada hari kerja.'; end if;
  if not exists(select 1 from public.drivers where is_active and coalesce(jabatan,'Sopir')<>'Sopir') then raise exception 'Tidak ada karyawan payroll.'; end if;
  cuts=coalesce(p_payload->'deductions','{}');
  insert into public.payroll_runs(periode,tanggal,holidays) values(per,trans_date,holidays) returning id into run_id;
  for employee in select * from public.drivers where is_active and coalesce(jabatan,'Sopir')<>'Sopir' order by id for update loop
   select count(distinct tanggal) into absentdays from public.absens where employee_id=employee.id and voided_at is null and to_char(tanggal,'YYYY-MM')=per and extract(dow from tanggal)<>0 and not(tanggal=any(holidays));
   salary=coalesce(employee.gaji_pokok,4000000); allowance=(workdays-absentdays)*70000; deduction=coalesce((cuts->>employee.id::text)::bigint,0);
   select * into loan from public.kasbons where employee_id=employee.id and is_active order by tanggal_kasbon limit 1 for update;
   debt=0;
   if found then select loan.total_potong-coalesce(sum(nominal),0) into debt from public.cicilans where kasbon_id=loan.id and voided_at is null; end if;
   if deduction<0 or deduction>debt or deduction>salary+allowance then raise exception 'Potongan % melebihi saldo atau gaji terbaru.',employee.name; end if;
   expected=p_payload->'expected'->employee.id::text;
   if expected is null or expected<>jsonb_build_object('gaji_pokok',salary,'hari_kerja',workdays,'hari_absen',absentdays,'tunjangan_hadir',allowance,'potongan_pinjaman',deduction,'total',salary+allowance-deduction) then raise exception 'Data berubah sejak pratinjau. Muat ulang dan periksa payroll kembali.'; end if;
   insert into public.payroll_items(run_id,employee_id,driver_name,jabatan,gaji_pokok,hari_kerja,hari_absen,tunjangan_hadir,potongan_pinjaman,total) values(run_id,employee.id,employee.name,employee.jabatan,salary,workdays,absentdays,allowance,deduction,salary+allowance-deduction);
   if deduction>0 then insert into public.cicilans(kasbon_id,nominal,tanggal,note,payroll_run_id) values(loan.id,deduction,trans_date,'Potongan payroll '||per,run_id); end if;
  end loop;
  insert into public.attendance_periods(periode,reason) values(per,'Finalisasi payroll') on conflict(periode) do nothing;
  result=jsonb_build_object('id',run_id);
 else raise exception 'Operasi tidak dikenal.';
 end if;
 insert into gka_private.requests(id,action,payload,result) values(p_request_id,p_action,p_payload,result);
 insert into public.audit_log(table_name,record_id,action,after_data) values('operations',coalesce(result->>'id',p_request_id::text),p_action,jsonb_build_object('reason',nullif(reason,''),'request_id',p_request_id));
 return result;
end $$;
revoke all on function gka_private.command(text,jsonb,uuid) from public;
grant usage on schema gka_private to anon,authenticated;
grant execute on function gka_private.command(text,jsonb,uuid) to anon,authenticated;
create function public.gka_command(p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select gka_private.command(p_action,p_payload,p_request_id) $$;
revoke all on function public.gka_command(text,jsonb,uuid) from public;
grant execute on function public.gka_command(text,jsonb,uuid) to anon,authenticated;
comment on function public.gka_command(text,jsonb,uuid) is 'Intentionally anonymous operational API per owner preference. Does not identify individual operators.';
-- Existing direct grants retained until frontend cutover. DELETE triggers already
-- protect every legacy table. Run database/cutover.sql when deploying the new UI.
