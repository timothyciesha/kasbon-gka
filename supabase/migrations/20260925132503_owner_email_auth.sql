-- Restrict the operational workspace to one authenticated owner email.
-- Additive/auth-only migration: no business rows are changed or removed.
create or replace function public.is_gka_owner()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'timothyciesha@gmail.com'
$$;

revoke all on function public.is_gka_owner() from public, anon;
grant execute on function public.is_gka_owner() to authenticated;

do $$
declare
  t text;
  policy_record record;
begin
  foreach t in array array[
    'drivers', 'kasbons', 'cicilans', 'absens', 'gajian',
    'gajian_detail', 'suppliers', 'supplier_tagihan', 'supplier_bayar',
    'slips', 'attendance_periods', 'payroll_runs', 'payroll_items', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_record.policyname,
        t
      );
    end loop;

    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy owner_read on public.%I for select to authenticated using ((select public.is_gka_owner()))',
      t
    );
  end loop;
end $$;

revoke usage on schema gka_private from anon;
revoke all on function gka_private.command(text, jsonb, uuid) from anon, authenticated;

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
begin
  if lower(coalesce((select auth.jwt() ->> 'email'), '')) <> 'timothyciesha@gmail.com' then
    raise exception 'Akses hanya tersedia untuk owner GKA.';
  end if;

  return gka_private.command(p_action, p_payload, p_request_id);
end
$$;

revoke all on function gka_private.owner_command(text, jsonb, uuid) from public, anon;
grant execute on function gka_private.owner_command(text, jsonb, uuid) to authenticated;

create or replace function public.gka_command(
  p_action text,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select public.is_gka_owner()) then
    raise exception 'Akses hanya tersedia untuk owner GKA.';
  end if;

  return gka_private.owner_command(p_action, p_payload, p_request_id);
end
$$;

revoke all on function public.gka_command(text, jsonb, uuid) from public, anon;
grant execute on function public.gka_command(text, jsonb, uuid) to authenticated;

comment on function public.gka_command(text, jsonb, uuid) is
  'Authenticated GKA owner command API; restricted to timothyciesha@gmail.com.';
