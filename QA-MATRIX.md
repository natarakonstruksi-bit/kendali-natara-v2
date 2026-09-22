# QA Matrix — Nara System V3.4.7

| Area | Skenario | Hasil yang diwajibkan |
|---|---|---|
| Role | Site Manager/Superintendent login | Dibaca sebagai Project Manager |
| Role | Pengawas Lapangan/Site Supervisor login | Dibaca sebagai Pelaksana Lapangan |
| UI Role | Dropdown Karyawan | Tidak menampilkan Site Manager/Pengawas; menampilkan PM/Pelaksana |
| Project Scope | Legacy `siteManagerUserId` | Tetap dianggap scope Project Manager |
| Project Scope | Legacy `pengawasUserId` | Tetap dianggap scope Pelaksana |
| PR | Pelaksana assigned menyiapkan draft PR | Dapat create/edit DRAFT; requester formal tetap Project Manager |
| PR | Pelaksana mencoba submit PR | Ditolak; submit hanya Project Manager/Manajemen |
| PR | Project Manager submit PR | Berubah SUBMITTED dan handoff ke Procurement |
| QC | Pelaksana membaca defect proyek | Diizinkan pada project scope |
| QC | Pelaksana adalah PIC temuan | Muncul pada Tugas Perbaikan Saya/Tugas Saya |
| QC | Pelaksana kirim bukti perbaikan | Berubah WAITING QC CHECK, handoff ke QC |
| Regression | Tombol QC tambah foto/item | Binder tersedia |
| Regression | Workflow Inbox | Claim/Start/Buka & Proses tersedia |
| Build | npm run build | Wajib lolos |
| Database | migration fresh/upgrade | Wajib lolos tanpa kehilangan data |
| PR | Procurement kirim pembanding | Berubah READY_FOR_APPROVAL dan handoff ke Head |
| PR | Head pilih vendor | Berubah APPROVED dan handoff ke Admin Teknik |
| PR | Admin Teknik membuat SPK/PO | PO/SPK masuk register, PR menjadi SPK_CREATED, handoff ke Procurement |
| PR | Procurement order | Hanya dapat dari SPK_CREATED |
