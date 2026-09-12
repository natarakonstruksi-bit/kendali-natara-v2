# KENDALI Natara V2 — CF-02

## Tujuan
Cloudflare Access = autentikasi identitas.
D1 = user, role, jobdesk dan permission.
KENDALI tidak menyimpan password.

## Migration
`migrations/0002_cf02_identity_permissions.sql`

Migration ini:
- membuat permissions + role_permissions
- memasang jobdesk summary
- membuat matriks kewenangan
- memastikan Administrator memiliki seluruh permission
- membuat Administrator awal dengan email `natarakonstruksi@gmail.com`
- mengubah schema version menjadi `CF-02`

## Worker APIs
- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/admin/roles`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`

## Cloudflare Access setup
Workers & Pages → `kendali-natara-v2` → Access → Protect this Worker behind Access.
Pilih **All traffic** dan izinkan email Administrator terlebih dahulu:
`natarakonstruksi@gmail.com`

Cloudflare Access memeriksa login sebelum Worker berjalan.
Setelah login, Worker membaca identitas melalui `ctx.access.getIdentity()` dan mencocokkannya dengan tabel `users` D1.

## Build
Build command tetap:
`npx wrangler d1 migrations apply kendali-natara-db-v2 --remote`

Deploy command:
`npx wrangler deploy`

## Verification
1. Build harus Success.
2. `/api/health` harus menunjukkan `schema_version: "CF-02"`.
3. Aktifkan Cloudflare Access.
4. Login memakai `natarakonstruksi@gmail.com`.
5. Halaman utama harus menampilkan:
   - Administrator
   - jobdesk Administrator
   - permission `system.full_access`

edit README
