# Rencana Migrasi Supabase Auth + UUID + RLS

Dokumen ini adalah langkah hardening backend yang **belum dijalankan otomatis**, karena paket yang tersedia hanya `dist` frontend dan tidak menyertakan skema/migration database lengkap.

## Target arsitektur

Login pengguna tidak lagi dipercaya dari `localStorage` atau role yang dikirim browser. Identitas authoritative harus berasal dari Supabase Auth:

`Supabase Auth → auth.uid() → employee/profile → active role → policy/RPC → database`

## 1. Backup
- Buat backup database produksi.
- Export tabel `users`, `projects`, `po`, dan seluruh tabel transaksi.
- Simpan mapping username lama ke employee/user baru.

## 2. Identity permanen
Tambahkan ID permanen untuk setiap karyawan. Minimal:
- `employee_id UUID` — primary/business identity karyawan.
- `auth_uid UUID` — FK ke `auth.users.id`.
- `role_key` — role aktif yang sudah dinormalisasi.
- `is_active`.
- `is_legacy`.

Jangan memakai username/nama sebagai relational key.

## 3. Migrasi relasi proyek
Migrasikan field berbasis username seperti:
- `pmUsername` → `pm_employee_id`
- `pengawasUsername` → `superintendent_employee_id` atau field final sesuai struktur
- `timUsername[]` → tabel `project_members(project_id, employee_id, project_role)`
- `pelaksanaUserId` yang masih berisi username → UUID employee sebenarnya
- verifier/approver/penerima material/petugas pembayaran → UUID

Jika ada nama/username yang tidak dapat dicocokkan satu-ke-satu, masukkan ke antrean `Perlu Verifikasi Admin`; jangan hapus histori.

## 4. Supabase Auth
- Buat/migrasikan akun aktif ke `auth.users`.
- Kaitkan `auth.users.id` dengan `employee.auth_uid`.
- Nonaktifkan login custom berbasis pembacaan password dari tabel `users`.
- Gunakan `supabase.auth.signInWithPassword()` atau metode Auth yang ditetapkan perusahaan.
- Session berasal dari Supabase Auth, bukan `kendali_session_v1` buatan aplikasi.

## 5. Helper authorization database
Buat helper database yang mengambil employee dan role berdasarkan `auth.uid()`. Contoh konsep:

```sql
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from employee_profiles
  where auth_uid = auth.uid()
    and is_active = true
    and coalesce(is_legacy, false) = false
  limit 1;
$$;
```

Nama tabel/kolom wajib disesuaikan dengan schema aktual sebelum dijalankan.

## 6. RLS
Aktifkan RLS pada seluruh tabel bisnis yang sensitif dan buat policy berdasarkan `auth.uid()`/employee ID, bukan role dari frontend.

Minimal mencakup:
- users/employees
- projects/project_members
- fund_requests/payments
- material_requests/material_transactions/stock
- tool_requests/assets/asset_movements
- purchase_orders/goods_receipts/invoices
- qc_findings/qc_verifications
- cco
- pho/fho/retention
- audit_log

Prinsip:
- SELECT: hanya proyek/rekaman yang memang dapat dilihat pengguna.
- INSERT: hanya role pembuat pada tahapan yang valid.
- UPDATE: hanya role pemilik tahapan saat ini.
- DELETE: dibatasi keras; transaksi posted sebaiknya tidak dihapus, gunakan reversal.

## 7. RPC untuk transisi approval
Untuk transaksi penting, jangan mengandalkan update status langsung dari browser. Gunakan database function/RPC atomik, misalnya:
- `verify_fund_operational(request_id, decision, note)`
- `verify_fund_cost_control(...)`
- `approve_fund_final(...)`
- `post_goods_receipt(...)`
- `reverse_goods_receipt(...)`
- `verify_qc(...)`
- `close_qc(...)`
- `activate_cco(...)`
- `approve_pho(...)`
- `approve_fho(...)`
- `close_project(...)`

Setiap RPC wajib memeriksa:
1. `auth.uid()`;
2. role aktif;
3. project membership bila relevan;
4. current status;
5. limit nominal bila relevan;
6. prerequisite documents;
7. idempotency/duplicate action.

## 8. Audit log append-only
Gunakan tabel audit terpisah yang minimal berisi:
- `id`
- `created_at` server timestamp
- `actor_auth_uid`
- `actor_employee_id`
- `actor_role`
- `module`
- `record_id`
- `action`
- `status_before`
- `status_after`
- `data_before jsonb`
- `data_after jsonb`
- `note`
- `request_id/session metadata` bila tersedia

Pengguna biasa tidak boleh UPDATE/DELETE audit log. Sebaiknya ditulis via trigger atau RPC.

## 9. Acceptance test backend
Uji sekurangnya:
- Pelaksana tidak dapat menutup QC dengan request manual.
- Pelaksana/Superintendent tidak dapat posting stok.
- Cost Control tidak dapat membayar.
- Finance tidak dapat mengubah baseline atau mengaktifkan CCO.
- Head Operational tidak dapat menutup QC/proyek.
- Admin Sistem tidak dapat melakukan approval bisnis hanya karena status admin sistem.
- Approval nominal dana di atas limit ditolak database.
- CCO tanpa bukti klien ditolak.
- FHO sebelum retensi selesai ditolak.
- Closed tanpa FHO final ditolak.
- Receipt posted tidak dapat dihapus; reversal harus dipakai.

## 10. Cutover
- Jalankan migrasi pada staging terlebih dahulu.
- UAT per role menggunakan akun nyata/dummy.
- Cocokkan saldo stok, PO, payment history, project assignments, dan approval history sebelum/akhir migrasi.
- Baru setelah semua test lulus, matikan login legacy dan pindahkan production ke Supabase Auth.
