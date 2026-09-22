-- KENDALI Natara V3.3 — Position Roles + QC/ATI Reports
-- app_records bersifat generic; qc_reports dan ati_reports tidak memerlukan tabel baru.
INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','KENDALI-V3.3-ROLES-QC-ATI-REPORTS',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('project_control_version','3.3.0',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
