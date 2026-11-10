## V3.4.34 — Tampilan HP

- **Tabel otomatis menjadi kartu** di layar HP (≤640px): setiap baris tampil sebagai kartu dengan label kolom, sehingga tidak perlu geser ke samping dan tombol Aksi selalu terlihat. Berlaku untuk semua menu & tabel di dalam form.
- **Navigasi bawah** di HP: Beranda · Tugas (dengan angka) · 2 menu utama sesuai jabatan · Menu. Contoh: Site Manager → Progress & QC; QC → QC & Arsip QC; Finance → Keuangan & Bayar; Head of Operational → Proyek & Bayar.
- Header HP: judul satu baris, pilihan proyek selebar layar; header tetap di atas saat menggulir.
- Menu samping: latar gelap di belakang, ketuk di luar menu untuk menutup.
- Form (modal) tampil sebagai lembar penuh dari bawah; tombol Batal/Simpan besar dan selalu terlihat.
- Tombol & isian lebih besar untuk jari; ukuran huruf isian 16px (HP tidak lagi zoom otomatis saat mengetik).
- Kotak angka (KPI) tidak lagi membuat halaman melebar (Dashboard Finance).
- **Tugas Saya**: daftar panjang dibagi per halaman (8 di HP / 15 di desktop) + pencarian + filter status.

## V3.4.33 — Rute QC: Jumat hari kondisional

- Kolom **Jumat** di Jadwal mingguan diberi tanda **KONDISIONAL** dan keterangan "QC bebas berkunjung ke proyek mana saja sesuai kebutuhan" (tidak lagi "Tidak ada kunjungan").
- Saat hari Jumat, bagian **Rute hari ini** menampilkan pilihan proyek + tombol **Mulai Inspeksi** untuk proyek mana pun.
- Kunjungan wajib tetap bisa dijadwalkan di hari Jumat bila perlu; di form, Jumat ditandai * (kondisional).

## V3.4.32 — PR / Vendor: edit & hapus

- Tabel **Purchase Request**: tombol **Edit** kini tersedia untuk Head of Operational / Head Unit Bisnis / Direktur / Administrator di semua tahap (sebelumnya hanya saat Draft). Tombol **Hapus** untuk Head & Administrator; Site Manager hanya bisa menghapus PR miliknya yang masih Draft / Ditolak.
- Tabel **PO / SPK**: tombol **Hapus** untuk Head of Operational, Admin Teknik, dan Administrator.
- Pengaman:
  - PR yang sudah punya SPK/PO tidak bisa dihapus sebelum SPK/PO-nya dihapus.
  - SPK/PO yang sudah dipakai di Pembayaran Proyek tidak bisa dihapus.
  - Admin Teknik tidak bisa menghapus SPK/PO yang sudah ditindaklanjuti ke vendor (Ordered/Diterima).
  - Menghapus SPK/PO dari PR mengembalikan PR ke "Vendor disetujui" (tugas kembali ke Admin Teknik) dan menghapus hutang otomatis (AUTO-PO).
  - Mengubah No. SPK/PO ikut memperbarui referensi di PR.

## V3.4.31 — QC disederhanakan

- Halaman QC kini diawali **alur 1-2-3-4**: Inspeksi → Konfirmasi → Perbaikan → Verifikasi → Selesai, masing-masing dengan jumlahnya; klik langkah untuk langsung ke bagiannya, arahkan kursor untuk penjelasan.
- Isi dibagi **tab**: Tugas saya (default, dengan angka) · Inspeksi · Temuan · Ringkasan · Laporan. Halaman tidak lagi memanjang puluhan ribu piksel.
- **Tugas saya**:
  - QC / Head of Supporting: verifikasi hasil perbaikan + konfirmasi yang perlu diputuskan.
  - Site Manager: daftar temuan yang harus diperbaiki (urut deadline, tanda lewat deadline, catatan QC bila perbaiki ulang) dengan tombol **Mulai** dan **Kirim Perbaikan** langsung di daftar; serta yang sudah dikirim dan menunggu dicek.
- Tabel Temuan, Inspeksi, Perlu Perhatian, Temuan per Proyek, Performa Site Manager: **per halaman (20)** + pencarian + filter status (default "Belum selesai").
- Status temuan berbahasa sehari-hari: Belum dikerjakan · Sedang diperbaiki · Menunggu verifikasi · Perbaiki ulang · Selesai. Label angka diperjelas.
- Pesan aksi diperjelas (mis. "Perbaikan dimulai…", "Temuan selesai (ditutup)").

