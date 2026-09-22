# Changelog

## V3.4.7 — PM QC + Procurement Runtime Fix
- Memperbaiki QC Dashboard Project Manager yang gagal karena frontend memaksa membaca `qc_reports` walau PM tidak memiliki akses laporan divisi.
- Memperbaiki Procurement Project Manager yang gagal karena frontend memaksa membaca master `vendor`.
- Procurement kini hanya memuat master vendor untuk role yang memang mengelola pembanding vendor.
- Register PO/SPK juga dimuat hanya bila role memiliki hak baca; ini menjaga halaman Procurement tetap dapat digunakan oleh role lapangan sesuai kewenangannya.
- Hak PM tetap least-privilege: dapat melihat QC proyek yang ditugaskan dan membuat/memantau PR, tanpa memperoleh akses laporan QC seluruh divisi atau master vendor yang tidak diperlukan.


## PR Vendor → SPK/PO oleh Admin Teknik
- PR diposisikan khusus untuk kebutuhan pekerjaan/material/jasa yang membutuhkan vendor.
- Project Manager menjadi pengaju formal PR dan pihak yang melakukan submit. Pelaksana Lapangan masih dapat membantu menyiapkan draft, tetapi tidak dapat submit atas nama PM.
- Setelah submit, Procurement melengkapi pembanding/quotation vendor.
- Head of Operational atau Head Unit Bisnis memilih dan menyetujui vendor.
- Setelah vendor disetujui, `Tugas Saya` otomatis berpindah ke Admin Teknik untuk membuat SPK/PO.
- Admin Teknik membuat register SPK/PO berdasarkan vendor dan nilai yang sudah disetujui.
- Setelah SPK/PO tersimpan, PR berubah menjadi `SPK_CREATED` dan tugas otomatis berpindah ke Procurement untuk eksekusi order.
- Procurement menandai `ORDERED` lalu `RECEIVED`.
- PO/SPK yang berstatus Approved/Ordered tetap membentuk committed cost/hutang sesuai engine Finance yang sudah ada.
- Tidak ada migration baru.


## Branding — Nara System

- Nama produk yang tampil kepada user diubah dari nama lama menjadi **Nara System**.
- Halaman login, sidebar, browser title, welcome banner, workflow inbox, fallback error, dan service label sudah menggunakan Nara System.
- Versi dinaikkan ke **V3.4.7**.
- Identifier teknis produksi (Worker, D1, R2, cookie, password salt, dan nama tabel legacy) dipertahankan agar deployment existing tidak terputus.


## Field Role Merge

- Menggabungkan **Site Manager / Superintendent** ke role **Project Manager**.
- Menggabungkan **Pengawas Lapangan / Site Supervisor** ke role **Pelaksana Lapangan**.
- Menghapus Site Manager dan Pengawas Lapangan dari dropdown jabatan baru dan form assignment proyek.
- Menambahkan compatibility alias agar akun/data lama tetap terbaca.
- Project scope legacy tetap aman melalui fallback `siteManagerUserId` dan `pengawasUserId`.

## Pelaksana → Draft PR

- Pelaksana Lapangan pada proyek yang ditugaskan masih dapat membantu menyiapkan/mengedit draft PR.
- Pengaju formal PR selalu Project Manager proyek.
- Hanya Project Manager (atau Manajemen sebagai override) yang dapat melakukan submit PR.
- Setelah submit, tugas berpindah ke Procurement → Head of Operational/Head Unit Bisnis → Admin Teknik → Procurement.

## Pelaksana → Temuan QC

- Pelaksana tetap memiliki akses baca/update Temuan QC dalam scope proyek.
- Tugas perbaikan QC ditampilkan pada QC Dashboard dan Tugas Saya jika akun menjadi PIC.
- Setelah Pelaksana mengirim bukti perbaikan, handoff kembali ke QC untuk verifikasi.

## Compatibility

Tidak ada migration database baru. Migration terakhir tetap `0019_workflow_inbox.sql`.


### V3.4.7
- Memperbaiki resolusi role Project Manager dari Posisi/Jabatan.
- Menjamin menu Procurement dan QC tersedia untuk Project Manager.
- Menambah alias Project Manager/Superintendent.
- Menambah smoke test khusus akses PM.