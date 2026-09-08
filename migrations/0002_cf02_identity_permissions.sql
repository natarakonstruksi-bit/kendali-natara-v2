PRAGMA foreign_keys = ON;

-- ============================================================
-- KENDALI NATARA V2 - CF-02
-- Identity + Role + Permission + Administrator bootstrap
-- Authentication itself is handled by Cloudflare Access.
-- D1 stores authorization/jobdesk only; no passwords are stored.
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON role_permissions(role_id);

-- Role descriptions are informational jobdesk summaries used by Admin UI.
ALTER TABLE roles ADD COLUMN jobdesk_summary TEXT;

UPDATE roles SET jobdesk_summary =
CASE code
  WHEN 'ADMINISTRATOR' THEN 'Full access seluruh KENDALI, seluruh proyek, seluruh modul, user/role, konfigurasi, audit dan override administratif.'
  WHEN 'DIRECTOR' THEN 'Monitoring manajemen, akses lintas proyek, approval strategis dan penutupan proyek.'
  WHEN 'CONSTRUCTION_MANAGER' THEN 'Kontrol operasional konstruksi tingkat manajerial, approval RAB/PO/CCO/PHO/FHO dan project governance.'
  WHEN 'HEAD_OPERATIONAL' THEN 'Kontrol pelaksanaan operasional, tindak lanjut QC, material/tools, dana operasional dan handover operasional.'
  WHEN 'SUPERINTENDENT' THEN 'Mengendalikan proyek yang ditugaskan, koordinasi Pelaksana, SPK operasional, request material/tools dan penugasan perbaikan.'
  WHEN 'FIELD_EXECUTOR' THEN 'Mode Lapangan: progress PDF, pelaksanaan pekerjaan, perbaikan QC, request material/tools dan penerimaan barang lapangan.'
  WHEN 'HEAD_SUPPORTING' THEN 'Membawahi QC dan ATI; review mutu, final approval/close QC, verifikasi PHO/FHO dan retensi.'
  WHEN 'SENIOR_QC' THEN 'Membuat/monitor/verifikasi temuan mutu dan punch list; tidak melakukan final close.'
  WHEN 'QC_INSPECTOR' THEN 'Inspeksi, temuan dan verifikasi QC/punch list; tidak melakukan final close.'
  WHEN 'HEAD_ATI' THEN 'Mengelola Akademik Tukang Indonesia (ATI), program, peserta dan monitoring.'
  WHEN 'ATI_INSTRUCTOR' THEN 'Mencatat pelaksanaan pelatihan, peserta dan hasil ATI.'
  WHEN 'HEAD_ENGINEERING' THEN 'Review teknis RAB, engineering dan CCO.'
  WHEN 'SENIOR_ESTIMATOR' THEN 'Menyusun dan mengendalikan draft RAB/estimasi.'
  WHEN 'ESTIMATOR' THEN 'Menyusun RAB dan estimasi pekerjaan.'
  WHEN 'QS' THEN 'Opname formal, validasi volume/bobot dan dukungan teknis CCO.'
  WHEN 'ADMIN_TEKNIK' THEN 'Document Controller seluruh proyek: SPK, kontrak, CCO, surat, BAST, PHO/FHO, gambar kerja/as-built dan dokumen teknis.'
  WHEN 'ADMIN_LOGISTIK' THEN 'Mengelola vendor, material, stok, tools/inventaris, PO, penerimaan barang dan mutasi.'
  WHEN 'COST_CONTROL' THEN 'Verifikasi biaya/budget, cost control PO/dana/CCO; tidak melakukan pembayaran.'
  WHEN 'FINANCE' THEN 'Verifikasi administrasi keuangan, invoice dan pembayaran; tidak mengubah baseline biaya.'
  ELSE jobdesk_summary
END;

INSERT OR IGNORE INTO permissions(code,module,action,description) VALUES
('system.full_access','SYSTEM','FULL_ACCESS','Akses penuh seluruh KENDALI'),

('users.view','USERS','VIEW','Melihat user/karyawan'),
('users.manage','USERS','MANAGE','Membuat dan memperbarui user/karyawan'),
('roles.view','ROLES','VIEW','Melihat role dan jobdesk'),
('audit.view','AUDIT','VIEW','Melihat audit trail'),

