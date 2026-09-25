-- Run against the migrated project. All fixture data and audit entries ROLLBACK.
begin;
do $$
declare e uuid; k uuid; c uuid; s uuid; t uuid; req uuid:=gen_random_uuid(); payload jsonb; first_result jsonb; second_result jsonb; failed boolean; n integer; expected jsonb; emp record; workdays int; absentdays int; run uuid; total_before int;
begin
 payload=jsonb_build_object('name','__TEST__'||req::text,'jabatan','Admin','gaji_pokok',4000000);
 first_result=public.gka_command('employee',payload,req);
 second_result=public.gka_command('employee',payload,req);
 assert first_result=second_result,'Idempotent request failed'; e=(first_result->>'id')::uuid;
 k=(public.gka_command('loan',jsonb_build_object('employee_id',e,'nominal',500000,'tanggal','2026-09-01'),gen_random_uuid())->>'id')::uuid;
 failed=false;begin perform public.gka_command('loan',jsonb_build_object('employee_id',e,'nominal',500000,'tanggal','2026-09-01'),gen_random_uuid());exception when others then failed=true;end;assert failed,'Duplicate active loan accepted';
 failed=false;begin perform public.gka_command('loan_payment',jsonb_build_object('kasbon_id',k,'nominal',500001,'tanggal','2026-09-02'),gen_random_uuid());exception when others then failed=true;end;assert failed,'Overpayment accepted';
 c=(public.gka_command('loan_payment',jsonb_build_object('kasbon_id',k,'nominal',500000,'tanggal','2026-09-02'),gen_random_uuid())->>'id')::uuid;
 assert (select not is_active from public.kasbons where id=k),'Loan status not updated atomically';
 perform public.gka_command('void_payment',jsonb_build_object('id',c,'kind','kasbon','reason','Test reversal'),gen_random_uuid());
 assert (select is_active from public.kasbons where id=k),'Void did not reopen loan';
 assert (select voided_at is not null from public.cicilans where id=c),'Void removed original payment';
 failed=false;begin delete from public.drivers where id=e;exception when others then failed=true;end;assert failed,'Hard delete allowed';
 perform public.gka_command('absence',jsonb_build_object('employee_id',e,'tanggal','2026-09-01','kind','Izin'),gen_random_uuid());
 failed=false;begin perform public.gka_command('absence',jsonb_build_object('employee_id',e,'tanggal','2026-09-01','kind','Sakit'),gen_random_uuid());exception when others then failed=true;end;assert failed,'Duplicate absence accepted';
 perform public.gka_command('employee',jsonb_build_object('id',e,'name','__RENAMED__'||req::text,'jabatan','Admin','gaji_pokok',4000000),gen_random_uuid());
 failed=false;begin perform public.gka_command('absence',jsonb_build_object('employee_id',e,'tanggal','2026-09-01','kind','Sakit'),gen_random_uuid());exception when others then failed=true;end;assert failed,'Renaming bypassed duplicate absence check';
 failed=false;begin perform public.gka_command('loan',jsonb_build_object('employee_id',e,'nominal',500000,'tanggal','2026-09-02'),gen_random_uuid());exception when others then failed=true;end;assert failed,'Renaming bypassed active loan check';
 s=(public.gka_command('supplier',jsonb_build_object('name','__SUPPLIER__'||req::text),gen_random_uuid())->>'id')::uuid;
 t=(public.gka_command('invoice',jsonb_build_object('supplier_id',s,'nominal',100000,'jatuh_tempo','2026-09-30','keterangan','Test'),gen_random_uuid())->>'id')::uuid;
 c=(public.gka_command('supplier_payment',jsonb_build_object('tagihan_id',t,'nominal',100000,'tanggal','2026-09-02'),gen_random_uuid())->>'id')::uuid;
 assert (select is_lunas from public.supplier_tagihan where id=t),'Supplier status not atomic';
 perform public.gka_command('void_payment',jsonb_build_object('id',c,'kind','supplier','reason','Test supplier reversal'),gen_random_uuid());
 assert (select not is_lunas from public.supplier_tagihan where id=t),'Supplier reversal not atomic';
 expected='{}';
 select count(*) into workdays from generate_series('2026-09-01'::date,'2026-09-30'::date,'1 day') dt where extract(dow from dt)<>0;
 for emp in select * from public.drivers where is_active and coalesce(jabatan,'Sopir')<>'Sopir' loop
  select count(distinct tanggal) into absentdays from public.absens where employee_id=emp.id and voided_at is null and to_char(tanggal,'YYYY-MM')='2026-09' and extract(dow from tanggal)<>0;
  expected=expected||jsonb_build_object(emp.id::text,jsonb_build_object('gaji_pokok',coalesce(emp.gaji_pokok,4000000),'hari_kerja',workdays,'hari_absen',absentdays,'tunjangan_hadir',(workdays-absentdays)*70000,'potongan_pinjaman',case when emp.id=e then 100000 else 0 end,'total',coalesce(emp.gaji_pokok,4000000)+(workdays-absentdays)*70000-case when emp.id=e then 100000 else 0 end));
 end loop;
 select count(*) into total_before from public.payroll_runs;
 failed=false;begin perform public.gka_command('payroll',jsonb_build_object('periode','2026-09','tanggal','2026-09-25','holidays','[]'::jsonb,'deductions',jsonb_build_object(e::text,100000),'expected','{}'::jsonb),gen_random_uuid());exception when others then failed=true;end;
 assert failed,'Stale preview accepted';assert (select count(*) from public.payroll_runs)=total_before,'Failed payroll partially persisted';
 run=(public.gka_command('payroll',jsonb_build_object('periode','2026-09','tanggal','2026-09-25','holidays','[]'::jsonb,'deductions',jsonb_build_object(e::text,100000),'expected',expected),gen_random_uuid())->>'id')::uuid;
 assert (select sum(nominal) from public.cicilans where payroll_run_id=run)=100000,'Payroll deduction not persisted';
 assert exists(select 1 from public.attendance_periods where periode='2026-09'),'Payroll did not lock attendance';
 failed=false;begin perform public.gka_command('absence',jsonb_build_object('employee_id',e,'tanggal','2026-09-02','kind','Sakit'),gen_random_uuid());exception when others then failed=true;end;assert failed,'Closed attendance editable';
end $$;
select 'PASS: idempotency, overpayment, atomic settlement, void, no hard delete, duplicate absence, payroll rollback, payroll deduction, period lock' as result;
rollback;
