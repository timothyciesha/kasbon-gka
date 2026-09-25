-- Resolve record fields only inside the matching table branch.
create or replace function gka_private.payment_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare owed bigint; already_paid bigint; loan_date date;
begin
 perform pg_advisory_xact_lock(7192401);
 if tg_op='UPDATE' then
  if old.voided_at is not null or new.voided_at is null or length(trim(coalesce(new.void_reason,'')))<3 or (to_jsonb(new)-'voided_at'-'void_reason')<>(to_jsonb(old)-'voided_at'-'void_reason') then raise exception 'Pembayaran hanya dapat dibatalkan dengan alasan; nominal asli tidak boleh diubah.'; end if;
  if tg_table_name='cicilans' then
   if old.payroll_run_id is not null then raise exception 'Potongan payroll final tidak dapat dibatalkan terpisah.'; end if;
  end if;
  if tg_table_name='cicilans' then
   if exists(select 1 from public.kasbons other join public.kasbons target on target.id=new.kasbon_id where other.employee_id=target.employee_id and other.is_active and other.id<>target.id) then raise exception 'Tidak dapat membuka kasbon lama ketika ada kasbon baru aktif.'; end if;
  end if;
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
