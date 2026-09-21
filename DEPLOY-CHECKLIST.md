# DEPLOY CHECKLIST — KENDALI V3.0

1. Backup/commit repository saat ini.
2. Replace `src/`, `public/`, `scripts/check.mjs`, `package.json`, dan tambahkan migration `0012_full_workflow_roles_qc_cco.sql`.
3. Pertahankan `package-lock.json` repository yang sekarang bila sudah ada.
4. Pastikan `wrangler.jsonc` tetap menunjuk D1 `kendali-natara-db-v2` ID `04849d77-cb23-4d50-9cfc-4e0d9c542d6b` dan R2 `kendali-natara-files-v2`.
5. Jalankan `npm run build`.
6. Jalankan migration remote: `npx wrangler d1 migrations apply DB --remote`.
7. Deploy: `npx wrangler deploy` atau jalankan pipeline Cloudflare Git.
8. Login Administrator dan buka Karyawan & Akses; sesuaikan role semua akun lama.
9. Uji satu proyek: pilih PM/Pelaksana/QS/QC melalui dropdown.
10. Input dua Progress Harian dengan tanggal berbeda; pastikan grafik Rencana vs Aktual muncul.
11. Uji Payment Request sampai Paid; pastikan Cash Out otomatis terbentuk.
12. Uji QC: sync RAB → inspect dengan bukti → NG membuat defect → re-inspect PASS menutup defect.
13. Uji CCO lengkap sampai Addendum dan Closed.
14. Login dengan akun Pelaksana, QS, QC, Finance, dan Procurement untuk memastikan menu/API hanya sesuai role.

## Uji role & project scope setelah deploy

1. Login sebagai Project Manager yang ditugaskan pada satu proyek. Pastikan hanya proyek itu yang muncul.
2. Login sebagai Pelaksana Lapangan yang ditugaskan pada satu proyek. Pastikan hanya proyek itu yang muncul.
3. Coba akses URL/API record proyek lain dari akun PM/Pelaksana; sistem harus menolak.
4. Pastikan dropdown project di Progress, CCO, PR, Pengajuan Dana, Dokumen, dan Flow hanya memuat proyek yang ditugaskan.
5. Pastikan role tanpa Finance tidak menerima angka Cash In/Cash Out/Piutang/Hutang pada dashboard.
