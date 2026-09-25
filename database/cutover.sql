-- Apply ONLY together with publishing the new frontend. The former UI writes
-- tables directly and will no longer be able to submit transactions after this.
-- No rows are removed. Anonymous read + validated commands remain available.
begin;
do $$ declare t text; begin
 foreach t in array array['drivers','kasbons','cicilans','absens','gajian','gajian_detail','suppliers','supplier_tagihan','supplier_bayar','slips'] loop
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from anon,authenticated',t);
 end loop;
end $$;
commit;
