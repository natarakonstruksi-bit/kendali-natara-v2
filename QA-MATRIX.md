# QA Matrix — Nara System V3.4.14

| Area | Skenario | Expected |
|---|---|---|
| Startup | Frontend load | Tidak white-screen; selector helper aman |
| Role | Head of Supporting | `qcInspect`, `qcVerify`, delete session/finding aktif |
| QC Session | Create/Open/Edit/Delete | Handler + endpoint tersedia dan terikat |
| QC Item | Add/Edit/Delete/Photo | Handler aktif; linked finding ditangani aman |
| QC Result | Sesuai/Tidak Sesuai | PATCH item berjalan |
| QC Finding | Create/Detail/Edit/Delete | Dedicated CRUD tersedia |
| QC Workflow | Start → Submit Fix → Verify | Status/task berpindah sesuai alur |
| QC Report | Create/Detail/Edit/Delete | Tombol/endpoint tersedia sesuai permission |
| PM QC | Read assigned projects | Bisa baca, tidak inspeksi/verifikasi |
| Tugas Saya | Claim/Start/Open & Process | Button binder tersedia |
| PR Vendor | PM → Head → Admin Teknik → PM | Next action/route tersedia |
| CCO | Stage actions | Button → endpoint terikat |
| ATI | CRUD/workflow/report controls | Binder/route kritikal tersedia |
| Shell | Sidebar/filter/refresh/modal | Binder tersedia |
| Placeholder | Empty onclick/javascript:void | Tidak ditemukan pada audit kritikal |
| DB Fresh | migrations 0011–0019 | Lolos |
| DB Upgrade | user/project existing | Tetap terjaga |

| Vendor free text | PM mengetik nama vendor langsung tanpa Master Vendor | PASS via smoke test |

| QC Detail Before / After | QC/Head/PM read | Foto BEFORE + AFTER, tanggal, catatan, placeholder | Automated static/runtime smoke | PASS |

## QS / As-Built

- QS hanya input Volume RAB dan Volume Realisasi.
- QS submit → Head of Engineering → Admin Teknik.
- As-Built 3 disiplin + overall otomatis.
- Upload/ganti file Arsitektur, Struktur, MEP.
- Submit hanya jika 100% + 3 file tersedia.
- Head of Engineering Approve / Revisi.
- Handoff muncul di Tugas Saya.


### Dashboard Progress V3.4.13
- Dua series Rencana/Realisasi dirender.
- Satu titik progress tetap punya visual garis melalui anchor tanggal mulai proyek.
- Data rencana dari planProgress tidak ditimpa baseline schedule.
- Deviasi = Realisasi - Rencana.


### QC Team / PM PIC V3.4.14
- Master Proyek tidak memiliki field satu QC per proyek.
- Semua role QC + Head of Supporting dapat inspeksi lintas proyek.
- Temuan QC otomatis ber-PIC Project Manager.
- Project Manager dapat membuat/edit/hapus dan menindaklanjuti Temuan.
- Pelaksana Lapangan dapat melihat Temuan tetapi tidak mengubah workflow.
- Existing Temuan dimigrasikan ke PM melalui 0020.
