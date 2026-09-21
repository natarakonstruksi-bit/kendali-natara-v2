# KENDALI V3.1.1 — White Screen Fix

- Memperbaiki error startup frontend `ReferenceError: renderAti is not defined` yang membuat `app.js` berhenti sebelum `init()` dan menyebabkan layar putih.
- `renderAti` sekarang dideklarasikan sebagai function yang valid pada ES module.
- Menambahkan fallback boot UI: jika frontend gagal dimuat, pengguna melihat pesan error dan tombol Muat Ulang, bukan layar putih.
- Tidak mengubah skema D1, data proyek, role, QC, ATI, PR, atau R2.

# Changelog

## V3.1.0

- Role-specific PIC pada semua form operasional utama.
- Daily Progress hanya Pelaksana Lapangan dan terhubung ke daftar tukang.
- `daily_workers` sebagai sumber rekap kehadiran, upah harian dan lembur.
- PR multi-item dengan HPP detail.
- Perbandingan multi-vendor dengan VML, harga, term, lead time dan lampiran.
- Vendor selection dikunci hanya untuk Head Operational atau Head Unit Bisnis.
- PO/SPK dapat diprefill dari vendor PR terpilih.
- Project code dihilangkan dari UI operasional.
- QC dashboard dikembalikan ke model Temuan QC / Tugas / Verifikasi dan bukti before-after.
- ATI dashboard: Pengajuan Pekerjaan, Database Tukang, Attendance & Productivity/Upah, Masalah Lapangan, Evaluasi, Assessment/Grading, Pelatihan, Log, talent pool dan leveling.
- Tambah koleksi `daily_workers`, `qc_actions`, `qc_verifications`, `ati_assessments`.
- Migration additive `0013_field_pr_qc_ati.sql`.

- Pengaju dana dikunci ke user login dan identitas requester tidak dapat dialihkan saat edit.
- PR selalu memakai Project Manager yang ditugaskan sebagai pemilik/pengaju; vendor decision bukan kewenangan Admin/Direktur.
