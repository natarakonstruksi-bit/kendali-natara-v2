-- KENDALI Natara V3.1 — Field responsibility, payroll, PR vendor comparison, QC findings, ATI
-- Generic app_records architecture: no destructive table change required.

CREATE INDEX IF NOT EXISTS idx_app_records_daily_worker_report
ON app_records(collection, json_extract(data_json,'$.dailyProgressId'), json_extract(data_json,'$.date'));

CREATE INDEX IF NOT EXISTS idx_app_records_worker
ON app_records(collection, json_extract(data_json,'$.workerId'), json_extract(data_json,'$.date'));

CREATE INDEX IF NOT EXISTS idx_app_records_finding
ON app_records(collection, json_extract(data_json,'$.findingId'), json_extract(data_json,'$.date'));

CREATE INDEX IF NOT EXISTS idx_app_records_procurement_status
ON app_records(collection, json_extract(data_json,'$.projectId'), json_extract(data_json,'$.status'), json_extract(data_json,'$.date'));

INSERT INTO schema_meta(key,value,updated_at) VALUES('schema_version','KENDALI-V3.1-FIELD-PR-QC-ATI',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('project_control_version','3.1.0',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('field_workflow_version','V3.1-ROLE-PAYROLL-PR-QC-ATI',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
