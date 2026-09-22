# QA Matrix — KENDALI Natara V3.4.1

Release ini menambah pemeriksaan otomatis untuk mencegah regresi tombol, role, workflow, dan konfigurasi deploy.

## Cakupan yang diperiksa otomatis

| Area | Skenario | Hasil yang diharapkan |
|---|---|---|
| Role/Jabatan | Dropdown karyawan baru | Hanya jabatan baru; `Head Operational` tidak muncul |
| Legacy role | Akun lama `Head Operational` | Backend tetap memetakan ke `Head of Operational` |
| Tugas Saya | Open / claim / start / open | Tombol tersedia dan terikat ke handler |
| Progress | DRAFT → PM → Head of Operational | Tombol handoff sesuai status tersedia |
| Opname | DRAFT → Head of Engineering → Admin Teknik | Tombol submit / verify / close tersedia |
| CCO | Field → Admin → QS → Admin/Client → Addendum | Endpoint action + task sync tersedia |
| Procurement | PR submit → vendor comparison → vendor decision → order → receive | Tombol dan endpoint tersedia |
| Pengajuan Dana | Pending → approve/reject → paid | Endpoint dan task handoff tersedia |
| QC Continuous | Tambah sub-pekerjaan, foto, hasil, hapus, publish finding | Tombol + binding frontend tersedia |
| QC Finding | Start → submit fix → verify / revision | Tombol dan endpoint tersedia |
| ATI | Pengajuan pekerjaan + masalah lapangan | Tombol workflow tersedia |
| Laporan QC/ATI | Mingguan/Bulanan → Head Unit Bisnis | Create, detail, review tersedia |
| Gate Proyek | QC/CCO/Finance/Closeout | Engine flow membaca blocker dan continuous QC |
| Database | Migration 0011–0019 | Fresh schema dan upgrade-preservation diuji lokal |
| Config | D1/R2 production binding | Tidak ada placeholder |
| Frontend | Syntax + runtime smoke | Tidak ada white-screen startup error yang terdeteksi |

## Yang tetap perlu dites setelah deploy

Upload nyata ke R2, cookie/session Cloudflare, permission D1 produksi, ukuran file besar, koneksi jaringan, dan perilaku browser/mobile harus dites di deployment nyata. QA source/build tidak dapat membuktikan kondisi eksternal tersebut 100% sebelum deploy.