('project.view_all','PROJECT','VIEW_ALL','Melihat seluruh proyek'),
('project.view_assigned','PROJECT','VIEW_ASSIGNED','Melihat proyek yang ditugaskan'),
('project.manage','PROJECT','MANAGE','Membuat/mengubah proyek'),
('project.assign','PROJECT','ASSIGN','Mengatur anggota proyek'),
('project.close','PROJECT','CLOSE','Menutup lifecycle proyek'),

('rab.view','RAB','VIEW','Melihat RAB dan bobot'),
('rab.edit','RAB','EDIT','Menyusun/mengubah RAB'),
('rab.technical_review','RAB','TECHNICAL_REVIEW','Review teknis RAB'),
('rab.approve','RAB','APPROVE','Approval RAB'),
('qs.opname','QS','OPNAME','Opname/validasi volume formal'),

('progress.upload_pdf','PROGRESS','UPLOAD_PDF','Upload PDF progress mingguan'),
('progress.view','PROGRESS','VIEW','Melihat progress dan deviasi'),
('progress.review','PROGRESS','REVIEW','Review hasil ekstraksi progress'),

('qc.create','QC','CREATE','Membuat temuan QC'),
('qc.supporting_review','QC','SUPPORTING_REVIEW','Review awal Head Supporting'),
('qc.operational_followup','QC','OPERATIONAL_FOLLOWUP','Tindak lanjut Head Operational'),
('qc.superintendent_assign','QC','SUPERINTENDENT_ASSIGN','Penugasan perbaikan oleh Superintendent'),
('qc.repair','QC','REPAIR','Melakukan perbaikan QC'),
('qc.verify','QC','VERIFY','Verifikasi hasil perbaikan'),
('qc.close','QC','CLOSE','Final close oleh Head Supporting'),

('documents.view_all','DOCUMENT','VIEW_ALL','Melihat dokumen semua proyek'),
('documents.view_project','DOCUMENT','VIEW_PROJECT','Melihat dokumen proyek yang dapat diakses'),
('documents.manage','DOCUMENT','MANAGE','Mengelola arsip dokumen'),
('documents.archive_spk','DOCUMENT','ARCHIVE_SPK','Mengarsipkan SPK seluruh proyek'),

('material.request','MATERIAL','REQUEST','Request material'),
('material.verify_superintendent','MATERIAL','VERIFY_SUPERINTENDENT','Verifikasi Superintendent'),
('material.process_logistics','MATERIAL','PROCESS_LOGISTICS','Proses Admin Logistik'),
('material.approve_operational','MATERIAL','APPROVE_OPERATIONAL','Approval Head Operational'),
('material.post_stock','MATERIAL','POST_STOCK','Posting stok resmi'),

('tools.request','TOOLS','REQUEST','Request tools'),
('tools.verify_superintendent','TOOLS','VERIFY_SUPERINTENDENT','Verifikasi tools oleh Superintendent'),
('tools.approve_operational','TOOLS','APPROVE_OPERATIONAL','Approval tools oleh Head Operational'),
('tools.manage','TOOLS','MANAGE','Mengelola inventaris/tools'),

('vendor.manage','VENDOR','MANAGE','Mengelola master vendor'),

('po.create','PO','CREATE','Membuat/revisi PO'),
('po.cost_verify','PO','COST_VERIFY','Verifikasi Cost Control'),
('po.approve','PO','APPROVE','Approval PO'),
('po.send','PO','SEND','Mengirim PO ke vendor'),
('po.receive_site','PO','RECEIVE_SITE','Konfirmasi barang datang di site'),
('po.post_stock','PO','POST_STOCK','Posting penerimaan ke stok'),
('po.reverse','PO','REVERSE','Reversal penerimaan'),

('fund.request','FUND','REQUEST','Pengajuan dana'),
('fund.verify_operational','FUND','VERIFY_OPERATIONAL','Verifikasi operasional'),
('fund.verify_cost','FUND','VERIFY_COST','Verifikasi Cost Control'),
('fund.verify_finance','FUND','VERIFY_FINANCE','Verifikasi Finance'),
('fund.approve_small','FUND','APPROVE_SMALL','Final approval sampai Rp1 juta'),
('fund.approve_medium','FUND','APPROVE_MEDIUM','Final approval >Rp1 juta s/d Rp10 juta'),
('fund.approve_large','FUND','APPROVE_LARGE','Final approval >Rp10 juta'),
('fund.pay','FUND','PAY','Melakukan pembayaran'),

