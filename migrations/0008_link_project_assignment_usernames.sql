PRAGMA foreign_keys = ON;

-- ============================================================
-- KENDALI NATARA APP V2.4
-- Link akun karyawan ke project assignment existing.
--
-- Prinsip:
-- - Nama yang dapat dipastikan dipetakan ke username KENDALI.
-- - Nama yang belum mempunyai pasangan pasti dibiarkan kosong.
-- - Tidak menebak Ade / Arman / Raslin / Hilmi / Uais / Ansari / Fikar.
-- ============================================================

-- PROJECT MANAGER / SUPERINTENDENT
UPDATE app_records
SET data_json=json_set(data_json,'$.pmUsername','sayyidtriwardhana'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pm') IN ('Sayyid','Sayyid Triwardhana');

UPDATE app_records
SET data_json=json_set(data_json,'$.pmUsername','muhammadhilalp765'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pm') IN ('Hilal','Muhammad Hilal');

UPDATE app_records
SET data_json=json_set(data_json,'$.pmUsername','dzuljob'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pm') IN ('Zul','Zulkarnaen');

-- PELAKSANA / PENGAWAS
UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','aanmks0326'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Aan';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','anasmunandar18'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Anas';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','muhammadfadhly300'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Fadhly';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','nurulfadli00'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Fadli';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','muhammdnurfikry'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Fikry';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','raikah536'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Gazali';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','muhammadhilalp765'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Hilal';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','sayyidtriwardhana'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Sayyid';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','muhammadsyawal26001'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Syawal';

UPDATE app_records
SET data_json=json_set(data_json,'$.pengawasUsername','muhzulfikarf14'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='projects'
  AND json_extract(data_json,'$.pengawas')='Zulfikar';

-- Metadata import / audit
INSERT INTO app_sync_audit(id,collection,record_id,action)
VALUES(lower(hex(randomblob(16))),'projects',NULL,'LINK_PROJECT_ASSIGNMENT_USERNAMES');

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('project_assignment_version','ASSIGN-V2.4-20260908',CURRENT_TIMESTAMP);
