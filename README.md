# KENDALI Natara App V2.3 — Single App / Single Deploy

Versi ini menggabungkan kondisi KENDALI terbaru dalam satu struktur aplikasi.

## Sudah termasuk
- UI KENDALI existing.
- Backend Cloudflare Worker.
- Database Cloudflare D1.
- File Cloudflare R2.
- 46 proyek dari DATA PROYEK + Keuangan PROYEK.
- Import 23 karyawan.
- Username karyawan bisa diubah.
- Perubahan username mengikuti relasi atasan dan assignment proyek.
- `/app-build.json` dijawab langsung oleh Worker.
- `/api/health` menampilkan jumlah proyek dan karyawan.
- `/api/diagnostics` untuk melihat versi import dan jumlah data per collection.
- Build preflight mencegah regresi koneksi Supabase/username terkunci.

## Konsep mulai sekarang
Tidak ada lagi patch manual ke `public/assets`.

Alur pengembangan:
`ubah source -> commit GitHub -> Cloudflare build -> deploy`

Folder `public/` adalah HASIL BUILD dan akan dibuat ulang otomatis.

## Cloudflare Builds
Build command:
`npm run build`

Deploy command:
`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

Root:
`/`

## Verifikasi
`/app-build.json`
harus menampilkan `APP-V2.3` dan `singleDeploy: true`.

`/api/health`
harus menampilkan minimal:
- `imported_projects: 46`
- `imported_employees: 23` setelah migration karyawan sudah applied
- `d1_binding: true`
- `r2_binding: true`

## Upload
Untuk paling aman, replace seluruh isi repository dengan isi folder paket ini lalu commit sekali ke `main`.
Migration yang sudah pernah applied tidak akan dijalankan ulang.
