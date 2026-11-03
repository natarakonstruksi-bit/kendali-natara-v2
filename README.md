# Nara System V3.4.19 — Notifikasi Email Tugas

Setiap tugas baru yang masuk ke **Tugas Saya** seseorang kini juga dikirim ke **email** orang tersebut (atau ke semua karyawan dengan jabatan antrean, mis. Head of Operational / Finance). Email berisi nama tugas, proyek, apa yang perlu dilakukan, prioritas, deadline, pengirim, dan tombol **Buka Tugas Saya**.

- Email disimpan di outbox lalu dikirim di latar belakang → aksi di aplikasi tetap cepat.
- Gagal kirim dicoba ulang otomatis (Cron 5 menit, maks. 5 kali); bisa juga *Kirim Ulang yang Gagal* manual.
- Pilihan pengiriman: **Google Apps Script (Gmail Natara, tanpa domain)**, **Brevo**, atau **Resend**.
- Per karyawan: kolom Email + opsi *Kirim notifikasi tugas baru ke email*.
- Panel **Karyawan & Akses → Notifikasi Email Tugas**: status konfigurasi, jumlah terkirim/gagal, log 40 email terakhir, daftar karyawan tanpa email, tombol *Kirim Email Uji*.
- Tidak ada email untuk tugas yang dibuat oleh diri sendiri, akun nonaktif, atau karyawan yang mematikan opsi.

**Aktivasi:** ikuti `EMAIL-SETUP.md` (±10 menit). Sebelum diaktifkan sistem tetap jalan normal.
Tidak ada migration baru. File baru: `email-relay/Code.gs`, `EMAIL-SETUP.md`, `scripts/email-notification-smoke.mjs`.

# Nara System V3.4.18 — Performa & Stabilitas

Diuji dengan data simulasi ±12.000 record (30 proyek, 27 akun, 18 jabatan) pada Wrangler lokal.

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Buka **Tugas Saya** | 7–21 detik | 0,03–0,4 detik |
| Badge Tugas Saya (dipanggil setiap pindah menu) | 7–21 detik, **menahan** perpindahan menu | 0,01 detik, tidak menahan menu |
| Dashboard | 0,20 detik | 0,05–0,14 detik (hasil identik) |
| Halaman Progress (pimpinan, semua proyek) | 1,0–1,4 detik | 0,3–0,4 detik |
| Daftar sesi QC (Site Manager) | N+1 query | 1 query |

Perubahan:
- **Tugas Saya**: sinkronisasi tugas dibuat massal (3 query baca + batch tulis) dan hanya berjalan maksimal tiap 10 menit sebagai jaring pengaman; setiap perubahan data tetap menyinkronkan tugas secara langsung. Tambah `?resync=1` untuk memaksa sinkron.
- **Endpoint baru `/api/tasks/count`** untuk badge (satu query); badge diperbarui di latar belakang dengan debounce.
- **Dashboard**: data dikelompokkan per proyek sekali (O(n)), bukan difilter ulang untuk setiap proyek.
- **Frontend**: koleksi yang tidak boleh dibaca role aktif tidak lagi membuat halaman error; request identik yang bersamaan digabung; tabel besar dibatasi 200 baris terbaru saat melihat semua proyek (pilih satu proyek untuk melihat semuanya).
- Asset `app.js`/`styles.css` diberi versi agar browser langsung memakai file terbaru setelah deploy.

Bug yang diperbaiki:
- Tugas Saya hanya membaca 2.500 data terbaru — PR, pengajuan dana, issue, dan temuan lama **tidak pernah muncul** di Tugas Saya bila data laporan sudah banyak (di simulasi: 503 tugas hilang). Sekarang semua muncul.
- Halaman **Progress** error untuk role QC (tidak berhak membaca data tukang).
- Halaman **ATI** error untuk Site Manager (data pelatihan/evaluasi).
- Menu **Dokumen** tampil untuk Kepala/Instruktur ATI padahal aksesnya ditolak; nama proyek di halaman ATI tidak terbaca → ATI kini dapat membaca daftar proyek (baca saja) dan menu Dokumen disembunyikan.
- Log kehadiran ATI menampilkan "undefined" bila status kehadiran kosong.

Tidak ada migration baru.

# Nara System V3.4.17 — Restrukturisasi Operational: Site Manager

Struktur operasional proyek disederhanakan:

```
Head Unit Bisnis
└── Head of Operational
    ├── Site Manager      (menggantikan Project Manager + Pelaksana Lapangan)
    └── Admin Logistik    (dipindahkan ke Divisi Operational)
```

