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

async function getAccessIdentity(ctx) {
  if (!ctx?.access) return null;
  const identity = await ctx.access.getIdentity();
  if (!identity?.email) return null;
  return {
    email: String(identity.email).trim().toLowerCase(),
    name: identity.name || null
  };
}

async function getUserByEmail(env, email) {
  return env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.employee_id,
      u.phone,
      u.position,
      u.department,
      u.is_active,
      r.id AS role_id,
      r.code AS role_code,
      r.name AS role_name,
      r.department AS role_department,
      r.is_admin
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE lower(u.email) = ?
      AND u.is_active = 1
      AND r.is_active = 1
    LIMIT 1
  `).bind(email).first();
}

async function getPermissions(env, roleId) {
  const result = await env.DB.prepare(`
    SELECT p.code
    FROM role_permissions rp
    JOIN permissions p ON p.code = rp.permission_code
    WHERE rp.role_id = ?
      AND rp.allowed = 1
    ORDER BY p.code
  `).bind(roleId).all();
  return (result.results || []).map(x => x.code);
}

function landingRoute(roleCode) {
  return roleCode === "FIELD_EXECUTOR" ? "/lapangan" : "/dashboard";
}

function page(title, content) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#edf1f5;color:#142331}
.wrap{max-width:960px;margin:7vh auto;padding:24px}
.card{background:#fff;border:1px solid #dce4ea;border-radius:18px;padding:30px;box-shadow:0 12px 32px rgba(15,35,50,.06)}
.brand{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7b89}
h1{margin:.4rem 0 1rem}
.muted{color:#647483}
.badge{display:inline-block;background:#edf3f7;padding:6px 10px;border-radius:999px;margin:3px;font-size:12px}
a.btn{display:inline-block;text-decoration:none;background:#10283a;color:#fff;padding:11px 16px;border-radius:10px;margin-top:14px}
code{background:#f2f5f7;padding:3px 6px;border-radius:6px}
.err{color:#b42318}
</style>
</head>
<body>
<div class="wrap"><div class="card">${content}</div></div>
</body></html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Infrastructure health remains readable only after Access once Access
    // protection is enabled on the whole Worker.
    if (url.pathname === "/api/health") {
      let schemaVersion = null;
      try {
        const row = await env.DB
          .prepare("SELECT value FROM schema_meta WHERE key='schema_version'")
          .first();
        schemaVersion = row?.value || null;
      } catch {}

      return json({
        ok: schemaVersion === "CF-02",
        service: "KENDALI Natara V2",
        d1_binding: Boolean(env.DB),
        r2_binding: Boolean(env.FILES),
        schema_version: schemaVersion,
        access_context: Boolean(ctx?.access)
      }, schemaVersion === "CF-02" ? 200 : 503);
    }

    const identity = await getAccessIdentity(ctx);

    if (!identity) {
      return html(page(
        "KENDALI — Access diperlukan",
        `<div class="brand">KENDALI · Natara Konstruksi</div>
         <h1 class="err">Identitas Cloudflare Access belum tersedia</h1>
         <p>Aktifkan proteksi Cloudflare Access untuk Worker <code>kendali-natara-v2</code>, lalu buka kembali halaman ini.</p>`
      ), 401);
    }

    const user = await getUserByEmail(env, identity.email);

    if (!user) {
      return html(page(
        "KENDALI — User belum terdaftar",
        `<div class="brand">KENDALI · Natara Konstruksi</div>
         <h1>User belum terdaftar di KENDALI</h1>
         <p>Email Cloudflare Access: <code>${identity.email}</code></p>
         <p class="muted">Administrator harus mendaftarkan email ini di master User KENDALI sebelum akses diberikan.</p>
         <a class="btn" href="/cdn-cgi/access/logout">Keluar</a>`
      ), 403);
    }

    const permissions = await getPermissions(env, user.role_id);

    if (url.pathname === "/api/auth/me") {
      return json({
        ok: true,
        identity,
        user,
        permissions,
        landing_route: landingRoute(user.role_code)
      });
    }

    if (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/lapangan") {
      const expected = landingRoute(user.role_code);

      if (url.pathname === "/" && expected !== "/") {
        return Response.redirect(new URL(expected, url.origin).toString(), 302);
      }

      if (url.pathname === "/lapangan" && user.role_code !== "FIELD_EXECUTOR" && user.is_admin !== 1) {
        return Response.redirect(new URL("/dashboard", url.origin).toString(), 302);
      }

      if (url.pathname === "/dashboard" && user.role_code === "FIELD_EXECUTOR" && user.is_admin !== 1) {
        return Response.redirect(new URL("/lapangan", url.origin).toString(), 302);
      }

      const mode = user.role_code === "FIELD_EXECUTOR" ? "Mode Lapangan" : "Dashboard";
      return html(page(
        "KENDALI Natara V2",
        `<div class="brand">KENDALI · Natara Konstruksi</div>
         <h1>Halo, ${user.full_name}</h1>
         <p><b>${user.role_name}</b> · ${mode}</p>
         <p class="muted">${user.email}</p>
         <div>${permissions.slice(0,18).map(p=>`<span class="badge">${p}</span>`).join("")}</div>
         ${permissions.length > 18 ? `<p class="muted">+ ${permissions.length-18} permission lainnya</p>` : ""}
         <p><a class="btn" href="/api/auth/me">Cek identitas API</a></p>
         <p><a href="/cdn-cgi/access/logout">Keluar</a></p>`
      ));
    }

    return json({ ok: false, code: "NOT_FOUND" }, 404);
  }
};
