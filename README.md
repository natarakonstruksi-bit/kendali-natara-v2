# KENDALI Natara V2 — CF-01

Database D1:
- Name: `kendali-natara-db-v2`
- ID: `04849d77-cb23-4d50-9cfc-4e0d9c542d6b`
- Worker binding: `DB`

R2:
- Name: `kendali-natara-files-v2`
- Worker binding: `FILES`

Worker:
- Name: `kendali-natara-v2`

## Cloudflare Builds

Build command:
`npx wrangler d1 migrations apply kendali-natara-db-v2 --remote`

Deploy command:
`npx wrangler deploy`

## Expected test
After a successful build:
- `/api/health`
- `/api/db/health`
- `/api/r2/health`

The main `/api/health` result should include:
- `ok: true`
- `d1_binding: true`
- `r2_binding: true`
- `schema_version: "CF-01"`
- `database_ready: true`

Do not add other KENDALI modules until CF-01 passes.
