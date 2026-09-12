/**
 * KENDALI Natara App V2.6 — Cloudflare Worker
 *
 * Satu deploy: Worker (API) + Static Assets (frontend) + D1 (data) + R2 (file).
 * Autentikasi: Cloudflare Access (email) -> dicocokkan ke master karyawan di D1.
 *
 * Route:
 *   GET  /api/health              — status layanan (publik, tanpa data sensitif)
 *   GET  /api/access/session      — identitas Access -> user KENDALI
 *   GET  /api/auth/me             — alias /api/access/session
 *   GET  /api/diagnostics         — Admin/Direktur saja
 *   *    /rest/v1/:collection     — adapter PostgREST -> D1 (app_records)
 *   *    /storage/v1/object/...   — adapter Supabase Storage -> R2
 *   *    /auth/v1/*, /api/broadcast — dimatikan (Supabase lama)
 *   *    lainnya                  — static assets (SPA)
 */

const APP_VERSION = "APP-V2.6";
const SERVICE_NAME = "KENDALI Natara App V2";
const SCHEMA_VERSION = "FULL-UI-01";
const STORAGE_BUCKET = "kendali-files";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const COLLECTIONS = new Set([
  "projects", "users", "rabs", "surat", "tukang",
  "pelatihan", "aset", "proyeksi", "vendor", "po"
]);

const DIAGNOSTIC_ROLES = new Set(["admin", "direktur"]);
const FIELD_ROLE = "Pelaksana Lapangan";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

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
    "access-control-allow-headers":
      request.headers.get("access-control-request-headers") ||
      "authorization,apikey,content-type,prefer,x-upsert",
    "access-control-max-age": "86400"
  };
  if (origin) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-credentials"] = "true";
    h["vary"] = "origin";
  }
  return h;
}

function cleanId(v) {
  const s = String(v ?? "").trim();
  if (!s || s.length > 250) return null;
  return s;
}

function safeCollection(name) {
  return COLLECTIONS.has(name) ? name : null;
}

function safeJsonParse(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Parse PostgREST filter `in.(a,b,"c,d")` -> ["a","b","c,d"] */
function parseInFilter(value) {
  if (!value) return [];
  const m = String(value).trim().match(/^in\.\((.*)\)$/s);
  if (!m) return [];

  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of m[1]) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);

  // URLSearchParams sudah melakukan decode satu kali; jangan decode ulang
  // agar id yang mengandung karakter "%" tidak rusak.
  return out.map((x) => x.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Cloudflare Access identity                                          */
/* ------------------------------------------------------------------ */

function base64UrlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

/**
 * Verifikasi JWT Cloudflare Access (opsional, aktif bila ACCESS_TEAM_DOMAIN + ACCESS_AUD diisi).
 * Bila tidak diisi, Worker mempercayai header Cf-Access-Authenticated-User-Email,
 * yang hanya aman selama Worker berada di belakang Cloudflare Access.
 */
async function verifyAccessJwt(token, env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || "").trim();
  const aud = String(env.ACCESS_AUD || "").trim();
  if (!team || !aud || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = safeJsonParse(new TextDecoder().decode(base64UrlDecode(parts[0])), null);
  const payload = safeJsonParse(new TextDecoder().decode(base64UrlDecode(parts[1])), null);
  if (!header || !payload || header.alg !== "RS256") return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(aud)) return null;

  const certsUrl = `https://${team.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/cdn-cgi/access/certs`;
  const certs = await fetch(certsUrl, { cf: { cacheTtl: 300, cacheEverything: true } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const jwk = certs?.keys?.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}

async function accessEmail(request, env) {
  const strict = Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);

  if (strict) {
    const token =
      request.headers.get("cf-access-jwt-assertion") ||
      getCookie(request, "CF_Authorization");
    const payload = await verifyAccessJwt(token, env);
    return payload?.email ? String(payload.email).trim().toLowerCase() : null;
  }

  const header = request.headers.get("cf-access-authenticated-user-email");
  if (header) return header.trim().toLowerCase();

  // Hanya untuk `wrangler dev` lokal (.dev.vars) dan hanya bila host-nya localhost.
  if (env.DEV_ACCESS_EMAIL && isLocalRequest(request)) {
    return String(env.DEV_ACCESS_EMAIL).trim().toLowerCase();
  }

  return null;
}

function isLocalRequest(request) {
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0";
  } catch {
    return false;
  }
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username || u.id,
    name: u.name || u.username || u.email,
    role: u.role || "",
    jabatan: u.jabatan || u.role || "",
    unit: u.unit || "",
    departemen: u.departemen || "",
    email: u.email || "",
    status: u.status || ""
  };
}