## V3.4.30 — Verifikasi perbaikan temuan oleh Head of Supporting

- Tugas **Verifikasi Perbaikan QC** kini masuk ke Tugas Saya (dan email) **QC dan Head of Supporting** sekaligus — siapa pun yang lebih dulu mengerjakan. Tugas lama yang hanya untuk QC otomatis dipindah ke antrean bersama.
- Antrean tugas mendukung beberapa jabatan sekaligus (`assigneeRole: "qc,koordinator_supporting"`).
- QC Dashboard: kartu **Menunggu verifikasi hasil perbaikan** + layar verifikasi dengan foto sebelum/sesudah, catatan perbaikan Site Manager, centang banyak → **Sesuai — tutup temuan**, atau **Tidak sesuai** + catatan per temuan (kembali ke Site Manager).
- Endpoint `POST /api/qc/findings/verify-bulk {ids}`.

## V3.4.29 — Pindah jenis mitra

- Database Mitra punya tab baru **Reimburse** (perorangan/karyawan yang menalangi belanja), di samping Tukang, Vendor, Subkon, Toko Material.
- **Pindahkan**: centang satu atau banyak baris (atau "pilih semua yang tampil" setelah mencari) → pilih tujuan → Pindahkan. Bisa juga dari tombol Edit → Jenis.
  - Riwayat pembayaran ikut pindah. Pembayaran lunas tanpa SPK ikut ganti kategori pengeluaran (Toko/Reimburse = Material, Vendor = Vendor, Subkon = Subkon) sehingga rekap Keuangan per kategori ikut benar.
  - Nama yang sama di tab tujuan otomatis digabung.
  - Pihak yang punya SPK hanya bisa dipindah antara Vendor dan Subkon.
- Vendor/Subkon kini juga menampilkan **pembayaran tanpa SPK** (mis. hasil impor) di kolom Sudah dibayar.
- Impor ulang dari Google Sheet mengikuti jenis yang sudah dipindah/digabung (tidak memunculkan lagi sebagai toko).
- Endpoint `POST /api/finance/directory/move {ids, toType}` (Head of Operational, Finance, pimpinan).

## V3.4.28 — Impor Keuangan dari Google Sheet / Excel

- Menu **Keuangan → Impor file…** (Finance & pimpinan): baca file .xlsx hasil unduhan Google Sheet rekap proyek. Sheet yang dibaca: REKAP DANA PROYEK, Keuangan PROYEK, DATA BELANJA PROYEK, IMPOR BELANJA.
- Proyek: nilai kontrak, HPP, tanggal mulai/target, status, owner, lokasi, no. kontrak, adendum. Dicocokkan otomatis ke proyek Nara System berdasarkan nama; bisa dipilih manual, dibuat baru, atau dilewati. Nama kembar (mis. "Sumur Bor" No 16 & 46) dibedakan.
- Pengeluaran: hanya baris "Dihitung ke Proyek = Ya" (sama dengan REKAP). Kategori Material → Material (atau Subkon bila uraian "subkon"), Gaji → Tukang, Operasional/Lainnya → Operasional. Nama toko, jumlah, satuan, harga diambil dari IMPOR BELANJA; satu nota per tanggal + toko + proyek.
- Toko material otomatis masuk Database Mitra beserta nominal pembelian.
- Pratinjau sebelum impor: total per kategori, baris dilewati beserta alasannya, dan cek "Dana keluar REKAP" vs "Akan diimpor" per proyek.
- Impor ulang file yang sama memperbarui (ID deterministik), tidak dobel. Riwayat impor + **Hapus hasil impor** per batch.
- Endpoint: `POST /api/finance/import/projects`, `POST /api/finance/import/transactions`, `GET /api/finance/import`, `DELETE /api/finance/import/:batch`.
- Pembaca Excel (SheetJS 0.18.5, Apache-2.0) disertakan lokal di `public/vendor/`.

## V3.4.27 — Arsip Laporan QC

