# Role Matrix KENDALI V3.1

| Role | Akses Utama | Scope Proyek |
|---|---|---|
| Administrator | Administrasi sistem, seluruh menu/data, karyawan, audit; **tidak mengambil keputusan vendor PR** | Semua |
| Direktur | Monitoring seluruh menu/data; **tidak mengambil keputusan vendor PR** | Semua |
| Head Unit Bisnis | Kontrol bisnis dan **pemilihan vendor PR** | Semua |
| Manager Operasional / Head Operational | Operasional, QC, CCO, PR dan **pemilihan vendor PR** | Semua |
| Admin Teknik | Administrasi proyek, dokumen, routing, PR/vendor data | Semua |
| Project Manager | Proyek, progress, QC monitoring, CCO, PR | Hanya proyek yang ditangani |
| Pelaksana Lapangan | Laporan harian, progress, QC corrective action, CCO/PR | Hanya proyek yang ditangani |
| QS | Opname, RAB/CCO pricing | Sesuai akses role |
| QC | Temuan, verifikasi QC, bukti | Sesuai akses role |
| Finance | Finance, pengajuan dana, payroll view | Semua sesuai role |
| Logistik / Procurement | PR vendor comparison, PO/SPK, vendor | Semua sesuai role |
| Kepala ATI | Talent pool, upah/kehadiran, asesmen, pelatihan | ATI |
| Instruktur ATI | Asesmen, pelatihan, monitoring talent | ATI |
| Viewer | Read-only | Sesuai data yang diizinkan |

## PIC yang dikunci

- Laporan Harian/Mingguan: **Pelaksana Lapangan**.
- Schedule/Milestone/Issue lapangan: **Pelaksana Lapangan**.
- Temuan/perbaikan QC: **Pelaksana Lapangan** sebagai PIC perbaikan; verifikasi oleh **QC**.
- Opname: **QS / Quantity Surveyor**.
- CCO pengaju lapangan: **Project Manager atau Pelaksana Lapangan**.
- PO/SPK: **Logistik / Procurement**.
- Surat: **Admin Teknik**.
- Retensi: **Finance/Admin Teknik/Manager Operasional**.
- Close-Out: **Admin Teknik/Manager Operasional/Project Manager**.

- Pengajuan Dana: **Pengaju = user yang sedang login**; tidak tersedia dropdown untuk memilih orang lain.
- Purchase Request: pemilik/pengaju = **Project Manager yang ditugaskan pada proyek**; vendor dipilih hanya oleh **Head Operational atau Head Unit Bisnis**.
