# Changelog

## V3.4.10 — Vendor Free Text

- Nama vendor pada PR diketik langsung oleh Project Manager; tidak perlu mendaftarkan/upload nama vendor ke Master Vendor.
- Dropdown vendor dan ketergantungan load Master Vendor di PR dihapus.
- Quotation tetap dapat dilampirkan secara opsional; alur approval Head → Admin Teknik SPK/PO → PM tetap sama.

- Head of Supporting ditegaskan sebagai role QC penuh untuk input, edit/hapus, publish finding, verifikasi, close/delete session, dan laporan QC.
- Menambah capability `qcDeleteFinding` dan memperluas `qcDeleteSession` untuk QC/Head of Supporting/manajemen.
- Menambah PATCH session QC untuk edit tanggal mulai/catatan.
- Menambah PATCH/DELETE dedicated untuk Temuan QC.
- Delete sub-pekerjaan yang sudah terhubung Finding dapat melakukan cleanup relasi QC terkait dengan konfirmasi dan audit.
- Delete session melakukan cleanup item, finding yang berasal dari session, history/task/evidence terkait, sambil mempertahankan audit trail.
- UI Inspeksi QC mempunyai aksi `Buka / Edit / Hapus`.
- UI sub-pekerjaan mempunyai `Edit / Hapus / Ganti Foto`.
- UI Temuan QC mempunyai `Detail / Edit / Hapus` ditambah tombol workflow sesuai status.
- Menambah edit/hapus Laporan QC/ATI bagi role yang berwenang; snapshot periode tidak dimanipulasi oleh Edit metadata.
- Memperjelas copy/alur QC pada dashboard.
- Menambah `qc-control-smoke.mjs` untuk hak Head of Supporting/QC dan PM read-only.
- Menambah `button-flow-audit.mjs` untuk memeriksa wiring tombol/route kritikal dan menolak placeholder tombol kosong.
- Tidak ada migration database baru; tetap memakai migration terakhir `0019_workflow_inbox.sql`.

## V3.4.8 — PM Vendor Flow

- Menghapus Procurement sebagai tahap wajib workflow PR.
- PM mengisi kebutuhan + pembanding vendor.
- Head of Operational/Head Unit Bisnis memilih vendor.
- Admin Teknik membuat SPK/PO.
- Tugas kembali ke PM untuk tindak lanjut/order dan penerimaan.

## V3.4.7 — PM QC + PR Runtime Fix

- PM dapat membuka QC dan PR/Vendor tanpa gagal akibat pemanggilan koleksi yang tidak diizinkan.

## V3.4.6 — PM Access Fix

- Perbaikan resolusi role agar Posisi/Jabatan menjadi basis utama akses.
- PM memperoleh akses read QC dan PR/Vendor pada proyek yang ditugaskan.

## V3.4.4 — Nara System Branding

- Branding produk diubah dari KENDALI menjadi Nara System tanpa mengganti identifier teknis produksi lama.
