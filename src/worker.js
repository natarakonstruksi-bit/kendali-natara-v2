const COLLECTIONS = new Set([
  "projects","users","rabs","surat","tukang",
  "pelatihan","aset","proyeksi","vendor","po"
]);

function json(data, status = 200, extra = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extra
  });
  return new Response(data === null ? null : JSON.stringify(data), { status, headers });
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  const h = {
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": request.headers.get("access-control-request-headers") || "authorization,apikey,content-type,prefer",
    "access-control-max-age": "86400"
  };
  if (origin) h["access-control-allow-origin"] = origin;
  return h;
}

function safeCollection(name) {
  return COLLECTIONS.has(name) ? name : null;
}

function cleanId(v) {
  const s = String(v ?? "").trim();
  if (!s || s.length > 250) return null;
  return s;
}

function parseInFilter(value) {
  if (!value) return [];
  let s = String(value).trim();
  const m = s.match(/^in\.\((.*)\)$/s);
  if (!m) return [];
  s = m[1];
  return s.split(",").map(x => {
    x = x.trim();
    if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) {
      x = x.slice(1, -1);
    }
    return decodeURIComponent(x);
  }).filter(Boolean);
}

async function restGet(env, collection) {
  const result = await env.DB.prepare(`
    SELECT id, data_json, updated_at
    FROM app_records
    WHERE collection=?
    ORDER BY updated_at DESC
  `).bind(collection).all();

  const rows = (result.results || []).map(r => ({
    id: r.id,
    data: JSON.parse(r.data_json),
    updated_at: r.updated_at
  }));

  return json(rows, 200, {
    "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`
  });
}

async function restUpsert(request, env, collection) {
  let payload;
  try { payload = await request.json(); }
  catch { return json({message:"Invalid JSON"}, 400); }

  const rows = Array.isArray(payload) ? payload : [payload];
  if (!rows.length) return json(null, 201);

  const statements = [];
  const audits = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    const id = cleanId(row?.id);
    if (!id || row?.data === undefined) {
      return json({message:"Each row requires id and data"}, 400);
    }
    const updatedAt = row.updated_at || now;
    statements.push(
      env.DB.prepare(`
        INSERT INTO app_records(collection,id,data_json,updated_at)
        VALUES(?,?,?,?)
        ON CONFLICT(collection,id) DO UPDATE SET
          data_json=excluded.data_json,
          updated_at=excluded.updated_at
      `).bind(collection,id,JSON.stringify(row.data),updatedAt)
    );
    audits.push(
      env.DB.prepare(`
        INSERT INTO app_sync_audit(id,collection,record_id,action)
        VALUES(?,?,?,'UPSERT')
      `).bind(crypto.randomUUID(),collection,id)
    );
  }

  if (statements.length) await env.DB.batch(statements);
  if (audits.length) await env.DB.batch(audits);

  // Supabase JS upsert without .select() is satisfied by a successful 201.
  return json(null, 201, {"preference-applied":"resolution=merge-duplicates"});
}

async function restDelete(request, env, collection, url) {
  const ids = parseInFilter(url.searchParams.get("id"));
  if (!ids.length) return json(null, 204);

  const statements = ids.map(id =>
    env.DB.prepare("DELETE FROM app_records WHERE collection=? AND id=?")
      .bind(collection,id)
  );
  const audits = ids.map(id =>
    env.DB.prepare(`
      INSERT INTO app_sync_audit(id,collection,record_id,action)
      VALUES(?,?,?,'DELETE')
    `).bind(crypto.randomUUID(),collection,id)
  );

  await env.DB.batch(statements);
  await env.DB.batch(audits);
  return json(null, 204);
}

function storageParts(pathname) {
  const prefix = "/storage/v1/object/";
  if (!pathname.startsWith(prefix)) return null;
  let rest = pathname.slice(prefix.length);
  let isPublic = false;

  if (rest.startsWith("public/")) {
    isPublic = true;
    rest = rest.slice("public/".length);
  }

  const slash = rest.indexOf("/");
  if (slash < 1) return null;
  const bucket = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  if (!key) return null;
  return { isPublic, bucket, key };
}

