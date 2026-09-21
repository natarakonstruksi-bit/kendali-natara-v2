# Deploy Checklist V3.1.5

1. Pertahankan D1 `kendali-natara-db-v2` dan R2 `kendali-natara-files-v2`.
2. Jalankan `npm clean-install --progress=false`.
3. Jalankan `npm run build` dan pastikan muncul `KENDALI V3.1.5 QC Function Fix preflight OK`.
4. Jalankan `npx wrangler d1 migrations apply DB --remote` agar migration 0014 terpasang.
5. Jalankan `npx wrangler deploy`.
6. Login role QC, buka QC Dashboard, klik **+ Inspeksi Baru**, pilih proyek.
7. Pastikan modal menampilkan 4 KPI, identitas pemeriksaan, 7 kelompok pekerjaan, input sub-pekerjaan, tombol Sesuai/Tidak sesuai, keterangan, dan Ambil foto.
8. Tambah satu sub-pekerjaan Tidak sesuai, lalu klik **Terbitkan 1 temuan** dan pastikan PIC otomatis Pelaksana proyek.
9. Login Pelaksana proyek tersebut dan pastikan temuan masuk dalam scope proyek yang ditangani.
10. Uji role lain agar tidak dapat mengubah inspeksi bila tidak memiliki hak QC.
