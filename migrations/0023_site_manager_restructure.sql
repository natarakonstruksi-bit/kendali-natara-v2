-- Nara System V3.4.17 — Restrukturisasi Operational
-- 1) Project Manager dan Pelaksana Lapangan dilebur menjadi satu posisi: Site Manager.
-- 2) Atasan langsung Site Manager adalah Head of Operational (laporan progress & issue langsung ke Head of Operational).
-- 3) Admin Logistik dipindahkan ke Divisi Operational.
-- Migration bersifat aman diulang. Field lama tetap disimpan sebagai jejak (legacy*).

-- ---------------------------------------------------------------- Users
UPDATE app_records
SET data_json = json_set(data_json,
      '$.legacyPosition', COALESCE(json_extract(data_json,'$.jabatan'), json_extract(data_json,'$.role'), ''),
      '$.role','Site Manager',
      '$.jabatan','Site Manager',
      '$.departemen','Divisi Operational'),
    updated_at = datetime('now')
WHERE collection='users'
  AND (
    lower(trim(COALESCE(json_extract(data_json,'$.jabatan'),''))) IN ('project manager','pm','project manager / superintendent','project manager superintendent','superintendent / project manager','pm / superintendent','project manager (superintendent)','superintendent','site superintendent','superindtent','pelaksana lapangan','pelaksana','pengawas','pengawas lapangan','site supervisor','project_manager','pelaksana_lapangan','sm')
    OR lower(trim(COALESCE(json_extract(data_json,'$.role'),''))) IN ('project manager','pm','project manager / superintendent','project manager superintendent','superintendent / project manager','pm / superintendent','project manager (superintendent)','superintendent','site superintendent','superindtent','pelaksana lapangan','pelaksana','pengawas','pengawas lapangan','site supervisor','project_manager','pelaksana_lapangan','sm')
  );

UPDATE app_records
SET data_json = json_set(data_json, '$.departemen','Divisi Operational'),
    updated_at = datetime('now')
WHERE collection='users'
  AND lower(trim(COALESCE(json_extract(data_json,'$.jabatan'), json_extract(data_json,'$.role'), ''))) = 'site manager'
  AND COALESCE(json_extract(data_json,'$.departemen'),'') <> 'Divisi Operational';

UPDATE app_records
SET data_json = json_set(data_json,
      '$.legacyPosition', COALESCE(json_extract(data_json,'$.jabatan'), json_extract(data_json,'$.role'), ''),
      '$.role','Admin Logistik',
      '$.jabatan','Admin Logistik',
      '$.departemen','Divisi Operational'),
    updated_at = datetime('now')
WHERE collection='users'
  AND (
    lower(trim(COALESCE(json_extract(data_json,'$.jabatan'),''))) IN ('logistik','staf logistik','staff logistik','manager logistik','logistik / procurement','procurement','procurement / purchasing','purchasing','logistik procurement','admin logistik')
    OR lower(trim(COALESCE(json_extract(data_json,'$.role'),''))) IN ('logistik','staf logistik','staff logistik','manager logistik','logistik / procurement','procurement','procurement / purchasing','purchasing','logistik procurement','admin logistik')
  );

-- ---------------------------------------------------------------- Projects
-- Site Manager proyek = PM lama; bila proyek belum punya PM, memakai Pelaksana lama.
UPDATE app_records
SET data_json = json_set(data_json,
      '$.siteManagerUserId', COALESCE(
          NULLIF(trim(COALESCE(json_extract(data_json,'$.siteManagerUserId'),'')),''),
          NULLIF(trim(COALESCE(json_extract(data_json,'$.pmUserId'),'')),''),
          NULLIF(trim(COALESCE(json_extract(data_json,'$.projectManagerUserId'),'')),''),
          NULLIF(trim(COALESCE(json_extract(data_json,'$.smUserId'),'')),''),
          NULLIF(trim(COALESCE(json_extract(data_json,'$.pelaksanaUserId'),'')),''),
          NULLIF(trim(COALESCE(json_extract(data_json,'$.pengawasUserId'),'')),''),
          ''),
      '$.legacyPmUserId', COALESCE(json_extract(data_json,'$.legacyPmUserId'), json_extract(data_json,'$.pmUserId'), ''),
      '$.legacyPelaksanaUserId', COALESCE(json_extract(data_json,'$.legacyPelaksanaUserId'), json_extract(data_json,'$.pelaksanaUserId'), json_extract(data_json,'$.pengawasUserId'), '')),
    updated_at = datetime('now')
