function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const out = {
        ok: true,
        service: "KENDALI Natara V2",
        worker: true,
        d1_binding: Boolean(env.DB),
        r2_binding: Boolean(env.FILES),
        schema_version: null,
        database_ready: false
      };

      try {
        const row = await env.DB
          .prepare("SELECT value FROM schema_meta WHERE key = ?")
          .bind("schema_version")
          .first();

        out.schema_version = row?.value ?? null;
        out.database_ready = out.schema_version === "CF-02";
        if (!out.database_ready) out.ok = false;
      } catch (e) {
        out.ok = false;
        out.database_error = String(e?.message || e);
      }

      return json(out, out.ok ? 200 : 503);
    }

    if (url.pathname === "/api/db/check") {
      try {
        const roles = await env.DB.prepare("SELECT COUNT(*) AS c FROM roles").first();
        const users = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();
        const perms = await env.DB.prepare("SELECT COUNT(*) AS c FROM permissions").first();
        const schema = await env.DB.prepare(
          "SELECT value FROM schema_meta WHERE key='schema_version'"
        ).first();

        return json({
          ok: true,
          schema_version: schema?.value ?? null,
          roles: roles?.c ?? 0,
          users: users?.c ?? 0,
          permissions: perms?.c ?? 0
        });
      } catch (e) {
        return json({ ok: false, error: String(e?.message || e) }, 503);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