async function findUserByEmail(env, email) {
  const row = await env.DB.prepare(`
    SELECT id, data_json
    FROM app_records
    WHERE collection = 'users'
      AND lower(trim(COALESCE(json_extract(data_json, '$.email'), ''))) = ?
    LIMIT 1
  `).bind(email).first();

  if (!row) return null;
  return { id: row.id, ...safeJsonParse(row.data_json, {}) };
}

/**
 * Identitas Access -> user KENDALI aktif.
 * Mengembalikan { ok, status, reason, email, user }.
 */
async function registeredAccessUser(request, env) {
  const email = await accessEmail(request, env);
  if (!email) {
    return { ok: false, status: 401, reason: "UNAUTHORIZED", email: null, user: null };
  }

  const user = await findUserByEmail(env, email);
  if (!user) {
    return { ok: false, status: 403, reason: "NOT_REGISTERED", email, user: null };
  }

  if (String(user.status || "").trim().toLowerCase() === "nonaktif") {
    return { ok: false, status: 403, reason: "INACTIVE", email, user: publicUser(user) };
  }

  return { ok: true, status: 200, reason: null, email, user: publicUser(user) };
}

function accessFailure(auth) {
  const messages = {
    UNAUTHORIZED: "Identitas Cloudflare Access tidak ditemukan. Pastikan Worker dilindungi Cloudflare Access.",
    NOT_REGISTERED: "Email Cloudflare Access belum terdaftar di database karyawan KENDALI.",
    INACTIVE: "Akun KENDALI nonaktif."
  };
  return json(
    {
      ok: false,
      code: auth.reason,
      message: messages[auth.reason] || "Akses ditolak.",
      email: auth.email || null
    },
    auth.status || 403
  );
}

/* ------------------------------------------------------------------ */
/* REST adapter (PostgREST-like) -> D1 app_records                     */
/* ------------------------------------------------------------------ */

const D1_BATCH_SIZE = 50;

/** Jalankan statement D1 dalam batch berukuran aman (sinkron sekaligus ratusan record). */
async function runBatched(env, statements) {
  for (let i = 0; i < statements.length; i += D1_BATCH_SIZE) {
    await env.DB.batch(statements.slice(i, i + D1_BATCH_SIZE));
  }
}

async function restGet(env, collection, url) {
  const ids = parseInFilter(url.searchParams.get("id"));
  const eq = (url.searchParams.get("id") || "").match(/^eq\.(.+)$/s);

  let stmt;
  if (eq) {
    stmt = env.DB.prepare(
      "SELECT id, data_json, updated_at FROM app_records WHERE collection=? AND id=? ORDER BY updated_at DESC"
    ).bind(collection, eq[1]);
  } else if (ids.length) {
    const marks = ids.map(() => "?").join(",");
    stmt = env.DB.prepare(
      `SELECT id, data_json, updated_at FROM app_records WHERE collection=? AND id IN (${marks}) ORDER BY updated_at DESC`
    ).bind(collection, ...ids);
  } else {
    stmt = env.DB.prepare(
      "SELECT id, data_json, updated_at FROM app_records WHERE collection=? ORDER BY updated_at DESC"
    ).bind(collection);
  }

  const result = await stmt.all();
  const rows = (result.results || []).map((r) => ({
    id: r.id,
    data: safeJsonParse(r.data_json, null),
    updated_at: r.updated_at
  }));

  return json(rows, 200, {
    "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`
  });
}