WHERE collection='projects';

UPDATE app_records
SET data_json = json_set(data_json,
      '$.pmUserId', json_extract(data_json,'$.siteManagerUserId'),
      '$.projectManagerUserId', json_extract(data_json,'$.siteManagerUserId'),
      '$.pelaksanaUserId', '',
      '$.pengawasUserId', ''),
    updated_at = datetime('now')
WHERE collection='projects';

-- ---------------------------------------------------------------- Data operasional yang masih berjalan → PIC Site Manager proyek
UPDATE app_records AS r
SET data_json = json_set(r.data_json,
      '$.picUserId', (SELECT json_extract(p.data_json,'$.siteManagerUserId') FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId')),
      '$.status', CASE WHEN upper(COALESCE(json_extract(r.data_json,'$.status'),'')) IN ('SUBMITTED_TO_PM','PM_APPROVED') THEN 'SUBMITTED_TO_OPERATIONAL' ELSE json_extract(r.data_json,'$.status') END),
    updated_at = datetime('now')
WHERE r.collection IN ('daily_progress','weekly_progress')
  AND upper(COALESCE(json_extract(r.data_json,'$.status'),'DRAFT')) <> 'REVIEWED'
  AND EXISTS (SELECT 1 FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId') AND COALESCE(json_extract(p.data_json,'$.siteManagerUserId'),'')<>'');

UPDATE app_records AS r
SET data_json = json_set(r.data_json,
      '$.picUserId', (SELECT json_extract(p.data_json,'$.siteManagerUserId') FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId'))),
    updated_at = datetime('now')
WHERE r.collection IN ('defects','issues')
  AND upper(COALESCE(json_extract(r.data_json,'$.status'),'OPEN')) <> 'CLOSED'
  AND EXISTS (SELECT 1 FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId') AND COALESCE(json_extract(p.data_json,'$.siteManagerUserId'),'')<>'');

UPDATE app_records AS r
SET data_json = json_set(r.data_json,
      '$.projectManagerUserId', (SELECT json_extract(p.data_json,'$.siteManagerUserId') FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId')),
      '$.requesterUserId', (SELECT json_extract(p.data_json,'$.siteManagerUserId') FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId'))),
    updated_at = datetime('now')
WHERE r.collection='procurement'
  AND upper(COALESCE(json_extract(r.data_json,'$.status'),'DRAFT')) NOT IN ('RECEIVED','CLOSED','CANCELLED','PAID')
  AND EXISTS (SELECT 1 FROM app_records p WHERE p.collection='projects' AND p.id=json_extract(r.data_json,'$.projectId') AND COALESCE(json_extract(p.data_json,'$.siteManagerUserId'),'')<>'');

-- ---------------------------------------------------------------- Tugas Saya lama untuk PM/Pelaksana ditutup;
-- sistem membuat ulang tugas yang benar (Site Manager / Head of Operational) saat Tugas Saya dibuka.
UPDATE app_records
SET data_json = json_set(data_json,'$.status','CANCELLED','$.completedAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'$.completionNote','Restrukturisasi V3.4.17: PM/Pelaksana menjadi Site Manager'),
    updated_at = datetime('now')
WHERE collection='workflow_tasks'
  AND upper(COALESCE(json_extract(data_json,'$.status'),'OPEN')) IN ('OPEN','IN_PROGRESS')
  AND (json_extract(data_json,'$.assigneeRole') IN ('project_manager','pelaksana_lapangan')
       OR json_extract(data_json,'$.stage') IN ('PROGRESS_PM_REVIEW','PROGRESS_FIELD','ISSUE_REVIEW','ISSUE_ACTION','QC_PM_FOLLOWUP','PR_PM_REQUEST','PR_PM_VENDOR','PR_ORDER','PR_RECEIVE','CCO_FIELD','ATI_REQUESTER','ATI_CONFIRM','PROGRESS_OPERATIONAL_REVIEW'));

INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','NARA-V3.4.17-SITE-MANAGER',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('org_structure_version','V3.4.17: Head of Operational -> Site Manager, Admin Logistik',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
