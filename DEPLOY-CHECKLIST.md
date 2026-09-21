# Deploy Checklist — V3.2.1

1. Replace source repository dengan isi paket V3.2.1.
2. Pertahankan resource existing: D1 `kendali-natara-db-v2` dan R2 `kendali-natara-files-v2`.
3. Jalankan `npm run build`.
4. Jalankan `npx wrangler d1 migrations apply DB --remote`.
5. Jalankan `npx wrangler deploy`.
6. Hard refresh browser.
7. Login sebagai Administrator/Manajemen → menu **Profil & Portofolio**.
8. Isi profil Natara dan tambah minimal satu portofolio.
9. Buka `/info` tanpa login dan pastikan hanya profil + portofolio yang tampil.
10. Pastikan endpoint internal seperti `/api/dashboard` tanpa login tetap menghasilkan 401.
