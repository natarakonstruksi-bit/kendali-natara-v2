-- Nara System V3.4.40 — Login dari Sipatuo (portal grup)
-- Additive migration. Menyimpan id tiket (jti) yang sudah dipakai agar tiket tidak bisa dipakai dua kali.
-- Baris dibersihkan otomatis oleh Cron setelah tiket kedaluwarsa. Tidak ada data lama yang diubah.

CREATE TABLE IF NOT EXISTS sso_tiket_terpakai (
  jti TEXT PRIMARY KEY,
  exp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sso_tiket_exp ON sso_tiket_terpakai(exp);

INSERT INTO schema_meta(key,value,updated_at)
VALUES('schema_version','NARA-V3.4.40-SIPATUO-SSO',datetime('now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
