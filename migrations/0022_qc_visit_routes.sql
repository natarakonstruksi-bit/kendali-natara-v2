-- Nara System V3.4.16 — Rute Kunjungan QC
-- Additive migration. Rute disimpan di app_records (collection 'qc_visit_routes') sebagai jadwal mingguan
-- berulang: setiap record = satu titik kunjungan (proyek) dengan daftar hari 1..7 (Senin..Minggu).
-- Tidak ada data lama yang diubah.

CREATE INDEX IF NOT EXISTS idx_app_records_qc_visit_route_project
ON app_records(collection,
  json_extract(data_json,'$.projectId'),
  json_extract(data_json,'$.status'));

INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','NARA-V3.4.16-QC-VISIT-ROUTE',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('qc_visit_route_version','V3.4.16-WEEKLY-RECURRING',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
