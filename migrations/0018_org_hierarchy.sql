-- KENDALI Natara V3.3.1 — Org hierarchy labels
-- Tidak menghapus data lama. Backend tetap menerima alias jabatan legacy.
INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','KENDALI-V3.3.1-ORG-HIERARCHY',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('project_control_version','3.3.1',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
