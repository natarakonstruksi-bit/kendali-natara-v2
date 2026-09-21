# KENDALI Natara V3.0.1 — Role + Project Scope

KENDALI V3.0.1 adalah penyempurnaan V3.0 dengan tetap memakai resource produksi yang sama:

- Worker: `kendali-natara-v2`
- D1: `kendali-natara-db-v2`
- D1 ID: `04849d77-cb23-4d50-9cfc-4e0d9c542d6b`
- R2: `kendali-natara-files-v2`
- Static assets: `public/`

Data lama tetap berada di `app_records`; migration baru bersifat additive.

## Perubahan utama

1. Dashboard per proyek memiliki grafik **Rencana vs Aktual/Realisasi** berdasarkan Progress Harian/Mingguan yang diinput.
2. Project Manager, Pelaksana, QS, QC, Admin Teknik dan field PIC lain memakai **dropdown master karyawan**.
3. Keuangan dipisahkan jelas menjadi baseline/HPP, Piutang, Cash In, Hutang, Cash Out, dan Pengajuan Dana.
4. **Pengajuan Dana Karyawan** memiliki workflow Draft → Pending → Approved/Rejected → Paid; Paid otomatis membuat Cash Out.
5. Opname menjelaskan fungsi QS/Quantity Surveyor dan menyimpan volume kontrak, periode, serta volume terverifikasi.
6. QC memiliki daftar semua item pekerjaan, sync dari RAB, inspeksi berulang, upload bukti wajib, defect otomatis, dan re-inspection.
7. CCO dikunci sesuai alur Pelaksana/PM → Admin → QS → Admin → Client → Addendum → Closed, termasuk kontrol 8%/10%.
8. Procurement menjelaskan dan memisahkan PR dari PO/SPK; PO/SPK aktif otomatis membentuk payable/outstanding.
9. Menu **Karyawan & Akses** untuk membuat akun, role, jabatan, unit, departemen, status, dan password.
10. RBAC berlaku di frontend dan backend API.


## Pembatasan proyek per user

Role **Project Manager** dan **Pelaksana Lapangan** sekarang memakai pembatasan proyek sampai level data/API, bukan hanya filter tampilan.

- Project Manager hanya melihat proyek yang field `pmUserId`-nya menunjuk ke akun tersebut.
- Pelaksana Lapangan hanya melihat proyek yang field `pelaksanaUserId`-nya menunjuk ke akun tersebut.
- Kompatibilitas data lama tetap didukung melalui `pmUsername`, `projectManagerUsername`, `pengawasUsername`, dan `pelaksanaUsername`.
- Dashboard, daftar proyek, progress, issue, CCO, PR, pengajuan dana, dokumen, flow, QC-related data, dan endpoint legacy ikut tersaring berdasarkan proyek yang ditugaskan.
- Akses file R2 melalui adapter legacy juga memeriksa scope proyek.
- Angka Cash In/Cash Out/Piutang/Hutang tidak dikirim di response dashboard untuk role yang tidak mempunyai menu Finance.

Penugasan dilakukan oleh role yang berwenang pada **Master Proyek** melalui dropdown Project Manager dan Pelaksana Lapangan. Jika akun PM/Pelaksana belum dipasang pada proyek, proyek tersebut tidak akan muncul pada akun itu.

## Deploy

Build command:

```bash
npm run build
```

Deploy command bila repository memakai Wrangler:

```bash
npx wrangler d1 migrations apply DB --remote && npx wrangler deploy
```

`package.json` tetap memakai dependency Wrangler yang sama seperti versi sebelumnya. Jika repository Git saat ini sudah memiliki `package-lock.json`, pertahankan file lock tersebut agar `npm clean-install`/`npm ci` tetap berjalan.

## Migration

Migration baru: `migrations/0012_full_workflow_roles_qc_cco.sql`.

Migration hanya menambah indeks dan metadata versi. Collection baru seperti `qc_work_items` tetap menggunakan arsitektur JSON `app_records`, sehingga tidak memerlukan tabel per modul.

## Catatan QC sync dari RAB

Tombol **Sinkron dari RAB** membaca bentuk data RAB yang umum: `items`, `rows`, `details`, `workItems`, `pekerjaan`, `rabItems`, atau field item/description/uraian pada record. Jika RAB lama tidak menyimpan detail item sebagai struktur data, item QC dapat ditambah manual tanpa menghapus data lama.

## Catatan keamanan workflow

CCO, Payment Request, PR, dan QC Inspection menggunakan action endpoint khusus. Pengguna tidak dapat mengubah status kritis langsung lewat form biasa untuk melewati gate workflow.
