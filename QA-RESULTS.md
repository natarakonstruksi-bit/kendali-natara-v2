# QA Results — Nara System V3.4.8

Fokus regression: Project Manager membuka QC Dashboard dan Procurement tanpa 403 dari dependensi koleksi yang tidak diperlukan.

- QC PM: koleksi inspeksi/temuan tetap dapat dibaca sesuai project scope; `qc_reports` tidak dimuat jika hak baca tidak ada.
- Procurement PM: PR tetap dimuat; master vendor hanya dimuat oleh role pembanding vendor; PO/SPK hanya dimuat jika role punya hak baca.
- PM tetap tidak diberi hak QC inspection/verification.
- PM tetap tidak diberi hak mengelola master vendor.

# QA Results — Nara System V3.4.8

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
- Sidebar `NARA SYSTEM • V3.4.8`: PASS
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

- PM access smoke: Procurement + QC menu/read permission ✅
- Jabatan Project Manager mengalahkan role legacy/stale ✅
