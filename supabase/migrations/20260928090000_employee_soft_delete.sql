-- Hide removed employees while preserving every financial and payroll record.
alter table public.drivers
  add column deleted_at timestamptz,
  add column deleted_reason text,
  add constraint drivers_deleted_reason_check check (
    deleted_at is null or length(trim(coalesce(deleted_reason, ''))) >= 3
  );

drop policy if exists owner_read on public.drivers;
create policy owner_read on public.drivers
for select to authenticated
using ((select public.is_gka_owner()) and deleted_at is null);

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
begin
  if lower(coalesce((select auth.jwt() ->> 'email'), '')) <> 'timothyciesha@gmail.com' then
    raise exception 'Akses hanya tersedia untuk owner GKA.';
  end if;

  if p_action <> 'employee_delete' then
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
  set is_active = false,
      deleted_at = now(),
      deleted_reason = reason
  where id = target_employee_id and deleted_at is null;
  if not found then
    raise exception 'Karyawan tidak ditemukan atau sudah dihapus.';
  end if;

  result = jsonb_build_object('id', target_employee_id);
  insert into gka_private.requests(id, action, payload, result)
  values (p_request_id, p_action, p_payload, result);
  insert into public.audit_log(table_name, record_id, action, after_data)
  values (
    'operations', target_employee_id::text, p_action,
    jsonb_build_object('reason', reason, 'request_id', p_request_id)
  );
  return result;
end
$$;

revoke all on function gka_private.owner_command(text, jsonb, uuid) from public, anon;
grant execute on function gka_private.owner_command(text, jsonb, uuid) to authenticated;

comment on column public.drivers.deleted_at is
  'Soft deletion marker. Historical transactions remain intact.';
