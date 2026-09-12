/**
 * KENDALI Natara App V2.7 — Cloudflare Worker
 *
 * Satu deploy: Worker (API) + Static Assets (frontend) + D1 (data) + R2 (file).
 * Autentikasi: username + password KENDALI (server-side, sesi cookie HttpOnly).
 *
 * Route:
 *   GET  /login                   — halaman login (HTML dari Worker)
 *   GET  /ganti-password          — ubah password sendiri (butuh sesi)
 *   POST /api/auth/login          — {username,password,remember} -> cookie sesi
 *   GET|POST /api/auth/logout     — hapus sesi
 *   POST /api/auth/change-password
 *   GET  /api/auth/me, /api/access/session — sesi -> user KENDALI (dipakai bundle UI)
 *   GET  /api/health              — status layanan (publik, tanpa data sensitif)
 *   GET  /api/diagnostics         — Admin/Direktur saja
 *   *    /rest/v1/:collection     — adapter PostgREST -> D1 (app_records), butuh sesi
 *   *    /storage/v1/object/...   — adapter Supabase Storage -> R2, butuh sesi
 *   *    /auth/v1/*, /api/broadcast — dimatikan (Supabase lama)
 *   GET  /                        — index.html bila ada sesi, jika tidak -> /login
 *   *    lainnya                  — static assets (SPA)
 */

import { loginPage, changePasswordPage } from "./pages.js";

const APP_VERSION = "APP-V2.7";
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

// Sesi
const SESSION_COOKIE = "kendali_session";
const SESSION_TTL_SEC = 12 * 60 * 60;            // 12 jam
const SESSION_TTL_REMEMBER_SEC = 30 * 24 * 60 * 60; // 30 hari ("ingat saya")
// Pembatasan percobaan login per username
const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_SEC = 15 * 60;
// Format hash password — HARUS sama dengan bundle UI (md/fB): "h1$" + sha256hex("kendali-natara-v1:" + password)
const PASSWORD_SALT_PREFIX = "kendali-natara-v1:";
const PASSWORD_HASH_PREFIX = "h1$";
const PASSWORD_MIN_LEN = 6;

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

function html(markup, status = 200, extra = {}) {
  return new Response(markup, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

function redirect(location, extra = {}) {
  return new Response(null, { status: 302, headers: { location, "cache-control": "no-store", ...extra } });
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

  // URLSearchParams sudah melakukan decode satu kali; jangan decode ulang.
  return out.map((x) => x.trim()).filter(Boolean);
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function readBody(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json")) {
    try {
      return { data: await request.json(), form: false };
    } catch {
      return { data: {}, form: false };
    }
  }
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    try {
      const fd = await request.formData();
      const data = {};
      for (const [k, v] of fd.entries()) data[k] = typeof v === "string" ? v : "";
      return { data, form: true };
    } catch {
      return { data: {}, form: true };
    }
  }
  return { data: {}, form: false };
}

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */

function isHashed(v) {
  return typeof v === "string" && v.startsWith(PASSWORD_HASH_PREFIX);
}

async function hashPassword(plain) {
  return PASSWORD_HASH_PREFIX + (await sha256Hex(PASSWORD_SALT_PREFIX + plain));
}

/** Verifikasi password terhadap nilai tersimpan (hash h1$ atau plaintext legacy). */
async function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, upgrade: false };
  if (isHashed(stored)) {
    return { ok: timingSafeEqual(await hashPassword(plain), stored), upgrade: false };
  }
  return { ok: timingSafeEqual(plain, stored), upgrade: true };
}

/* ------------------------------------------------------------------ */
/* Users & sesi (D1)                                                   */
/* ------------------------------------------------------------------ */

function publicUser(u) {
  return {
    id: u.id,
    username: u.username || u.id,
    name: u.name || u.username || u.email || "",
    role: u.role || "",
    jabatan: u.jabatan || u.role || "",
    unit: u.unit || "",
    departemen: u.departemen || "",
    email: u.email || "",
    status: u.status || ""
  };
}

async function findUserByUsername(env, username) {
  const key = String(username || "").trim().toLowerCase();
  if (!key) return null;
  const row = await env.DB.prepare(`
    SELECT id, data_json
    FROM app_records
    WHERE collection = 'users'
      AND (lower(id) = ? OR lower(trim(COALESCE(json_extract(data_json, '$.username'), ''))) = ?)
    LIMIT 1
  `).bind(key, key).first();
  if (!row) return null;
  return { id: row.id, ...safeJsonParse(row.data_json, {}) };
}

