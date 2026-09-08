function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin"
    }
  });
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function boolInt(v, fallback = 1) {
  if (v === undefined || v === null) return fallback;
  return v ? 1 : 0;
}

async function getAccessIdentity(ctx) {
  if (!ctx?.access) return null;
  try {
    const identity = await ctx.access.getIdentity();
    if (!identity?.email) return null;
    return {
      email: normEmail(identity.email),
      name: identity.name || null
    };
  } catch {
    return null;
  }
}

async function getUserByEmail(env, email) {
  return env.DB.prepare(`
    SELECT
      u.id,u.email,u.full_name,u.employee_id,u.phone,u.position,u.department,
      u.is_active,u.role_id,
      r.code AS role_code,r.name AS role_name,r.department AS role_department,
      r.is_admin
    FROM users u
    JOIN roles r ON r.id=u.role_id
    WHERE lower(u.email)=?
      AND u.is_active=1
      AND r.is_active=1
    LIMIT 1
  `).bind(normEmail(email)).first();
}

async function getPermissions(env, roleId) {
  const result = await env.DB.prepare(`
    SELECT p.code
    FROM role_permissions rp
    JOIN permissions p ON p.code=rp.permission_code
    WHERE rp.role_id=? AND rp.allowed=1
    ORDER BY p.code
  `).bind(roleId).all();
  return (result.results || []).map(x => x.code);
}

function hasPerm(user, perms, code) {
  return user?.is_admin === 1 ||
    perms.includes("system.full_access") ||
    perms.includes(code);
}

async function requireUser(env, ctx) {
  const identity = await getAccessIdentity(ctx);
  if (!identity) {
    return {
      error: html(page(
        "KENDALI — Login",
        `<div class="eyebrow">KENDALI · Natara Konstruksi</div>
         <h1>Cloudflare Access diperlukan</h1>
         <p class="muted">Silakan login menggunakan email yang sudah diberi akses.</p>`
      ), 401)
    };
  }

  const user = await getUserByEmail(env, identity.email);
  if (!user) {
    return {
      error: html(page(
        "KENDALI — User belum aktif",
        `<div class="eyebrow">KENDALI · Natara Konstruksi</div>
         <h1>Akses belum terdaftar</h1>
         <p>Email <code>${identity.email}</code> sudah lolos Cloudflare Access, tetapi belum terdaftar sebagai user aktif KENDALI.</p>
         <a class="btn ghost" href="/cdn-cgi/access/logout">Keluar</a>`
      ), 403)
    };
  }

  const permissions = await getPermissions(env, user.role_id);
  return { identity, user, permissions };
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

async function audit(env, actorId, module, action, recordId, oldData, newData, notes = null) {
  await env.DB.prepare(`
    INSERT INTO audit_logs(
      id,user_id,module,action,record_id,old_data_json,new_data_json,notes
    ) VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    actorId || null,
    module,
    action,
    recordId || null,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    notes
  ).run();
}

function canViewAllProjects(user, perms) {
  return hasPerm(user, perms, "project.view_all");
}

async function listProjectsForUser(env, auth) {
  if (canViewAllProjects(auth.user, auth.permissions)) {
    const r = await env.DB.prepare(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM project_members pm
         WHERE pm.project_id=p.id AND pm.is_active=1) AS member_count
      FROM projects p
      ORDER BY
        CASE WHEN p.lifecycle_status='ACTIVE' THEN 0 ELSE 1 END,
        p.created_at DESC
    `).all();
    return r.results || [];
  }

  const r = await env.DB.prepare(`
    SELECT
      p.*,
      pm.project_role,
      (SELECT COUNT(*) FROM project_members x
       WHERE x.project_id=p.id AND x.is_active=1) AS member_count
    FROM project_members pm
    JOIN projects p ON p.id=pm.project_id
    WHERE pm.user_id=? AND pm.is_active=1
    ORDER BY
      CASE WHEN p.lifecycle_status='ACTIVE' THEN 0 ELSE 1 END,
      p.created_at DESC
  `).bind(auth.user.id).all();
  return r.results || [];
}

async function canAccessProject(env, auth, projectId) {
  if (canViewAllProjects(auth.user, auth.permissions)) return true;
  const row = await env.DB.prepare(`
    SELECT 1 AS ok
    FROM project_members
    WHERE project_id=? AND user_id=? AND is_active=1
    LIMIT 1
  `).bind(projectId, auth.user.id).first();
  return Boolean(row);
}

