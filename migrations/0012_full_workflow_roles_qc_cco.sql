-- KENDALI Natara V3.0 — Full Workflow, QC checklist, CCO routing, Finance automation, RBAC
-- Additive migration: data lama tetap berada pada app_records.

CREATE INDEX IF NOT EXISTS idx_app_records_project_status
ON app_records(collection, json_extract(data_json,'$.projectId'), json_extract(data_json,'$.status'));

CREATE INDEX IF NOT EXISTS idx_app_records_user_role
ON app_records(collection, json_extract(data_json,'$.role'));

CREATE INDEX IF NOT EXISTS idx_app_records_related
ON app_records(collection, json_extract(data_json,'$.relatedCollection'), json_extract(data_json,'$.relatedId'));

INSERT INTO schema_meta(key,value,updated_at) VALUES('schema_version','KENDALI-V3.0-FULL-WORKFLOW',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('project_control_version','3.0.0',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('rbac_version','V3-ROLE-MATRIX-01',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
