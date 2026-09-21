-- KENDALI Natara V3.1.4 — Continuous QC Inspection
-- Meniru alur dashboard QC lama: satu catatan inspeksi berjalan per proyek,
-- sub-pekerjaan ditambahkan bertahap dan dikelompokkan menurut item pekerjaan.

CREATE INDEX IF NOT EXISTS idx_app_records_qc_session_project
ON app_records(collection, json_extract(data_json,'$.projectId'), json_extract(data_json,'$.status'), json_extract(data_json,'$.startDate'));

CREATE INDEX IF NOT EXISTS idx_app_records_qc_item_session
ON app_records(collection, json_extract(data_json,'$.sessionId'), json_extract(data_json,'$.date'));

INSERT INTO app_records(collection,id,data_json,updated_at) VALUES
('qc_work_groups','QCG-010-PERSIAPAN','{"name":"Pekerjaan Persiapan","order":10,"status":"ACTIVE"}',CURRENT_TIMESTAMP),
('qc_work_groups','QCG-020-STRUKTUR-BAWAH','{"name":"Pekerjaan Struktur Bawah","order":20,"status":"ACTIVE"}',CURRENT_TIMESTAMP),
('qc_work_groups','QCG-030-STRUKTUR-ATAS','{"name":"Pekerjaan Struktur Atas","order":30,"status":"ACTIVE"}',CURRENT_TIMESTAMP),
('qc_work_groups','QCG-040-ARSITEKTUR','{"name":"Pekerjaan Arsitektur","order":40,"status":"ACTIVE"}',CURRENT_TIMESTAMP),
('qc_work_groups','QCG-050-SANITASI','{"name":"Pekerjaan Sanitasi","order":50,"status":"ACTIVE"}',CURRENT_TIMESTAMP),
('qc_work_groups','QCG-060-ELEKTRIKAL','{"name":"Pekerjaan Elektrikal","order":60,"status":"ACTIVE"}',CURRENT_TIMESTAMP),
('qc_work_groups','QCG-070-LANDSCAPING','{"name":"Pekerjaan Landscaping","order":70,"status":"ACTIVE"}',CURRENT_TIMESTAMP)
ON CONFLICT(collection,id) DO NOTHING;

INSERT INTO schema_meta(key,value,updated_at) VALUES('schema_version','KENDALI-V3.1.4-QC-CONTINUOUS',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('project_control_version','3.1.4',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at) VALUES('qc_workflow_version','V3.1.4-CONTINUOUS-INSPECTION',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
