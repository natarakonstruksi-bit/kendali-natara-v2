# Changelog

## V3.1.4 — Continuous QC Inspection

- Mengganti tampilan checklist QC V3.1.3 dengan model pemeriksaan berkelanjutan seperti dashboard QC sebelumnya.
- Menambah `qc_inspection_sessions`, `qc_inspection_items`, dan `qc_work_groups`.
- Satu proyek hanya memiliki satu catatan DRAFT/Berjalan pada satu waktu.
- Menambah tujuh kelompok pekerjaan QC bawaan.
- Menambah input sub-pekerjaan, Sesuai/Tidak sesuai, keterangan, foto, edit hasil, ganti foto, dan hapus sub-pekerjaan.
- Menambah publish batch sub-pekerjaan Tidak sesuai → Temuan QC dengan PIC otomatis Pelaksana Lapangan.
- Menambah close/delete catatan dengan role guard dan audit.
- Menjaga alur Temuan → Perbaikan → Waiting QC → Verifikasi tetap aktif.
