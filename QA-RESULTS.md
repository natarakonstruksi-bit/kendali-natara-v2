# QA Results — Nara System V3.4.5

## Hasil otomatis

- Syntax Worker: PASS
- Syntax frontend: PASS
- Frontend runtime smoke: PASS
- Role alias smoke: PASS
- RBAC PR formal Project Manager + draft assist Pelaksana: PASS
- RBAC Pelaksana → Temuan QC: PASS
- Workflow/button static wiring: PASS
- D1 fresh migration 0011–0019: PASS
- D1 upgrade preservation existing user/project: PASS


## Branding

- Browser title `Nara System — Natara Konstruksi`: PASS
- Login `NARA SYSTEM`: PASS
- Tombol `Masuk ke Nara System`: PASS
- Sidebar `NARA SYSTEM • V3.4.5`: PASS
- Service backend `Nara System`: PASS
- Identifier teknis legacy tetap kompatibel: PASS

## Role merge

- `Site Manager` → `project_manager`: PASS
- `Superintendent` → `project_manager`: PASS
- `Pengawas Lapangan` → `pelaksana_lapangan`: PASS
- `Site Supervisor` → `pelaksana_lapangan`: PASS
- Dropdown aktif hanya menampilkan Project Manager + Pelaksana Lapangan untuk fungsi tersebut: PASS

## Pelaksana

- Menu Procurement tersedia: PASS
- Collection `procurement` read/create/update: PASS
- Collection `defects` read/update: PASS
- PR menyimpan Pengaju PR dan PM secara terpisah: PASS (static/backend guard)
- QC Dashboard memiliki Tugas Perbaikan Saya berdasarkan `picUserId`: PASS

## Catatan produksi

Pengujian build tidak menggantikan browser QA pada Cloudflare produksi. Upload R2, session cookie, dan data D1 production tetap perlu diuji setelah deploy.
