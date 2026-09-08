function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function accessIdentity(ctx) {
  if (!ctx?.access) return null;
  try {
    const identity = await ctx.access.getIdentity();
    const email = normEmail(identity?.email);
    if (!email) return null;
    return {
      email,
      name: identity?.name || null,
      groups: Array.isArray(identity?.groups) ? identity.groups : []
    };
  } catch {
    return null;
  }
}

async function loadUser(env, email) {
  return env.DB.prepare(`
    SELECT
      u.id, u.email, u.full_name, u.employee_id, u.phone,
      u.position, u.department, u.is_active,
      r.id AS role_id, r.code AS role_code, r.name AS role_name,
      r.department AS role_department, r.is_admin, r.jobdesk_summary
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE lower(u.email) = ? AND u.is_active = 1 AND r.is_active = 1
    LIMIT 1
  `).bind(normEmail(email)).first();
}

async function loadPermissions(env, roleId) {
  const result = await env.DB.prepare(`
    SELECT p.code, p.module, p.action, p.description
    FROM role_permissions rp
    JOIN permissions p ON p.code = rp.permission_code
    WHERE rp.role_id = ? AND rp.allowed = 1
    ORDER BY p.module, p.code
  `).bind(roleId).all();
  return result.results || [];
}

function can(user, permissions, code) {
  return Boolean(
    user?.is_admin === 1 ||
    permissions?.some((p) => p.code === "system.full_access" || p.code === code)
  );
}

async function requireUser(env, ctx) {
  const identity = await accessIdentity(ctx);
  if (!identity) {
    return { error: json({
      ok: false,
      code: "ACCESS_REQUIRED",
      message: "Cloudflare Access belum memverifikasi identitas pengguna."
    }, 401) };
  }

  const user = await loadUser(env, identity.email);
  if (!user) {
    return { error: json({
      ok: false,
      code: "USER_NOT_REGISTERED",
      email: identity.email,
      message: "Email sudah terverifikasi Cloudflare Access, tetapi belum terdaftar sebagai user aktif KENDALI."
    }, 403) };
  }

  const permissions = await loadPermissions(env, user.role_id);
  return { identity, user, permissions };
}

function landingRoute(roleCode) {
  return roleCode === "FIELD_EXECUTOR" ? "/#/lapangan" : "/#/dashboard";
}

