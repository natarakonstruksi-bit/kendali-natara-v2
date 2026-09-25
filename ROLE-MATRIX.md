# Role Matrix — Nara System V3.4.15

## Hierarki utama

1. Head Unit Bisnis
2. Head of Operational
3. Head of Engineering
4. Head of Supporting

Administrator/Direktur adalah akses sistem/manajemen dan bukan urutan operasional proyek.

## Matriks fungsi inti

| Posisi | Scope | Fungsi utama |
|---|---|---|
| Head Unit Bisnis | Semua proyek | Oversight BU, keputusan, vendor approval, review laporan QC/ATI |
| Head of Operational | Semua proyek operasional | Review progress, approval operasional/fund/vendor, eksekusi proyek |
| Head of Engineering | Engineering | Review QS, CCO teknis, baseline teknis, approval As-Built |
| **Head of Supporting** | Semua fungsi supporting/QC | **Input inspeksi QC, edit/hapus data QC, terbitkan temuan, verifikasi, laporan QC** |
| Project Manager | Proyek ditugaskan | Kontrol proyek, review progress, PR + pembanding vendor, baca QC |
| Pelaksana Lapangan | Proyek ditugaskan | Progress, pekerjaan lapangan, perbaikan Temuan QC, bantu draft kebutuhan |
| QS / Quantity Surveyor | Proyek sesuai akses | Volume RAB vs Volume Realisasi, RAB CCO |
| Drafter / BIM | Proyek ditugaskan | Progress As-Built Arsitektur/Struktur/MEP, upload/ganti file, submit approval |
| **QC** | Proyek sesuai akses | **Inspeksi, edit/hapus QC, temuan, verifikasi, laporan QC** |
| Admin Teknik | Administrasi teknis | Routing CCO, dokumen, SPK/PO setelah vendor disetujui, close-out administratif |
| Finance | Finance | Pengajuan dana, pembayaran, Cash In/Out, hutang/piutang |
| Kepala ATI | ATI | Pengajuan tenaga, evaluasi masalah, kontrol ATI |
| Instruktur ATI | ATI sesuai akses | Aktivitas/pelatihan/assessment ATI |

## Hak khusus QC V3.4.13

**Head of Supporting dan QC** dapat:

- create/read/update/delete Temuan QC;
- membuat dan mengedit Continuous QC Inspection;
- menambah, mengedit, menghapus sub-pekerjaan;
- menambah/mengganti evidence inspeksi;
- publish findings;
- verifikasi perbaikan;
- close/delete inspection session;
- create/edit/delete laporan QC.

Project Manager hanya mempunyai akses baca/pemantauan QC pada proyek yang ditugaskan dan tidak memperoleh hak inspeksi/verifikasi.

Pelaksana Lapangan dapat melihat dan memproses Temuan QC yang diarahkan kepadanya: `OPEN/REVISION REQUIRED → ON PROGRESS → WAITING QC CHECK`.

## Penyatuan role lapangan

- Site Manager / Superintendent / SM dinormalisasi menjadi **Project Manager**.
- Pengawas Lapangan / Site Supervisor dinormalisasi menjadi **Pelaksana Lapangan**.
- QC Interior / QC MEP / QC Arsitektur / Senior QC dan label QC lama dinormalisasi menjadi **QC**.

## PR Vendor

| Posisi | Peran |
|---|---|
| Project Manager | Membuat PR, HPP, pembanding vendor/quotation, submit ke Head, tindak lanjut setelah SPK/PO, konfirmasi penerimaan |
| Head of Operational / Head Unit Bisnis | Memilih/menyetujui vendor |
| Admin Teknik | Membuat SPK/PO berdasarkan vendor terpilih dan memasukkannya ke register |
| Pelaksana Lapangan | Dapat membantu menyiapkan kebutuhan/draft, bukan submitter formal |

Tidak ada role Procurement sebagai tahap wajib pada workflow aktif.


## QC Team + PM PIC — V3.4.14
- QC tidak di-assign pada Master Proyek; seluruh role **QC** bekerja sebagai tim lintas proyek.
- **Head of Supporting** tetap memiliki kontrol inspeksi, edit/hapus, dan verifikasi QC.
- **Project Manager** adalah PIC Temuan QC otomatis untuk proyeknya dan menerima Tugas Saya untuk tindak lanjut.
- **Pelaksana Lapangan** dapat membaca Temuan QC proyek yang ditugaskan, tetapi tidak menjadi PIC dan tidak mengubah workflow Temuan.


## Pengelolaan Informasi Publik

Akses edit profil/portofolio tetap mengikuti capability koleksi `public_site_settings` dan `public_portfolio`. Website `/info` bersifat read-only untuk publik dan tidak memberi akses ke API internal yang memerlukan login.
