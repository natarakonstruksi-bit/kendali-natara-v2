# Nara System V3.4.10 — Vendor Free Text + QC Control QA

V3.4.10 memperkuat modul Quality Control dan melakukan audit wiring tombol/alur utama Nara System. Fokus revisi ini adalah memastikan **Head of Supporting tetap dapat menjalankan fungsi QC penuh**, data QC utama mempunyai kontrol **Edit/Hapus**, dan perpindahan tugas tetap mengikuti workflow agar status tidak dapat dilompati lewat edit biasa.

## Perubahan Vendor PR

Pada PR, Project Manager sekarang cukup **mengetik nama vendor langsung** pada baris pembanding. Tidak perlu membuat/mengunggah nama vendor ke Master Data terlebih dahulu. Nilai penawaran, term pembayaran, lead time, catatan, dan quotation opsional tetap dapat diisi. Alur tetap: **PM → Head memilih vendor → Admin Teknik membuat SPK/PO → PM tindak lanjut/penerimaan**.

## Struktur komando utama

**Head Unit Bisnis** → **Head of Operational / Head of Engineering / Head of Supporting** → posisi pelaksana sesuai fungsi.

Administrator dan Direktur adalah akses sistem/manajemen. Quality Control menggunakan satu role aktif: **QC**. Label QC lama tetap dinormalisasi ke QC untuk kompatibilitas data lama.

## QC — hak Head of Supporting

Head of Supporting mempunyai kewenangan QC operasional penuh:

- membuat dan membuka Continuous QC Inspection;
- menambah sub-pekerjaan pada seluruh kelompok inspeksi;
- menetapkan hasil **Sesuai / Tidak Sesuai**;
- menambah/mengganti foto dan keterangan inspeksi;
- mengedit catatan inspeksi yang masih berjalan;
- mengedit dan menghapus sub-pekerjaan;
- menerbitkan item Tidak Sesuai menjadi Temuan QC;
- membuat Temuan QC manual;
- mengedit metadata Temuan QC dan menghapus temuan;
- memverifikasi hasil perbaikan Pelaksana;
- menutup atau menghapus catatan inspeksi;
- membuat, mengedit, dan menghapus laporan QC mingguan/bulanan.

Penghapusan yang mempunyai relasi melakukan cleanup terhadap data terkait yang memang menjadi bagian record tersebut (misalnya finding/task/history/evidence), sedangkan audit penghapusan tetap dicatat.

## Alur QC yang dikunci

`QC / Head of Supporting inspeksi → Tidak Sesuai → Terbitkan Temuan → Pelaksana Lapangan memperbaiki → Kirim Bukti Perbaikan → QC / Head of Supporting verifikasi → CLOSED atau REVISION REQUIRED`

Tombol **Edit** pada Temuan tidak dapat digunakan untuk mengganti status workflow. Perubahan status wajib melalui tombol **Mulai**, **Kirim Perbaikan**, dan **Verifikasi** supaya `Tugas Saya`, PIC, dan riwayat tetap konsisten.

## Edit/Hapus pada QC

Kontrol eksplisit tersedia untuk:

- Catatan/Session Inspeksi: **Buka / Edit / Hapus**.
- Sub-pekerjaan inspeksi: **Edit / Hapus / Ganti Foto**.
- Temuan QC: **Detail / Edit / Hapus** + tombol workflow sesuai status.
- Laporan QC: **Lihat / Edit / Hapus** bagi role pembuat laporan.

Snapshot KPI/detail laporan yang sudah dibuat tetap dijaga sebagai snapshot periode; Edit laporan hanya mengubah metadata laporan seperti judul/catatan, bukan memanipulasi hasil inspeksi historis.

## Tugas Saya

Setiap handoff membuat task untuk penerima berikutnya. User tidak menyelesaikan tugas hanya dari inbox; tombol `Buka & Proses` membawa user ke modul sumber dan penyelesaian terjadi ketika aksi workflow yang benar dijalankan.

Alur utama saat ini:

- **Progress:** Pelaksana → Project Manager → Head of Operational.
- **Opname:** QS → Head of Engineering → Admin Teknik.
- **QC:** QC/HOS → Pelaksana → QC/HOS.
- **CCO:** Pelaksana/PM → Admin Teknik → QS → tahap approval/client/addendum.
- **Pengajuan Dana:** requester → Head of Operational → Finance.
- **PR Vendor:** Project Manager mengisi kebutuhan + pembanding vendor → Head of Operational/Head Unit Bisnis memilih vendor → Admin Teknik membuat SPK/PO → Project Manager menindaklanjuti/order & penerimaan.
- **Laporan QC/ATI:** divisi submit → Head Unit Bisnis review.

## Role lapangan

- Site Manager / Superintendent / SM → **Project Manager**.
- Pengawas Lapangan / Site Supervisor → **Pelaksana Lapangan**.
- Project Manager dapat membaca QC proyek yang ditugaskan, tetapi inspeksi/verifikasi tetap QC/Head of Supporting.
- Pelaksana Lapangan menerima Temuan QC yang ditugaskan untuk diperbaiki.

## QA V3.4.10

`npm run build` menjalankan:

- frontend runtime smoke;
- preflight source/config;
- static workflow wiring QA;
- RBAC/role smoke;
- PM access/runtime smoke;
- PM vendor flow smoke;
- QC Control smoke khusus Head of Supporting/QC;
- button/flow audit untuk kontrol kritikal shell, task, PR, QC, ATI, dan reporting.

Database smoke juga menguji fresh migration dan upgrade-preservation. V3.4.10 **tidak menambah migration**; migration terakhir tetap `0019_workflow_inbox.sql`.

## Deploy

Jika `0019_workflow_inbox.sql` sudah pernah diterapkan:

```bash
npm run build
npx wrangler deploy
```

Jika belum pernah diterapkan, jalankan migration remote satu kali sebelum deploy:

```bash
npx wrangler d1 migrations apply DB --remote
```

Tetap gunakan Worker, D1, dan R2 produksi yang sekarang. Identifier teknis lama sengaja dipertahankan agar login, data, dan file existing tetap kompatibel.