async function audit(env, userId, action, recordId, oldData, newData, notes) {
  await env.DB.prepare(`
    INSERT INTO audit_logs(
      id,user_id,module,action,record_id,old_data_json,new_data_json,notes
    ) VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    userId || null,
    "USERS",
    action,
    recordId || null,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    notes || null
  ).run();
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health stays available for infrastructure troubleshooting.
    if (url.pathname === "/api/health") {
      const result = {
        ok: true,
        service: "KENDALI Natara V2",
        worker: true,
        d1_binding: Boolean(env.DB),
        r2_binding: Boolean(env.FILES),
        schema_version: null,
        access_identity_available: Boolean(ctx?.access)
      };

      try {
        const row = await env.DB.prepare(
          "SELECT value FROM schema_meta WHERE key = ?"
        ).bind("schema_version").first();
        result.schema_version = row?.value ?? null;
        result.database_ready = result.schema_version === "CF-02";
      } catch (error) {
        result.ok = false;
        result.database_ready = false;
        result.database_error = String(error?.message || error);
      }

      return json(result, result.ok ? 200 : 503);
    }

    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      const auth = await requireUser(env, ctx);
      if (auth.error) return auth.error;

      return json({
        ok: true,
        identity: { email: auth.identity.email, name: auth.identity.name },
        user: auth.user,
        permissions: auth.permissions.map((p) => p.code),
        landing_route: landingRoute(auth.user.role_code)
      });
    }

    if (url.pathname === "/api/admin/roles" && request.method === "GET") {
      const auth = await requireUser(env, ctx);
      if (auth.error) return auth.error;
      if (!can(auth.user, auth.permissions, "roles.view") && !auth.user.is_admin) {
        return json({ ok: false, code: "FORBIDDEN" }, 403);
      }

      const result = await env.DB.prepare(`
        SELECT id,code,name,department,is_admin,is_active,jobdesk_summary
        FROM roles
        WHERE is_active = 1
        ORDER BY department,name
      `).all();

      return json({ ok: true, roles: result.results || [] });
    }

    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      const auth = await requireUser(env, ctx);
      if (auth.error) return auth.error;
      if (!can(auth.user, auth.permissions, "users.view")) {
        return json({ ok: false, code: "FORBIDDEN" }, 403);
      }

      const result = await env.DB.prepare(`
        SELECT
          u.id,u.email,u.full_name,u.employee_id,u.phone,u.position,u.department,
          u.is_active,u.created_at,u.updated_at,
          r.code AS role_code,r.name AS role_name
        FROM users u
        JOIN roles r ON r.id=u.role_id
        ORDER BY u.is_active DESC,u.full_name
      `).all();

      return json({ ok: true, users: result.results || [] });
    }

    if (url.pathname === "/api/admin/users" && request.method === "POST") {
      const auth = await requireUser(env, ctx);
      if (auth.error) return auth.error;
      if (!can(auth.user, auth.permissions, "users.manage")) {
        return json({ ok: false, code: "FORBIDDEN" }, 403);
      }

      const body = await parseJson(request);
      if (!body) return json({ ok:false, code:"INVALID_JSON" }, 400);

      const email = normEmail(body.email);
      const fullName = String(body.full_name || "").trim();
      const roleCode = String(body.role_code || "").trim();

      if (!email || !fullName || !roleCode) {
        return json({
          ok:false,
          code:"VALIDATION_ERROR",
          message:"email, full_name dan role_code wajib diisi."
        }, 400);
      }

      const role = await env.DB.prepare(
        "SELECT id,code,name FROM roles WHERE code=? AND is_active=1"
      ).bind(roleCode).first();

      if (!role) return json({ ok:false, code:"ROLE_NOT_FOUND" }, 400);

      const exists = await env.DB.prepare(
        "SELECT id FROM users WHERE lower(email)=?"
      ).bind(email).first();

      if (exists) return json({ ok:false, code:"EMAIL_EXISTS" }, 409);

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO users(
          id,email,full_name,employee_id,phone,position,department,role_id,is_active,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP)
      `).bind(
        id,email,fullName,
        body.employee_id || null,
        body.phone || null,
        body.position || role.name,
        body.department || null,
        role.id
      ).run();

      const created = await env.DB.prepare(`
        SELECT u.*,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(id).first();

      await audit(env, auth.user.id, "CREATE_USER", id, null, created, null);
      return json({ ok:true, user:created }, 201);
    }

    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && request.method === "PATCH") {
      const auth = await requireUser(env, ctx);
      if (auth.error) return auth.error;
      if (!can(auth.user, auth.permissions, "users.manage")) {
        return json({ ok:false, code:"FORBIDDEN" }, 403);
      }

      const id = decodeURIComponent(userMatch[1]);
      const current = await env.DB.prepare(`
        SELECT u.*,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(id).first();

      if (!current) return json({ ok:false, code:"USER_NOT_FOUND" }, 404);

      const body = await parseJson(request);
      if (!body) return json({ ok:false, code:"INVALID_JSON" }, 400);

      let roleId = current.role_id;
      if (body.role_code !== undefined) {
        const role = await env.DB.prepare(
          "SELECT id FROM roles WHERE code=? AND is_active=1"
        ).bind(String(body.role_code)).first();
        if (!role) return json({ ok:false, code:"ROLE_NOT_FOUND" }, 400);
        roleId = role.id;
      }

      const email = body.email !== undefined ? normEmail(body.email) : current.email;
      const fullName = body.full_name !== undefined
        ? String(body.full_name || "").trim()
        : current.full_name;

      if (!email || !fullName) {
        return json({ ok:false, code:"VALIDATION_ERROR" }, 400);
      }

      await env.DB.prepare(`
        UPDATE users SET
          email=?,full_name=?,employee_id=?,phone=?,position=?,department=?,
          role_id=?,is_active=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(
        email,
        fullName,
        body.employee_id !== undefined ? body.employee_id : current.employee_id,
        body.phone !== undefined ? body.phone : current.phone,
        body.position !== undefined ? body.position : current.position,
        body.department !== undefined ? body.department : current.department,
        roleId,
        body.is_active !== undefined ? (body.is_active ? 1 : 0) : current.is_active,
        id
      ).run();

      const updated = await env.DB.prepare(`
        SELECT u.*,r.code AS role_code,r.name AS role_name
        FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?
      `).bind(id).first();

      await audit(env, auth.user.id, "UPDATE_USER", id, current, updated, body.notes || null);
      return json({ ok:true, user:updated });
    }

    return env.ASSETS.fetch(request);
  }
};
