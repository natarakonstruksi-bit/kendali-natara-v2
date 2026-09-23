# QA Results — Nara System V3.4.10

## Automated checks

`npm run build` menjalankan dan harus menghasilkan PASS untuk:

- Frontend runtime smoke.
- Nara System V3.4.10 preflight.
- Static wiring QA.
- Worker RBAC smoke.
- PM access smoke.
- PM page runtime smoke.
- PM vendor flow smoke.
- QC Control smoke.
- Button/flow audit.

## QC checks yang dicakup

- Head of Supporting dapat input QC dan mempunyai capability inspeksi/verifikasi.
- Head of Supporting/QC dapat create/read/update/delete Temuan QC.
- Session QC mempunyai edit/delete endpoint.
- Subitem mempunyai edit/delete/photo handler.
- Finding mempunyai edit/delete handler.
- Laporan QC mempunyai edit/delete action.
- PM tetap read-only untuk operasi inspeksi/verifikasi.
- Tombol kritikal QC mempunyai event binder dan matching route/backend marker.

## Database

`python scripts/db-smoke.py` menguji:

- fresh migration seluruh migration 0011–0019;
- upgrade preservation untuk data user/proyek existing.

V3.4.10 tidak menambah migration baru.

## Batas QA lokal

PASS lokal tidak sama dengan jaminan absolut environment produksi. Upload R2 remote, D1 remote, cookie/session Cloudflare, cache asset, dan kombinasi data nyata tetap perlu smoke test sesudah deploy. Tidak ada known unbound button pada kontrol kritikal yang tercakup audit V3.4.10.

- Vendor free-text smoke: PASS — PR tidak bergantung pada Master Vendor; nama vendor diketik langsung.
