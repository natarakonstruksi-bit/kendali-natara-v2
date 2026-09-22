# QA Results — KENDALI Natara V3.4.1

Tanggal QA paket: 22 September 2026.

## Hasil otomatis

- PASS — `node --check src/worker.js`
- PASS — `node --check public/app.js`
- PASS — `node --check public/public.js`
- PASS — frontend runtime smoke; selector scoped, startup, role normalization, dan generator tombol workflow.
- PASS — static action wiring; Tugas Saya, Progress, Opname, CCO, Pengajuan Dana, Procurement, QC Continuous, QC Finding, ATI, dan Laporan QC/ATI mempunyai producer + binder/endpoint yang diperiksa.
- PASS — Worker RBAC smoke; legacy role dipetakan ke struktur baru, Head Unit/3 Head/PM/Pelaksana mendapat view/capability yang diuji.
- PASS — migration fresh: 0011–0019 dapat diaplikasikan berurutan pada database kosong.
- PASS — migration upgrade preservation: user dan proyek existing tetap tersimpan setelah seluruh migration diaplikasikan.
- PASS — D1 binding production: `kendali-natara-db-v2` / ID existing.
- PASS — R2 binding production: `kendali-natara-files-v2`.
- PASS — dropdown jabatan baru tidak lagi memasukkan `Head Operational`; akun lama tetap dibaca sebagai `Head of Operational`.

## Regression khusus yang diuji

1. Tombol QC `Ambil / pilih foto` dan `Tambahkan` di Continuous Inspection tetap dihasilkan dan memiliki event binding.
2. Progress DRAFT menghasilkan `Kirim ke PM`; PM_APPROVED menghasilkan `Review Final` untuk Head of Operational.
3. Opname DRAFT menghasilkan `Kirim Engineering`.
4. CCO `SUBMITTED_TO_ADMIN` menghasilkan aksi Admin → QS.
5. Pengajuan Dana `PENDING` menghasilkan Approve/Reject untuk role yang berwenang.
6. PR `READY_FOR_APPROVAL` menghasilkan pemilihan vendor untuk role berwenang.
7. ATI DRAFT menghasilkan `Ajukan ke ATI`.
8. `Tugas Saya` mempunyai Ambil/Mulai/Buka & Proses dan menampilkan `waitingFor`, deadline, assignee, status.

## Batas QA

Paket belum dianggap bukti bahwa layanan eksternal produksi 100% bebas gangguan. Setelah deploy tetap lakukan smoke test pada Cloudflare production untuk upload R2, cookie/session, D1 permission, jaringan, mobile browser, dan akun role nyata. Source/build test dapat menangkap regresi kode, tetapi tidak dapat mensimulasikan seluruh kondisi produksi Cloudflare.
