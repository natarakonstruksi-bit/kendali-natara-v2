# KENDALI Natara App V2.6 — Single Login Cloudflare Access

V2.6 menghapus login username/password KENDALI dari alur pengguna.

## Alur baru
1. User membuka KENDALI.
2. Cloudflare Access meminta email.
3. User menerima/verifikasi login sesuai metode Access.
4. Worker membaca `ctx.access.getIdentity()`.
5. Email dicocokkan dengan master karyawan di D1.
6. Jika user Aktif dan role valid, KENDALI masuk otomatis sesuai role.
7. Pelaksana Lapangan otomatis ke Mode Lapangan.

## Keamanan
- Endpoint data `/rest/v1/*` dan file `/storage/v1/*` sekarang juga memerlukan email Access yang terdaftar dan Aktif di KENDALI.
- Email Access yang tidak ada di database KENDALI tidak dapat membaca data.
- Diagnostics hanya untuk Admin/Direktur.
- Logout KENDALI sekaligus logout dari Cloudflare Access.

## Migration baru
`migrations/0009_cloudflare_access_sso.sql`
- memastikan `natarakonstruksi@gmail.com` menjadi Administrator utama;
- memindahkan role legacy `Estimator` ke `Senior Estimator`.

## Penting — Cloudflare Access
File `CLOUDFLARE-ACCESS-EMAILS.txt` berisi email yang sudah tersedia dari database karyawan.

Setelah deploy, ubah policy Worker Access:
- Action: Allow
- Include: Emails
- masukkan email dari file tersebut
- aktifkan One-time PIN (OTP) sebagai login method bila email staf bukan anggota Cloudflare account.

JANGAN gunakan `Include Everyone`. Gunakan email yang disetujui saja.

Dua karyawan dari database sumber belum memiliki email:
- Muhammad Rezky
- Raihan Afhatatur
Mereka baru dapat login setelah email ditambahkan di KENDALI dan Access policy.

Amirullah memiliki email tetapi role KENDALI masih kosong karena sumber hanya menyebut AKADEMI TUKANG INDONESIA. Administrator perlu menentukan Kepala ATI atau Instruktur ATI sebelum login.

## Deploy
Build:
`npm run build`

Deploy:
`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

## Verifikasi
`/app-build.json` → `APP-V2.6`

Setelah membuka URL utama, tidak ada lagi form Username/Kata Sandi KENDALI.
Cloudflare Access login langsung diteruskan menjadi sesi KENDALI.
