PRAGMA foreign_keys = ON;

-- ============================================================
-- KENDALI NATARA APP V2.7
-- Login kembali memakai username + password KENDALI (server-side).
-- Cloudflare Access tidak lagi dipakai sebagai gerbang login.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  username   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip         TEXT
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_login_attempts (
  username     TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  last_fail_at TEXT NOT NULL
);

-- Password awal Administrator = "admin123" (format hash sama dengan UI: h1$ + sha256("kendali-natara-v1:" + password)).
-- Hanya diisi bila password masih kosong. WAJIB diganti setelah login pertama (/ganti-password).
UPDATE app_records
SET data_json = json_set(data_json, '$.password', 'h1$5bd750bfae1abc00c0686e3ca6c7b7894ebcfb7e9bfdd4abeced3f06aa0e07b5'),
    updated_at = CURRENT_TIMESTAMP
WHERE collection = 'users'
  AND id = 'admin'
  AND COALESCE(json_extract(data_json, '$.password'), '') = '';

INSERT INTO app_sync_audit(id,collection,record_id,action)
VALUES(lower(hex(randomblob(16))),'users','admin','ENABLE_USERNAME_PASSWORD_LOGIN');

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('auth_version','USERPASS-V2.7-20260912',CURRENT_TIMESTAMP);
