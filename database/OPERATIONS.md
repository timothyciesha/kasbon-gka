# Operasi database

## Migrasi additive

1. `20260925032656_preserve_data_operations.sql`: backup privat, UUID karyawan, kolom void/aktif, payroll, audit, RPC, trigger validasi dan anti-delete.
2. `20260925034247_strengthen_validation.sql`: kasus perubahan nama, pembatalan supplier, dan validasi pratinjau payroll.
3. `20260925034704_supplier_reversal_guard.sql`: mengisolasi akses kolom khusus kasbon agar pembatalan supplier berjalan benar.

Tidak ada `DROP TABLE`, `TRUNCATE`, penghapusan baris, atau reset database. Kolom bisnis lama dipertahankan. Backfill hanya mengisi kolom UUID baru dari kecocokan nama yang sudah ada.

Snapshot sebelum migrasi: 11 drivers, 16 kasbons, 43 cicilans, 2 absens, 6 gajian, 2 suppliers, 3 supplier_tagihan, 9 supplier_bayar; gajian_detail dan slips kosong. Setelah migrasi, verifikasi membandingkan setiap objek baris backup dengan nilai kolom asal pada tabel aktif (JSON containment). Seluruh 10 tabel cocok.

## Setelah frontend baru dipublikasikan

Jalankan `cutover.sql` melalui akses administrator database. Skrip hanya mencabut write langsung dari role client; read dan RPC tetap tersedia. Jangan jalankan saat aplikasi lama masih harus dipakai karena aplikasi lama menulis tabel langsung. Jangan menambah kembali grant DELETE untuk menyiasati trigger.

## Pengujian database

`tests/database-regression.sql` menggunakan transaksi yang diakhiri `ROLLBACK`. Pengujian menambahkan fixture sementara, lalu memeriksa idempotensi, saldo, pembayaran, pembatalan, payroll, dan penguncian absensi. Untuk eksekusi ulang di masa depan, sesuaikan periode fixture agar belum memiliki payroll final dan gunakan tanggal yang sudah terjadi. Tidak ada fixture yang tersisa setelah tes sukses. Jika tool/koneksi terputus di tengah transaksi, pastikan transaksi dibatalkan sebelum melanjutkan.

## Pemulihan

Snapshot ada di `gka_private.upgrade_backup`, satu baris per tabel dengan array JSON asli dan waktu pengambilan. Schema privat tidak diekspos oleh REST dan tidak diberi SELECT kepada anon/authenticated. Pemulihan harus dilakukan oleh administrator: bandingkan ID serta kolom, pulihkan hanya catatan yang benar-benar hilang secara terkontrol, dan verifikasi saldo. Jangan menimpa perubahan operasional baru dengan snapshot lama; jangan menjalankan seed/reset.

## Akses tanpa login

`public.gka_command` adalah wrapper SECURITY INVOKER menuju fungsi terbatas di schema privat. Fungsi privat memakai SECURITY DEFINER secara sengaja untuk menyediakan operasi yang ditentukan, setelah write tabel langsung dicabut. Semua identifier tabel/SQL tetap statis; payload tidak dipakai sebagai SQL. Akses RPC anonim adalah keputusan produk, bukan autentikasi. Role anon dapat menulis melalui operasi ini; aplikasi tidak mengklaim adanya owner/admin/viewer.

Audit hanya append melalui trigger/fungsi; role client hanya dapat membaca. Snapshot backup dan idempotency ledger tidak diberi hak baca client. Tidak ada service-role key di frontend.
