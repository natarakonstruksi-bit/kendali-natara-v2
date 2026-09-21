# KENDALI Natara V3.1.6 — Branding & Greeting UI

V3.1.6 melanjutkan seluruh fungsi V3.1.5 dan menambahkan identitas visual Natara Konstruksi serta sapaan personal untuk user yang login.

## Perubahan V3.1.6

- Logo Natara Konstruksi dipasang pada halaman login, sidebar, dashboard, dan favicon.
- Halaman login didesain ulang menjadi tampilan corporate dua panel.
- Warna UI memakai aksen terracotta dari logo Natara dengan sidebar dark.
- Topbar menampilkan `Halo, [nama user]` dan role akun yang sedang login.
- Dashboard menampilkan welcome banner `Halo, [nama lengkap user]` beserta tanggal dan scope akses proyek.
- Nama yang ditampilkan selalu berasal dari session user aktif, bukan teks statis.
- Seluruh fungsi QC Inspection V3.1.5 tetap dipertahankan.

## Deploy

Tidak ada migration database baru pada V3.1.6 apabila migration 0014 sudah pernah dijalankan.

```bash
npm run build
npx wrangler deploy
```

Jika deployment environment belum pernah menjalankan migration 0014, jalankan migration terlebih dahulu.
