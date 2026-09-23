# QA Matrix — Nara System V3.4.10

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
