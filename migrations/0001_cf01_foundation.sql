PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO schema_meta(key, value)
VALUES ('schema_version', 'CF-01');

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  phone TEXT,
  position TEXT,
  department TEXT,
  role_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  project_code TEXT UNIQUE,
  project_name TEXT NOT NULL,
  client_name TEXT,
  location TEXT,
  contract_value REAL NOT NULL DEFAULT 0,
  budget_value REAL NOT NULL DEFAULT 0,
  progress_plan REAL NOT NULL DEFAULT 0,
  progress_actual REAL NOT NULL DEFAULT 0,
  deviation REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  target_finish_date TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_role TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  old_data_json TEXT,
  new_data_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

INSERT OR IGNORE INTO roles(id, code, name, department, is_admin) VALUES
('role-admin', 'ADMINISTRATOR', 'Administrator', 'SYSTEM', 1),
('role-director', 'DIRECTOR', 'Direksi', 'MANAGEMENT', 0),
('role-manager', 'CONSTRUCTION_MANAGER', 'Manager Konstruksi', 'OPERATIONAL', 0),
('role-head-op', 'HEAD_OPERATIONAL', 'Head of Operational', 'OPERATIONAL', 0),
('role-superintendent', 'SUPERINTENDENT', 'Superintendent', 'OPERATIONAL', 0),
('role-field', 'FIELD_EXECUTOR', 'Pelaksana Lapangan', 'OPERATIONAL', 0),
('role-head-support', 'HEAD_SUPPORTING', 'Head of Supporting', 'SUPPORTING', 0),
('role-senior-qc', 'SENIOR_QC', 'Senior QC', 'SUPPORTING', 0),
('role-qc', 'QC_INSPECTOR', 'QC Inspector', 'SUPPORTING', 0),
('role-head-ati', 'HEAD_ATI', 'Kepala ATI', 'SUPPORTING', 0),
('role-ati-instructor', 'ATI_INSTRUCTOR', 'Instruktur ATI', 'SUPPORTING', 0),
('role-head-eng', 'HEAD_ENGINEERING', 'Head of Engineering', 'ENGINEERING', 0),
('role-senior-estimator', 'SENIOR_ESTIMATOR', 'Senior Estimator', 'ENGINEERING', 0),
('role-estimator', 'ESTIMATOR', 'Estimator', 'ENGINEERING', 0),
('role-qs', 'QS', 'Quantity Surveyor', 'ENGINEERING', 0),
('role-admin-teknik', 'ADMIN_TEKNIK', 'Admin Teknik', 'ENGINEERING', 0),
('role-admin-logistik', 'ADMIN_LOGISTIK', 'Admin Logistik', 'LOGISTICS', 0),
('role-cost-control', 'COST_CONTROL', 'Cost Control', 'FINANCE', 0),
('role-finance', 'FINANCE', 'Finance', 'FINANCE', 0);
