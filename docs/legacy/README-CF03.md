# KENDALI Natara V2 — CF-03

## Scope
- User/Karyawan API
- Role lookup
- Project CRUD
- Project Members / assignment
- Field Executor hanya melihat proyek yang ditugaskan
- Administrator dan role dengan `project.view_all` melihat seluruh proyek
- Audit Trail untuk perubahan User, Project dan Assignment
- Mode Lapangan otomatis untuk `FIELD_EXECUTOR`

## Migration
Tambahkan:
`migrations/0003_cf03_users_projects.sql`

## Replace
`src/index.js`

Tidak perlu mengganti `wrangler.jsonc` CF-02A.

## Deploy command
Tetap:
`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

## Verification
- `/api/health` => `schema_version: CF-03`
- Administrator: `/api/projects` boleh melihat semua proyek.
- User nonaktif: ditolak meskipun Cloudflare Access mengenali email.
- FIELD_EXECUTOR: `/` diarahkan ke `/lapangan`.
- FIELD_EXECUTOR: `/api/projects` hanya proyek yang ada di `project_members`.
