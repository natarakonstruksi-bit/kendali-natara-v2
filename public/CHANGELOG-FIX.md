# Changelog — KENDALI Jobdesk Final

Tanggal: 7 Agustus 2026

## Role & struktur
- Admin: full access seluruh KENDALI.
- Admin Teknik: Document Controller seluruh proyek; arsip semua SPK dan dokumen formal.
- Admin Logistik: material, tools/inventaris, mutasi, vendor, PO, penerimaan.
- ATI tetap di bawah Head of Supporting.
- HSE Officer tetap legacy/nonaktif untuk penugasan baru.
- Role legacy diblokir dari login transaksi baru.

## Access control
- Menambahkan filter tab detail proyek per role.
- Menambahkan/menegaskan store-level guard untuk user management, backup/restore, QC/inspeksi, opname, K3, SI/RFI, absensi, action plan, CPR, subkon, RAB, ATI, vendor, inventaris, proyeksi, surat, arsip proyek, PHO/FHO dan workflow lainnya.
- Full role menjadi override resmi sehingga Administrator tetap dapat melakukan seluruh kontrol dan approval.

## Admin Teknik
- Menambahkan job `Arsip SPK & Dokumen Proyek`.
- Menambahkan kategori arsip lengkap.
- Menambahkan reminder SPK, CCO/Addendum, PHO/FHO dan BAST yang belum diarsipkan.
- Menjamin akses lintas seluruh proyek untuk dokumentasi, tanpa memberikan transaksi logistik.

## QC & Serah Terima
- Mempertahankan hotfix Closed agar temuan selesai hilang dari daftar aktif/overdue.
- QC 7 tahap tetap dipertahankan.
- Menambahkan final approval punch list oleh Head of Supporting.
- Membatasi inspeksi formal ke QC.
- Memperketat PHO/FHO, checklist dan lifecycle sesuai role.

## Engineering & Commercial
- RAB hanya dibuat/revisi/diajukan Senior Estimator/full.
- Review RAB oleh Head of Engineering, final Manager.
- Opname formal hanya QS/full.
- CCO mengikuti technical → cost → manager → client → activate.

## Finance & Cost Control
- Finance mengelola transaksi/pembayaran/invoice/termin subkon.
- Cost Control mengelola baseline/CPR/forecast dan verifikasi budget; tidak membayar.

## Logistik
- Stok resmi dan inventaris hanya Admin Logistik/full.
- PO mengikuti Cost Control → Manager → vendor → receipt/invoice.
- Barang baik/rusak/ditolak dipisahkan; hanya barang baik menambah stok.
- Reversal penerimaan mengembalikan stok dan mempertahankan histori.

## System control
- Tambah/edit/hapus user dibatasi full role.
- Export/import/reset backup dibatasi full role.
- Administrator tetap mempunyai semua akses KENDALI.

## 2026-08-10 — Laporan Progres Mingguan berbasis PDF
- Menghapus input volume mingguan manual.
- Laporan progres mingguan hanya diunggah oleh Pelaksana Lapangan; Administrator tetap full access.
- Menambahkan pembacaan teks PDF menggunakan PDF.js.
- Menambahkan ekstraksi bobot mingguan dan bobot kumulatif.
- Menambahkan pencocokan otomatis item PDF ke Rincian & Bobot/RAB.
- Rincian & Bobot sekarang menampilkan bobot realisasi mingguan, kumulatif, dan progres item.
- Progres fisik proyek otomatis mengambil bobot kumulatif PDF terbaru.
- Laporan Progres diubah menjadi tampilan berbasis PDF dan menyediakan tombol Buka PDF/Ganti PDF.
- Tetap kompatibel dengan data laporan progres lama berbasis volume.

## 2026-08-10 — Deviasi Progres Mingguan
- Menambahkan snapshot `rencanaProyek` pada setiap PDF laporan progres mingguan.
- Menambahkan `deviasi = bobot kumulatif aktual - progres rencana` pada data laporan.
- Menampilkan Rencana dan Deviasi pada preview upload PDF.
- Menampilkan Rencana dan Deviasi pada tab Laporan Progres.
- Menampilkan Deviasi pada pilihan histori laporan mingguan.
- Menampilkan Rencana dan Deviasi pada ringkasan Rincian & Bobot.
- Warna deviasi: merah untuk negatif (terlambat), hijau untuk nol/positif (sesuai/lebih cepat).
- Laporan lama tanpa snapshot rencana tetap kompatibel dengan fallback ke rencana proyek saat ini.