async function setUserPassword(env, userId, hash) {
  await env.DB.prepare(`
    UPDATE app_records
    SET data_json = json_set(data_json, '$.password', ?), updated_at = CURRENT_TIMESTAMP
    WHERE collection = 'users' AND id = ?
  `).bind(hash, userId).run();
}

function nowIso() {
  return new Date().toISOString();
}

async function createSession(env, request, user, remember) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const ttl = remember ? SESSION_TTL_REMEMBER_SEC : SESSION_TTL_SEC;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO app_sessions (token_hash, user_id, username, expires_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    tokenHash,
    user.id,
    user.username || user.id,
    expiresAt,
    (request.headers.get("user-agent") || "").slice(0, 300),
    request.headers.get("cf-connecting-ip") || ""
  ).run();
  return { token, ttl };
}

function sessionCookie(request, token, ttl) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${secure}`;
}

function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/**
 * Sesi -> user KENDALI aktif.
 * Mengembalikan { ok, status, reason, user, sessionHash }.
 */
async function authenticate(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || token.length < 20 || token.length > 200) {
    return { ok: false, status: 401, reason: "NO_SESSION", user: null };
  }

  const tokenHash = await sha256Hex(token);
  const sess = await env.DB.prepare(`
    SELECT user_id, expires_at FROM app_sessions WHERE token_hash = ? LIMIT 1
  `).bind(tokenHash).first();

  if (!sess) return { ok: false, status: 401, reason: "NO_SESSION", user: null };
  if (new Date(sess.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM app_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return { ok: false, status: 401, reason: "EXPIRED", user: null };
  }

  const row = await env.DB.prepare(
    "SELECT id, data_json FROM app_records WHERE collection='users' AND id = ? LIMIT 1"
  ).bind(sess.user_id).first();
  if (!row) return { ok: false, status: 403, reason: "NOT_REGISTERED", user: null };

  const user = { id: row.id, ...safeJsonParse(row.data_json, {}) };
  if (String(user.status || "").trim().toLowerCase() === "nonaktif") {
    return { ok: false, status: 403, reason: "INACTIVE", user: publicUser(user) };
  }

  // sentuh sesi (jarang) agar bisa dibersihkan berdasarkan last_seen
  return { ok: true, status: 200, reason: null, user: publicUser(user), sessionHash: tokenHash };
}

function authFailure(auth) {
  const messages = {
    NO_SESSION: "Belum login.",
    EXPIRED: "Sesi sudah berakhir. Silakan login kembali.",
    NOT_REGISTERED: "Akun tidak ditemukan di database karyawan KENDALI.",
    INACTIVE: "Akun KENDALI nonaktif."
  };
  return json(
    { ok: false, code: auth.reason, message: messages[auth.reason] || "Akses ditolak.", login_url: "/login" },
    auth.status || 403
  );
}

/* ------------------------------------------------------------------ */
/* Login attempts (rate limit per username)                            */
/* ------------------------------------------------------------------ */

async function loginBlocked(env, username) {
  const row = await env.DB.prepare(
    "SELECT fails, last_fail_at FROM app_login_attempts WHERE username = ?"
  ).bind(username).first();
  if (!row) return false;
  const age = (Date.now() - new Date(row.last_fail_at).getTime()) / 1000;
  return Number(row.fails) >= LOGIN_MAX_FAILS && age < LOGIN_WINDOW_SEC;
}

async function recordLoginFail(env, username) {
  await env.DB.prepare(`
    INSERT INTO app_login_attempts (username, fails, last_fail_at) VALUES (?, 1, ?)
    ON CONFLICT(username) DO UPDATE SET
      fails = CASE WHEN (julianday(?) - julianday(last_fail_at)) * 86400 > ? THEN 1 ELSE fails + 1 END,
      last_fail_at = excluded.last_fail_at
  `).bind(username, nowIso(), nowIso(), LOGIN_WINDOW_SEC).run();
}

async function clearLoginFails(env, username) {
  await env.DB.prepare("DELETE FROM app_login_attempts WHERE username = ?").bind(username).run();
}

/* ------------------------------------------------------------------ */
/* Auth handlers                                                       */
/* ------------------------------------------------------------------ */

function landingFor(user) {
  return user.role === FIELD_ROLE ? "/#/lapangan" : "/";
}

async function loginHandler(request, env) {
  const { data, form } = await readBody(request);
  const username = String(data.username || "").trim();
  const password = String(data.password || "");
  const remember = data.remember === true || data.remember === "1" || data.remember === "on" || data.remember === "true";
  const wantsRedirect = form || data.redirect === "1";

  const fail = (status, message) =>
    wantsRedirect
      ? html(loginPage({ error: message, username }), status)
      : json({ ok: false, message }, status);

  if (!username || !password) return fail(400, "Username dan password wajib diisi.");

  const key = username.toLowerCase();
  if (await loginBlocked(env, key)) {
    return fail(429, "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.");
  }

  const user = await findUserByUsername(env, username);
  if (!user) {
    await recordLoginFail(env, key);
    return fail(401, "Username atau password salah.");
  }
  if (!user.password) {
    return fail(403, "Password akun ini belum diatur. Hubungi Administrator.");
  }

  const check = await verifyPassword(password, user.password);
  if (!check.ok) {
    await recordLoginFail(env, key);
    return fail(401, "Username atau password salah.");
  }
  if (String(user.status || "").trim().toLowerCase() === "nonaktif") {
    return fail(403, "Akun KENDALI nonaktif. Hubungi Administrator.");
  }
  if (check.upgrade) {
    await setUserPassword(env, user.id, await hashPassword(password));
  }

  await clearLoginFails(env, key);
  const { token, ttl } = await createSession(env, request, user, remember);
  const cookie = sessionCookie(request, token, ttl);
  const pub = publicUser(user);
  const landing = landingFor(pub);

  if (wantsRedirect) return redirect(landing, { "set-cookie": cookie });
  return json(
    { ok: true, user: pub, username: pub.username, landing_route: pub.role === FIELD_ROLE ? "/lapangan" : "/", landing_url: landing },
    200,
    { "set-cookie": cookie }
  );
}

async function logoutHandler(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    try {
      await env.DB.prepare("DELETE FROM app_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    } catch {}
  }
  const cookie = clearSessionCookie(request);
  if (request.method === "GET") return redirect("/login", { "set-cookie": cookie });
  return json({ ok: true, login_url: "/login" }, 200, { "set-cookie": cookie });
}

async function sessionHandler(request, env) {
  const auth = await authenticate(request, env);
  if (!auth.ok) return authFailure(auth);
  return json({
    ok: true,
    username: auth.user.username,
    email: auth.user.email || "",
    user: auth.user,
    identity: { username: auth.user.username, email: auth.user.email || "" },
    landing_route: auth.user.role === FIELD_ROLE ? "/lapangan" : "/"
  });
}

async function changePasswordHandler(request, env) {
  const auth = await authenticate(request, env);
  if (!auth.ok) return authFailure(auth);

  const { data } = await readBody(request);
  const oldPassword = String(data.oldPassword || "");
  const newPassword = String(data.newPassword || "");
  if (newPassword.length < PASSWORD_MIN_LEN) {
    return json({ ok: false, message: `Password baru minimal ${PASSWORD_MIN_LEN} karakter.` }, 400);
  }

  const full = await findUserByUsername(env, auth.user.username);
  if (!full) return json({ ok: false, message: "Akun tidak ditemukan." }, 404);

  const check = await verifyPassword(oldPassword, full.password);
  if (!check.ok) return json({ ok: false, message: "Password saat ini salah." }, 401);

  await setUserPassword(env, full.id, await hashPassword(newPassword));
  // sesi lain untuk user ini diputus, sesi saat ini dipertahankan
  await env.DB.prepare("DELETE FROM app_sessions WHERE user_id = ? AND token_hash <> ?")
    .bind(full.id, auth.sessionHash).run();

  return json({ ok: true, message: "Password berhasil diperbarui." });
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
  const rows = (result.results || []).map((r) => {
    const data = safeJsonParse(r.data_json, null);
    // Hash password tidak pernah dikirim ke browser; verifikasi login terjadi di Worker.
    if (collection === "users" && data && typeof data === "object") data.password = "";
    return { id: r.id, data, updated_at: r.updated_at };
  });

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

  // Collection users: password kosong dari UI berarti "tidak diubah" -> pertahankan hash lama;
  // password plaintext (bukan h1$) di-hash di sini.
  let existingPasswords = null;
  if (collection === "users") {
    existingPasswords = new Map();
    const ids = rows.map((r) => cleanId(r?.id)).filter(Boolean);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const res = await env.DB.prepare(
        `SELECT id, json_extract(data_json, '$.password') AS password FROM app_records WHERE collection='users' AND id IN (${chunk.map(() => "?").join(",")})`
      ).bind(...chunk).all();
      for (const r of res.results || []) existingPasswords.set(r.id, r.password || "");
    }
  }

  for (const row of rows) {
    const id = cleanId(row?.id);
    if (!id || row?.data === undefined) {
      return json({ message: "Each row requires id and data" }, 400);
    }
    const updatedAt = row.updated_at || now;

    if (existingPasswords && row.data && typeof row.data === "object") {
      const incoming = String(row.data.password || "");
      if (!incoming) {
        row.data.password = existingPasswords.get(id) || "";
      } else if (!isHashed(incoming)) {
        row.data.password = await hashPassword(incoming);
      }
    }

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

async function diagnosticsHandler(request, env) {
  const auth = await authenticate(request, env);
  if (!auth.ok) return authFailure(auth);

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
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // ---- Halaman login / ganti password (HTML dari Worker)
  if (pathname === "/login") {
    if (method !== "GET" && method !== "HEAD") return json({ message: "Method not allowed" }, 405);
    const auth = await authenticate(request, env);
    if (auth.ok) return redirect(landingFor(auth.user));
    return html(loginPage(), 200, auth.reason === "EXPIRED" ? { "set-cookie": clearSessionCookie(request) } : {});
  }
  if (pathname === "/ganti-password") {
    const auth = await authenticate(request, env);
    if (!auth.ok) return redirect("/login");
    return html(changePasswordPage({ user: auth.user }));
  }

  // ---- Auth API
  if (pathname === "/api/auth/login") {
    if (method !== "POST") return json({ message: "Method not allowed" }, 405);
    return loginHandler(request, env);
  }
  if (pathname === "/api/auth/logout") return logoutHandler(request, env);
  if (pathname === "/api/auth/change-password") {
    if (method !== "POST") return json({ message: "Method not allowed" }, 405);
    return changePasswordHandler(request, env);
  }
  if (pathname === "/api/auth/me" || pathname === "/api/access/session") return sessionHandler(request, env);

  // ---- API lain
  if (pathname === "/api/health") return healthHandler(env);
  if (pathname === "/api/diagnostics") return diagnosticsHandler(request, env);
  if (pathname.startsWith("/api/broadcast")) {
    return json({ ok: false, message: "Realtime dimatikan. Sinkronisasi memakai request/response ke D1." }, 410);
  }
  if (pathname.startsWith("/api/")) {
    return json({ ok: false, message: "Endpoint tidak ditemukan" }, 404);
  }

  // ---- Data & file (wajib sesi login aktif)
  if (pathname.startsWith("/rest/v1/")) {
    const auth = await authenticate(request, env);
    if (!auth.ok) return authFailure(auth);
    return restHandler(request, env, url);
  }
  if (pathname.startsWith("/storage/v1/object/")) {
    const auth = await authenticate(request, env);
    if (!auth.ok) return authFailure(auth);
    return storageHandler(request, env, url);
  }
  if (pathname.startsWith("/storage/v1/")) {
    return json({ statusCode: "404", error: "not_found", message: "Storage endpoint not supported" }, 404);
  }

  // ---- Supabase Auth lama dimatikan
  if (pathname.startsWith("/auth/v1/")) {
    return json({ message: "Authentication is handled by KENDALI (/login)." }, 404);
  }

  // ---- Frontend
  if (method !== "GET" && method !== "HEAD") {
    return json({ message: "Method not allowed" }, 405);
  }
  if (!env.ASSETS) {
    return json({ ok: false, error: "ASSETS binding tidak tersedia" }, 500);
  }

  // Halaman utama hanya untuk yang sudah login; selain itu ke /login.
  if (pathname === "/" || pathname === "/index.html") {
    const auth = await authenticate(request, env);
    if (!auth.ok) {
      return redirect("/login", auth.reason === "EXPIRED" ? { "set-cookie": clearSessionCookie(request) } : {});
    }
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
