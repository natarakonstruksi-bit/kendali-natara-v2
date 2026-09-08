PRAGMA foreign_keys = ON;

-- ============================================================
-- KENDALI NATARA V2 - CF-03
-- User Management + Project + Project Members
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(is_active, full_name);

CREATE INDEX IF NOT EXISTS idx_roles_code
  ON roles(code);

CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON projects(created_at);

CREATE INDEX IF NOT EXISTS idx_projects_name
  ON projects(project_name);

CREATE INDEX IF NOT EXISTS idx_project_members_active
  ON project_members(project_id, user_id, is_active);

-- Supporting permission aliases for CF-03 UI/API.
INSERT OR IGNORE INTO permissions(code,module,action,description) VALUES
('project.member_view','PROJECT','MEMBER_VIEW','Melihat anggota proyek'),
('project.member_manage','PROJECT','MEMBER_MANAGE','Mengatur anggota proyek'),
('users.deactivate','USERS','DEACTIVATE','Menonaktifkan user KENDALI');

-- Administrator always gets every current permission.
INSERT OR REPLACE INTO role_permissions(role_id,permission_code,allowed)
SELECT 'role-admin', code, 1 FROM permissions;

-- Existing managerial roles that can manage assignments.
INSERT OR IGNORE INTO role_permissions(role_id,permission_code,allowed) VALUES
('role-director','project.member_view',1),
('role-director','project.member_manage',1),
('role-manager','project.member_view',1),
('role-manager','project.member_manage',1),
('role-head-op','project.member_view',1),
('role-superintendent','project.member_view',1);

INSERT OR REPLACE INTO schema_meta(key,value,updated_at)
VALUES('schema_version','CF-03',CURRENT_TIMESTAMP);