async function restUpsert(request, env, collection) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, 400);
  }

  const rows = Array.isArray(payload) ? payload : [payload];
  if (!rows.length) return json(null, 201);

  const now = new Date().toISOString();
  const statements = [];

  for (const row of rows) {
    const id = cleanId(row?.id);
    if (!id || row?.data === undefined) {
      return json({ message: "Each row requires id and data" }, 400);
    }
    const updatedAt = row.updated_at || now;

    statements.push(
      env.DB.prepare(`
        INSERT INTO app_records (collection, id, data_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(collection, id) DO UPDATE SET
          data_json = excluded.data_json,
          updated_at = excluded.updated_at
      `).bind(collection, id, JSON.stringify(row.data), updatedAt)
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO app_sync_audit (id, collection, record_id, action) VALUES (?, ?, ?, 'UPSERT')"
      ).bind(crypto.randomUUID(), collection, id)
    );
  }

  await runBatched(env, statements);

  return json(null, 201, { "preference-applied": "resolution=merge-duplicates" });
}

async function restDelete(env, collection, url) {
  const idParam = url.searchParams.get("id") || "";
  const eq = idParam.match(/^eq\.(.+)$/s);
  const ids = eq ? [eq[1]] : parseInFilter(idParam);

  if (!ids.length) return json(null, 204);

  const statements = [];
  for (const id of ids) {
    statements.push(
      env.DB.prepare("DELETE FROM app_records WHERE collection=? AND id=?").bind(collection, id)
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO app_sync_audit (id, collection, record_id, action) VALUES (?, ?, ?, 'DELETE')"
      ).bind(crypto.randomUUID(), collection, id)
    );
  }
  await runBatched(env, statements);

  return json(null, 204);
}

async function restHandler(request, env, url) {
  const collection = safeCollection(
    decodeURIComponent(url.pathname.slice("/rest/v1/".length).split("/")[0] || "")
  );
  if (!collection) return json({ message: "Unknown table" }, 404);

  switch (request.method) {
    case "GET":
    case "HEAD":
      return restGet(env, collection, url);
    case "POST":
    case "PUT":
    case "PATCH":
      return restUpsert(request, env, collection);
    case "DELETE":
      return restDelete(env, collection, url);
    default:
      return json({ message: "Method not allowed" }, 405);
  }
}

/* ------------------------------------------------------------------ */
/* Storage adapter (Supabase Storage-like) -> R2                       */
/* ------------------------------------------------------------------ */

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
  let key;
  try {
    key = decodeURIComponent(rest.slice(slash + 1));
  } catch {
    return null;
  }

  key = key.replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\")) return null;

  return { isPublic, bucket, key };
}

function indexOfBytes(hay, needle, from = 0) {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Parser multipart/form-data minimal: mengembalikan part yang berisi file
 * (punya atribut filename) — atau part terbesar bila tidak ada filename.
 * Dibutuhkan karena workerd menolak part bernama "" yang dikirim supabase-js.
 */
async function extractMultipartFile(request, contentType) {
  const m = contentType.match(/boundary="?([^";]+)"?/i);
  if (!m) return null;

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const buf = new Uint8Array(await request.arrayBuffer());
  const delim = enc.encode(`--${m[1]}`);
  const headerEnd = enc.encode("\r\n\r\n");

  const parts = [];
  let pos = indexOfBytes(buf, delim, 0);
  while (pos !== -1) {
    const next = indexOfBytes(buf, delim, pos + delim.length);
    if (next === -1) break;

    let start = pos + delim.length;
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2; // CRLF setelah boundary
    let end = next;
    if (buf[end - 2] === 0x0d && buf[end - 1] === 0x0a) end -= 2; // CRLF sebelum boundary berikutnya

    const he = indexOfBytes(buf, headerEnd, start);
    if (he !== -1 && he < end) {
      const headers = dec.decode(buf.subarray(start, he));
      const disp = headers.match(/content-disposition:\s*([^\r\n]*)/i)?.[1] || "";
      const filename = disp.match(/filename\*?=(?:"([^"]*)"|([^;\r\n]*))/i);
      const ctype = headers.match(/content-type:\s*([^\r\n]*)/i)?.[1]?.trim() || "";
      parts.push({
        filename: filename ? (filename[1] ?? filename[2] ?? "").trim() : null,
        contentType: ctype,
        bytes: buf.subarray(he + headerEnd.length, end)
      });
    }
    pos = next;
  }

  if (!parts.length) return null;
  const withFile = parts.find((p) => p.filename !== null);
  if (withFile) return withFile;
  return parts.reduce((a, b) => (b.bytes.byteLength > a.bytes.byteLength ? b : a));
}

