# KENDALI Natara V3.1.4 — Continuous QC Inspection

Versi ini meneruskan V3.1.3 dan mengembalikan pola **Inspeksi QC berkelanjutan** seperti dashboard QC Natara sebelumnya.

## Perubahan QC utama

- Satu proyek mempunyai satu **catatan pemeriksaan yang masih Berjalan**.
- Catatan menampilkan kartu **Sub-pekerjaan, Sesuai, Tidak sesuai, Kesesuaian**.
- Identitas catatan: Nama Proyek, tanggal mulai, dan pemeriksa.
- Tujuh kelompok pekerjaan bawaan:
  1. Pekerjaan Persiapan
  2. Pekerjaan Struktur Bawah
  3. Pekerjaan Struktur Atas
  4. Pekerjaan Arsitektur
  5. Pekerjaan Sanitasi
  6. Pekerjaan Elektrikal
  7. Pekerjaan Landscaping
- Di setiap kelompok, QC dapat menambah sub-pekerjaan tanpa batas, memilih **Sesuai / Tidak sesuai**, menulis keterangan, dan mengambil/upload foto.
- Sub-pekerjaan Tidak sesuai dapat diterbitkan secara batch menjadi Temuan QC.
- PIC Temuan QC otomatis **Pelaksana Lapangan proyek** sesuai penugasan KENDALI.
- Catatan pemeriksaan dapat dilanjutkan setiap kunjungan; tidak perlu membuat inspeksi baru setiap kali.
- Catatan yang sudah ditutup menjadi read-only.
- Hapus catatan dibatasi untuk Administrator/Direktur/Head Unit Bisnis dan ditolak bila sudah mempunyai temuan.

## Data lama

D1 dan R2 tetap menggunakan resource produksi yang sama. Migration `0014_qc_continuous_inspection.sql` hanya menambahkan index, master tujuh kelompok pekerjaan QC, dan metadata versi. Data proyek, user, PR, progress, ATI, dan dokumen lama tidak dihapus.

## Build & deploy

```bash
npm clean-install --progress=false
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Setelah deploy, buka QC Dashboard → **+ Inspeksi Baru** → pilih proyek. Bila proyek sudah mempunyai catatan Berjalan, sistem otomatis membuka catatan yang sama.
