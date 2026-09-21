# KENDALI Natara V3.1.1 — White Screen Fix

Versi ini memperbaiki layar putih pada V3.1. Penyebabnya adalah `renderAti` ditetapkan tanpa deklarasi pada ES module, sehingga browser melempar `ReferenceError` sebelum `init()` dijalankan.

Gunakan source ini untuk mengganti V3.1. Tidak ada migration baru; D1 dan R2 tetap memakai resource yang sama.

# KENDALI Natara V3.1 — Field + Procurement + QC + ATI

Versi ini melanjutkan V3.0.1 dan tetap memakai resource produksi yang sama:

- Worker: `kendali-natara-v2`
- D1: `kendali-natara-db-v2`
- D1 ID: `04849d77-cb23-4d50-9cfc-4e0d9c542d6b`
- R2: `kendali-natara-files-v2`
- Static assets: `public/`

Migration `0013_field_pr_qc_ati.sql` bersifat additive. Data lama pada `app_records` tidak dihapus.

## Perubahan V3.1

1. **PIC berbasis role**. Laporan harian/mingguan, schedule, milestone, issue dan perbaikan QC hanya memakai Pelaksana Lapangan; Opname hanya QS; PO/SPK hanya Procurement; Surat hanya Admin Teknik; fungsi lain disesuaikan per tanggung jawab.
2. **Laporan Harian + Tukang**. Pelaksana memilih nama pekerja/tukang, status kehadiran, upah harian, jam/tarif lembur. Sistem menyimpan snapshot ke `daily_workers` sehingga otomatis menjadi rekap gaji/upah.
3. **Purchase Request multi-item**. Satu PR dapat memiliki banyak item material/jasa dengan `Vol × HPP/Unit = Total HPP`.
4. **Vendor comparison**. Satu PR dapat memiliki beberapa vendor: Vendor ID/VML, nilai penawaran, term, lead time, catatan dan upload penawaran.
5. **Vendor decision**. Pemilihan vendor dikunci hanya untuk **Head Operational (Manager Operasional)** atau **Head Unit Bisnis**. Vendor terpilih kemudian dipakai untuk pembuatan PO/SPK.
6. **Nama proyek saja**. Kode proyek tidak dipakai di form/tabel operasional. UUID tetap dipakai internal database tetapi tidak menjadi identitas user-facing.
7. **QC Management System** mengikuti alur dashboard QC: `OPEN → ON PROGRESS → WAITING QC CHECK → CLOSED`, atau `WAITING QC CHECK → REVISION REQUIRED → ON PROGRESS`. Foto before dan after tersimpan di R2.
8. **ATI** mengikuti struktur dashboard sebelumnya: Pengajuan Pekerjaan, Database Tukang, Attendance & Productivity/Upah, Masalah Lapangan, Evaluasi Masalah, Assessment/Grading, Pelatihan, dan Log ATI. Talent pool menyimpan level L0–L6, skill, ketersediaan, tarif, portofolio, serta status masuk/keluar.
9. **Pengaju dana dikunci ke akun login**; user tidak dapat memilih nama karyawan lain sebagai pengaju. Role Project Manager/Pelaksana tetap hanya melihat proyek yang ditugaskan kepadanya pada frontend dan API.

## Build dan deploy

```bash
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Pertahankan `package-lock.json` repository produksi bila sudah ada.
