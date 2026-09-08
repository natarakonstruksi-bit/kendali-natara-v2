PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_code),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

INSERT OR IGNORE INTO permissions(code,module,action,description) VALUES
('system.full_access','SYSTEM','FULL_ACCESS','Akses penuh seluruh KENDALI'),
('users.view','USERS','VIEW','Melihat user/karyawan'),
('users.manage','USERS','MANAGE','Mengelola user/karyawan'),
('roles.view','ROLES','VIEW','Melihat role'),
('project.view_all','PROJECT','VIEW_ALL','Melihat seluruh proyek'),
('project.view_assigned','PROJECT','VIEW_ASSIGNED','Melihat proyek yang ditugaskan'),
('project.manage','PROJECT','MANAGE','Mengelola proyek'),
('project.assign','PROJECT','ASSIGN','Assign anggota proyek'),
('progress.upload_pdf','PROGRESS','UPLOAD_PDF','Upload progress PDF'),
('progress.view','PROGRESS','VIEW','Melihat progress/deviasi'),
('qc.create','QC','CREATE','Membuat temuan QC'),
('qc.verify','QC','VERIFY','Verifikasi QC'),
('qc.close','QC','CLOSE','Final close QC'),
('documents.view_all','DOCUMENT','VIEW_ALL','Melihat seluruh dokumen'),
('documents.manage','DOCUMENT','MANAGE','Mengelola dokumen'),
('documents.archive_spk','DOCUMENT','ARCHIVE_SPK','Arsip SPK seluruh proyek'),
('material.request','MATERIAL','REQUEST','Request material'),
('material.post_stock','MATERIAL','POST_STOCK','Posting stok'),
('tools.request','TOOLS','REQUEST','Request tools'),
('tools.manage','TOOLS','MANAGE','Kelola tools'),
('vendor.manage','VENDOR','MANAGE','Kelola vendor'),
('po.create','PO','CREATE','Buat PO'),
('po.approve','PO','APPROVE','Approve PO'),
('fund.request','FUND','REQUEST','Pengajuan dana'),
('fund.pay','FUND','PAY','Pembayaran'),
('ati.manage','ATI','MANAGE','Kelola ATI'),
('audit.view','AUDIT','VIEW','Melihat audit');

DELETE FROM role_permissions;

INSERT OR REPLACE INTO role_permissions(role_id,permission_code,allowed)
SELECT 'role-admin', code, 1 FROM permissions;

INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-director','project.view_all'),
('role-director','project.manage'),
('role-director','project.assign'),
('role-director','audit.view'),

('role-manager','project.view_all'),
('role-manager','project.manage'),
('role-manager','project.assign'),
('role-manager','po.approve'),

('role-head-op','project.view_all'),
('role-head-op','progress.view'),

('role-superintendent','project.view_assigned'),
('role-superintendent','material.request'),
('role-superintendent','tools.request'),

('role-field','project.view_assigned'),
('role-field','progress.upload_pdf'),
('role-field','progress.view'),
('role-field','material.request'),
('role-field','tools.request'),

('role-head-support','project.view_all'),
('role-head-support','qc.close'),
('role-head-support','ati.manage'),

('role-senior-qc','project.view_all'),
('role-senior-qc','qc.create'),
('role-senior-qc','qc.verify'),

('role-qc','project.view_all'),
('role-qc','qc.create'),
('role-qc','qc.verify'),

('role-admin-teknik','project.view_all'),
('role-admin-teknik','documents.view_all'),
('role-admin-teknik','documents.manage'),
('role-admin-teknik','documents.archive_spk'),

('role-admin-logistik','project.view_all'),
('role-admin-logistik','vendor.manage'),
('role-admin-logistik','material.post_stock'),
('role-admin-logistik','tools.manage'),
('role-admin-logistik','po.create'),

('role-cost-control','project.view_all'),
('role-finance','project.view_all'),
('role-finance','fund.pay');

INSERT OR IGNORE INTO users(
  id,email,full_name,employee_id,position,department,role_id,is_active
) VALUES (
  'user-admin-primary',
  'natarakonstruksi@gmail.com',
  'Administrator',
  'ADM-001',
  'Administrator',
  'SYSTEM',
  'role-admin',
  1
);

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('schema_version','CF-02',CURRENT_TIMESTAMP);
