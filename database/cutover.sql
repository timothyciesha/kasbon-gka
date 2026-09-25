-- Historical cutover helper. Migration 20260925132503_owner_email_auth.sql now
-- supersedes this file and revokes every anonymous table/API permission.
-- No rows are removed.
begin;
do $$ declare t text; begin
 foreach t in array array['drivers','kasbons','cicilans','absens','gajian','gajian_detail','suppliers','supplier_tagihan','supplier_bayar','slips','attendance_periods','payroll_runs','payroll_items','audit_log'] loop
  execute format('revoke all on public.%I from anon',t);
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from authenticated',t);
 end loop;
end $$;
revoke all on function public.gka_command(text,jsonb,uuid) from anon;
commit;
