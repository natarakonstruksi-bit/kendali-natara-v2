# KENDALI Natara App V2.5 — Karyawan & Project Assignment UI

Baseline ini melanjutkan V2.4 dan tetap memakai single App / single deploy.

## Fitur baru
- Menu **Karyawan & Org** sekarang punya tab **Penugasan Proyek**.
- Administrator dapat melihat proyek yang dipegang masing-masing karyawan.
- Nama proyek pada tab Penugasan dapat diklik untuk membuka detail proyek.
- Tombol **Atur dari Master Proyek** membuka Master Data.
- Master Data Proyek sekarang langsung menampilkan:
  - Superintendent / PM
  - username PM
  - Pelaksana
  - username Pelaksana
- Edit Proyek tetap memakai dropdown akun aktif untuk PM/Superintendent dan Pelaksana.
- User Nonaktif tetap tidak bisa login.
- Username tetap bisa diedit dan cascade assignment tetap aktif.

## Tidak ada migration baru
V2.5 adalah peningkatan UI di atas data D1 V2.4.

## Deploy
Build:
`npm run build`

Deploy:
`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

## Verifikasi
- `/app-build.json` → `APP-V2.5`
- Buka `/users` → ada tab **Penugasan Proyek**
- Buka `/master` → tabel menampilkan **Superintendent / PM** dan **Pelaksana**
