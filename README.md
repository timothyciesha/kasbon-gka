# GKA Operasional

Aplikasi React + Vite untuk kasbon, absensi, payroll, dan supplier. Versi 2 mempertahankan seluruh tabel dan catatan versi sebelumnya. Aplikasi memakai dark theme permanen dan login passwordless Supabase untuk satu email owner: `timothyciesha@gmail.com`.

## Menjalankan

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:e2e
```

Tes browser memakai Chrome yang terpasang (`channel: chrome`). Bila Chrome belum ada, pasang browser tersebut atau sesuaikan `playwright.config.js` dengan browser pengujian yang tersedia. Semua request database pada tes browser dimock; tidak ada transaksi produksi yang ditulis.

URL dan publishable key project lama menjadi default agar instalasi lama tetap terhubung. Untuk lingkungan lain, salin `.env.example` menjadi `.env.local`. Jangan pernah memasukkan service-role/secret key ke variabel `VITE_*`.

Login menggunakan magic link sekali pakai. Pada login pertama, Supabase membuat akun email owner lalu mengirim link ke inbox. Site URL Supabase harus menunjuk ke URL aplikasi yang dipublikasikan karena link kembali mengikuti konfigurasi Auth tersebut. Sesi divalidasi ke server saat aplikasi dibuka, disimpan oleh client Supabase, dan dapat diakhiri lewat tombol Keluar.

## Struktur

```
src/
  components/  Komponen form, modal, tombol, ekspor dan panel
  hooks/       Pemuatan data, status error, refresh
  lib/         API, fungsi perhitungan murni, ekspor
  pages/       Dashboard, kasbon, absensi, payroll, supplier, aktivitas
  App.jsx      Layout dan koordinasi transaksi
  index.css    Tema, responsive, aksesibilitas, cetak
supabase/migrations/  Perubahan database berversi
database/            Cutover dan panduan operasi
tests/               Unit, browser, regresi database
```

Komponen lama yang tidak dipakai telah dihapus dari source; sejarah kode tetap ada di Git. Tidak ada penghapusan data database.

## Perilaku utama

- Tanggal bisnis selalu WIB. Biaya admin kasbon berdasarkan tanggal transaksi dan tanggal pelunasan terakhir.
- Karyawan menggunakan UUID sebagai relasi. Nama pada catatan lama adalah snapshot historis; perubahan nama tidak memutus relasi.
- Tombol simpan terkunci selama request, setiap request punya UUID idempotensi. Setelah timeout, muat ulang untuk memastikan apakah transaksi sudah tersimpan sebelum mencoba lagi.
- RPC `gka_command` memvalidasi tindakan yang diizinkan, mengunci transaksi, dan menyimpan audit. Pembayaran, saldo, serta status lunas berubah atomik.
- Data keuangan tidak dihapus permanen. Pembayaran/absen dibatalkan dengan alasan. Karyawan dinonaktifkan. Pembayaran payroll final tidak dapat dibatalkan terpisah karena akan merusak slip final.
- Absensi adalah catatan **ketidakhadiran**. Sesuai aturan awal, semua jenis ketidakhadiran pada hari kerja mengurangi tunjangan hadir. Minggu dan tanggal libur yang dipilih tidak dihitung dua kali. Tidak ada kalender libur pemerintah otomatis; operator memilih tanggal libur yang berlaku.
- Payroll adalah snapshot final: gaji pokok dan kehadiran dihitung ulang di server, dibandingkan dengan pratinjau, lalu slip dan cicilan tersimpan bersama. Satu payroll final per periode. Absensi periode final terkunci. Draf bertahan ketika pindah tab, tetapi belum disimpan jika browser direfresh; label pratinjau menjelaskan status ini.
- CSV dapat dibuka di Excel, dan ekspor `.xlsx` asli tersedia pada rekap utama. Slip final dapat dicetak atau disimpan sebagai PDF lewat dialog cetak browser.
- Pemuatan data baru dimulai setelah sesi owner tervalidasi. Tabel dipisahkan dengan error yang terlihat dan paginasi 500 baris. Penyimpanan dinonaktifkan ketika ada data gagal dimuat. Refresh saat kembali ke jendela mengurangi saldo basi; server tetap menjadi sumber kebenaran saat menulis.

## Database dan publikasi

Migrasi tambahan telah diterapkan pada project `kasbon-gka`. Salinan seluruh tabel lama disimpan di `gka_private.upgrade_backup`, tidak dapat dibaca melalui Data API publik. Anonymous tidak lagi memiliki akses tabel atau RPC. Hanya JWT Supabase terautentikasi dengan email owner yang lolos RLS dan command guard. Lihat [panduan database](database/OPERATIONS.md).

Frontend baru **belum dipublikasikan**. Migrasi Auth/RLS sudah aktif, jadi frontend lama yang tidak mengirim sesi login tidak lagi dapat membaca atau menulis database. Publikasikan hasil `npm run build`, lalu pastikan Site URL dan redirect URL Supabase mengarah ke alamat tersebut. `database/cutover.sql` kini hanya dokumentasi defensif; migrasi Auth sudah mencakup pencabutan aksesnya.

## Batas operasional

- Akses dibatasi ke satu email owner. Publishable key tetap boleh ada di frontend; RLS dan pemeriksaan JWT adalah pengamannya. Audit database mencatat perubahan data, sementara identitas login tersedia dari sesi Auth.
- Backup sebelum upgrade adalah snapshot sekali, bukan backup terjadwal atau pengganti backup/PITR penyedia. Jangan mengekspor snapshot privat ke repository.
- Tidak ada tombol membuka kembali payroll final. Koreksi setelah finalisasi perlu alur pembetulan terkontrol; jangan mengubah tabel langsung.
- Nama organisasi dan aturan nominal mengikuti versi sebelumnya. Data default gaji nol dipertahankan, bukan diganti dengan Rp4 juta.
