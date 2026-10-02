-- Track withdrawals of collected admin fees without changing loan history.
create table public.admin_fee_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount bigint not null check (amount > 0),
  reason text not null check (length(trim(reason)) >= 3),
  withdrawn_at timestamptz not null default now(),
  request_id uuid not null unique
);

alter table public.admin_fee_withdrawals enable row level security;
revoke all on table public.admin_fee_withdrawals from anon, authenticated;
grant select on table public.admin_fee_withdrawals to authenticated;
create policy owner_read on public.admin_fee_withdrawals
for select to authenticated
using ((select public.is_gka_owner()));

create or replace function gka_private.admin_fee_withdrawals_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Riwayat pengambilan biaya admin tidak dapat diubah atau dihapus.';
end
$$;

create trigger admin_fee_withdrawals_immutable
before update or delete on public.admin_fee_withdrawals
for each row execute function gka_private.admin_fee_withdrawals_immutable();

create or replace function gka_private.collected_admin_fees()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with loan_payments as (
    select
      k.id,
      k.nominal::bigint as principal,
      coalesce(k.fee, 0)::bigint as fee,
      coalesce(sum(c.nominal) filter (where c.voided_at is null), 0)::bigint as paid
    from public.kasbons k
    left join public.cicilans c on c.kasbon_id = k.id
    group by k.id
  )
  select coalesce(
    sum(least(fee, greatest(paid - principal, 0))),
    0
  )::bigint
  from loan_payments
$$;

revoke all on function gka_private.collected_admin_fees() from public, anon, authenticated;

create or replace function gka_private.admin_fee_withdrawal_command(
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
  withdrawal_id uuid;
  withdrawal_reason text;
  collected bigint;
  withdrawn bigint;
  available bigint;
begin
  if lower(coalesce((select auth.jwt() ->> 'email'), '')) <> 'timothyciesha@gmail.com' then
    raise exception 'Akses hanya tersedia untuk owner GKA.';
  end if;

  perform pg_advisory_xact_lock(7192401);
  if p_request_id is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Permintaan tidak valid.';
  end if;

  select * into saved from gka_private.requests where id = p_request_id;
  if found then
    if saved.action <> 'admin_fee_withdrawal' or saved.payload <> p_payload then
      raise exception 'Permintaan sebelumnya sudah tersimpan. Muat ulang data.';
    end if;
    return saved.result;
  end if;

  withdrawal_reason = trim(coalesce(p_payload ->> 'reason', ''));
  if length(withdrawal_reason) < 3 then
    raise exception 'Catatan pengambilan minimal 3 karakter.';
  end if;

  collected = gka_private.collected_admin_fees();
  select coalesce(sum(amount), 0)::bigint
  into withdrawn
  from public.admin_fee_withdrawals;
  available = greatest(collected - withdrawn, 0);
  if available < 1 then
    raise exception 'Tidak ada saldo biaya admin yang dapat diambil.';
  end if;

  insert into public.admin_fee_withdrawals(amount, reason, request_id)
  values(available, withdrawal_reason, p_request_id)
  returning id into withdrawal_id;

  result = jsonb_build_object('id', withdrawal_id, 'amount', available);
  insert into gka_private.requests(id, action, payload, result)
  values(p_request_id, 'admin_fee_withdrawal', p_payload, result);
  insert into public.audit_log(table_name, record_id, action, after_data)
  values(
    'admin_fee_withdrawals', withdrawal_id::text, 'admin_fee_withdrawal',
    jsonb_build_object(
      'amount', available,
      'reason', withdrawal_reason,
      'request_id', p_request_id
    )
  );
  return result;
end
$$;

revoke all on function gka_private.admin_fee_withdrawal_command(jsonb, uuid)
from public, anon;
grant execute on function gka_private.admin_fee_withdrawal_command(jsonb, uuid)
to authenticated;

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

  if p_action = 'admin_fee_withdrawal' then
    return gka_private.admin_fee_withdrawal_command(p_payload, p_request_id);
  end if;
  return gka_private.owner_command(p_action, p_payload, p_request_id);
end
$$;

revoke all on function public.gka_command(text, jsonb, uuid) from public, anon;
grant execute on function public.gka_command(text, jsonb, uuid) to authenticated;

comment on table public.admin_fee_withdrawals is
  'Append-only history of collected admin-fee cash withdrawals.';
