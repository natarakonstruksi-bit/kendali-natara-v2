# KENDALI — Deploy ke Cloudflare Pages

Build ini siap untuk Cloudflare Pages Direct Upload. Tidak memerlukan build command karena seluruh asset sudah berupa hasil build (`index.html` + `assets/`).

## Cara deploy paling cepat
1. Masuk ke Cloudflare Dashboard.
2. Buka **Workers & Pages**.
3. Pilih **Create application** > **Pages** > **Use direct upload**.
4. Buat nama project, misalnya `kendali`.
5. Upload ZIP ini atau folder hasil extract.
6. Klik **Deploy site**.
7. Setelah berhasil, buka URL `*.pages.dev` untuk UAT.

## Custom domain
1. Buka project Pages > **Custom domains**.
2. Pilih **Set up a custom domain**.
3. Masukkan domain/subdomain KENDALI.
4. Jika domain menggunakan DNS Cloudflare pada akun yang sama, Cloudflare dapat membuat record yang diperlukan dari dashboard.

## Supabase
Deployment hosting tidak mengubah database Supabase. Jika nanti memakai Supabase Auth, pastikan **Site URL** dan **Redirect URLs** di Supabase Auth mengarah ke domain Cloudflare/custom domain yang baru.

## Catatan
- Aplikasi ini merupakan SPA dan Cloudflare Pages memiliki SPA fallback otomatis selama tidak ada file `404.html` di root.
- Jangan membuat aturan Cache Everything untuk seluruh domain Pages; gunakan default caching Cloudflare kecuali ada kebutuhan khusus.
- Build ini belum mengubah backend Supabase Auth/RLS. Dokumen `SUPABASE-AUTH-RLS-MIGRATION.md` tetap berlaku.
