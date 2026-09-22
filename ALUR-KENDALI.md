# Alur KENDALI V3.4.1 — Dari Proyek Masuk sampai CLOSED

## 1. Prinsip Workflow

KENDALI V3.4.1 menggunakan pola:

**Seseorang menyelesaikan tahap → sistem menutup tugasnya → sistem membuat tugas untuk orang/role berikutnya → tugas muncul di Tugas Saya penerima.**

Inbox bukan tempat mencentang tugas secara manual. Tombol **Buka & Proses** membawa user ke modul sumber. Hanya aksi workflow yang sah yang dapat mengakhiri tugas dan meneruskan alur.

## 2. Struktur Tanggung Jawab

- **Head Unit Bisnis:** kontrol keseluruhan BU, keputusan akhir, menerima laporan QC/ATI, oversight semua workflow.
- **Head of Operational:** kontrol eksekusi, PM/Pelaksana, progress, approval operasional, procurement/fund request.
- **Head of Engineering:** RAB/HPP, schedule, QS/opname, CCO teknis, gambar/DED, engineering review.
- **Head of Supporting:** QC/quality gate, defect, verifikasi mutu, readiness serah terima.
- **PM:** memimpin satu proyek dan mereview progress/kendala/PR.
- **Pelaksana Lapangan:** progress harian/mingguan, tenaga kerja, perbaikan defect, pengajuan kondisi lapangan.
- **QS:** opname dan RAB CCO.
- **QC:** inspeksi, temuan, verifikasi perbaikan.
- **Procurement:** pembanding vendor, PO/SPK, order dan penerimaan.
- **Finance:** pembayaran, cash in/out, AR/AP, fund request paid.
- **Admin Teknik:** administrasi teknis, dokumen, routing CCO, closeout administratif.
- **ATI:** tenaga tukang, attendance/upah, assessment, masalah, pelatihan, pemenuhan tenaga.

## 3. Workflow per Modul

### Progress Harian/Mingguan
`DRAFT/RETURNED_TO_FIELD → SUBMITTED_TO_PM → PM_APPROVED → REVIEWED`

- Pelaksana menyusun dan submit.
- Tugas otomatis muncul ke PM: **Review Progress**.
- PM approve atau return ke Pelaksana.
- Jika approve, tugas muncul ke Head of Operational: **Review Operasional**.
- Head of Operational review → selesai.

### Opname / QS
`DRAFT/RETURNED_TO_QS → SUBMITTED_TO_ENGINEERING → VERIFIED → CLOSED`

- QS submit opname.
- Head of Engineering memverifikasi atau mengembalikan ke QS.
- Setelah VERIFIED, tugas berpindah ke Admin Teknik untuk finalisasi administrasi/penutupan.

### QC
`Continuous Inspection → Tidak Sesuai → OPEN → ON PROGRESS → WAITING QC CHECK → CLOSED / REVISION REQUIRED`

- QC melakukan inspeksi berkelanjutan per proyek.
- Sub-pekerjaan Tidak Sesuai diterbitkan sebagai temuan.
- Tugas perbaikan muncul ke Pelaksana proyek.
- Pelaksana mulai, perbaiki, unggah bukti, submit.
- Tugas berpindah ke QC untuk verifikasi.
- Sesuai → CLOSED. Tidak sesuai → kembali ke Pelaksana sebagai REVISION REQUIRED.

### CCO / Addendum
`DRAFT → SUBMITTED_TO_ADMIN → SENT_TO_QS → QS_PRICING → RAB_READY → SENT_TO_CLIENT → CLIENT_APPROVED → ADDENDUM_PROCESS → CLOSED`

- Pelaksana/PM mengajukan CCO.
- Admin Teknik menerima dan meneruskan ke QS.
- QS menyusun RAB CCO.
- Jika memerlukan eskalasi sesuai kebijakan, task muncul ke Head of Operational/management.
- Admin Teknik meneruskan nilai final ke client.
- Setelah client setuju, Admin Teknik memproses Addendum.
- Upload/finalisasi Addendum → CLOSED.

### Pengajuan Dana
`DRAFT/REJECTED → PENDING → APPROVED → PAID`

- Requester submit.
- Tugas approval ke Head of Operational.
- Approved → tugas ke Finance.
- Finance bayar → PAID dan Cash Out dibuat.

### Procurement / PR
`DRAFT/REJECTED → SUBMITTED → READY_FOR_APPROVAL → APPROVED → ORDERED → RECEIVED`

- PM membuat PR multi-item.
- Submit → task ke Procurement untuk isi beberapa pembanding vendor.
- Procurement klik **Kirim Pembanding** setelah vendor offer tersedia.
- Task ke Head of Operational/Head Unit Bisnis untuk memilih vendor.
- Approved → task kembali ke Procurement untuk PO/order.
- ORDERED → Procurement menerima barang/jasa.
- RECEIVED → workflow selesai.

### Issue / Kendala
`OPEN → IN PROGRESS → WAITING → CLOSED`

- PIC menerima tugas penyelesaian masalah.
- Setelah tindakan selesai, kirim ke PM.
- PM review dan close atau kembalikan sesuai kondisi.

### Retensi
`OPEN/HOLD → RELEASED → CLOSED`

- PIC/Finance memastikan kewajiban retensi selesai.
- RELEASED → Admin Teknik final close.

### Close-Out
`OPEN/IN PROGRESS → CLOSED`

- Setiap checklist closeout mempunyai owner/PIC.
- Tugas muncul pada owner tersebut; bila tidak ditentukan, masuk queue Admin Teknik.
- Setelah bukti dan kewajiban selesai, checklist CLOSED.

### ATI — Pengajuan Pekerjaan/Tenaga
`DRAFT → DIAJUKAN → DIPROSES → TERPENUHI → SELESAI`

- Requester mengajukan.
- Kepala ATI menerima dan memproses.
- Setelah kebutuhan terpenuhi, task kembali ke requester untuk konfirmasi.

### ATI — Masalah Lapangan
`OPEN/IN PROGRESS → WAITING EVALUATION → CLOSED`

- PIC menangani masalah.
- Hasil tindakan dikirim ke Kepala ATI untuk evaluasi.
- Kepala ATI close setelah evaluasi selesai.

### Laporan QC / ATI
`SUBMITTED → REVIEWED`

- QC/ATI membuat laporan mingguan/bulanan dari snapshot dashboard masing-masing.
- Tugas review otomatis masuk ke Head Unit Bisnis.
- Head Unit membuka laporan dan menandai Reviewed.

## 4. Di Mana Melihat “Sekarang Menunggu Apa?”

### Tugas Saya
Menampilkan pekerjaan yang saat ini berada pada user/role yang login: tugas, proyek, modul, tahap, menunggu apa, deadline, dan next action.

### Semua Tugas Aktif
Untuk Head/management: melihat semua workflow aktif lintas tim, termasuk tugas role-queue yang belum diambil.

### Alur Proyek
Pilih satu proyek → bagian **Tugas Aktif Proyek** menunjukkan seluruh pekerjaan yang masih terbuka pada proyek tersebut. Bagian **Gate Aktif/Blocker** menunjukkan mengapa proyek belum dapat maju ke tahap lifecycle berikutnya.

## 5. Lifecycle Proyek

`SETUP → PRECON → MOBILIZATION → EXECUTION → PHO → RETENTION → FHO → FINANCIAL_CLOSE → CLOSED`

Progress fisik 100% belum berarti CLOSED. Proyek baru CLOSED setelah quality, dokumen, CCO, retention/FHO bila berlaku, piutang/hutang, payment request, closeout checklist, dan final reconciliation tidak menyisakan blocker.
