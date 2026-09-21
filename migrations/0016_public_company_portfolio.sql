-- KENDALI Natara V3.2.1 — Profil Natara & Portofolio Publik
-- app_records bersifat generic; koleksi public_portfolio tidak memerlukan tabel baru.
INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','KENDALI-V3.2.1-COMPANY-PORTFOLIO',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;

INSERT INTO schema_meta(key,value,updated_at)
VALUES('project_control_version','3.2.1',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
