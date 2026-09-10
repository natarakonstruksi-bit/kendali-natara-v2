PRAGMA foreign_keys = ON;

-- Employee seed intentionally removed.
-- Users will be created manually from KENDALI Employee menu.

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('employee_import_version','MANUAL_INPUT',CURRENT_TIMESTAMP);