- Menu baru **Arsip Laporan QC** (view `qc_archive`) untuk QC, Head of Supporting, Head of Operational, Admin Teknik, dan pimpinan: tabel Dikirim · Laporan · Lingkup · Hasil · Perlu tindakan · Nilai · Status (Dibaca/Belum dibaca) dengan tombol Buka PDF, Rincian, Hapus; filter jenis, bulan, status baca, dan pencarian.
- Buat laporan QC kini memilih **jenis** (Inspeksi / Temuan), **lingkup** (semua proyek atau satu proyek), dan **sertakan foto**. Judul otomatis, mis. "Laporan Inspeksi QC Mingguan 26 Okt 2026 – 30 Okt 2026". Laporan kosong ditolak.
- **Buka PDF**: halaman cetak A4 berlogo Natara (ringkasan nilai, KPI, rekap per item, perlu tindakan, rincian pemeriksaan / temuan dengan foto sebelum–sesudah) → Simpan sebagai PDF.
- **Status baca**: otomatis "Dibaca" (nama & tanggal) saat Head Unit Bisnis/Direktur membuka Rincian atau PDF — `POST /api/reports/qc/:id/read`.
- Laporan lama tetap tampil sebagai "Inspeksi + Temuan".
- Perbaikan: menu yang diklik saat aplikasi masih memuat tidak lagi tertimpa Dashboard.

## V3.4.26 — Temuan QC dikunci untuk QC & Head of Supporting

- Edit, hapus, dan buat temuan QC manual hanya untuk **QC** dan **Head of Supporting** (plus Administrator sistem untuk darurat). Berlaku di tombol layar, endpoint `/api/qc/findings/:id` (PATCH/DELETE), dan CRUD generik `defects`.
- Site Manager (PIC) tetap: melihat temuan, **Mulai** tindak lanjut, dan **Kirim Perbaikan** dengan foto hasil perbaikan. QC lalu memverifikasi.
- Head of Operational, Direktur, Head Unit Bisnis: hanya membaca temuan (tetap bisa membantu Mulai/Kirim Perbaikan seperti sebelumnya).
- Tes peran QC diperbarui.

## V3.4.25 — Database Mitra

- Menu baru **Database Mitra** (view `directory`): tab Tukang, Vendor, Subkon, Toko Material — kontak, rekening, status, dan nominal masing-masing (nilai SPK/dikerjakan/dibayar/belum dibayar/retensi; total beli/dibayar; upah absensi/dibayar/dalam pengajuan/belum diajukan). Pencarian, filter status, urutan.
- Detail per pihak: `GET /api/finance/directory/(tukang|partners)/:id/history` — SPK, tagihan, pembelian, pembayaran + bukti; untuk tukang: per proyek, upah, absensi.
- Gabung duplikat: `POST /api/finance/directory/merge` (Head of Operational/Finance/pimpinan) — memindahkan SPK, pengajuan, Cash Out, absensi, dan baris upah ke data utama.
- Absensi lama yang hanya berisi nama ditandai "belum terhubung" → tombol **Hubungkan** (ke tukang yang ada atau jadikan tukang baru). Nama yang sama persis otomatis dicocokkan ke data tukang.
- SPK dengan vendor yang belum terdaftar → tombol **Daftarkan**.
- Pencegahan: nama dobel ditolak (tukang: kecuali No. HP berbeda); data yang sudah dipakai transaksi tidak bisa dihapus (409) — nonaktifkan.
- Form laporan harian: tombol **+ Tukang baru** langsung menyimpan ke Database Mitra dan memilihnya di absensi. Site Manager & Finance kini boleh menambah/mengubah data tukang.
- Tes `scripts/directory-smoke.mjs`. Tidak ada migration baru.

## V3.4.24 — Keuangan Proyek (Pemasukan & Pengeluaran)

- Koleksi baru (tanpa migration, tetap `app_records`): `partners` (Vendor/Subkon/Toko Material, terbentuk otomatis saat pertama diajukan), `project_terms` (termin client), `partner_payments` (pengajuan pembayaran), setting `app_settings/finance` (`materialHubThreshold`, default Rp 5.000.000).
- SPK (`po`) diperluas jadi kontrak: `partnerType` VENDOR/SUBKON, `retentionPct` (0–20%), `terms[]` (≤ 100%). `POST /api/finance/contracts[/:poId]` untuk atur SPK lama atau catat SPK baru.
- Alur pembayaran: Site Manager → Head of Operational → (Material > batas: Head Unit Bisnis) → Finance verifikasi + bukti transfer → `cash_out` `PP-<id>` otomatis per kategori.
  - Vendor/Subkon: per termin SPK, nilai kumulatif tidak boleh melebihi progres pekerjaan & nilai SPK; retensi dipotong otomatis; pelepasan retensi di akhir.
  - Tukang: mingguan dari absensi laporan harian (`GET /api/finance/payroll-preview`), periode tidak boleh tumpang tindih.
  - Material: item + toko (baru/terdaftar), lampiran wajib.
