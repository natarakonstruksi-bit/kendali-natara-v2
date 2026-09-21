# KENDALI Natara V3.2.1 — Profil Natara & Portofolio

Versi ini mempertahankan seluruh fungsi internal KENDALI V3.1.6/V3.2, tetapi portal publik `/info` hanya berfungsi sebagai **website profil Natara Konstruksi dan portofolio**.

## Halaman publik
- `/info`
- `/public`
- `/informasi`

Tidak membutuhkan login.

## Konten publik
1. Apa itu Natara Konstruksi.
2. Fokus/layanan Natara.
3. Kontak dan alamat publik.
4. Portofolio proyek: judul, kategori, lokasi, tahun, ringkasan, deskripsi, cover, dan galeri foto.

Portal tidak menampilkan progress, RAB/HPP, cashflow, QC, CCO, opname, vendor, karyawan, tukang, dokumen internal, atau audit.

## Pengelolaan
Login KENDALI → **Profil & Portofolio** → Edit Profil / Tambah Portofolio.

## Deploy
```bash
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Migration baru `0016_public_company_portfolio.sql` hanya menandai versi schema karena `app_records` tetap generic. D1 dan R2 produksi yang lama tetap digunakan.
