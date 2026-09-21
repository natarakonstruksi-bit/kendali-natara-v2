# Deploy Checklist V3.1.6

1. Replace source V3.1.5 dengan isi paket V3.1.6.
2. Pastikan folder `public/assets/` ikut ter-upload.
3. Jalankan `npm run build`.
4. Pastikan hasil: `KENDALI V3.1.6 Branding & Greeting UI preflight OK`.
5. Jika migration 0014 sebelumnya sudah sukses, tidak perlu migration baru.
6. Jalankan `npx wrangler deploy`.
7. Buka `/app-build.json` dan pastikan `APP-V3.1.6`.
8. Hard refresh browser setelah deploy.
9. Login dan cek nama user muncul pada topbar serta welcome banner Dashboard.
10. Cek logo pada login, sidebar, dan tab browser.
