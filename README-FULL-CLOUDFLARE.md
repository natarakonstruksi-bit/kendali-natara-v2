# KENDALI — Full Existing Website on Cloudflare

Paket ini adalah pendekatan **lift-and-shift**, bukan rebuild modul satu per satu.

Frontend:
- menggunakan build KENDALI yang sudah ada dari ZIP pengguna;
- tampilan, jobdesk, workflow, dashboard, progress PDF, QC, material, PO, CCO, PHO/FHO, ATI, dll tetap dipertahankan;
- URL backend Supabase lama sudah dialihkan ke Worker Cloudflare.

Backend compatibility:
- `projects/users/rabs/surat/tukang/pelatihan/aset/proyeksi/vendor/po`
  disimpan di D1 melalui tabel `app_records`;
- file yang sebelumnya menuju Supabase Storage dialihkan ke R2;
- Supabase Realtime dimatikan karena sinkronisasi sekarang request/response ke D1.

## Deploy
Upload SELURUH isi paket ini ke root repository `kendali-natara-v2`.

Cloudflare Deploy command:
`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

Build command boleh kosong.

## Test
1. Build Success.
2. Buka `/api/health`.
3. Harus `schema_version: FULL-UI-01`.
4. Buka `/`.
5. KENDALI harus tampil dengan UI lama/lengkap.
6. Login awal aplikasi lama masih tersedia.
7. Coba buat perubahan kecil lalu refresh untuk memastikan D1 sync.

## Penting
Cloudflare Access yang sudah aktif tetap dapat digunakan sebagai lapisan keamanan di depan aplikasi.
KENDALI custom login masih ada di frontend existing, sehingga untuk sementara bisa terjadi dua lapis akses:
Cloudflare Access -> Login KENDALI.
Nanti login internal dapat disederhanakan tanpa membangun ulang semua modul.
