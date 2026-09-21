-- KENDALI Natara V3.2 — Sistem Informasi Publik
-- app_records bersifat generic, sehingga tidak diperlukan tabel bisnis baru.
-- Migration ini hanya menandai versi schema/workflow yang aktif.
INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','KENDALI-V3.2-PUBLIC-INFORMATION',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('project_control_version','3.2.0',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
