# ROLE MATRIX — KENDALI NATARA V3.0.1

Role di bawah mengontrol dua lapis sekaligus: menu frontend dan API backend. Menyembunyikan menu saja tidak dianggap cukup; request API yang tidak sesuai role juga ditolak.

| Role | Akses Utama | Hak Kunci |
|---|---|---|
| Administrator | Semua modul | Full CRUD, user/role, audit, seluruh workflow |
| Direktur | Semua modul | Full control dan keputusan manajemen |
| Head Unit Bisnis | Semua modul | Full control unit bisnis |
| Manager Operasional | Operasional lintas proyek + monitoring finance | Proyek, progress, opname, QC, CCO, PR, closeout, approval tertentu |
| Admin Teknik | Administrasi proyek | Project admin, dokumen, routing CCO, monitoring progress/QC/finance |
| Project Manager | **Hanya proyek yang ditugaskan sebagai PM** | Progress, issue, QC monitoring, CCO, PR, pengajuan dana pada proyek tersebut |
| Pelaksana Lapangan | **Hanya proyek yang ditugaskan sebagai Pelaksana** | Progress, QC/defect lapangan, CCO request, PR, pengajuan dana pada proyek tersebut |
| QS / Quantity Surveyor | Komersial/QS | Opname, RAB, pricing CCO, dokumen terkait |
| QC / Quality Control | Mutu | Item QC, inspection + upload wajib, defect, re-inspection |
| Finance | Keuangan | Piutang, Cash In, hutang, Cash Out, approval/bayar pengajuan dana |
| Logistik / Procurement | Pengadaan | PR, PO/SPK, vendor, delivery |
| Viewer | Baca terbatas | Dashboard, proyek, dokumen, alur |

## Prinsip keamanan

1. Status workflow kritis CCO, Payment Request, dan PR tidak dapat dilompati dengan edit biasa. Perubahan status harus melalui endpoint action.
2. Pelaksana/PM hanya dapat mengedit CCO draft/returned yang diajukan sendiri.
3. Karyawan non-Finance hanya dapat mengedit Payment Request miliknya saat masih Draft/Rejected.
4. QC Inspection dibuat sebagai log baru dan bukti file wajib. Log inspeksi lama tidak diedit untuk mengganti histori.
5. Hanya Administrator/Direktur/Head Unit Bisnis yang dapat menambah atau mengubah akun karyawan dan role.
6. Project Manager dan Pelaksana Lapangan menggunakan **row-level project scope**. Daftar proyek, dashboard, record proyek, workflow action, dokumen, dan file storage untuk proyek lain ditolak oleh backend.
7. Scope Project Manager membaca `pmUserId` (plus field legacy PM), sedangkan scope Pelaksana membaca `pelaksanaUserId` (plus field legacy pengawas/pelaksana).
8. Pembatasan project scope tidak hanya menyembunyikan dropdown/menu; request API langsung ke ID proyek lain menghasilkan 403 atau daftar kosong.
9. Data finansial detail pada dashboard tidak dikirim ke role yang tidak memiliki akses modul Finance.

