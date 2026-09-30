-- Attendance closes at the payroll payment date, not at calendar month end.
alter table public.payroll_runs
  add column period_start date,
  add column period_end date;

update public.payroll_runs
set period_start = (periode || '-01')::date,
    period_end = tanggal;

alter table public.payroll_runs
  alter column period_start set not null,
  alter column period_end set not null,
  add constraint payroll_runs_date_range_check
    check (period_start <= period_end and period_end = tanggal);

create or replace function gka_private.guard_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payroll_cutoff date;
begin
  perform pg_advisory_xact_lock(7192401);
  if tg_op = 'DELETE' then
    raise exception 'Data tidak boleh dihapus. Gunakan pembatalan atau nonaktifkan.';
  end if;
  if tg_table_name = 'absens' then
    select max(tanggal) into payroll_cutoff from public.payroll_runs;
    if (payroll_cutoff is not null and new.tanggal <= payroll_cutoff)
       or (tg_op = 'UPDATE' and payroll_cutoff is not null and old.tanggal <= payroll_cutoff) then
      raise exception 'Absensi sampai tanggal % sudah masuk payroll final.', payroll_cutoff;
    end if;
    if tg_op = 'INSERT' then
      select id into new.employee_id
      from public.drivers
      where id = new.employee_id or (new.employee_id is null and name = new.driver_name);
    end if;
    if tg_op = 'INSERT' and exists(
      select 1 from public.absens a
      where a.employee_id = new.employee_id
        and a.tanggal = new.tanggal
        and a.voided_at is null
    ) then
      raise exception 'Absen pada tanggal ini sudah tercatat.';
    end if;
    if tg_op = 'UPDATE' and (
      old.voided_at is not null or new.voided_at is null
      or length(trim(coalesce(new.void_reason, ''))) < 3
      or (to_jsonb(new) - 'voided_at' - 'void_reason') <> (to_jsonb(old) - 'voided_at' - 'void_reason')
    ) then
      raise exception 'Catatan absen hanya dapat dibatalkan dengan alasan.';
    end if;
  end if;
  return new;
end
$$;

-- Reopen the legacy month lock so the currently deployed UI can immediately
-- record dates after the latest payroll cutoff.
alter table public.attendance_periods disable trigger gka_guard;
delete from public.attendance_periods where reason = 'Finalisasi payroll';
alter table public.attendance_periods enable trigger gka_guard;

