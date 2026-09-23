# Changelog

## V3.4.12 — QS Volume + As-Built Drafter

- QS disederhanakan menjadi Volume RAB dan Volume Realisasi, dengan % realisasi otomatis.
- QS auto mengikuti assignment proyek dan edit dikunci setelah submit kecuali dikembalikan.
- Modul baru As-Built / Drafter dengan progress Arsitektur, Struktur, MEP, Overall, dan status.
- Drafter dapat upload/ganti file As-Built per disiplin.
- Workflow As-Built: Drafter → Head of Engineering → Approved/Revisi, terintegrasi Tugas Saya.
- Gate PHO membaca As-Built Approved bila tracker baru digunakan, dengan fallback legacy.
- Tidak ada migration baru.

## V3.4.11 — QC Before / After

- Detail Temuan QC menampilkan **dua foto berdampingan: BEFORE dan AFTER**.
- BEFORE menggunakan bukti dari Continuous QC Inspection atau foto temuan manual.
- AFTER menggunakan foto hasil perbaikan terbaru yang dikirim Pelaksana.
- Setiap panel menampilkan tanggal dan catatan; jika foto belum ada tampil placeholder yang jelas.
- Bukti selain foto utama tetap tampil sebagai **Bukti Tambahan**.
- Modal detail QC diperlebar dan responsif; pada mobile Before/After ditumpuk vertikal.
- Tombol `Simpan` di modal detail dihilangkan karena detail bersifat read-only; tombol `Tutup` digunakan.
- Upload hasil perbaikan (`After`) divalidasi sebagai gambar di backend.


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