- **Site Manager** adalah satu-satunya penanggung jawab proyek di lapangan. Master Proyek hanya punya satu field **Site Manager** (field PM dan Pelaksana dihapus dari form).
- Site Manager mengerjakan semua yang dulu dikerjakan PM dan Pelaksana: laporan harian/mingguan, issue & corrective action, PIC Temuan QC, CCO, PR vendor (pengaju formal), konfirmasi SPK/PO & penerimaan, pengajuan dana, dan pengajuan tenaga ATI.
- **Laporan progress**: `Site Manager → Head of Operational → Disetujui` (atau dikembalikan ke Site Manager). Tahap "Review PM" dihapus. Tabel Laporan Harian sekarang punya kolom Status dan tombol Kirim / Review & Setujui / Kembalikan.
- **Issue / corrective action**: Site Manager mengerjakan → Head of Operational menutup atau mengembalikan.
- **PR vendor**: Site Manager → Head of Operational memilih vendor → Admin Teknik buat SPK/PO → Site Manager tindak lanjut.
- **Admin Logistik** (dulu Logistik / Staf Logistik / Manager Logistik) berada di Divisi Operational. Hak akses tetap: PR/Vendor, PO, pengajuan dana, dokumen.
- Jabatan lama (Project Manager, PM, Pelaksana Lapangan, Pengawas, Superintendent) otomatis dibaca sebagai Site Manager, jadi akun lama tetap bisa login.

Migration baru `0023_site_manager_restructure.sql`:
- akun PM/Pelaksana → `Site Manager`, akun Logistik → `Admin Logistik`, keduanya `departemen = Divisi Operational` (jabatan lama disimpan di `legacyPosition`);
- Site Manager proyek = PM lama; kalau proyek belum punya PM, memakai Pelaksana lama (nilai lama disimpan di `legacyPmUserId` / `legacyPelaksanaUserId`);
- laporan progress yang menunggu review PM dipindah ke antrean Head of Operational; PIC laporan/temuan/issue/PR yang masih berjalan dipindah ke Site Manager proyek;
- Tugas Saya lama untuk PM/Pelaksana ditutup dan dibuat ulang otomatis sesuai alur baru.

# Nara System V3.4.16 — Rute Kunjungan QC

V3.4.16 menambahkan **Rute Kunjungan QC** di bagian atas QC Dashboard. Rute adalah jadwal kunjungan **mingguan yang berulang terus** (Senin–Minggu) sampai diedit, dinonaktifkan, atau dihapus — tidak perlu dibuat ulang setiap minggu.

- **Satu titik rute** = satu proyek + hari kunjungan (bisa lebih dari satu hari) + jam + nomor urut + perkiraan durasi + petugas QC (atau "Tim QC") + fokus pemeriksaan + catatan lokasi.
- **Rute hari ini** tampil otomatis sesuai hari berjalan, diurutkan nomor urut lalu jam. Titik yang proyeknya sudah ada aktivitas inspeksi hari ini ditandai hijau.
- Tombol **Mulai / Lanjutkan Inspeksi** pada rute hari ini langsung membuka catatan Continuous QC Inspection proyek tersebut.
- **Jadwal mingguan** menampilkan 7 hari; filter per petugas dan opsi tampilkan titik nonaktif.
- **Tambah / Edit / Nonaktifkan / Hapus**: QC, Head of Supporting, Head of Operational, dan manajemen. Project Manager dan Pelaksana Lapangan hanya melihat rute untuk proyek yang ditugaskan kepadanya.
- Validasi backend: proyek wajib ada, minimal satu hari, format jam HH:MM, petugas wajib role QC/Head of Supporting.
- Data disimpan di collection `qc_visit_routes`. Migration baru: `0022_qc_visit_routes.sql` (additive, hanya index + schema_meta).

# Nara System V3.4.15 — Public Information Website

V3.4.15 memasukkan konten **Company Profile Natara Konstruksi** ke Sistem Informasi Publik `/info`. Website publik sekarang memuat Tentang Natara, Filosofi, Visi & Misi, Nilai Perusahaan, Layanan, Pendekatan Kerja, Keunggulan, Segmentasi Klien, Penutup, serta Portofolio lengkap dengan galeri. Konten dan visual portofolio diimpor dari company profile yang diberikan pengguna.

Migration baru `0021_public_company_profile_seed.sql` mengisi profil publik dan 7 portofolio company-profile. Field kontak/alamat yang sudah ada tetap dipertahankan karena update memakai `json_patch`. Asset gambar company profile disimpan sebagai static assets agar dapat tampil tanpa membuka dokumen internal/R2.

> Catatan sumber: daftar ringkas company profile menyebut **Cafe Rakil** dan **Rumah Am**, sedangkan halaman portofolio detail menggunakan **YD Cafe** dan **Rumah Amirullah**. V3.4.15 mengikuti halaman detail karena memiliki narasi dan visual proyek.

# Nara System V3.4.14 — QC Team + PM Finding PIC