function cleanText(v, max = 250) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function page(title, content) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{--navy:#10283a;--bg:#edf1f5;--line:#dce4ea;--muted:#667785;--danger:#b42318}
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:var(--bg);color:#142331}
.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
aside{background:var(--navy);color:#fff;padding:24px 18px}
.brand{font-size:20px;font-weight:800}.sub{font-size:11px;letter-spacing:.11em;color:#9eb0bf;margin-top:4px}
nav{margin-top:28px}nav a{display:block;color:#d9e3ea;text-decoration:none;padding:10px 12px;border-radius:10px;margin-bottom:5px}
nav a:hover{background:#1d405b}
main{padding:28px;max-width:1300px;width:100%}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 8px 24px rgba(15,35,50,.04);margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.kpi{font-size:28px;font-weight:800}.muted{color:var(--muted)}
.badge{display:inline-block;background:#edf3f7;border-radius:999px;padding:5px 9px;font-size:12px;margin:2px}
.btn{display:inline-block;text-decoration:none;background:var(--navy);color:#fff;padding:10px 14px;border-radius:10px;border:0;cursor:pointer}
.btn.ghost{background:#fff;color:var(--navy);border:1px solid var(--line)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #edf1f4;font-size:14px}th{font-size:12px;color:#657482}
code{background:#f3f6f8;padding:3px 6px;border-radius:6px}
@media(max-width:900px){.shell{grid-template-columns:1fr}aside{display:none}.grid{grid-template-columns:1fr}main{padding:16px}}
</style>
</head>
<body>${content}</body></html>`;
}

function appShell(user, active, body) {
  const isField = user.role_code === "FIELD_EXECUTOR";
  return `<div class="shell">
  <aside>
    <div class="brand">KENDALI</div>
    <div class="sub">PROJECT CONTROL · NATARA</div>
    <nav>
      <a href="${isField ? "/lapangan" : "/dashboard"}">Dashboard</a>
      <a href="/projects">Proyek</a>
      ${user.is_admin === 1 ? `<a href="/admin/users">User & Role</a>` : ""}
      <a href="/api/auth/me">Profil API</a>
    </nav>
  </aside>
  <main>
    <div class="top">
      <div><b>${user.full_name}</b><div class="muted">${user.role_name}</div></div>
      <a class="btn ghost" href="/cdn-cgi/access/logout">Keluar</a>
    </div>
    ${body}
  </main>
</div>`;
}

function dashboardHtml(auth, projects) {
  const activeCount = projects.filter(p => p.lifecycle_status === "ACTIVE").length;
  const avg = projects.length
    ? Math.round(projects.reduce((a,p)=>a+Number(p.progress_actual||0),0)/projects.length)
    : 0;

  const cards = projects.slice(0,8).map(p => `
    <div class="card">
      <b>${p.project_name}</b>
      <div class="muted">${p.location || "-"} · ${p.lifecycle_status}</div>
      <p>Progress <b>${Number(p.progress_actual||0).toFixed(1)}%</b></p>
      <a href="/projects/${encodeURIComponent(p.id)}">Lihat proyek →</a>
    </div>`).join("");

  return `
    <h1>${auth.user.role_code === "FIELD_EXECUTOR" ? "Mode Lapangan" : "Dashboard"}</h1>
    <div class="grid">
      <div class="card"><div class="muted">Proyek dapat diakses</div><div class="kpi">${projects.length}</div></div>
      <div class="card"><div class="muted">Proyek aktif</div><div class="kpi">${activeCount}</div></div>
      <div class="card"><div class="muted">Rata-rata progress</div><div class="kpi">${avg}%</div></div>
    </div>
    <h2>Proyek</h2>
    <div class="grid">${cards || `<div class="card muted">Belum ada proyek yang ditugaskan.</div>`}</div>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      let schemaVersion = null;
      try {
        const row = await env.DB.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").first();
        schemaVersion = row?.value || null;
      } catch {}
      return json({
        ok: schemaVersion === "CF-03",
        service: "KENDALI Natara V2",
        schema_version: schemaVersion,
        d1_binding: Boolean(env.DB),
        r2_binding: Boolean(env.FILES),
        access_context: Boolean(ctx?.access)
      }, schemaVersion === "CF-03" ? 200 : 503);
    }

    const auth = await requireUser(env, ctx);
    if (auth.error) return auth.error;

    // Identity
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      return json({
        ok: true,
        identity: auth.identity,
        user: auth.user,
        permissions: auth.permissions,
        landing_route: auth.user.role_code === "FIELD_EXECUTOR" ? "/lapangan" : "/dashboard"
      });
    }

    // Roles
    if (url.pathname === "/api/admin/roles" && request.method === "GET") {
      if (!hasPerm(auth.user, auth.permissions, "roles.view")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }
      const r = await env.DB.prepare(`
        SELECT id,code,name,department,is_admin,is_active
        FROM roles WHERE is_active=1 ORDER BY department,name
      `).all();
      return json({ok:true,roles:r.results||[]});
    }

    // Users list/create
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      if (!hasPerm(auth.user, auth.permissions, "users.view")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }
      const r = await env.DB.prepare(`
        SELECT u.id,u.email,u.full_name,u.employee_id,u.phone,u.position,u.department,
               u.is_active,u.created_at,u.updated_at,
               r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id
        ORDER BY u.is_active DESC,u.full_name
      `).all();
      return json({ok:true,users:r.results||[]});
    }

    if (url.pathname === "/api/admin/users" && request.method === "POST") {
      if (!hasPerm(auth.user, auth.permissions, "users.manage")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }
      const b = await readJson(request);
      if (!b) return json({ok:false,code:"INVALID_JSON"},400);

      const email = normEmail(b.email);
      const fullName = cleanText(b.full_name,120);
      const roleCode = cleanText(b.role_code,80);
      if (!email || !fullName || !roleCode) {
        return json({ok:false,code:"VALIDATION_ERROR",message:"email, full_name, role_code wajib"},400);
      }

      const role = await env.DB.prepare("SELECT id,name FROM roles WHERE code=? AND is_active=1").bind(roleCode).first();
      if (!role) return json({ok:false,code:"ROLE_NOT_FOUND"},400);

      const exists = await env.DB.prepare("SELECT id FROM users WHERE lower(email)=?").bind(email).first();
      if (exists) return json({ok:false,code:"EMAIL_EXISTS"},409);

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO users(
          id,email,full_name,employee_id,phone,position,department,role_id,is_active,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP)
      `).bind(
        id,email,fullName,cleanText(b.employee_id,50),cleanText(b.phone,50),
        cleanText(b.position,120)||role.name,cleanText(b.department,100),role.id
      ).run();

      const created = await env.DB.prepare(`
        SELECT u.*,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(id).first();
      await audit(env,auth.user.id,"USERS","CREATE",id,null,created);
      return json({ok:true,user:created},201);
    }

    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && request.method === "PATCH") {
      if (!hasPerm(auth.user, auth.permissions, "users.manage")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }
      const id = decodeURIComponent(userMatch[1]);
      const current = await env.DB.prepare(`
        SELECT u.*,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(id).first();
      if (!current) return json({ok:false,code:"USER_NOT_FOUND"},404);

      const b = await readJson(request);
      if (!b) return json({ok:false,code:"INVALID_JSON"},400);

      let roleId = current.role_id;
      if (b.role_code !== undefined) {
        const role = await env.DB.prepare("SELECT id FROM roles WHERE code=? AND is_active=1")
          .bind(String(b.role_code)).first();
        if (!role) return json({ok:false,code:"ROLE_NOT_FOUND"},400);
        roleId = role.id;
      }

      const newEmail = b.email !== undefined ? normEmail(b.email) : current.email;
      const newName = b.full_name !== undefined ? cleanText(b.full_name,120) : current.full_name;
      if (!newEmail || !newName) return json({ok:false,code:"VALIDATION_ERROR"},400);

      // Primary admin cannot accidentally disable itself.
      const nextActive = b.is_active !== undefined ? boolInt(b.is_active,current.is_active) : current.is_active;
      if (current.id === "user-admin-primary" && nextActive !== 1) {
        return json({ok:false,code:"PRIMARY_ADMIN_REQUIRED"},400);
      }

      await env.DB.prepare(`
        UPDATE users SET
          email=?,full_name=?,employee_id=?,phone=?,position=?,department=?,
          role_id=?,is_active=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(
        newEmail,newName,
        b.employee_id !== undefined ? cleanText(b.employee_id,50) : current.employee_id,
        b.phone !== undefined ? cleanText(b.phone,50) : current.phone,
        b.position !== undefined ? cleanText(b.position,120) : current.position,
        b.department !== undefined ? cleanText(b.department,100) : current.department,
        roleId,nextActive,id
      ).run();

      const updated = await env.DB.prepare(`
        SELECT u.*,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(id).first();
      await audit(env,auth.user.id,"USERS","UPDATE",id,current,updated,cleanText(b.notes,500));
      return json({ok:true,user:updated});
    }

    // Projects
    if (url.pathname === "/api/projects" && request.method === "GET") {
      const projects = await listProjectsForUser(env, auth);
      return json({ok:true,projects});
    }

    if (url.pathname === "/api/projects" && request.method === "POST") {
      if (!hasPerm(auth.user, auth.permissions, "project.manage")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }
      const b = await readJson(request);
      if (!b) return json({ok:false,code:"INVALID_JSON"},400);
      const name = cleanText(b.project_name,180);
      if (!name) return json({ok:false,code:"PROJECT_NAME_REQUIRED"},400);

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO projects(
          id,project_code,project_name,client_name,location,contract_value,budget_value,
          progress_plan,progress_actual,deviation,start_date,target_finish_date,
          lifecycle_status,created_by,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      `).bind(
        id,cleanText(b.project_code,80),name,cleanText(b.client_name,180),cleanText(b.location,220),
        Number(b.contract_value||0),Number(b.budget_value||0),
        Number(b.progress_plan||0),Number(b.progress_actual||0),
        Number(b.progress_actual||0)-Number(b.progress_plan||0),
        cleanText(b.start_date,30),cleanText(b.target_finish_date,30),
        cleanText(b.lifecycle_status,40)||"ACTIVE",auth.user.id
      ).run();

      const created = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(id).first();
      await audit(env,auth.user.id,"PROJECT","CREATE",id,null,created);
      return json({ok:true,project:created},201);
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === "GET") {
      const id = decodeURIComponent(projectMatch[1]);
      if (!(await canAccessProject(env,auth,id))) return json({ok:false,code:"FORBIDDEN"},403);
      const p = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(id).first();
      if (!p) return json({ok:false,code:"PROJECT_NOT_FOUND"},404);
      return json({ok:true,project:p});
    }

    if (projectMatch && request.method === "PATCH") {
      if (!hasPerm(auth.user,auth.permissions,"project.manage")) return json({ok:false,code:"FORBIDDEN"},403);
      const id = decodeURIComponent(projectMatch[1]);
      const current = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(id).first();
      if (!current) return json({ok:false,code:"PROJECT_NOT_FOUND"},404);
      const b = await readJson(request);
      if (!b) return json({ok:false,code:"INVALID_JSON"},400);

      const plan = b.progress_plan !== undefined ? Number(b.progress_plan) : Number(current.progress_plan||0);
      const actual = b.progress_actual !== undefined ? Number(b.progress_actual) : Number(current.progress_actual||0);

      await env.DB.prepare(`
        UPDATE projects SET
          project_code=?,project_name=?,client_name=?,location=?,contract_value=?,budget_value=?,
          progress_plan=?,progress_actual=?,deviation=?,start_date=?,target_finish_date=?,
          lifecycle_status=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(
        b.project_code !== undefined ? cleanText(b.project_code,80) : current.project_code,
        b.project_name !== undefined ? cleanText(b.project_name,180) : current.project_name,
        b.client_name !== undefined ? cleanText(b.client_name,180) : current.client_name,
        b.location !== undefined ? cleanText(b.location,220) : current.location,
        b.contract_value !== undefined ? Number(b.contract_value) : current.contract_value,
        b.budget_value !== undefined ? Number(b.budget_value) : current.budget_value,
        plan,actual,actual-plan,
        b.start_date !== undefined ? cleanText(b.start_date,30) : current.start_date,
        b.target_finish_date !== undefined ? cleanText(b.target_finish_date,30) : current.target_finish_date,
        b.lifecycle_status !== undefined ? cleanText(b.lifecycle_status,40) : current.lifecycle_status,
        id
      ).run();

      const updated = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(id).first();
      await audit(env,auth.user.id,"PROJECT","UPDATE",id,current,updated,cleanText(b.notes,500));
      return json({ok:true,project:updated});
    }

    // Project members
    const membersMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/members$/);
    if (membersMatch && request.method === "GET") {
      const projectId = decodeURIComponent(membersMatch[1]);
      if (!(await canAccessProject(env,auth,projectId))) return json({ok:false,code:"FORBIDDEN"},403);

      const r = await env.DB.prepare(`
        SELECT
          pm.id,pm.project_id,pm.user_id,pm.project_role,pm.is_active,pm.assigned_at,
          u.full_name,u.email,u.position,u.department,
          r.code AS role_code,r.name AS role_name
        FROM project_members pm
        JOIN users u ON u.id=pm.user_id
        JOIN roles r ON r.id=u.role_id
        WHERE pm.project_id=? AND pm.is_active=1
        ORDER BY r.name,u.full_name
      `).bind(projectId).all();
      return json({ok:true,members:r.results||[]});
    }

    if (membersMatch && request.method === "POST") {
      if (!hasPerm(auth.user,auth.permissions,"project.member_manage") &&
          !hasPerm(auth.user,auth.permissions,"project.assign")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }

      const projectId = decodeURIComponent(membersMatch[1]);
      const b = await readJson(request);
      if (!b?.user_id) return json({ok:false,code:"USER_ID_REQUIRED"},400);

      const p = await env.DB.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();
      if (!p) return json({ok:false,code:"PROJECT_NOT_FOUND"},404);

      const u = await env.DB.prepare(`
        SELECT u.id,u.full_name,u.is_active,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(String(b.user_id)).first();
      if (!u || u.is_active !== 1) return json({ok:false,code:"USER_NOT_ACTIVE"},400);

      const existing = await env.DB.prepare(`
        SELECT * FROM project_members WHERE project_id=? AND user_id=?
      `).bind(projectId,u.id).first();

      if (existing) {
        await env.DB.prepare(`
          UPDATE project_members
          SET project_role=?,is_active=1,assigned_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).bind(cleanText(b.project_role,120)||u.role_name,existing.id).run();
        await audit(env,auth.user.id,"PROJECT_MEMBER","REACTIVATE",existing.id,existing,
          {project_id:projectId,user_id:u.id,project_role:cleanText(b.project_role,120)||u.role_name});
        return json({ok:true,id:existing.id});
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO project_members(id,project_id,user_id,project_role,is_active)
        VALUES(?,?,?,?,1)
      `).bind(id,projectId,u.id,cleanText(b.project_role,120)||u.role_name).run();

      await audit(env,auth.user.id,"PROJECT_MEMBER","ASSIGN",id,null,
        {project_id:projectId,user_id:u.id,project_role:cleanText(b.project_role,120)||u.role_name});
      return json({ok:true,id},201);
    }

    const memberDeleteMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
    if (memberDeleteMatch && request.method === "DELETE") {
      if (!hasPerm(auth.user,auth.permissions,"project.member_manage") &&
          !hasPerm(auth.user,auth.permissions,"project.assign")) {
        return json({ok:false,code:"FORBIDDEN"},403);
      }

      const projectId = decodeURIComponent(memberDeleteMatch[1]);
      const userId = decodeURIComponent(memberDeleteMatch[2]);
      const current = await env.DB.prepare(`
        SELECT * FROM project_members WHERE project_id=? AND user_id=? AND is_active=1
      `).bind(projectId,userId).first();
      if (!current) return json({ok:false,code:"MEMBER_NOT_FOUND"},404);

      await env.DB.prepare(`
        UPDATE project_members SET is_active=0 WHERE id=?
      `).bind(current.id).run();

      await audit(env,auth.user.id,"PROJECT_MEMBER","REMOVE",current.id,current,
        {...current,is_active:0});
      return json({ok:true});
    }

    // UI routes
    if (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/lapangan") {
      const expected = auth.user.role_code === "FIELD_EXECUTOR" ? "/lapangan" : "/dashboard";
      if (url.pathname === "/") return Response.redirect(new URL(expected,url.origin).toString(),302);
      if (url.pathname === "/dashboard" && auth.user.role_code === "FIELD_EXECUTOR" && auth.user.is_admin !== 1)
        return Response.redirect(new URL("/lapangan",url.origin).toString(),302);
      if (url.pathname === "/lapangan" && auth.user.role_code !== "FIELD_EXECUTOR" && auth.user.is_admin !== 1)
        return Response.redirect(new URL("/dashboard",url.origin).toString(),302);

      const projects = await listProjectsForUser(env,auth);
      return html(page("KENDALI Natara V2",appShell(auth.user,"dashboard",dashboardHtml(auth,projects))));
    }

    if (url.pathname === "/projects") {
      const projects = await listProjectsForUser(env,auth);
      const rows = projects.map(p=>`
        <tr>
          <td><a href="/projects/${encodeURIComponent(p.id)}"><b>${p.project_name}</b></a></td>
          <td>${p.location||"-"}</td>
          <td>${p.lifecycle_status}</td>
          <td>${Number(p.progress_actual||0).toFixed(1)}%</td>
          <td>${p.member_count||0}</td>
        </tr>`).join("");
      const body = `<h1>Proyek</h1><div class="card"><table>
        <thead><tr><th>Proyek</th><th>Lokasi</th><th>Status</th><th>Progress</th><th>Tim</th></tr></thead>
        <tbody>${rows||`<tr><td colspan="5" class="muted">Belum ada proyek.</td></tr>`}</tbody>
      </table></div>`;
      return html(page("Proyek · KENDALI",appShell(auth.user,"projects",body)));
    }

    const uiProject = url.pathname.match(/^\/projects\/([^/]+)$/);
    if (uiProject) {
      const id = decodeURIComponent(uiProject[1]);
      if (!(await canAccessProject(env,auth,id))) return html(page("Forbidden","<h1>Akses ditolak</h1>"),403);
      const p = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(id).first();
      if (!p) return html(page("Not Found","<h1>Proyek tidak ditemukan</h1>"),404);
      const members = await env.DB.prepare(`
        SELECT u.full_name,u.position,r.name AS role_name,pm.project_role
        FROM project_members pm JOIN users u ON u.id=pm.user_id
        JOIN roles r ON r.id=u.role_id
        WHERE pm.project_id=? AND pm.is_active=1
        ORDER BY r.name,u.full_name
      `).bind(id).all();
      const team = (members.results||[]).map(m=>`<span class="badge">${m.full_name} · ${m.project_role||m.role_name}</span>`).join("");
      const body = `<h1>${p.project_name}</h1>
        <div class="grid">
          <div class="card"><div class="muted">Lokasi</div><b>${p.location||"-"}</b></div>
          <div class="card"><div class="muted">Progress Aktual</div><div class="kpi">${Number(p.progress_actual||0).toFixed(1)}%</div></div>
          <div class="card"><div class="muted">Deviasi</div><div class="kpi">${Number(p.deviation||0).toFixed(1)}%</div></div>
        </div>
        <div class="card"><h3>Tim Proyek</h3>${team||`<p class="muted">Belum ada personel ditugaskan.</p>`}</div>`;
      return html(page(`${p.project_name} · KENDALI`,appShell(auth.user,"project",body)));
    }

    if (url.pathname === "/admin/users") {
      if (!hasPerm(auth.user,auth.permissions,"users.view")) return html(page("Forbidden","<h1>Akses ditolak</h1>"),403);
      const r = await env.DB.prepare(`
        SELECT u.full_name,u.email,u.position,u.department,u.is_active,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id
        ORDER BY u.is_active DESC,u.full_name
      `).all();
      const rows = (r.results||[]).map(u=>`
        <tr><td><b>${u.full_name}</b><div class="muted">${u.email}</div></td>
        <td>${u.role_name}</td><td>${u.department||"-"}</td>
        <td>${u.is_active===1?"Aktif":"Nonaktif"}</td></tr>`).join("");
      const body = `<h1>User & Role</h1><div class="card"><table>
        <thead><tr><th>User</th><th>Role</th><th>Departemen</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
        <div class="card muted">Form tambah/edit user akan diaktifkan setelah API CF-03 lolos UAT.</div>`;
      return html(page("User & Role · KENDALI",appShell(auth.user,"users",body)));
    }

    return json({ok:false,code:"NOT_FOUND"},404);
  }
};