('cco.create','CCO','CREATE','Membuat CCO'),
('cco.technical_review','CCO','TECHNICAL_REVIEW','Review teknis CCO'),
('cco.cost_review','CCO','COST_REVIEW','Review biaya CCO'),
('cco.internal_approve','CCO','INTERNAL_APPROVE','Approval internal CCO'),
('cco.client_evidence','CCO','CLIENT_EVIDENCE','Mencatat persetujuan klien'),
('cco.activate','CCO','ACTIVATE','Mengaktifkan CCO'),

('pho.prepare','PHO','PREPARE','Menyiapkan PHO'),
('pho.operational_verify','PHO','OPERATIONAL_VERIFY','Verifikasi operasional PHO'),
('pho.supporting_verify','PHO','SUPPORTING_VERIFY','Verifikasi mutu PHO'),
('pho.finance_verify','PHO','FINANCE_VERIFY','Verifikasi Finance PHO'),
('pho.approve','PHO','APPROVE','Approval PHO'),

('retention.manage','RETENTION','MANAGE','Menindaklanjuti issue retensi'),
('retention.verify','RETENTION','VERIFY','Verifikasi issue retensi'),

('fho.prepare','FHO','PREPARE','Menyiapkan FHO'),
('fho.operational_verify','FHO','OPERATIONAL_VERIFY','Verifikasi operasional FHO'),
('fho.supporting_verify','FHO','SUPPORTING_VERIFY','Verifikasi mutu FHO'),
('fho.finance_verify','FHO','FINANCE_VERIFY','Verifikasi Finance FHO'),
('fho.approve','FHO','APPROVE','Approval FHO'),

('ati.manage','ATI','MANAGE','Mengelola ATI'),
('ati.record','ATI','RECORD','Mencatat kegiatan/peserta ATI'),

('notifications.view_own','NOTIFICATION','VIEW_OWN','Melihat notifikasi sendiri');

-- Deterministic permissions: clear non-admin matrix first.
DELETE FROM role_permissions
WHERE role_id <> 'role-admin';

-- Administrator always gets ALL permissions.
INSERT OR REPLACE INTO role_permissions(role_id,permission_code,allowed)
SELECT 'role-admin', code, 1 FROM permissions;

-- Direksi
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-director','project.view_all'),
('role-director','project.manage'),
('role-director','project.assign'),
('role-director','project.close'),
('role-director','documents.view_all'),
('role-director','progress.view'),
('role-director','rab.view'),
('role-director','fund.approve_large'),
('role-director','audit.view');

-- Manager Konstruksi
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-manager','project.view_all'),
('role-manager','project.manage'),
('role-manager','project.assign'),
('role-manager','project.close'),
('role-manager','documents.view_all'),
('role-manager','progress.view'),
('role-manager','rab.view'),
('role-manager','rab.approve'),
('role-manager','po.approve'),
('role-manager','fund.approve_medium'),
('role-manager','cco.internal_approve'),
('role-manager','cco.activate'),
('role-manager','pho.approve'),
('role-manager','fho.approve');

-- Head Operational
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-head-op','project.view_all'),
('role-head-op','documents.view_project'),
('role-head-op','progress.view'),
('role-head-op','rab.view'),
('role-head-op','qc.operational_followup'),
('role-head-op','material.approve_operational'),
('role-head-op','tools.approve_operational'),
('role-head-op','fund.verify_operational'),
('role-head-op','fund.approve_small'),
('role-head-op','pho.operational_verify'),
('role-head-op','fho.operational_verify'),
('role-head-op','retention.manage');

-- Superintendent
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-superintendent','project.view_assigned'),
('role-superintendent','documents.view_project'),
('role-superintendent','progress.view'),
('role-superintendent','rab.view'),
('role-superintendent','qc.superintendent_assign'),
('role-superintendent','material.request'),
('role-superintendent','material.verify_superintendent'),
('role-superintendent','tools.request'),
('role-superintendent','tools.verify_superintendent'),
('role-superintendent','fund.request'),
('role-superintendent','cco.create'),
('role-superintendent','pho.prepare'),
('role-superintendent','fho.prepare'),
('role-superintendent','retention.manage');

