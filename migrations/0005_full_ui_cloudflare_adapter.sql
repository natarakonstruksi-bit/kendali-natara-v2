PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_app_records_collection_updated
  ON app_records(collection, updated_at DESC);

CREATE TABLE IF NOT EXISTS app_sync_audit (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_sync_audit_created
  ON app_sync_audit(created_at DESC);

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('schema_version','FULL-UI-01',CURRENT_TIMESTAMP);
