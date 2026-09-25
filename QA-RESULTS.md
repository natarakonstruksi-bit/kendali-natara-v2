# QA Results — Nara System V3.4.14

Status: **PASS untuk build/smoke test lokal**.

- Frontend runtime smoke: PASS
- Worker RBAC smoke: PASS
- PM QC / PR runtime smoke: PASS
- PM vendor flow & vendor free-text: PASS
- QC control + before/after: PASS
- Button / workflow audit: PASS
- QS Volume + As-Built: PASS
- Dashboard dual progress chart: PASS
- JavaScript syntax `public/app.js`: PASS
- JavaScript syntax `src/worker.js`: PASS

## Dashboard V3.4.13
- Dua series terpisah: Rencana dan Realisasi.
- Sumbu waktu mengikuti tanggal aktual.
- Titik awal proyek menjadi anchor 0% bila tersedia.
- Satu data progress tetap dirender sebagai garis pendek, bukan titik yang tidak terlihat.
- Baseline Rencana dapat memakai Time Schedule/Kurva-S; `planProgress` input harian/mingguan tetap lebih prioritas.
- Ringkasan Rencana, Realisasi, dan Deviasi tampil pada setiap kartu proyek.

Catatan: koneksi D1/R2 remote dan data produksi tetap perlu diverifikasi setelah deploy Cloudflare.


## QC Team + PM PIC V3.4.14
- Field/kolom assignment QC per proyek: dihapus dari UI.
- QC dan Head of Supporting tetap dapat inspeksi lintas proyek: PASS.
- Project Manager dapat create/edit/delete Temuan QC pada proyek assignment: PASS.
- Pelaksana Lapangan hanya read Temuan QC proyek assignment: PASS.
- Workflow Temuan menuju PM dan antrean verifikasi kembali ke role QC: PASS.
- Migration 0020 memindahkan PIC Temuan legacy dari Pelaksana ke PM proyek: PASS.
