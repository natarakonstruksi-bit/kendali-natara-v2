# KENDALI Natara App V2.5.1 — Hotfix Halaman Karyawan

Hotfix ini memperbaiki layar putih pada `/users` setelah V2.5.

## Perbaikan
- `users` dan `projects` diberi default array agar halaman tidak crash saat data masih memuat.
- Matcher penugasan proyek dibuat lebih defensif terhadap data kosong/legacy.
- Navigasi dari tab Penugasan Proyek tidak lagi bergantung pada hook tambahan.
- Nama/role/key yang kosong diberi fallback aman.
- Ditambahkan runtime error overlay agar jika ada error tampilan berikutnya tidak lagi hanya layar putih.
- Fitur V2.5 tetap dipertahankan:
  - tab Penugasan Proyek,
  - kolom PM/Superintendent dan Pelaksana di Master,
  - username editable,
  - project assignment V2.4,
  - 46 proyek + 23 karyawan.

## Deploy
Replace seluruh isi repo dengan paket ini, commit sekali ke `main`.

Build:
`npm run build`

Deploy:
`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

Tidak ada migration baru.

## Verifikasi
- `/app-build.json` → APP-V2.5.1
- `/users` tidak boleh blank.
- Tab Daftar Karyawan, Penugasan Proyek, Struktur Organisasi, dan Role Legacy harus bisa dibuka.
