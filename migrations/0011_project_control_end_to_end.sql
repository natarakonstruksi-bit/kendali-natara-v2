-- KENDALI Natara V2.8 — End-to-End Project Control
-- Migration is additive and keeps existing app_records data.

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_app_records_collection_updated ON app_records(collection, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_records_project ON app_records(collection, json_extract(data_json,'$.projectId'));

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_login_attempts (
  username TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  last_fail_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kendali_audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  collection TEXT,
  record_id TEXT,
  project_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kendali_audit_project ON kendali_audit_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kendali_audit_collection ON kendali_audit_log(collection, created_at DESC);

-- Seed administrator only for a fresh database with no KENDALI users.
-- Existing deployments keep their current users untouched.
-- Temporary password for fresh install: Kendali#2026!  -> change immediately after first login.
INSERT INTO app_records(collection,id,data_json,updated_at)
SELECT
  'users',
  'USR-ADMIN',
  '{"username":"admin","name":"Administrator Nara System","email":"natarakonstruksi@gmail.com","role":"Administrator","jabatan":"Administrator","unit":"Natara Konstruksi","departemen":"Management","status":"Aktif","password":"h1$68695904f72cf8bf5db4917daaeefcbad005ca61223737e6543e461ba05ff0ba"}',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM app_records WHERE collection='users');

INSERT INTO schema_meta(key,value,updated_at) VALUES('schema_version','KENDALI-V2.8-END-TO-END',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('project_control_version','2.8.0',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
