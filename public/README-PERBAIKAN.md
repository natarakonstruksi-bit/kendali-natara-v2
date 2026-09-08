# KENDALI — Build Jobdesk Final

Versi: 7 Agustus 2026

Build ini merupakan revisi menyeluruh pembagian fungsi KENDALI berdasarkan jobdesk aktif Natara Konstruksi.

## Perubahan utama

- Administrator memiliki **full access seluruh KENDALI**: seluruh proyek, modul, data, approval, user, backup/restore, koreksi dan override.
- Hak akses halaman detail proyek difilter per role sehingga setiap posisi hanya melihat area yang relevan; full role tetap melihat semuanya.
- Admin Teknik ditetapkan sebagai **Document Controller semua proyek** dan wajib mengarsipkan semua SPK serta dokumen formal proyek.
- Admin Logistik menjadi pemilik material, stok, tools/inventaris, mutasi, vendor, PO dan penerimaan.
- Finance dan Cost Control dipisahkan: Cost Control mengendalikan budget/forecast/CPR; Finance melakukan transaksi/pembayaran.
- RAB: Senior Estimator → Head of Engineering → Manager Konstruksi.
- Opname formal hanya Quantity Surveyor/full.
- QC mengikuti alur 7 tahap dan Final Approval temuan hanya Head of Supporting/full.
- Punch list membutuhkan Final Approval Head of Supporting setelah QC menyatakan selesai.
- Pengajuan dana, material, tools, PO, CCO, PHO/FHO dan lifecycle diberi guard per tahap/role.
- Pembayaran subkon dilakukan Finance; paket/SPK/progres subkon dikelola Superintendent.
- Role legacy diblokir dari login transaksi baru.
- Pengelolaan akun serta backup/restore diberi guard full-access.
- Tampilan ATI/Vendor tidak lagi mencampur KPI yang bukan kewenangan role terkait.

## Admin Teknik — arsip semua SPK

Menu/fitur yang digunakan:

1. **Kerja Saya → Arsip SPK & Dokumen Proyek**.
2. Buka proyek → tab **Arsip SPK**.
3. Admin Teknik dapat mengarsipkan SPK, kontrak, CCO/Addendum, BA, BAST, PHO/FHO, RAB Final/HPP, gambar/as-built, surat/RFI/SI dan dokumen lain.
4. Tugas Saya memberi reminder lintas semua proyek jika SPK/CCO/PHO-FHO/BAST belum diarsipkan.

Admin Teknik tidak memiliki akses transaksi material/tools/inventaris/vendor procurement.

## Administrator

Role `Admin` memiliki capability `full`. Full-access berlaku pada menu, seluruh tab proyek, tindakan workflow, approval, data master, akun, backup/restore dan override sistem.

## Pengujian

Build diuji melalui pemeriksaan sintaks JavaScript, audit marker role/workflow/jobdesk, pemeriksaan konsistensi signature pemanggilan fungsi, serta smoke test asset melalui local HTTP server. Hasil QA final dicatat saat packaging.

## Penting untuk production

File ini adalah build `dist`, bukan source React asli. Workflow dan guard aplikasi sudah diperbaiki, tetapi hardening autentikasi/database penuh tetap memerlukan Supabase Auth + UUID user + RLS/backend policy. Baca `SUPABASE-AUTH-RLS-MIGRATION.md` sebelum menjadikan aplikasi sebagai sistem transaksi produksi yang bergantung pada keamanan database.

Lihat juga `JOBDESK-MATRIX-FINAL.md` untuk matriks tanggung jawab setiap posisi.


## Revisi Laporan Progres Mingguan — PDF
- Form input volume mingguan manual dihapus.
- Hanya Pelaksana Lapangan (dan Administrator/full access) yang mengunggah PDF laporan progres mingguan.
- PDF dibaca di browser menggunakan PDF.js yang sudah dibundel di aplikasi.
- Sistem mencari bobot/progres kumulatif dan mencocokkan uraian pekerjaan terhadap Rincian & Bobot/RAB.
- Bobot hasil PDF ditampilkan pada Rincian & Bobot dan Laporan Progres.
- `project.aktual` otomatis mengikuti bobot kumulatif PDF terbaru.
- PDF asli disimpan sebagai dokumen sumber dan dapat dibuka kembali.
- PDF hasil scan/foto tanpa text layer belum dapat dibaca otomatis; ekspor PDF sebagai PDF teks.

## Deviasi progres
Setiap PDF progres mingguan sekarang menyimpan snapshot progres rencana saat laporan diunggah. Sistem menghitung:

`Deviasi = Progres Aktual Kumulatif - Progres Rencana`

Contoh: rencana 65%, aktual 60% = deviasi -5% (terlambat). Rencana 65%, aktual 68% = deviasi +3% (lebih cepat). Deviasi tampil pada preview upload, Laporan Progres, dan Rincian & Bobot.
