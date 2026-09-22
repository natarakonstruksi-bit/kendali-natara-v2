-- KENDALI Natara V3.4 — Workflow Inbox + Handoffs
-- Additive migration. Workflow tasks tetap disimpan di app_records untuk kompatibilitas arsitektur KENDALI.

CREATE INDEX IF NOT EXISTS idx_app_records_workflow_task_assignee
ON app_records(collection,
  json_extract(data_json,'$.assigneeUserId'),
  json_extract(data_json,'$.assigneeRole'),
  json_extract(data_json,'$.status'));

CREATE INDEX IF NOT EXISTS idx_app_records_workflow_task_source
ON app_records(collection,
  json_extract(data_json,'$.sourceCollection'),
  json_extract(data_json,'$.sourceId'));

CREATE INDEX IF NOT EXISTS idx_app_records_workflow_task_project
ON app_records(collection,
  json_extract(data_json,'$.projectId'),
  json_extract(data_json,'$.status'));

INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','KENDALI-V3.4-WORKFLOW-INBOX',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('project_control_version','3.4.0',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
