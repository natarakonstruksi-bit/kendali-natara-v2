# KENDALI Natara V2 — CF-02 FULL REPLACE

Gunakan paket ini untuk mengganti seluruh isi repo GitHub `kendali-natara-v2`.

Struktur root:
- migrations/0001_cf01_foundation.sql
- migrations/0002_cf02_identity_permissions.sql
- src/index.js
- public/index.html
- package.json
- wrangler.jsonc

Cloudflare Builds:
- Build command: `npx wrangler d1 migrations apply kendali-natara-db-v2 --remote`
- Deploy command: `npx wrangler deploy`

Setelah build Success:
- `/api/health` harus menunjukkan `schema_version: "CF-02"`
- `/api/db/check` harus menunjukkan roles > 0, users >= 1, permissions > 0


This SAFE package removes ALTER TABLE from migration 0002 so it can be applied cleanly on the current CF-01 database.
