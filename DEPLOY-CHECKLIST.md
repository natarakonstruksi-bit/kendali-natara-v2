# Deploy Checklist — Nara System V3.4.15

1. Gunakan package **V3.4.15 Public Information Website**.
2. Jangan membuat D1/R2 baru; tetap gunakan binding produksi existing.
3. Jalankan QA lokal:

```bash
npm run build
python scripts/db-smoke.py
```

4. Terapkan migration baru `0021_public_company_profile_seed.sql`:

```bash
npx wrangler d1 migrations apply DB --remote
```

5. Deploy:

```bash
npx wrangler deploy
```

6. Hard refresh dan buka `/info`. Pastikan section Company Profile dan 7 portofolio tampil.
7. Login Administrator/role pengelola, buka **Profil & Portofolio**, pastikan konten hasil import dapat diedit dan static image tetap terbaca.
8. Uji link kontak/Instagram bila sudah diisi di Profil Publik.
9. Regression check internal: Dashboard, Tugas Saya, QC, PR/Vendor, QS/Volume, As-Built, CCO, ATI tetap dapat dibuka.

Catatan: migration memakai `json_patch`, sehingga field kontak/alamat existing pada `public_site_settings/main` dipertahankan.
