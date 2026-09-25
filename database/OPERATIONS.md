# Operasi database

## Migrasi additive

1. `20260925032656_preserve_data_operations.sql`: backup privat, UUID karyawan, kolom void/aktif, payroll, audit, RPC, trigger validasi dan anti-delete.
2. `20260925034247_strengthen_validation.sql`: kasus perubahan nama, pembatalan supplier, dan validasi pratinjau payroll.
3. `20260925034704_supplier_reversal_guard.sql`: mengisolasi akses kolom khusus kasbon agar pembatalan supplier berjalan benar.
4. `20260925132503_owner_email_auth.sql`: menutup seluruh akses anon, memberi read-only table grants kepada role authenticated, menerapkan RLS email owner, dan membatasi command RPC kepada `timothyciesha@gmail.com`.

Tidak ada `DROP TABLE`, `TRUNCATE`, penghapusan baris, atau reset database. Kolom bisnis lama dipertahankan. Backfill hanya mengisi kolom UUID baru dari kecocokan nama yang sudah ada.

Snapshot sebelum migrasi: 11 drivers, 16 kasbons, 43 cicilans, 2 absens, 6 gajian, 2 suppliers, 3 supplier_tagihan, 9 supplier_bayar; gajian_detail dan slips kosong. Setelah migrasi, verifikasi membandingkan setiap objek baris backup dengan nilai kolom asal pada tabel aktif (JSON containment). Seluruh 10 tabel cocok.

## Setelah frontend baru dipublikasikan

Atur Supabase Auth Site URL ke URL produksi dan tambahkan URL preview/development hanya jika memang diperlukan. Magic link hanya dapat kembali ke URL yang diizinkan. Migrasi Auth sudah mencabut akses aplikasi lama; `cutover.sql` dipertahankan sebagai helper defensif dan tidak diperlukan lagi untuk migrasi yang sudah aktif. Jangan menambah kembali grant anon atau grant DELETE untuk menyiasati trigger.

## Pengujian database

`tests/database-regression.sql` menggunakan transaksi yang diakhiri `ROLLBACK`. Pengujian menambahkan fixture sementara, lalu memeriksa idempotensi, saldo, pembayaran, pembatalan, payroll, dan penguncian absensi. Untuk eksekusi ulang di masa depan, sesuaikan periode fixture agar belum memiliki payroll final dan gunakan tanggal yang sudah terjadi. Tidak ada fixture yang tersisa setelah tes sukses. Jika tool/koneksi terputus di tengah transaksi, pastikan transaksi dibatalkan sebelum melanjutkan.

## Pemulihan

Snapshot ada di `gka_private.upgrade_backup`, satu baris per tabel dengan array JSON asli dan waktu pengambilan. Schema privat tidak diekspos oleh REST dan tidak diberi SELECT kepada anon/authenticated. Pemulihan harus dilakukan oleh administrator: bandingkan ID serta kolom, pulihkan hanya catatan yang benar-benar hilang secara terkontrol, dan verifikasi saldo. Jangan menimpa perubahan operasional baru dengan snapshot lama; jangan menjalankan seed/reset.

## Akses owner

`public.gka_command` adalah wrapper SECURITY INVOKER yang memeriksa email JWT, lalu memanggil dispatcher privat. Dispatcher privat mengulang pemeriksaan email sebelum menjalankan command tervalidasi. Semua identifier tabel/SQL tetap statis; payload tidak dipakai sebagai SQL. Role anon tidak memiliki akses tabel maupun RPC. Role authenticated hanya mendapat SELECT melalui RLS email owner dan tidak mendapat direct table writes.

Audit hanya append melalui trigger/fungsi; owner hanya dapat membaca. Snapshot backup dan idempotency ledger tidak diberi hak baca client. Tidak ada service-role key di frontend.
