# KENDALI — Matriks Jobdesk & Kewenangan Final

Versi: 7 Agustus 2026

Dokumen ini menjadi acuan pembagian fungsi pada build KENDALI Jobdesk Final. Prinsip yang dipakai adalah **satu pemilik proses, pemisahan maker–checker–approver, dan Administrator sebagai full-control override**.

## Prinsip Akses

- **Administrator (Admin)** memiliki akses penuh seluruh KENDALI: seluruh proyek, modul, data, approval, user, konfigurasi, backup/restore, koreksi, dan override sistem.
- **Direktur** tetap memiliki akses penuh dan kewenangan persetujuan tertinggi.
- Role operasional lain hanya melihat/mengubah fungsi sesuai jobdesk.
- Aksi penting juga dibatasi pada fungsi/store aplikasi, bukan hanya menyembunyikan tombol.
- Role legacy tidak dapat login untuk transaksi baru dan harus dimigrasikan.

## Matriks Posisi

| Posisi | Tanggung Jawab Utama | Aksi Utama di KENDALI | Tidak Menjadi Kewenangan |
|---|---|---|---|
| Administrator | Pengendalian sistem | Semua modul, semua proyek, semua approval, user, backup/restore, koreksi/override | — |
| Direktur | Keputusan dan approval tertinggi | Full access, approval dana > Rp10 juta, keputusan strategis | — |
| Manager Konstruksi | Pimpinan operasional seluruh proyek | Master proyek, approval final RAB, PO, CCO, dana sesuai limit, lifecycle proyek, PHO/FHO/Closed | Posting stok harian, pembayaran Finance |
| Head of Operational | Kontrol eksekusi proyek | Progres, kendala, K3, action plan, tindak lanjut QC, verifikasi kebutuhan lapangan, kesiapan PHO/FHO | Final close QC, posting stok, pembayaran |
| Finance | Kontrol transaksi keuangan | Kas masuk/keluar, verifikasi administrasi dana, pembayaran, invoice vendor, termin subkon, rekonsiliasi, verifikasi keuangan PHO/FHO | Mengubah baseline RAB/HPP/CPR, approval teknis |
| Head of Engineering | Kontrol teknis | Review teknis RAB/CCO, gambar, MEP, RFI/SI, koordinasi teknis | Menyusun RAB sebagai estimator, opname formal, pembayaran |
| Head of Supporting | Pimpinan QC dan ATI | Review/final approval QC, final punch list, monitoring kualitas, pengawasan ATI | Material, tools, stok, inventaris, pembayaran |
| Superintendent | PIC proyek/lapangan | Laporan/progres, tenaga, absensi, permintaan material/tools, proyeksi material, kendala/K3, paket & progres subkon, draft CCO, persiapan BAST/PHO/FHO | Posting stok, pembayaran subkon, final QC, opname formal |
| Pelaksana Lapangan | Pelaksanaan pekerjaan | Laporan harian/progres, absensi, kendala/K3, request material/tools, perbaikan QC, RFI/SI lapangan | Approval, posting stok, pembayaran, final QC |
| Senior Estimator | Penyusunan RAB | Membuat, merevisi, mengajukan RAB; mendukung kalkulasi perubahan | Approval final RAB, pembayaran, opname formal |
| MEP Engineer | Engineering MEP | Gambar/revisi MEP, koordinasi teknis, kendala, RFI/SI, data teknis | Approval biaya/pembayaran, opname formal |
| Cost Control | Pengendalian biaya proyek | Baseline/HPP, forecast, CPR, deviasi, verifikasi budget dana/PO/CCO | Pembayaran, kas/bank |
| Quantity Surveyor | Pengukuran volume | Opname formal, quantity check, review volume CCO | Pembayaran, approval final RAB |
| Drafter/BIM | Dokumentasi gambar | Gambar kerja, revisi, BIM | Approval biaya/keuangan |
| Admin Teknik | **Document Controller seluruh proyek** | **Mengarsipkan SEMUA SPK semua proyek**, kontrak vendor/subkon, kontrak kerja sama, CCO/addendum, surat, berita acara, BAST, PHO/FHO, RAB final, gambar/as-built, dokumen teknis; menyiapkan administrasi serah terima | Material, tools, stok, inventaris, vendor procurement, pembayaran |
| Admin Logistik | Logistik dan procurement | Master/stok material, penerimaan resmi, inventaris/mutasi tools, vendor, proyeksi kebutuhan, PO, pengadaan | Arsip teknis sebagai Document Controller, pembayaran bank |
| Senior QC | Quality control senior | Inspeksi, temuan mutu, verifikasi perbaikan, punch list, laporan mutu | Final closure QC (Head Supporting), stok/pembayaran |
| QC Inspector | Quality inspection | Inspeksi lapangan, buka temuan, dokumentasi, punch list | Final closure QC, stok/pembayaran |
| Kepala ATI | Pengelolaan ATI | Master tukang, program pelatihan, evaluasi kompetensi, sertifikasi | Vendor/logistik |
| Instruktur ATI | Pelaksanaan pelatihan | Pelaksanaan batch, absensi peserta, penilaian/hasil pelatihan | Master vendor/logistik, approval proyek |

