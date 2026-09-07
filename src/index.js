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
      const result = {
        ok: true,
        service: "KENDALI Natara V2",
        worker: true,
        d1_binding: Boolean(env.DB),
        r2_binding: Boolean(env.FILES),
        schema_version: null
      };

      if (env.DB) {
        try {
          const row = await env.DB
            .prepare("SELECT value FROM schema_meta WHERE key = ?")
            .bind("schema_version")
            .first();
          result.schema_version = row?.value ?? null;
          result.database_ready = result.schema_version === "CF-01";
        } catch (error) {
          result.ok = false;
          result.database_ready = false;
          result.database_error = String(error?.message || error);
        }
      }

      if (!env.FILES) {
        result.ok = false;
        result.r2_error = "FILES binding belum tersedia";
      }

      return json(result, result.ok ? 200 : 503);
    }

    if (url.pathname === "/api/db/health") {
      if (!env.DB) return json({ ok: false, error: "DB binding tidak tersedia" }, 503);
      try {
        const row = await env.DB
          .prepare("SELECT value FROM schema_meta WHERE key = ?")
          .bind("schema_version")
          .first();
        return json({ ok: true, schema_version: row?.value ?? null });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 503);
      }
    }

    if (url.pathname === "/api/r2/health") {
      if (!env.FILES) return json({ ok: false, error: "FILES binding tidak tersedia" }, 503);
      try {
        const listed = await env.FILES.list({ limit: 1 });
        return json({ ok: true, bucket: "kendali-natara-files-v2", objects_checked: listed.objects.length });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error) }, 503);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
