PRAGMA foreign_keys = ON;

-- Clear imported employee records.
-- Employee data will be entered manually through KENDALI.

DELETE FROM app_records
WHERE collection='users'
AND id LIKE 'EMP-%';
