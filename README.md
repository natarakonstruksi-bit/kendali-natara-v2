# KENDALI Natara App V2 — Single Deploy

Ini adalah struktur App terpadu untuk KENDALI Natara.

## Tujuan
Setelah paket ini menjadi root repository `kendali-natara-v2`, perubahan KENDALI tidak lagi dipasang sebagai patch asset satu per satu.
Alurnya menjadi:

**Edit App → Commit GitHub → Build Cloudflare → Migration D1 (jika ada) → Deploy Worker**

Satu commit menghasilkan satu pipeline deploy.

## Struktur
- `app/` = UI KENDALI yang saat ini sudah jadi dan stabil.
- `src/worker.js` = API Cloudflare D1 + R2.
- `src/app-config.js` = konfigurasi App.
- `src/app-overrides.js` = extension point source untuk perubahan baru.
- `scripts/build.mjs` = membangun `public/` otomatis.
- `migrations/` = seluruh migration D1 yang relevan, termasuk 46 proyek dan 23 karyawan.
- `public/` = hasil build; **jangan diedit manual**.

## Catatan penting tentang source lama
File KENDALI awal yang tersedia adalah hasil build/dist, bukan source React asli. Karena itu UI existing dipertahankan sebagai base di `app/` supaya seluruh fungsi/tampilan tidak hilang. Mulai versi ini, perubahan baru dikelola dari source App dan build script. Modul lama dapat dimigrasikan bertahap tanpa mengubah pola deploy lagi.

## Cloudflare Build Settings
Build command:

`npm run build`

Deploy command:

`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

Root directory:

`/`

## Data yang dipertahankan
Paket tetap memakai resource yang sudah aktif:
- Worker: `kendali-natara-v2`
- D1: `kendali-natara-db-v2`
- D1 ID: `04849d77-cb23-4d50-9cfc-4e0d9c542d6b`
- R2: `kendali-natara-files-v2`

Migration import ikut disertakan:
- `0006_import_46_projects.sql`
- `0007_import_23_karyawan.sql`

Migration yang sudah pernah applied akan otomatis dilewati oleh D1.

## Setelah deploy
1. Buka `/api/health`.
2. Buka `/` dan login KENDALI.
3. Pastikan 46 proyek terbaca.
4. Buka Karyawan & Org; 23 karyawan harus tersedia setelah migration 0007 applied.
5. Username karyawan bisa diedit dari form Edit Karyawan.

## Aturan mulai sekarang
Jangan lagi replace file `public/assets/index-HRmtcOom.js` secara manual.
`public/` adalah hasil build. Perubahan dilakukan pada App/source lalu commit satu kali.
