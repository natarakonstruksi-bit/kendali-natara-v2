# KENDALI Natara V2.8 — End-to-End Project Control

Versi ini menambahkan kontrol proyek dari pembukaan proyek sampai `CLOSED`, termasuk pemasukan/pengeluaran seluruh proyek, progress, schedule, opname, QC/defect, CCO, procurement, approval, dokumen proyek, retensi, FHO, financial close-out, dan audit log.

## Yang sudah tersedia

- Dashboard portfolio seluruh proyek: nilai kontrak, cash-in, cash-out, net cash, budget/HPP, committed cost, sisa budget, piutang, hutang, QC/defect, issue, approval, CCO, jadwal, progress, dan status gate.
- Finance per proyek: budget/cost code, pemasukan, pengeluaran, piutang, hutang, payment request, approval queue.
- Progress: schedule/Kurva-S, milestone, laporan harian, laporan mingguan, issue/corrective action.
- QS: opname dan BA opname.
- QC: inspection, defect, PIC, deadline, corrective action, closure.
- CCO/Addendum: nilai, % terhadap RAB, status, approval, lampiran.
- Procurement: PR, PO/SPK, vendor, committed cost, pembayaran.
- Dokumen proyek: upload, buka, edit metadata, ganti file, hapus file, version number, audit trail.
- Alur proyek otomatis: Setup → Pre-Con → Mobilisasi → Pelaksanaan → PHO → Retensi → FHO → Financial Close → CLOSED.
- Close-Out: checklist standar, dokumen PHO/as-built/FHO/final reconciliation, retensi, evaluasi otomatis.
- Audit Log: UPSERT, DELETE, upload/edit/delete dokumen, login, sinkronisasi status.
- Master Data: RAB, surat, vendor, tukang/crew, aset, pelatihan, proyeksi, dan user tetap memakai collection D1 lama.

## Dokumen wajib per gate

| Gate | Dokumen wajib |
|---|---|
| Project Setup | CONTRACT, RAB_BASELINE, DED_FINAL, TIME_SCHEDULE |
| Pre-Construction | PCM, MC0 |
| PHO | PHO_BAST, AS_BUILT |
| FHO | FHO_BAST bila FHO/retensi diwajibkan |
| Financial Close-Out | FINAL_RECONCILIATION |

Dokumen lain seperti bukti pembayaran, BA opname, bukti QC, addendum/CCO, PO/SPK, delivery receipt, dan retensi dapat di-upload dari form terkait atau menu Dokumen.

## Aturan CLOSED

Proyek hanya menjadi `CLOSED` ketika seluruh gate terpenuhi. Sistem memblokir penutupan bila masih ada progress <100%, QC/defect/issue terbuka, dokumen PHO/as-built belum ada, retensi/FHO belum selesai jika berlaku, piutang/hutang masih tersisa, CCO/approval/payment request belum selesai, checklist close-out masih terbuka, atau final reconciliation belum di-upload.

## Struktur teknis

- Cloudflare Worker: `src/worker.js`
- Cloudflare D1: binding `DB`
- Cloudflare R2: binding `FILES`, bucket `kendali-files`
- Static assets: `public/`
- Migration: `migrations/0011_project_control_end_to_end.sql`
- Konfigurasi: `wrangler.jsonc`

Migration bersifat additive: data `app_records` lama tidak dihapus.

## Sebelum deploy ke KENDALI lama

Isi dua nilai berikut pada `wrangler.jsonc` menggunakan **D1 database lama yang sekarang dipakai KENDALI**:

- `database_name`
- `database_id`

Jangan membuat D1 baru bila tujuannya mempertahankan seluruh data proyek/karyawan lama.

R2 menggunakan bucket `kendali-files`. Jika bucket produksi Anda memiliki nama berbeda, ubah `bucket_name` saja tanpa memindahkan data secara sembarang.

## Deploy

```bash
npm install
npm run check
npm run deploy
```

`npm run deploy` menjalankan preflight, migration remote D1, kemudian deploy Worker + static assets.

Untuk pengembangan lokal:

```bash
npm install
npm run dev
```

## Login

Untuk **upgrade database lama**, user lama tetap dipertahankan. Migration tidak membuat admin baru bila collection `users` sudah berisi data.

Untuk **database benar-benar baru dan kosong**, migration membuat akun sementara:

- Username: `admin`
- Password: `Kendali#2026!`

Segera ubah password lewat menu **Ganti password** setelah login pertama.

## Dokumen: upload, edit, ganti, hapus

Menu **Dokumen** menyediakan empat fungsi:

1. **Upload** — simpan file di R2 dan metadata di D1.
2. **Buka** — file dibaca melalui endpoint KENDALI yang membutuhkan sesi login.
3. **Edit / Ganti File** — metadata dapat diperbarui tanpa ganti file; bila file baru dipilih, file lama di R2 dihapus, file baru disimpan, dan versi naik.
4. **Hapus** — menghapus file R2 sekaligus metadata D1 dan mencatat audit log.

Maksimal upload default: 25 MB/file.

## Kontrol keuangan dashboard

- `Pemasukan` = transaksi cash-in berstatus PAID/VERIFIED/RECEIVED/TERBAYAR/DITERIMA/LUNAS, atau data legacy tanpa status.
- `Pengeluaran` = transaksi cash-out dengan kriteria realisasi yang sama.
- `Committed Cost` = sisa PO/SPK yang belum selesai/lunas.
- `Sisa Budget` = Budget − Actual Expense − Committed Cost.
- `Piutang/Hutang` = nilai outstanding dikurangi nilai yang sudah diterima/dibayar.
- Budget menggunakan line `project_budget` approved/revised/closed bila tersedia; bila belum ada, fallback ke budget/HPP pada master proyek.

## Upgrade aman

Sebelum deploy produksi:

1. Backup D1 produksi.
2. Pastikan `database_id` di `wrangler.jsonc` sama dengan D1 KENDALI lama.
3. Pastikan R2 `kendali-files` benar.
4. Jalankan `npm run check`.
5. Jalankan migration.
6. Deploy.
7. Uji login, dashboard, CRUD, upload/edit/delete dokumen, dan sinkronisasi status satu proyek uji.

Lihat juga `ALUR-KENDALI.md` dan `DEPLOY-CHECKLIST.md`.