-- Pelaksana
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-field','project.view_assigned'),
('role-field','documents.view_project'),
('role-field','progress.upload_pdf'),
('role-field','progress.view'),
('role-field','rab.view'),
('role-field','qc.repair'),
('role-field','material.request'),
('role-field','tools.request'),
('role-field','po.receive_site'),
('role-field','retention.manage');

-- Head Supporting
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-head-support','project.view_all'),
('role-head-support','documents.view_project'),
('role-head-support','progress.view'),
('role-head-support','qc.supporting_review'),
('role-head-support','qc.close'),
('role-head-support','pho.supporting_verify'),
('role-head-support','fho.supporting_verify'),
('role-head-support','retention.verify'),
('role-head-support','ati.manage');

-- Senior QC
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-senior-qc','project.view_all'),
('role-senior-qc','documents.view_project'),
('role-senior-qc','progress.view'),
('role-senior-qc','qc.create'),
('role-senior-qc','qc.verify'),
('role-senior-qc','retention.verify');

-- QC Inspector
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-qc','project.view_all'),
('role-qc','documents.view_project'),
('role-qc','progress.view'),
('role-qc','qc.create'),
('role-qc','qc.verify'),
('role-qc','retention.verify');

-- ATI
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-head-ati','ati.manage'),
('role-head-ati','ati.record'),
('role-ati-instructor','ati.record');

-- Engineering
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-head-eng','project.view_all'),
('role-head-eng','documents.view_project'),
('role-head-eng','progress.view'),
('role-head-eng','rab.view'),
('role-head-eng','rab.technical_review'),
('role-head-eng','cco.technical_review'),

('role-senior-estimator','project.view_all'),
('role-senior-estimator','documents.view_project'),
('role-senior-estimator','rab.view'),
('role-senior-estimator','rab.edit'),
('role-senior-estimator','cco.create'),

('role-estimator','project.view_all'),
('role-estimator','documents.view_project'),
('role-estimator','rab.view'),
('role-estimator','rab.edit'),

('role-qs','project.view_all'),
('role-qs','documents.view_project'),
('role-qs','progress.view'),
('role-qs','rab.view'),
('role-qs','qs.opname'),
('role-qs','cco.create'),
('role-qs','cco.technical_review');

-- Admin Teknik
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-admin-teknik','project.view_all'),
('role-admin-teknik','documents.view_all'),
('role-admin-teknik','documents.manage'),
('role-admin-teknik','documents.archive_spk'),
('role-admin-teknik','rab.view'),
('role-admin-teknik','progress.view'),
('role-admin-teknik','pho.prepare'),
('role-admin-teknik','fho.prepare');

-- Admin Logistik
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-admin-logistik','project.view_all'),
('role-admin-logistik','documents.view_project'),
('role-admin-logistik','vendor.manage'),
('role-admin-logistik','material.process_logistics'),
('role-admin-logistik','material.post_stock'),
('role-admin-logistik','tools.manage'),
('role-admin-logistik','po.create'),
('role-admin-logistik','po.send'),
('role-admin-logistik','po.receive_site'),
('role-admin-logistik','po.post_stock'),
('role-admin-logistik','po.reverse');

-- Cost Control
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-cost-control','project.view_all'),
('role-cost-control','documents.view_project'),
('role-cost-control','progress.view'),
('role-cost-control','rab.view'),
('role-cost-control','po.cost_verify'),
('role-cost-control','fund.verify_cost'),
('role-cost-control','cco.cost_review');

-- Finance
INSERT OR IGNORE INTO role_permissions(role_id,permission_code) VALUES
('role-finance','project.view_all'),
('role-finance','documents.view_project'),
('role-finance','progress.view'),
('role-finance','fund.verify_finance'),
('role-finance','fund.pay'),
('role-finance','pho.finance_verify'),
('role-finance','fho.finance_verify');

-- Everyone gets own notifications and role visibility will be handled by API.
INSERT OR IGNORE INTO role_permissions(role_id,permission_code)
SELECT id, 'notifications.view_own'
FROM roles
WHERE is_active = 1;

-- Bootstrap first Administrator. Cloudflare Access identity email must match this.
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