async function storageHandler(request, env, url) {
  const parts = storageParts(url.pathname);
  if (!parts) return json({ statusCode: "400", error: "InvalidRequest", message: "Invalid storage path" }, 400);
  if (parts.bucket !== STORAGE_BUCKET) {
    return json({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" }, 404);
  }

  if (request.method === "GET" || request.method === "HEAD") {
    const obj = await env.FILES.get(parts.key);
    if (!obj) {
      return json({ statusCode: "404", error: "not_found", message: "Object not found" }, 404);
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set(
      "cache-control",
      parts.isPublic ? "private, max-age=3600" : "private, no-store"
    );

    const download = url.searchParams.get("download");
    if (download !== null) {
      const name = download || parts.key.split("/").pop();
      headers.set("content-disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
    }

    return new Response(request.method === "HEAD" ? null : obj.body, { headers });
  }

  if (request.method === "POST" || request.method === "PUT") {
    const upsert = String(request.headers.get("x-upsert") || "false").toLowerCase() === "true";
    if (!upsert && request.method === "POST") {
      const existing = await env.FILES.head(parts.key);
      if (existing) {
        return json({ statusCode: "409", error: "Duplicate", message: "The resource already exists" }, 409);
      }
    }

    const reqType = request.headers.get("content-type") || "";
    let body;
    let contentType;
    let size = Number(request.headers.get("content-length") || 0);

    if (reqType.toLowerCase().startsWith("multipart/form-data")) {
      // supabase-js mengirim Blob sebagai FormData dengan field bernama "" (kosong).
      // request.formData() di workerd menolak part tanpa nama, jadi multipart
      // di-parse manual (lihat extractMultipartFile).
      if (size > MAX_UPLOAD_BYTES) {
        return json(
          { statusCode: "413", error: "Payload too large", message: "File too large", max_mb: MAX_UPLOAD_BYTES / (1024 * 1024) },
          413
        );
      }
      const file = await extractMultipartFile(request, reqType);
      if (!file) {
        return json({ statusCode: "400", error: "InvalidRequest", message: "No file in form data" }, 400);
      }
      body = file.bytes;
      contentType = file.contentType || "application/octet-stream";
      size = file.bytes.byteLength;
    } else {
      body = request.body;
      contentType = reqType || "application/octet-stream";
    }

    if (size > MAX_UPLOAD_BYTES) {
      return json(
        { statusCode: "413", error: "Payload too large", message: "File too large", max_mb: MAX_UPLOAD_BYTES / (1024 * 1024) },
        413
      );
    }

    await env.FILES.put(parts.key, body, {
      httpMetadata: { contentType },
      customMetadata: { source: "KENDALI-APP-V2" }
    });

    return json({ Key: `${parts.bucket}/${parts.key}`, Id: crypto.randomUUID() }, 200);
  }

  if (request.method === "DELETE") {
    await env.FILES.delete(parts.key);
    return json({ message: "Successfully deleted" }, 200);
  }

  return json({ statusCode: "405", error: "MethodNotAllowed", message: "Method not allowed" }, 405);
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function healthHandler(env) {
  const base = {
    service: SERVICE_NAME,
    app_version: APP_VERSION,
    single_deploy: true,
    architecture: "single-app",
    database: "Cloudflare D1",
    files: "Cloudflare R2",
    d1_binding: Boolean(env.DB),
    r2_binding: Boolean(env.FILES),
    assets_binding: Boolean(env.ASSETS)
  };

  if (!env.DB) {
    return json({ ok: false, ...base, error: "D1 binding DB tidak tersedia" }, 503);
  }

  try {
    const [schema, all, projects, users, importedP, linkedPm, linkedPelaksana] = await env.DB.batch([
      env.DB.prepare("SELECT value FROM schema_meta WHERE key='schema_version'"),
      env.DB.prepare("SELECT COUNT(*) AS c FROM app_records"),
      env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects'"),
      env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='users'"),
      env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects' AND id LIKE 'NK-IMP-%'"),
      env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects' AND COALESCE(json_extract(data_json,'$.pmUsername'),'') <> ''"),
      env.DB.prepare("SELECT COUNT(*) AS c FROM app_records WHERE collection='projects' AND COALESCE(json_extract(data_json,'$.pengawasUsername'),'') <> ''")
    ]);

    const schemaVersion = schema.results?.[0]?.value || null;
    const count = (r) => Number(r.results?.[0]?.c || 0);
    const ok = schemaVersion === SCHEMA_VERSION;

    return json(
      {
        ok,
        ...base,
        schema_version: schemaVersion,
        expected_schema_version: SCHEMA_VERSION,
        records: count(all),
        projects: count(projects),
        users: count(users),
        imported_projects: count(importedP),
        linked_project_pm: count(linkedPm),
        linked_project_pelaksana: count(linkedPelaksana)
      },
      ok ? 200 : 503
    );
  } catch (e) {
    return json({ ok: false, ...base, error: String(e?.message || e) }, 503);
  }
}

async function sessionHandler(request, env) {
  const auth = await registeredAccessUser(request, env);
  if (!auth.ok) return accessFailure(auth);

  return json({
    ok: true,
    email: auth.email,
    identity: { email: auth.email },
    user: auth.user,
    landing_route: auth.user.role === FIELD_ROLE ? "/lapangan" : "/"
  });
}

async function diagnosticsHandler(request, env) {
  const auth = await registeredAccessUser(request, env);
  if (!auth.ok) return accessFailure(auth);

  if (!DIAGNOSTIC_ROLES.has(String(auth.user.role || "").trim().toLowerCase())) {
    return json(
      { ok: false, code: "FORBIDDEN", message: "Diagnostics hanya untuk Administrator/Direktur." },
      403
    );
  }

  try {
    const [meta, counts, audit] = await env.DB.batch([
      env.DB.prepare("SELECT key, value, updated_at FROM schema_meta ORDER BY key"),
      env.DB.prepare("SELECT collection, COUNT(*) AS count FROM app_records GROUP BY collection ORDER BY collection"),
      env.DB.prepare("SELECT collection, action, COUNT(*) AS count, MAX(created_at) AS last_at FROM app_sync_audit GROUP BY collection, action ORDER BY collection, action")
    ]);

    return json({
      ok: true,
      app_version: APP_VERSION,
      identity: auth.user,
      meta: meta.results || [],
      collections: counts.results || [],
      sync_audit: audit.results || []
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* entry                                                               */
/* ------------------------------------------------------------------ */

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // ---- API
  if (pathname === "/api/health") return healthHandler(env);
  if (pathname === "/api/access/session" || pathname === "/api/auth/me") return sessionHandler(request, env);
  if (pathname === "/api/diagnostics") return diagnosticsHandler(request, env);
  if (pathname.startsWith("/api/broadcast")) {
    return json({ ok: false, message: "Realtime dimatikan. Sinkronisasi memakai request/response ke D1." }, 410);
  }
  if (pathname.startsWith("/api/")) {
    return json({ ok: false, message: "Endpoint tidak ditemukan" }, 404);
  }

  // ---- Data & file (wajib identitas terdaftar & aktif)
  if (pathname.startsWith("/rest/v1/")) {
    const auth = await registeredAccessUser(request, env);
    if (!auth.ok) return accessFailure(auth);
    return restHandler(request, env, url);
  }

  if (pathname.startsWith("/storage/v1/object/")) {
    const auth = await registeredAccessUser(request, env);
    if (!auth.ok) return accessFailure(auth);
    return storageHandler(request, env, url);
  }

  if (pathname.startsWith("/storage/v1/")) {
    return json({ statusCode: "404", error: "not_found", message: "Storage endpoint not supported" }, 404);
  }

  // ---- Supabase Auth lama dimatikan
  if (pathname.startsWith("/auth/v1/")) {
    return json({ message: "Authentication is handled by Cloudflare Access." }, 404);
  }

  // ---- Frontend (static assets + SPA fallback dari wrangler.jsonc)
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ message: "Method not allowed" }, 405);
  }
  if (!env.ASSETS) {
    return json({ ok: false, error: "ASSETS binding tidak tersedia" }, 500);
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      console.error("KENDALI_WORKER_ERROR", e);
      return json({ ok: false, error: "Internal error", detail: String(e?.message || e) }, 500);
    }
  }
};
