# Verifikasi pembaruan — 25 September 2026

- Build produksi: lulus (Vite).
- Unit test: 7 lulus; tanggal WIB, libur/Minggu, nominal, biaya admin, pembayaran void, payroll berdasarkan ID, sanitasi CSV.
- Browser: 7 lulus menggunakan data simulasi; desktop dan mobile, kegagalan sebagian tabel, klik ganda, draf antar-tab, dialog keyboard, ekspor XLSX yang dibaca ulang, layout cetak/PDF.
- Regresi database: lulus dalam transaksi rollback; idempotensi, kasbon aktif ganda, pembayaran berlebih, pelunasan atomik, pembatalan kasbon/supplier, larangan hard delete, absensi ganda termasuk setelah rename, rollback payroll gagal, potongan payroll, penguncian periode.
- Akses anonymous RPC: diuji sukses dalam rollback. Backup privat: role anon tidak memiliki SELECT.
- Pemeriksaan data: semua 92 baris asal pada 10 tabel dipertahankan, termasuk seluruh nilai kolom sebelumnya. Kolom baru ditambahkan tanpa mengganti kolom bisnis lama.
- Rekonsiliasi akhir: 0 perbedaan status kasbon terhadap saldo dan 0 perbedaan status supplier terhadap saldo. Tidak ada fixture, payroll, atau audit uji yang tertinggal.
- Supabase security advisor: tidak ada lint pada pemeriksaan setelah migrasi validasi. Ini tidak mengubah fakta bahwa aplikasi sengaja tanpa login.
- Audit dependency produksi: 0 vulnerability yang dilaporkan npm. UUID transitif ExcelJS dipin ke 11.1.1; ekspor XLSX diuji setelah override.
- Screenshot desktop dan mobile ditinjau secara visual. Nominal besar pada kartu mobile diperkecil agar tidak terpotong.

Ekspor Excel di-load melalui dynamic import; bundle ExcelJS sekitar 930 kB sebelum gzip, terpisah dari bundle awal sekitar 201 kB. Vite memberi peringatan ukuran pada chunk ekspor ini; halaman awal tidak perlu mengunduhnya sebelum pengguna menekan Excel.

## Batas penyelesaian

Migrasi additive sudah aktif pada database. Frontend baru tersedia lokal dan belum dipublikasikan. Pencabutan direct table writes (`database/cutover.sql`) harus dijalankan bersamaan dengan publikasi frontend baru. Trigger perlindungan hapus dan validasi pembayaran sudah aktif. Snapshot privat sebelum upgrade bukan backup terjadwal.
