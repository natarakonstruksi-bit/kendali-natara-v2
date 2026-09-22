# Deploy Checklist — Nara System V3.4.7

1. Backup/review repository production saat ini.
2. Replace source dengan isi paket V3.4.7.
3. Pertahankan D1 dan R2 existing; jangan membuat database baru.
4. Jalankan build:

```bash
npm run build
```

5. Pastikan migration sampai `0019_workflow_inbox.sql` sudah diterapkan. Aman menjalankan perintah berikut karena Wrangler hanya menerapkan migration yang belum pernah dijalankan:

```bash
npx wrangler d1 migrations apply DB --remote
```

Migration terakhir tetap `0019_workflow_inbox.sql`; V3.4.7 tidak menambah schema baru.

6. Deploy:

```bash
npx wrangler deploy
```

7. Hard refresh browser.
8. Login Administrator dan buka **Tugas Saya**.
9. Uji minimal satu proyek dengan skenario berikut:
   - Pelaksana submit Progress → PM menerima task → PM approve → Head of Operational menerima task.
   - Pelaksana submit CCO → Admin Teknik menerima → teruskan QS → QS menerima task.
   - PM submit PR → Procurement menerima → isi vendor → Kirim Pembanding → Head of Operational menerima.
   - QC terbitkan temuan → Pelaksana menerima → submit perbaikan → QC menerima verifikasi.
10. Buka **Alur Proyek** dan pastikan `Tugas Aktif Proyek` menampilkan posisi/menunggu apa.
11. Login dengan PM/Pelaksana dan pastikan proyek lain tetap tidak dapat diakses.

Tidak ada kebutuhan membuat akun/D1/R2 baru.

12. Setelah deployment selesai, jalankan matrix pada `QA-MATRIX.md`, terutama upload QC/R2 dan login beberapa role nyata.


> Branding berubah menjadi **Nara System**, tetapi nama Worker/D1/R2 produksi tetap dipertahankan agar deployment menimpa sistem existing dan tidak membuat resource baru.

- V3.4.7 tidak menambah migration baru; migration terakhir tetap `0019_workflow_inbox.sql`.