- Pemasukan: Admin Teknik menyusun termin & menagih (`/api/finance/terms/:id/bill`, syarat progres + invoice) → Finance verifikasi uang masuk (`/receive`, bukti TF) → `cash_in` `TERM-<id>`.
- Rekap: `GET /api/finance/summary` — per proyek, per Vendor/Subkon (dikerjakan, dibayar, belum dibayar, belum dikerjakan, retensi), per Toko, per Tukang.
- Tugas Saya: tahap `PAY_OPS_APPROVE`, `PAY_HUB_APPROVE`, `PAY_FINANCE`, `PAY_FIX`, `TERM_RECEIVE`, `TERM_FIX` (+ email).
- Frontend: menu **Pembayaran Proyek**; menu **Keuangan** berisi ringkasan, termin client, buku kas rinci.
- Perbaikan: halaman tidak lagi reload sendiri saat kunjungan pertama (service worker) — sebelumnya isian login bisa terhapus.
- Tes `scripts/finance-smoke.mjs`.

## V3.4.23 — Periode Laporan Bebas

- `reportPeriod(periodType, anchorDate, startDate, endDate)`: rentang bebas, tipe `CUSTOM`, validasi ≤ 366 hari; kompatibel dengan tanggal acuan lama.
- Form laporan QC/ATI: dari–sampai tanggal + pilih cepat. Tes `scripts/report-range-smoke.mjs`.

## V3.4.22 — Aplikasi HP (PWA)

- Manifest, ikon (any + maskable + apple-touch), service worker `nara-shell-<versi>` (shell cache, API network-only, navigasi network-first dengan fallback 4 detik, halaman `/offline`).
- Tombol pasang (beforeinstallprompt / panduan iOS), banner pembaruan (SKIP_WAITING), safe-area untuk mode standalone.
- Tes `scripts/pwa-smoke.mjs`. Tidak ada migration baru.

## V3.4.21 — Alur Konfirmasi QC

- `qc_inspection_items` masuk workflow: tahap `QC_CONFIRM_ANSWER` (Site Manager / Head of Engineering), `QC_CONFIRM_DECIDE` (QC penanya), `QC_CONFIRM_ESCALATED` (Head of Operational).
- Field: `confirmTarget`, `confirmStatus`, `confirmDueDate` (+3 hari WITA), `confirmAnswer*`, `confirmEscalated*`, `confirmHistory`.
- Endpoint: `POST /api/qc/session-items/:id/confirm-answer` (multipart), `POST /api/qc/session-items/:id/confirm-reask`.
- Cron: `escalateOverdueQcConfirmations` sebelum flush email.
- Frontend: pilih penjawab, form Jawab/Putuskan, deep-open dari Tugas Saya. Tidak ada migration baru.

## V3.4.20 — QC Butuh Konfirmasi

- Hasil ketiga `BUTUH KONFIRMASI` pada sub-pekerjaan inspeksi (keterangan wajib; jejak `confirmationRequestedAt/ResolvedAt/Resolution`).
- Sesi: field `konfirmasi`; skor kesesuaian dari item yang sudah diputuskan; tutup catatan diblokir bila masih ada konfirmasi.
- QC Dashboard: KPI dan kartu Menunggu Konfirmasi; gate PHO menghitung konfirmasi sebagai belum lolos; laporan QC `butuhKonfirmasi`.
- Tes `scripts/qc-konfirmasi-smoke.mjs`. Tidak ada migration baru.

## V3.4.19 — Notifikasi Email Tugas

- Outbox `email_outbox` + pengiriman latar belakang (`ctx.waitUntil`) + Cron `*/5 * * * *` untuk retry (maks 5).
- Provider: `gas` (Apps Script relay Gmail), `brevo`, `resend` via vars/secrets.
- Endpoint: `GET /api/notifications/email`, `POST /api/notifications/email/test`, `POST /api/notifications/email/retry` (pimpinan).
- Karyawan: opsi `emailNotifications`; deep link `/?view=tasks`.
- Tidak ada migration baru.

## V3.4.18 — Performa & Stabilitas

