# Notifikasi Email Tugas — Panduan Aktivasi (V3.4.19)

Setiap kali tugas baru masuk ke **Tugas Saya** seseorang (mis. laporan dikirim ke Head of Operational, temuan QC ke Site Manager, PR menunggu pilih vendor), sistem mengirim email ke penerimanya.

- **Penerima tugas personal** (punya PIC) → email ke orang tersebut.
- **Antrean jabatan** (mis. "Head of Operational", "Finance") → email ke semua karyawan aktif dengan jabatan itu.
- Pengirim aksi tidak menerima email untuk tugas yang ia buat sendiri.
- Karyawan tanpa email, nonaktif, atau yang mematikan opsi *Kirim notifikasi tugas baru ke email* tidak dikirimi.
- Email dikirim **di latar belakang** (tidak memperlambat aplikasi). Gagal kirim dicoba ulang otomatis lewat Cron setiap 5 menit, maksimal 5 kali.
- Status semua email bisa dilihat di **Karyawan & Akses → Notifikasi Email Tugas** (tombol *Kirim Email Uji* dan *Kirim Ulang yang Gagal*).

Sebelum diaktifkan, sistem tetap jalan normal; email disimpan dengan status *Tertahan* dan bisa dikirim ulang setelah konfigurasi selesai.

## Langkah 0 — Isi email karyawan
Karyawan & Akses → Edit → isi kolom **Email** untuk setiap karyawan.

## Pilihan A (disarankan untuk mulai) — Gmail via Google Apps Script
Tidak perlu domain atau akun baru; email dikirim dari Gmail Natara (mis. natarakonstruksi@gmail.com). Kuota Gmail biasa ±100 email/hari.

1. Buka https://script.google.com dengan akun Gmail Natara → **New project** → tempel isi `email-relay/Code.gs`.
2. **Project Settings → Script Properties** → tambah `RELAY_SECRET` = kata sandi acak panjang.
3. Jalankan fungsi `testKirim` sekali → izinkan akses Gmail.
4. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* → salin URL.
5. Di folder proyek:
   ```bash
   npx wrangler secret put EMAIL_GAS_SECRET     # isi sama persis dengan RELAY_SECRET
   ```
6. Edit `wrangler.jsonc` bagian `vars`:
   ```jsonc
   "EMAIL_PROVIDER": "gas",
   "EMAIL_GAS_URL": "https://script.google.com/macros/s/XXXX/exec",
   ```
7. `npm run deploy` → buka Karyawan & Akses → **Kirim Email Uji**.

## Pilihan B — Brevo (±300 email/hari gratis)
1. Daftar di brevo.com → **Senders** → verifikasi alamat pengirim → **SMTP & API → API Keys** → buat key.
2. `npx wrangler secret put EMAIL_API_KEY`
3. `vars`: `"EMAIL_PROVIDER": "brevo"`, `"EMAIL_FROM": "alamat-terverifikasi@..."`.
4. Deploy → Kirim Email Uji.
Catatan: pengirim berdomain Gmail lewat layanan pihak ketiga lebih mudah masuk Spam; paling andal dengan domain sendiri.

## Pilihan C — Resend (butuh domain sendiri)
1. Verifikasi domain di resend.com → buat API key.
2. `npx wrangler secret put EMAIL_API_KEY`
3. `vars`: `"EMAIL_PROVIDER": "resend"`, `"EMAIL_FROM": "notifikasi@domainanda.com"`.

## Pengaturan lain
- `APP_BASE_URL` — alamat aplikasi untuk tombol **Buka Tugas Saya** di email (link membuka langsung menu Tugas Saya setelah login).
- `EMAIL_FROM_NAME` — nama pengirim.
- Cron `*/5 * * * *` sudah ada di `wrangler.jsonc` (aktif otomatis saat deploy).