V3.4.14 mengubah struktur QC agar **QC tidak lagi ditetapkan satu orang per proyek**. Seluruh user role QC dan Head of Supporting dapat melakukan inspeksi lintas proyek. **PIC Temuan QC otomatis Project Manager proyek**; Project Manager dapat membuat/edit/hapus dan menindaklanjuti Temuan, sedangkan Pelaksana Lapangan tetap dapat melihat Temuan pada proyek yang ditugaskan kepadanya namun tidak menjadi PIC workflow.

Migration baru `0020_qc_pm_pic.sql` memindahkan PIC Temuan existing ke PM yang terpasang pada Master Proyek.

V3.4.13 menyederhanakan modul **QS** menjadi kontrol **Volume RAB vs Volume Realisasi**, dan menambahkan modul baru **As-Built / Drafter** seperti tabel referensi: Arsitektur %, Struktur %, MEP %, Overall Progress, serta Status As-Built. Drafter dapat meng-upload/ganti file As-Built tiap disiplin, kemudian mengirim hasil 100% ke Head of Engineering untuk approval.

## QS — Volume RAB vs Volume Realisasi

Form QS sekarang fokus pada: proyek, tanggal, item/area, satuan, **Volume RAB**, **Volume Realisasi**, dan catatan. Persentase realisasi dihitung otomatis. Workflow tetap: **QS → Head of Engineering → Admin Teknik**. Setelah QS submit, data tidak dapat diedit QS kecuali dikembalikan untuk revisi.

## As-Built / Drafter

Tabel As-Built menampilkan seluruh proyek yang relevan dengan kolom **Nama Proyek, Arsitektur %, Struktur %, MEP %, Overall Progress, Status As Built, Aksi**. Overall dihitung sebagai rata-rata tiga disiplin; contoh 60% + 80% + 0% menghasilkan 47% setelah pembulatan.

Drafter dapat menyimpan progress bertahap dan upload/ganti file As-Built Arsitektur, Struktur, serta MEP. Saat ketiganya 100% dan ketiga file tersedia, tombol **Kirim Approval** aktif. Handoff masuk ke `Tugas Saya` Head of Engineering. Head of Engineering dapat **Approve** atau **Revisi**. Status final menjadi `APPROVED`.

Drafter hanya dapat upload dokumen kategori `AS_BUILT` dan untuk proyek yang ditugaskan kepadanya. Gate PHO memakai tracker As-Built baru bila tracker sudah ada; proyek legacy tanpa tracker tetap kompatibel dengan dokumen AS_BUILT lama.

## QC Before / After

Pada modal **Detail Temuan QC** sekarang terdapat dua panel utama:

- **BEFORE** — foto kondisi saat temuan dibuat/inspeksi, tanggal temuan, dan catatan temuan.
- **AFTER** — foto terakhir yang dikirim Pelaksana sebagai hasil perbaikan, tanggal pengiriman, dan uraian perbaikan.

Jika salah satu foto belum tersedia, sistem menampilkan placeholder yang jelas, bukan area kosong. Bukti tambahan tetap tersedia di bagian **Bukti Tambahan**. Riwayat Perbaikan dan Riwayat Verifikasi tetap berada di bawah perbandingan foto. Input foto hasil perbaikan dibatasi ke file gambar pada UI dan backend.

## Perubahan Vendor PR

Pada PR, Project Manager sekarang cukup **mengetik nama vendor langsung** pada baris pembanding. Tidak perlu membuat/mengunggah nama vendor ke Master Data terlebih dahulu. Nilai penawaran, term pembayaran, lead time, catatan, dan quotation opsional tetap dapat diisi. Alur tetap: **PM → Head memilih vendor → Admin Teknik membuat SPK/PO → PM tindak lanjut/penerimaan**.

## Struktur komando utama

**Head Unit Bisnis** → **Head of Operational / Head of Engineering / Head of Supporting** → posisi pelaksana sesuai fungsi.

Administrator dan Direktur adalah akses sistem/manajemen. Quality Control menggunakan satu role aktif: **QC**. Label QC lama tetap dinormalisasi ke QC untuk kompatibilitas data lama.

## QC — hak Head of Supporting

Head of Supporting mempunyai kewenangan QC operasional penuh:

- membuat dan membuka Continuous QC Inspection;
- menambah sub-pekerjaan pada seluruh kelompok inspeksi;
- menetapkan hasil **Sesuai / Tidak Sesuai**;
- menambah/mengganti foto dan keterangan inspeksi;
- mengedit catatan inspeksi yang masih berjalan;
- mengedit dan menghapus sub-pekerjaan;
- menerbitkan item Tidak Sesuai menjadi Temuan QC;
- membuat Temuan QC manual;
- mengedit metadata Temuan QC dan menghapus temuan;
- memverifikasi hasil perbaikan Pelaksana;
- menutup atau menghapus catatan inspeksi;
- membuat, mengedit, dan menghapus laporan QC mingguan/bulanan.

