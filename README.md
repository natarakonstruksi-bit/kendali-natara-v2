# Nara System V3.4.5 — QA Final + Workflow Inbox

V3.4.5 melengkapi Nara System menjadi sistem **task routing** lintas departemen. Setiap tahap workflow yang membutuhkan tindakan orang lain akan membuat **Tugas Saya** untuk user/role tujuan. Tugas tidak dapat sekadar dicentang selesai dari inbox: user harus membuka modul asal dan menjalankan aksi yang benar. Saat aksi selesai, tugas aktif ditutup dan tugas berikutnya otomatis dibuat untuk PIC/role selanjutnya.

## Struktur komando utama

**Head Unit Bisnis** → **Head of Operational / Head of Engineering / Head of Supporting** → posisi pelaksana sesuai fungsi.

Administrator dan Direktur tetap merupakan akses sistem/manajemen, bukan urutan operasional proyek.

## Menu Tugas Saya

Menu `✓ Tugas Saya` tersedia untuk seluruh role operasional. Badge di sidebar menunjukkan jumlah tugas aktif.

Isi inbox menunjukkan:

- Prioritas
- Nama proyek dan modul asal
- Tugas yang harus dikerjakan
- Saat ini berada di siapa/role mana
- Sedang menunggu apa
- Deadline dan umur tugas
- Status OPEN / IN_PROGRESS
- Tombol `Ambil`, `Mulai`, dan `Buka & Proses`

Role pengawas/manajemen mempunyai toggle **Semua Tugas Aktif** untuk melihat bottleneck lintas tim. Pada menu **Alur Proyek**, proyek terpilih juga menampilkan `Tugas Aktif Proyek` sehingga posisi pekerjaan dan blocker dapat dilihat dari satu layar.

## Workflow yang sudah dirutekan otomatis

- **Progress Harian/Mingguan:** Pelaksana → Project Manager → Head of Operational → Reviewed.
- **Opname:** QS → Head of Engineering → Admin Teknik → Closed.
- **QC:** QC Inspection → bila Tidak Sesuai menjadi Temuan → Pelaksana memperbaiki → QC verifikasi → Closed / Revision ke Pelaksana.
- **CCO:** Pelaksana/PM → Admin Teknik → QS → Admin Teknik / Head of Operational bila perlu eskalasi → Client → Addendum → Closed.
- **Pengajuan Dana:** Requester → Head of Operational → Finance → Paid / Cash Out.
- **Procurement:** PM → Procurement (pembanding vendor) → Head of Operational/Head Unit Bisnis pilih vendor → Procurement order → Procurement receive.
- **Issue/Kendala:** PIC → Project Manager review → Closed.
- **Retensi:** PIC/Finance → Admin Teknik final close.
- **Close-Out:** owner checklist/Admin Teknik → Closed.
- **ATI Pengajuan Pekerjaan:** Requester → Kepala ATI → proses → Requester konfirmasi → Selesai.
- **ATI Masalah Lapangan:** PIC → Kepala ATI evaluasi → Closed.
- **Laporan QC/ATI:** QC/ATI submit → Head Unit Bisnis review → Reviewed.

## Aturan penting

1. Project Manager dan Pelaksana Lapangan tetap dibatasi ke proyek yang ditugaskan. Label lama Site Manager/Superintendent otomatis dibaca sebagai Project Manager; Pengawas Lapangan/Site Supervisor otomatis dibaca sebagai Pelaksana Lapangan.
2. Tugas role-queue dapat dilihat oleh role tujuan, lalu salah satu user dapat klik **Ambil** agar tugas menjadi miliknya.
3. Tugas yang sudah berada pada user tertentu tidak dapat diproses user lain kecuali role manajemen yang memang memiliki kewenangan pada modul sumber.
4. Perubahan status workflow melalui generic Edit dikunci untuk modul workflow agar tahapan tidak dapat dilompati.
5. QC project gate sekarang membaca **Continuous QC Inspection**, bukan hanya engine QC legacy.

## Deploy

```bash
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Schema database tidak berubah dari V3.4. Migration terakhir tetap `0019_workflow_inbox.sql`; jika migration itu sudah pernah diterapkan, V3.4.5 tidak menambah migration baru.

QA detail tersedia di `QA-MATRIX.md` dan `QA-RESULTS.md`.

Tetap memakai D1/R2 produksi yang sama. Jangan membuat database baru.


## Role QC
V3.4.5 mempertahankan fungsi Quality Control sebagai satu posisi/role **QC**. Seluruh inspeksi, temuan, verifikasi, dan laporan QC menggunakan role yang sama. Label QC lama tetap kompatibel di backend tetapi tidak lagi tersedia sebagai pilihan posisi baru.


## V3.4.5 — Penyatuan role lapangan

- `Site Manager`, `Superintendent`, `SM` → **Project Manager**.
- `Pengawas Lapangan`, `Site Supervisor` → **Pelaksana Lapangan**.
- Pilihan jabatan baru hanya menampilkan **Project Manager** dan **Pelaksana Lapangan** untuk dua fungsi tersebut.
- Data lama tetap kompatibel melalui alias backend dan fallback assignment proyek.
- **Pelaksana Lapangan dapat membantu menyiapkan draft Purchase Request (PR)** untuk proyek yang ditugaskan, tetapi pengaju formal dan pihak yang submit adalah Project Manager. Setelah submit, tugas berpindah ke Procurement untuk melengkapi pembanding vendor.
- **Pelaksana Lapangan dapat melihat temuan QC proyek dan menerima Tugas Perbaikan QC** jika ditetapkan sebagai PIC.


## Catatan kompatibilitas branding
Nama produk yang tampil kepada user sekarang adalah **Nara System**. Identifier teknis produksi yang sudah ada seperti Worker `kendali-natara-v2`, D1 `kendali-natara-db-v2`, R2 `kendali-natara-files-v2`, cookie `kendali_session`, password salt lama, dan tabel `kendali_audit_log` sengaja **tidak diubah** agar login, data, file, dan deployment existing tetap kompatibel.


## PR Vendor V3.4.5

Workflow PR resmi: **Project Manager → Procurement → Head of Operational/Head Unit Bisnis → Admin Teknik → Procurement**. Setelah vendor dipilih oleh Head, Admin Teknik wajib membuat SPK/PO; penyimpanan SPK/PO otomatis mengubah PR ke `SPK_CREATED` dan meneruskan tugas ke Procurement.