- Tugas Saya: backfill massal + throttle 10 menit; endpoint `/api/tasks/count`; badge non-blocking.
- Dashboard O(n) via `groupRowsByProject`; daftar sesi QC tanpa N+1.
- Frontend: `loadCollection` aman terhadap hak baca + dedupe request; batas render 200 baris; asset berversi.
- Bug: tugas lama hilang karena limit 2500; Progress error untuk QC; ATI error untuk Site Manager; menu Dokumen ATI; "undefined" di log ATI.
- Tes baru `scripts/performance-smoke.mjs`. Tidak ada migration baru.

## V3.4.17 — Site Manager & Divisi Operational

- Role `project_manager` dan `pelaksana_lapangan` dilebur menjadi `site_manager` (label **Site Manager**), langsung di bawah Head of Operational.
- Master Proyek: satu field `siteManagerUserId`; `pmUserId`/`projectManagerUserId` disinkronkan otomatis untuk kompatibilitas; field Pelaksana dikosongkan.
- Progress harian/mingguan: status baru `SUBMITTED_TO_OPERATIONAL`; tahap Review PM dihapus. Status lama `SUBMITTED_TO_PM`/`PM_APPROVED` tetap diterima sebagai menunggu Head of Operational.
- Issue: review/penutupan oleh Head of Operational.
- Tabel Laporan Harian: kolom Status + tombol workflow.
- Logistik → **Admin Logistik** di grup **Divisi Operational**.
- Validasi: penanggung jawab proyek, PIC progress, dan pengaju CCO wajib Site Manager.
- Migration `0023_site_manager_restructure.sql`; tes baru `scripts/site-manager-smoke.mjs`; tes lama diperbarui.

## V3.4.16 — Rute Kunjungan QC

- Kartu baru **Rute Kunjungan QC** di QC Dashboard: rute hari ini + jadwal mingguan berulang.
- CRUD titik rute (Tambah/Edit/Nonaktifkan/Hapus) untuk QC, Head of Supporting, Head of Operational, manajemen; PM/Pelaksana read-only sesuai proyeknya.
- Tombol Mulai/Lanjutkan Inspeksi dari rute hari ini membuka Continuous QC Inspection proyek.
- Penanda "Ada inspeksi hari ini" berdasarkan aktivitas catatan inspeksi proyek.
- Collection `qc_visit_routes`, capability `qcRouteManage`, validasi `normalizeQcVisitRoute`.
- Migration `0022_qc_visit_routes.sql`; smoke test `scripts/qc-visit-route-smoke.mjs`.

## V3.4.15

- Sistem Informasi Publik `/info` diubah menjadi website company profile Natara yang lengkap.
- Menambahkan section Tentang, Filosofi, Visi/Misi, Nilai Perusahaan, Layanan, Pendekatan Kerja, Keunggulan, Segmentasi Klien, Portofolio, dan Kontak.
- Mengimpor 7 portofolio dari Company Profile: Rumah Losari, Rumah Espana, Kost Samata, YD Cafe, Rumah Nordic, Rumah Amirullah, dan RD House.
- Mengimpor dan mengoptimalkan 33 visual company profile sebagai static WebP assets.
- Public portfolio API mendukung `coverUrl`, `galleryUrls`, dan `specs` selain media R2.
- Admin `Profil & Portofolio` dapat mengedit konten company profile dan tetap mempertahankan static portfolio assets.
- Migration baru: `0021_public_company_profile_seed.sql`.

## V3.4.14
- Hapus assignment satu QC dari Master Proyek dan kolom QC pada Daftar Proyek.
- QC menjadi team-wide: seluruh user role QC dan Head of Supporting dapat inspeksi lintas proyek.
- PIC Temuan QC otomatis Project Manager proyek.
- PM dapat membuat/edit/hapus Temuan dan menerima Tugas Saya untuk tindak lanjut.
- Pelaksana tetap dapat melihat Temuan proyek tetapi tidak menjadi PIC workflow.
- Migration `0020_qc_pm_pic.sql` memindahkan PIC Temuan lama ke PM proyek.

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


## V3.4.13
- Dashboard proyek: grafik dua garis **Rencana** dan **Realisasi**.
- Sumbu X mengikuti tanggal sebenarnya, bukan hanya indeks titik.
- Tambah ringkasan Rencana, Realisasi, dan Deviasi per proyek.
- Titik awal master proyek menjadi anchor 0% agar grafik tetap berupa garis walau baru ada satu laporan progress.
- Baseline rencana dapat dibentuk dari Time Schedule/Kurva-S bila tersedia; input planProgress harian/mingguan tetap diprioritaskan.
