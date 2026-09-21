# Deploy Checklist V3.1

1. Backup repository dan D1 sebelum deploy.
2. Pastikan `wrangler.jsonc` tetap mengarah ke D1 `kendali-natara-db-v2` dan R2 `kendali-natara-files-v2`.
3. Jalankan `npm run build`.
4. Jalankan `npx wrangler d1 migrations apply DB --remote`.
5. Jalankan `npx wrangler deploy`.
6. Login Administrator dan cek Master Karyawan serta assignment PM/Pelaksana pada proyek.
7. Uji Laporan Harian: PIC harus otomatis Pelaksana dan tukang harus masuk Rekap Gaji.
8. Uji PR: buat minimal 2 item HPP, 2 vendor, submit, lalu login Head Operational/Head Unit Bisnis dan pilih vendor.
9. Uji PO/SPK: buat dari PR Approved dan pastikan vendor/nilai terpilih terisi.
10. Uji QC: QC buat temuan + before; Pelaksana submit perbaikan + after; QC verifikasi sesuai/tidak sesuai.
11. Uji ATI: data tukang muncul, attendance/upah mengikuti laporan harian, asesmen/pelatihan dapat disimpan.
12. Uji project scope menggunakan akun PM dan Pelaksana pada dua proyek berbeda.

Tidak membuat D1/R2 baru.