create or replace function gka_private.owner_command(
  p_action text,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved gka_private.requests;
  result jsonb;
  target_employee_id uuid;
  reason text;
  employee public.drivers;
  loan public.kasbons;
  per text;
  trans_date date;
  previous_payroll_date date;
  cycle_start date;
  holidays date[];
  workdays integer;
  absentdays integer;
  deduction bigint;
  allowance bigint;
  salary bigint;
  debt bigint;
  run_id uuid;
  expected jsonb;
  cuts jsonb;
  holiday date;
begin
  if lower(coalesce((select auth.jwt() ->> 'email'), '')) <> 'timothyciesha@gmail.com' then
    raise exception 'Akses hanya tersedia untuk owner GKA.';
  end if;
  if p_action = 'close_attendance' then
    raise exception 'Periode absensi ditutup otomatis berdasarkan tanggal gajian.';
  end if;
  if p_action not in ('employee_delete', 'payroll') then
    return gka_private.command(p_action, p_payload, p_request_id);
  end if;

  perform pg_advisory_xact_lock(7192401);
  if p_request_id is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Permintaan tidak valid.';
  end if;
  select * into saved from gka_private.requests where id = p_request_id;
  if found then
    if saved.action <> p_action or saved.payload <> p_payload then
      raise exception 'Permintaan sebelumnya sudah tersimpan. Muat ulang data.';
    end if;
    return saved.result;
  end if;

  if p_action = 'employee_delete' then
    target_employee_id = nullif(p_payload ->> 'id', '')::uuid;
    reason = trim(coalesce(p_payload ->> 'reason', ''));
    if target_employee_id is null or length(reason) < 3 then
      raise exception 'Alasan penghapusan minimal 3 karakter.';
    end if;
    if exists (
      select 1 from public.kasbons k
      where k.employee_id = target_employee_id and k.is_active
    ) then
      raise exception 'Lunaskan kasbon sebelum menghapus karyawan.';
    end if;
    update public.drivers
    set is_active = false, deleted_at = now(), deleted_reason = reason
    where id = target_employee_id and deleted_at is null;
    if not found then
      raise exception 'Karyawan tidak ditemukan atau sudah dihapus.';
    end if;
    result = jsonb_build_object('id', target_employee_id);
  else
    per = p_payload ->> 'periode';
    trans_date = (p_payload ->> 'tanggal')::date;
    if per !~ '^\d{4}-(0[1-9]|1[0-2])$'
       or to_char(trans_date, 'YYYY-MM') <> per
       or trans_date > (now() at time zone 'Asia/Jakarta')::date then
      raise exception 'Periode atau tanggal payroll tidak valid.';
    end if;
    if exists(select 1 from public.payroll_runs where periode = per) then
      raise exception 'Payroll periode ini sudah final.';
    end if;
    select max(tanggal) into previous_payroll_date from public.payroll_runs;
    if previous_payroll_date is not null and trans_date <= previous_payroll_date then
      raise exception 'Tanggal payroll harus setelah payroll sebelumnya.';
    end if;
    cycle_start = coalesce(previous_payroll_date + 1, (per || '-01')::date);
    select coalesce(array_agg(distinct x::date), '{}')
    into holidays
    from jsonb_array_elements_text(coalesce(p_payload -> 'holidays', '[]')) x;
    foreach holiday in array holidays loop
      if holiday < cycle_start or holiday > trans_date then
        raise exception 'Tanggal libur harus berada dalam siklus payroll.';
      end if;
    end loop;
    select count(*) into workdays
    from generate_series(cycle_start, trans_date, interval '1 day') dt
    where extract(dow from dt) <> 0 and not (dt::date = any(holidays));
    if workdays < 1 then raise exception 'Tidak ada hari kerja.'; end if;
    if not exists(
      select 1 from public.drivers
      where is_active and deleted_at is null and coalesce(jabatan, 'Sopir') <> 'Sopir'
    ) then raise exception 'Tidak ada karyawan payroll.'; end if;
    if (select count(*) from jsonb_object_keys(coalesce(p_payload -> 'expected', '{}')))
       <> (select count(*) from public.drivers where is_active and deleted_at is null and coalesce(jabatan, 'Sopir') <> 'Sopir') then
      raise exception 'Daftar karyawan berubah. Muat ulang pratinjau payroll.';
    end if;
    cuts = coalesce(p_payload -> 'deductions', '{}');
    insert into public.payroll_runs(periode, tanggal, holidays, period_start, period_end)
    values(per, trans_date, holidays, cycle_start, trans_date)
    returning id into run_id;
    for employee in
      select * from public.drivers
      where is_active and deleted_at is null and coalesce(jabatan, 'Sopir') <> 'Sopir'
      order by id for update
    loop
      select count(distinct tanggal) into absentdays
      from public.absens
      where employee_id = employee.id and voided_at is null
        and tanggal between cycle_start and trans_date
        and extract(dow from tanggal) <> 0 and not (tanggal = any(holidays));
      salary = coalesce(employee.gaji_pokok, 4000000);
      allowance = (workdays - absentdays) * 70000;
      deduction = coalesce(nullif(cuts ->> employee.id::text, '')::bigint, 0);
      select * into loan from public.kasbons
      where employee_id = employee.id and is_active
      order by tanggal_kasbon limit 1 for update;
      debt = 0;
      if found then
        select loan.total_potong - coalesce(sum(nominal), 0) into debt
        from public.cicilans where kasbon_id = loan.id and voided_at is null;
      end if;
      if deduction < 0 or deduction > debt or deduction > salary + allowance then
        raise exception 'Potongan % melebihi saldo atau gaji terbaru.', employee.name;
      end if;
      expected = p_payload -> 'expected' -> employee.id::text;
      if expected is null or expected <> jsonb_build_object(
        'gaji_pokok', salary, 'hari_kerja', workdays,
        'hari_absen', absentdays, 'tunjangan_hadir', allowance,
        'potongan_pinjaman', deduction, 'total', salary + allowance - deduction
      ) then
        raise exception 'Data berubah sejak pratinjau. Muat ulang dan periksa payroll kembali.';
      end if;
      insert into public.payroll_items(
        run_id, employee_id, driver_name, jabatan, gaji_pokok,
        hari_kerja, hari_absen, tunjangan_hadir, potongan_pinjaman, total
      ) values (
        run_id, employee.id, employee.name, employee.jabatan, salary,
        workdays, absentdays, allowance, deduction, salary + allowance - deduction
      );
      if deduction > 0 then
        insert into public.cicilans(kasbon_id, nominal, tanggal, note, payroll_run_id)
        values(loan.id, deduction, trans_date, 'Potongan payroll ' || per, run_id);
      end if;
    end loop;
    result = jsonb_build_object(
      'id', run_id, 'period_start', cycle_start, 'period_end', trans_date
    );
  end if;

  insert into gka_private.requests(id, action, payload, result)
  values(p_request_id, p_action, p_payload, result);
  insert into public.audit_log(table_name, record_id, action, after_data)
  values(
    'operations', coalesce(result ->> 'id', p_request_id::text), p_action,
    jsonb_build_object('reason', nullif(reason, ''), 'request_id', p_request_id)
  );
  return result;
end
$$;

revoke all on function gka_private.owner_command(text, jsonb, uuid) from public, anon;
grant execute on function gka_private.owner_command(text, jsonb, uuid) to authenticated;