async function storageHandler(request, env, url) {
  const parts = storageParts(url.pathname);
  if (!parts) return json({message:"Invalid storage path"}, 400);

  // Existing build uses logical bucket "kendali-files"; physical bucket is FILES.
  if (parts.bucket !== "kendali-files") {
    return json({message:"Bucket not found"}, 404);
  }

  if (request.method === "GET" || request.method === "HEAD") {
    const obj = await env.FILES.get(parts.key);
    if (!obj) return json({message:"Object not found"}, 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", parts.isPublic ? "public, max-age=31536000, immutable" : "private, no-store");
    return new Response(request.method === "HEAD" ? null : obj.body, { headers });
  }

  if (request.method === "POST" || request.method === "PUT") {
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 25 * 1024 * 1024) {
      return json({message:"File too large",max_mb:25}, 413);
    }

    await env.FILES.put(parts.key, request.body, {
      httpMetadata: { contentType },
      customMetadata: { source: "KENDALI-FULL-UI" }
    });

    return json({
      Key: `${parts.bucket}/${parts.key}`,
      Id: crypto.randomUUID()
    }, 200);
  }

  if (request.method === "DELETE") {
    await env.FILES.delete(parts.key);
    return json({}, 200);
  }

  return json({message:"Method not allowed"}, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname === "/app-build.json") {
      return json({
        ok: true,
        appVersion: "APP-V2.5.1",
        singleDeploy: true,
        architecture: "single-app",
        frontend: "KENDALI App",
        backend: "Cloudflare Worker",
        database: "D1",
        files: "R2",
        verification_route: "worker-direct"
      });
    }

    if (url.pathname === "/api/health") {
      let schema = null;
      let recordCount = 0;
      let projectCount = 0;
      let userCount = 0;
      let importedProjects = 0;
      let importedEmployees = 0;
      let linkedPm = 0;
      let linkedPelaksana = 0;
      try {
        const [s, allRows, projects, users, importedP, importedE, linkedP, linkedL] = await Promise.all([
          env.DB.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects'").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='users'").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects' AND id LIKE 'NK-IMP-%'").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='users' AND id LIKE 'EMP-%'").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects' AND COALESCE(json_extract(data_json,'$.pmUsername'),'') <> ''").first(),
          env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects' AND COALESCE(json_extract(data_json,'$.pengawasUsername'),'') <> ''").first()
        ]);
        schema = s?.value || null;
        recordCount = Number(allRows?.c || 0);
        projectCount = Number(projects?.c || 0);
        userCount = Number(users?.c || 0);
        importedProjects = Number(importedP?.c || 0);
        importedEmployees = Number(importedE?.c || 0);
        linkedPm = Number(linkedP?.c || 0);
        linkedPelaksana = Number(linkedL?.c || 0);
      } catch (e) {
        return json({
          ok:false,
          service:"KENDALI Natara App V2",
          app_version:"APP-V2.5.1",
          error:String(e?.message || e)
        }, 503);
      }

      return json({
        ok: schema === "FULL-UI-01",
        service: "KENDALI Natara App V2",
        app_version: "APP-V2.5.1",
        single_deploy: true,
        architecture: "single-app",
        database: "Cloudflare D1",
        files: "Cloudflare R2",
        schema_version: schema,
        records: recordCount,
        projects: projectCount,
        users: userCount,
        imported_projects: importedProjects,
        imported_employees: importedEmployees,
        linked_project_pm: linkedPm,
        linked_project_pelaksana: linkedPelaksana,
        d1_binding: Boolean(env.DB),
        r2_binding: Boolean(env.FILES)
      }, schema === "FULL-UI-01" ? 200 : 503);

    }

    if (url.pathname === "/api/diagnostics") {
      try {
        const meta = await env.DB.prepare(`
          SELECT key,value,updated_at
          FROM schema_meta
          WHERE key IN ('schema_version','project_import_version','employee_import_version','project_assignment_version')
          ORDER BY key
        `).all();

        const counts = await env.DB.prepare(`
          SELECT collection,COUNT(*) AS count
          FROM app_records
          GROUP BY collection
          ORDER BY collection
        `).all();

        return json({
          ok:true,
          app_version:"APP-V2.5.1",
          meta:meta.results || [],
          collections:counts.results || []
        });
      } catch (e) {
        return json({ok:false,error:String(e?.message || e)},500);
      }
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      const collection = safeCollection(
        decodeURIComponent(url.pathname.slice("/rest/v1/".length).split("/")[0])
      );
      if (!collection) return json({message:"Unknown table"}, 404);

      if (request.method === "GET") return restGet(env, collection);
      if (request.method === "POST") return restUpsert(request, env, collection);
      if (request.method === "DELETE") return restDelete(request, env, collection, url);
      return json({message:"Method not supported by KENDALI adapter"}, 405);
    }

    if (url.pathname.startsWith("/storage/v1/object/")) {
      return storageHandler(request, env, url);
    }

    // Supabase auth/realtime are intentionally not used by this lift-and-shift build.
    if (url.pathname.startsWith("/auth/v1/")) {
      return json({message:"Auth handled by KENDALI/Cloudflare, not Supabase"}, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
