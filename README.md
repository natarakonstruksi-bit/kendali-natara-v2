# KENDALI Natara App V2.7 — Login Username + Password

Satu deploy: **Cloudflare Worker** (API) + **Static Assets** (UI KENDALI) + **D1** (data) + **R2** (file).
Login memakai **username + password KENDALI** milik masing-masing user, diverifikasi di Worker (server-side),
dengan sesi cookie HttpOnly. **Cloudflare Access tidak dipakai lagi.**

## Yang berubah dari V2.6 (Cloudflare Access) → V2.7
- Halaman login sendiri di `/login` (dirender Worker, tampilan KENDALI). Tanpa sesi, `/` otomatis ke `/login`.
- `POST /api/auth/login` memverifikasi password di server; hash password **tidak pernah dikirim ke browser**
  (`/rest/v1/users` mengembalikan `password: ""`).
- Form **Karyawan & Org** kembali punya field **Password** (wajib untuk akun baru, min. 6 karakter;
  saat edit kosongkan bila tidak diubah). Email tidak lagi wajib.
- Setiap user bisa mengganti password sendiri di `/ganti-password`.
- Tombol ⏻ (Keluar) menghapus sesi di Worker.
- Pembatasan 8× gagal login per username → tunggu 15 menit.
- Sesi 12 jam, atau 30 hari bila mencentang "Ingat saya". Ganti password memutus sesi lain user tersebut.
- Format hash sama dengan bundle UI (`h1$` + SHA-256 `kendali-natara-v1:` + password), jadi akun/password
  dari build lama tetap berlaku; password plaintext lama otomatis di-upgrade saat login pertama.

## Akun awal
- Username: `admin` — Password: `admin123` (diisi migration 0011 hanya bila password masih kosong).
- **Segera ganti** lewat `/ganti-password` setelah login pertama.
- Karyawan lain ditambahkan Admin/Direktur dari menu **Karyawan & Org → Tambah Karyawan** (isi username + password).
  Reset password karyawan: **Edit** karyawan → isi field Password → Simpan.

## Deploy
```bash
npm install
npx wrangler login
npm run deploy      # = build + migrations remote (termasuk 0011) + wrangler deploy
```
Lewat Git integration (Workers Builds): Build command `npm run build`,
Deploy command `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`.

## Setelah deploy — WAJIB: matikan Cloudflare Access
Kalau Access masih aktif, user harus lolos dua gerbang (OTP email lalu login KENDALI).
Workers & Pages → `kendali-natara-v2` → Settings → Domains & Routes → `workers.dev` → **Access → Disable**
(dan hapus Access Application-nya di Zero Trust → Access → Applications bila ada).

## Verifikasi
- Buka `/` → diarahkan ke `/login`. Login `admin` / `admin123` → dashboard, chip **Tersinkron**.
- `/api/health` → `ok: true`, `app_version: APP-V2.7`, `schema_version: FULL-UI-01`.
- Karyawan & Org → Tambah Karyawan → ada field Password. Login dengan akun baru di jendela private;
  `Pelaksana Lapangan` langsung masuk `#/lapangan`.

## Kondisi data awal (setelah semua migration)
- 46 proyek terimpor; `pmUsername`/`pengawasUsername` merujuk username:
  `sayyidtriwardhana`, `muhammadhilalp765`, `dzuljob`, `aanmks0326`, `anasmunandar18`, `muhammadfadhly300`,
  `nurulfadli00`, `muhammdnurfikry`, `raikah536`, `muhammadsyawal26001`, `muhzulfikarf14`.
  Gunakan username yang sama saat menginput karyawan agar penugasan proyek tersambung.
- Migration 0007 mengimpor 23 karyawan, 0010 menghapusnya lagi (keputusan "input manual").
  Kalau ingin 23 karyawan langsung ada, hapus `migrations/0010_clear_imported_karyawan.sql` **sebelum** migrasi remote
  pertama; mereka tetap perlu diberi password oleh Admin (Edit → Password) sebelum bisa login.

## Struktur
- `src/worker.js` — Worker (auth, adapter D1/R2, health, diagnostics)
- `src/pages.js` — HTML `/login` dan `/ganti-password`
- `src/app-config.js`, `src/app-overrides.js` — layer tambahan di atas bundle UI (penjaga sesi)
- `app/` — bundle UI (`assets/index-KNDLv27a.js` = bundle asli yang dipatch `scripts/patch-bundle.mjs`)
- `scripts/check.mjs` (preflight), `scripts/build.mjs` (app/ → public/), `scripts/patch-bundle.mjs`
- `migrations/` — D1; `0011_username_password_login.sql` = tabel sesi + password admin awal
- `docs/legacy/` — dokumen & worker versi sebelumnya (tidak dipakai)

## Route Worker
| Route | Keterangan |
|---|---|
| `GET /login`, `GET /ganti-password` | halaman HTML |
| `POST /api/auth/login` | `{username,password,remember}` → cookie `kendali_session` |
| `GET/POST /api/auth/logout` | hapus sesi |
| `POST /api/auth/change-password` | `{oldPassword,newPassword}` |
| `GET /api/auth/me`, `/api/access/session` | sesi → user (dipakai bundle UI) |
| `GET /api/health` | status layanan (publik) |
| `GET /api/diagnostics` | Admin/Direktur |
| `/rest/v1/:collection` | adapter PostgREST → D1 (butuh sesi) |
| `/storage/v1/object/...` | adapter Storage → R2 (butuh sesi) |
| `/auth/v1/*`, `/api/broadcast/*` | dimatikan |
| lainnya | static assets + fallback SPA |

## Testing lokal
```bash
npm run dev          # build + migration lokal + wrangler dev → http://localhost:8787/login
```