Penghapusan yang mempunyai relasi melakukan cleanup terhadap data terkait yang memang menjadi bagian record tersebut (misalnya finding/task/history/evidence), sedangkan audit penghapusan tetap dicatat.

## Alur QC yang dikunci

`QC / Head of Supporting inspeksi → Tidak Sesuai → Terbitkan Temuan → Pelaksana Lapangan memperbaiki → Kirim Bukti Perbaikan → QC / Head of Supporting verifikasi → CLOSED atau REVISION REQUIRED`

Tombol **Edit** pada Temuan tidak dapat digunakan untuk mengganti status workflow. Perubahan status wajib melalui tombol **Mulai**, **Kirim Perbaikan**, dan **Verifikasi** supaya `Tugas Saya`, PIC, dan riwayat tetap konsisten.

## Edit/Hapus pada QC

Kontrol eksplisit tersedia untuk:

- Catatan/Session Inspeksi: **Buka / Edit / Hapus**.
- Sub-pekerjaan inspeksi: **Edit / Hapus / Ganti Foto**.
- Temuan QC: **Detail / Edit / Hapus** + tombol workflow sesuai status.
- Laporan QC: **Lihat / Edit / Hapus** bagi role pembuat laporan.

Snapshot KPI/detail laporan yang sudah dibuat tetap dijaga sebagai snapshot periode; Edit laporan hanya mengubah metadata laporan seperti judul/catatan, bukan memanipulasi hasil inspeksi historis.

## Tugas Saya

Setiap handoff membuat task untuk penerima berikutnya. User tidak menyelesaikan tugas hanya dari inbox; tombol `Buka & Proses` membawa user ke modul sumber dan penyelesaian terjadi ketika aksi workflow yang benar dijalankan.

Alur utama saat ini:

- **Progress:** Pelaksana → Project Manager → Head of Operational.
- **Opname:** QS → Head of Engineering → Admin Teknik.
- **QC:** QC/HOS → Pelaksana → QC/HOS.
- **CCO:** Pelaksana/PM → Admin Teknik → QS → tahap approval/client/addendum.
- **Pengajuan Dana:** requester → Head of Operational → Finance.
- **PR Vendor:** Project Manager mengisi kebutuhan + pembanding vendor → Head of Operational/Head Unit Bisnis memilih vendor → Admin Teknik membuat SPK/PO → Project Manager menindaklanjuti/order & penerimaan.
- **Laporan QC/ATI:** divisi submit → Head Unit Bisnis review.

## Role lapangan

- Site Manager / Superintendent / SM → **Project Manager**.
- Pengawas Lapangan / Site Supervisor → **Pelaksana Lapangan**.
- Project Manager dapat membaca QC proyek yang ditugaskan, tetapi inspeksi/verifikasi tetap QC/Head of Supporting.
- Pelaksana Lapangan dapat melihat Temuan QC pada proyek assignment-nya, tetapi PIC dan workflow tindak lanjut berada pada Project Manager.

## QA V3.4.14

`npm run build` menjalankan:

- frontend runtime smoke;
- preflight source/config;
- static workflow wiring QA;
- RBAC/role smoke;
- PM access/runtime smoke;
- PM vendor flow smoke;
- QC Control smoke khusus Head of Supporting/QC;
- button/flow audit untuk kontrol kritikal shell, task, PR, QC, ATI, QS, As-Built, dan reporting;
- QS + As-Built smoke untuk formula progress, upload, dan workflow approval.

Database smoke juga menguji fresh migration dan upgrade-preservation. V3.4.14 menambah migration `0020_qc_pm_pic.sql` untuk memindahkan PIC Temuan QC existing ke Project Manager proyek.

## Deploy

Untuk V3.4.14 jalankan migration baru lalu deploy:

```bash
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Jika belum pernah diterapkan, jalankan migration remote satu kali sebelum deploy:

```bash
npx wrangler d1 migrations apply DB --remote
```

Tetap gunakan Worker, D1, dan R2 produksi yang sekarang. Identifier teknis lama sengaja dipertahankan agar login, data, dan file existing tetap kompatibel.


## V3.4.13 — Dashboard Dua Garis
Dashboard proyek menampilkan dua garis terpisah: **Rencana** dan **Realisasi**, plus deviasi aktual terhadap rencana. Timeline memakai tanggal sebenarnya; titik awal proyek digunakan sebagai anchor 0% agar satu input progress tetap terbaca sebagai garis. Bila Schedule/Kurva-S tersedia, baseline rencana dapat dibentuk dari bobot aktivitas, sedangkan planProgress dari laporan harian/mingguan tetap menjadi sumber dengan prioritas lebih tinggi.