PRAGMA foreign_keys = ON;

-- ============================================================
-- KENDALI NATARA APP V2.6
-- Cloudflare Access = satu-satunya login.
-- Password KENDALI tidak lagi diperlukan.
-- ============================================================

-- Pastikan Administrator utama dapat dipetakan dari identitas Cloudflare Access.
INSERT INTO app_records(collection,id,data_json,updated_at)
VALUES(
  'users',
  'admin',
  json_object(
    'username','admin',
    'password','',
    'name','Administrator',
    'nip','ADM-001',
    'jabatan','Administrator',
    'role','Admin',
    'unit','NATARA KONSTRUKSI',
    'atasan','',
    'telp','',
    'email','natarakonstruksi@gmail.com',
    'tglMasuk','',
    'status','Aktif',
    'departemen','Direksi',
    'statusPegawai','SYSTEM'
  ),
  CURRENT_TIMESTAMP
)
ON CONFLICT(collection,id) DO UPDATE SET
  data_json=json_set(
    app_records.data_json,
    '$.username','admin',
    '$.name','Administrator',
    '$.jabatan','Administrator',
    '$.role','Admin',
    '$.email','natarakonstruksi@gmail.com',
    '$.status','Aktif'
  ),
  updated_at=CURRENT_TIMESTAMP;

-- Role "Estimator" pada build lama adalah role legacy.
-- Karena jabatan sumber memang ESTIMATOR, pindahkan ke role aktif Senior Estimator.
UPDATE app_records
SET data_json=json_set(data_json,'$.role','Senior Estimator'),
    updated_at=CURRENT_TIMESTAMP
WHERE collection='users'
  AND id='EMP-017'
  AND json_extract(data_json,'$.jabatan')='ESTIMATOR';

INSERT INTO app_sync_audit(id,collection,record_id,action)
VALUES(lower(hex(randomblob(16))),'users',NULL,'ENABLE_CLOUDFLARE_ACCESS_SSO');

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('auth_version','ACCESS-SSO-V2.6-20260908',CURRENT_TIMESTAMP);
