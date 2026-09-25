-- Additional validation; no business rows are changed.
create or replace function gka_private.guard_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(7192401);
  if tg_op='DELETE' then raise exception 'Data tidak boleh dihapus. Gunakan pembatalan atau nonaktifkan.'; end if;
  if tg_table_name='absens' then
    if exists(select 1 from public.attendance_periods where periode=to_char(new.tanggal,'YYYY-MM')) or (tg_op='UPDATE' and exists(select 1 from public.attendance_periods where periode=to_char(old.tanggal,'YYYY-MM'))) then raise exception 'Periode absensi sudah ditutup.'; end if;
    if tg_op='INSERT' then select id into new.employee_id from public.drivers where id=new.employee_id or (new.employee_id is null and name=new.driver_name); end if;
    if tg_op='INSERT' and exists(select 1 from public.absens a where a.employee_id=new.employee_id and a.tanggal=new.tanggal and a.voided_at is null) then raise exception 'Absen pada tanggal ini sudah tercatat.'; end if;
    if tg_op='UPDATE' and (old.voided_at is not null or new.voided_at is null or length(trim(coalesce(new.void_reason,'')))<3 or (to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason')) then raise exception 'Catatan absen hanya dapat dibatalkan dengan alasan.'; end if;
  end if;
  return new;
end $$;

create or replace function gka_private.payment_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare owed bigint; already_paid bigint; loan_date date;
begin
 perform pg_advisory_xact_lock(7192401);
 if tg_op='UPDATE' then
  if old.voided_at is not null or new.voided_at is null or length(trim(coalesce(new.void_reason,'')))<3 or (to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason') then raise exception 'Pembayaran hanya dapat dibatalkan dengan alasan; nominal asli tidak boleh diubah.'; end if;
  if tg_table_name='cicilans' then
   if old.payroll_run_id is not null then raise exception 'Potongan payroll final tidak dapat dibatalkan terpisah.'; end if;
  end if;
  if tg_table_name='cicilans' and exists(select 1 from public.kasbons other join public.kasbons target on target.id=new.kasbon_id where other.employee_id=target.employee_id and other.is_active and other.id<>target.id) then raise exception 'Tidak dapat membuka kasbon lama ketika ada kasbon baru aktif.'; end if;
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

create or replace function gka_private.command(p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if (select count(*) from jsonb_object_keys(coalesce(p_payload->'expected','{}')))<>(select count(*) from public.drivers where is_active and coalesce(jabatan,'Sopir')<>'Sopir') then raise exception 'Daftar karyawan berubah. Muat ulang pratinjau payroll.'; end if;
  insert into public.payroll_runs(periode,tanggal,holidays) values(per,trans_date,holidays) returning id into run_id;
  for employee in select * from public.drivers where is_active and coalesce(jabatan,'Sopir')<>'Sopir' order by id for update loop
   select count(distinct tanggal) into absentdays from public.absens where employee_id=employee.id and voided_at is null and to_char(tanggal,'YYYY-MM')=per and extract(dow from tanggal)<>0 and not(tanggal=any(holidays));
   salary=coalesce(employee.gaji_pokok,4000000); allowance=(workdays-absentdays)*70000; deduction=coalesce(nullif(cuts->>employee.id::text,'')::bigint,0);
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