## Workflow Kritis

### QC
QC Inspector/Senior QC → Head of Supporting → Head of Operational → Superintendent → Pelaksana Lapangan → QC Verifikasi → Head of Supporting Final Approval → Closed.

Temuan `Closed` tidak lagi muncul di pekerjaan aktif/overdue. Temuan yang terlambat tetap tersimpan sebagai histori Closed Overdue.

### Punch List
QC membuat/memperbarui → status Selesai → **Head of Supporting Final Approval** → `Diterima Klien`. QC tidak dapat langsung memfinalkan.

### Pengajuan Dana
Pengaju → Head of Operational → Cost Control → Finance → Approver Final → Finance membayar.

- ≤ Rp1 juta: Head of Operational
- > Rp1 juta s.d. Rp10 juta: Manager Konstruksi
- > Rp10 juta: Direktur
- Administrator: full override.

### RAB
Senior Estimator → Review Head of Engineering → Approval Final Manager Konstruksi → Disetujui/Ditolak → Manager/Admin dapat menjadikan RAB yang disetujui sebagai proyek.

### Material
Pelaksana/Superintendent request → Superintendent verifikasi → Admin Logistik proses → Head of Operational approval → Admin Logistik melakukan transaksi stok resmi.

### Tools
Pelaksana/Superintendent request → Superintendent verifikasi → Admin Logistik proses → Head of Operational approval → Admin Logistik menugaskan alat → pengembalian/pemeriksaan oleh Admin Logistik.

### Purchase Order
Admin Logistik Draft → Cost Control verifikasi budget → Manager Konstruksi approval → Admin Logistik kirim vendor → Admin Logistik posting penerimaan → Finance/Admin Logistik invoice → penyelesaian PO.

Barang rusak/ditolak tidak menambah stok dan tidak dihitung sebagai barang baik diterima. Reversal penerimaan hanya oleh Admin Logistik/Admin full.

### Subkontrak
Superintendent mengelola paket/SPK/lingkup/progres. **Finance** mencatat pembayaran termin. Admin Teknik mengarsipkan SPK/dokumen final.

### CCO
Draft (Superintendent/Engineering/QS/Estimator) → Pemeriksaan Teknis → Pemeriksaan Biaya Cost Control → Persetujuan Internal Manager → Dikirim ke Klien → Bukti Persetujuan Klien → Aktivasi Manager.

CCO baru mengubah nilai proyek setelah status `Aktif` dan bukti klien lengkap.

### PHO/FHO
Dokumen disiapkan Superintendent/Admin Teknik. Verifikasi dilakukan sesuai fungsi Head Operational, Head Supporting, Finance, dan Manager. FHO hanya setelah masa pemeliharaan selesai dan issue terbuka diselesaikan. Closed hanya setelah FHO memenuhi syarat; Administrator memiliki full override sesuai kebijakan sistem.

## Administrasi Dokumen — Admin Teknik

Admin Teknik memiliki akses lintas seluruh proyek sebagai Document Controller. KENDALI menampilkan reminder bila dokumen berikut belum masuk arsip:

- SPK proyek;
- CCO/Addendum aktif;
- PHO/FHO;
- BAST.

Kategori arsip proyek mencakup SPK, kontrak vendor/subkon, kontrak kerja sama, RAB Final/HPP, CCO/Addendum, berita acara, BAST, PHO/FHO, gambar teknis/as-built, laporan, surat/RFI/SI, dan dokumen pendukung lainnya.

## Catatan Keamanan Produksi

Build yang direvisi adalah hasil kompilasi `dist`. Pembatasan workflow dan role sudah diperketat di aplikasi. Untuk keamanan produksi yang tidak dapat dilewati melalui akses database langsung, migrasikan login ke Supabase Auth + `auth.uid()` + UUID employee dan terapkan RLS/database function sesuai `SUPABASE-AUTH-RLS-MIGRATION.md`.


### Laporan Progres Mingguan
| Posisi | Tugas |
|---|---|
| Pelaksana Lapangan | Mengunggah PDF laporan progres mingguan. Tidak menginput volume/bobot manual. |
| Sistem KENDALI | Membaca bobot/progres dari PDF, mencocokkan ke Rincian & Bobot, dan memperbarui progres proyek otomatis. |
| Superintendent | Monitoring hasil laporan/progres; tidak menjadi penginput laporan progres mingguan. |
| Administrator | Full access, termasuk upload/ganti/hapus laporan bila diperlukan. |
