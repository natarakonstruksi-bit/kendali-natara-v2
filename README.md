# KENDALI Natara App V2.6.1 — Single Login Cloudflare Access

Satu deploy: **Cloudflare Worker** (API) + **Static Assets** (UI KENDALI) + **D1** (data) + **R2** (file).
Login hanya lewat **Cloudflare Access** (email). Tidak ada lagi username/password KENDALI.

## Perbaikan V2.6.1 (agar bisa deploy)
- `src/worker.js` ditulis ulang: versi sebelumnya rusak secara sintaks (string terpotong, fungsi tidak ditutup,
  `export default` menutup terlalu cepat, kode mati setelahnya) dan membaca token dari tabel `app_access_tokens`
  yang tidak pernah ada di migration. Sekarang identitas diambil dari header Cloudflare Access
  (`Cf-Access-Authenticated-User-Email`) lalu dicocokkan ke master karyawan di D1 (email, status Aktif).
- Parser filter `in.(...)` diperbaiki (versi lama memotong tanda kurung sehingga hapus data gagal).
- Upload file dari aplikasi (supabase-js mengirim multipart dengan field bernama kosong) sebelumnya gagal 500
  di runtime Workers; sekarang diparse manual dan disimpan ke R2. Duplikat tanpa `upsert` → 409 seperti Supabase.
- Sinkronisasi ratusan record dipecah per 50 statement D1.
- `wrangler.jsonc`: `run_worker_first` untuk `/api/*`, `/rest/*`, `/storage/*`, `/auth/*` supaya endpoint API
  tidak pernah tertukar dengan fallback SPA (`index.html`), plus `migrations_dir` dan observability.
- `scripts/check.mjs` memuat `src/worker.js` saat preflight, jadi worker yang rusak langsung ketahuan sebelum deploy.
- Dokumen lama (CF-02/CF-03/README-FULL) dan worker lama dipindah ke `docs/legacy/` agar tidak membingungkan.
- Endpoint `/api/auth/me` dipertahankan sebagai alias `/api/access/session`.

## Alur login
1. User membuka KENDALI → Cloudflare Access meminta email (OTP / IdP).
2. Worker membaca email dari Access dan mencocokkan ke `app_records` (collection `users`).
3. Email harus terdaftar dan `status = Aktif`; role legacy/kosong ditolak oleh UI.
4. `Pelaksana Lapangan` otomatis masuk Mode Lapangan (`#/lapangan`).
5. Logout KENDALI = logout Cloudflare Access (`/cdn-cgi/access/logout`).

## Kondisi data awal (setelah semua migration)
- 46 proyek terimpor (`NK-IMP-001` … `NK-IMP-046`), 46 punya `pmUsername`, 24 punya `pengawasUsername`.
- **Hanya satu user**: `admin` / `natarakonstruksi@gmail.com` (role Admin).
  Migration `0007_import_23_karyawan.sql` memang mengimpor 23 karyawan, tetapi `0010_clear_imported_karyawan.sql`
  menghapusnya lagi — sesuai keputusan "karyawan diinput manual lewat menu Karyawan".
- Agar link proyek ↔ karyawan (`pmUsername`, `pengawasUsername`) tersambung, pakai **username yang sama** dengan yang
  dirujuk migration 0008 saat menginput karyawan: `sayyidtriwardhana`, `muhammadhilalp765`, `dzuljob`, `aanmks0326`,
  `anasmunandar18`, `muhammadfadhly300`, `nurulfadli00`, `muhammdnurfikry`, `raikah536`, `muhammadsyawal26001`, `muhzulfikarf14`.
  Daftar email lengkap ada di `CLOUDFLARE-ACCESS-EMAILS.txt`.
- Jika ternyata 23 karyawan itu ingin **tetap terimpor**, hapus file `migrations/0010_clear_imported_karyawan.sql`
  **sebelum** menjalankan migration di remote (migration yang sudah dijalankan tidak bisa di-undo otomatis).

## Deploy (dari komputer lokal)
```bash
npm install
npx wrangler login
npm run deploy      # = build + migrations remote + wrangler deploy
```
Pastikan D1 `kendali-natara-db-v2` (id di wrangler.jsonc) dan R2 bucket `kendali-natara-files-v2` sudah ada di akun.

## Deploy lewat Git integration (Workers Builds)
- Build command: `npm run build`
- Deploy command: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`
- Root directory: `/`

## Setelah deploy — WAJIB: aktifkan Cloudflare Access
Workers & Pages → `kendali-natara-v2` → Settings → Domains & Routes → workers.dev → **Access → Enable**
(atau buat Access Application untuk domain kustomnya).

Policy:
- Action: **Allow**
- Include: **Emails** → isi dari `CLOUDFLARE-ACCESS-EMAILS.txt` (minimal `natarakonstruksi@gmail.com`)
- Login method: One-time PIN (OTP) bila email staf bukan anggota akun Cloudflare
- **JANGAN** memakai `Include Everyone`.

Tanpa Access, semua endpoint data menjawab `401 UNAUTHORIZED` — ini disengaja.

### Opsional: verifikasi JWT ketat
Isi variabel di Settings → Variables:
- `ACCESS_TEAM_DOMAIN` = `<team>.cloudflareaccess.com`
- `ACCESS_AUD` = Application Audience (AUD) Tag dari Access application tersebut

Bila keduanya terisi, Worker memverifikasi tanda tangan JWT Access (bukan hanya header email).

## Verifikasi
- `/api/health` → `ok: true`, `schema_version: FULL-UI-01`, `projects: 46`, `users: 1`
- `/app-build.json` → `APP-V2.6`
- Buka `/` → tidak ada form username/password; setelah Access, langsung "Masuk sebagai Administrator".
- `/api/diagnostics` (Admin/Direktur) → ringkasan schema_meta, jumlah record per collection, audit sync.

## Testing lokal
```bash
cp .dev.vars.example .dev.vars   # DEV_ACCESS_EMAIL hanya berlaku di localhost
npm run dev                      # build + migration lokal + wrangler dev
```

## Route Worker
| Route | Keterangan |
|---|---|
| `GET /api/health` | status layanan (publik, tanpa data sensitif) |
| `GET /api/access/session`, `/api/auth/me` | identitas Access → user KENDALI |
| `GET /api/diagnostics` | Admin/Direktur saja |
| `GET/POST/DELETE /rest/v1/:collection` | adapter PostgREST → D1 `app_records` |
| `GET/HEAD/POST/PUT/DELETE /storage/v1/object/...` | adapter Supabase Storage → R2 (`kendali-files`) |
| `/auth/v1/*`, `/api/broadcast/*` | dimatikan (Supabase lama) |
| lainnya | static assets + fallback SPA |
