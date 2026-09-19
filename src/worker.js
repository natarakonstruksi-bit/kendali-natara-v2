/**
 * KENDALI Natara V2.8 — End-to-End Project Control
 * Cloudflare Worker + D1 + R2 + Static Assets
 */

const APP_VERSION = "APP-V2.8.1";
const SERVICE_NAME = "KENDALI Natara Project Control";
const SESSION_COOKIE = "kendali_session";
const SESSION_TTL_SEC = 12 * 60 * 60;
const SESSION_TTL_REMEMBER_SEC = 30 * 24 * 60 * 60;
const PASSWORD_SALT_PREFIX = "kendali-natara-v1:";
const PASSWORD_HASH_PREFIX = "h1$";
const PASSWORD_MIN_LEN = 6;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const STORAGE_BUCKET = "kendali-natara-files-v2";
const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_SEC = 15 * 60;

const COLLECTIONS = new Set([
  "projects", "users", "rabs", "surat", "tukang", "pelatihan", "aset", "proyeksi", "vendor", "po",
  "project_budget", "cash_in", "cash_out", "receivables", "payables", "payment_requests",
  "daily_progress", "weekly_progress", "opname", "qc_inspections", "defects", "cco", "approvals",
  "milestones", "retention", "closeout", "project_documents", "issues", "schedule", "procurement"
]);

const DOC_CORE = ["CONTRACT", "RAB_BASELINE", "DED_FINAL", "TIME_SCHEDULE"];
const DOC_PRECON = ["PCM", "MC0"];
const DOC_PHO = ["PHO_BAST", "AS_BUILT"];
const DOC_FHO = ["FHO_BAST"];
const DOC_FIN = ["FINAL_RECONCILIATION"];

function json(data, status = 200, extra = {}) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra
    }
  });
}

function safeJsonParse(text, fallback = {}) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function cleanId(v) {
  const s = String(v ?? "").trim();
  if (!s || s.length > 250) return null;
  return s;
}

function safeCollection(name) {
  return COLLECTIONS.has(name) ? name : null;
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

function isHashed(v) {
  return typeof v === "string" && v.startsWith(PASSWORD_HASH_PREFIX);
}

async function hashPassword(plain) {
  return PASSWORD_HASH_PREFIX + await sha256Hex(PASSWORD_SALT_PREFIX + plain);
}

async function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, upgrade: false };
  if (isHashed(stored)) return { ok: timingSafeEqual(await hashPassword(plain), stored), upgrade: false };
  return { ok: timingSafeEqual(plain, stored), upgrade: true };
}

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
    status: u.status || "Aktif"
  };
}

async function findUserByUsername(env, username) {
  const key = String(username || "").trim().toLowerCase();
  if (!key) return null;
  const row = await env.DB.prepare(`
    SELECT id, data_json FROM app_records
    WHERE collection='users'
      AND (
        lower(id)=? OR
        lower(trim(COALESCE(json_extract(data_json,'$.username'),'')))=? OR
        lower(trim(COALESCE(json_extract(data_json,'$.email'),'')))=?
      )
    LIMIT 1
  `).bind(key, key, key).first();
  if (!row) return null;
  return { id: row.id, ...safeJsonParse(row.data_json, {}) };
}

async function setUserPassword(env, userId, hash) {
  await env.DB.prepare(`
    UPDATE app_records
    SET data_json=json_set(data_json,'$.password',?), updated_at=CURRENT_TIMESTAMP
    WHERE collection='users' AND id=?
  `).bind(hash, userId).run();
}

function sessionCookie(request, token, ttl) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${secure}`;
}

function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function createSession(env, request, user, remember) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const ttl = remember ? SESSION_TTL_REMEMBER_SEC : SESSION_TTL_SEC;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO app_sessions(token_hash,user_id,username,expires_at,user_agent,ip)
    VALUES(?,?,?,?,?,?)
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

async function authenticate(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || token.length < 20 || token.length > 200) return { ok:false, status:401, reason:"NO_SESSION" };
  const tokenHash = await sha256Hex(token);
  const sess = await env.DB.prepare(`SELECT user_id, expires_at FROM app_sessions WHERE token_hash=? LIMIT 1`).bind(tokenHash).first();
  if (!sess) return { ok:false, status:401, reason:"NO_SESSION" };
  if (new Date(sess.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM app_sessions WHERE token_hash=?`).bind(tokenHash).run();
    return { ok:false, status:401, reason:"EXPIRED" };
  }
  const row = await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='users' AND id=? LIMIT 1`).bind(sess.user_id).first();
  if (!row) return { ok:false, status:403, reason:"NOT_REGISTERED" };
  const user = { id: row.id, ...safeJsonParse(row.data_json,{}) };
  if (String(user.status || "").toLowerCase() === "nonaktif") return { ok:false, status:403, reason:"INACTIVE" };
  return { ok:true, user:publicUser(user), sessionHash:tokenHash };
}

function authFailure(auth) {
  const message = auth.reason === "EXPIRED" ? "Sesi berakhir. Silakan login kembali." :
    auth.reason === "INACTIVE" ? "Akun nonaktif." :
    auth.reason === "NOT_REGISTERED" ? "Akun tidak ditemukan." : "Belum login.";
  return json({ ok:false, code:auth.reason, message }, auth.status || 401);
}

async function parseJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function audit(env, user, action, collection, recordId, projectId = "", detail = {}) {
  try {
    await env.DB.prepare(`
      INSERT INTO kendali_audit_log(id,actor_id,actor_name,action,collection,record_id,project_id,detail_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(), user?.id || "", user?.name || user?.username || "System", action,
      collection || "", recordId || "", projectId || "", JSON.stringify(detail || {}), new Date().toISOString()
    ).run();
  } catch (_) {}
}

async function loginBlocked(env, username) {
  const row = await env.DB.prepare(`SELECT fails,last_fail_at FROM app_login_attempts WHERE username=?`).bind(username).first();
  if (!row) return false;
  const age = (Date.now() - new Date(row.last_fail_at).getTime()) / 1000;
  return Number(row.fails || 0) >= LOGIN_MAX_FAILS && age < LOGIN_WINDOW_SEC;
}

async function recordLoginFail(env, username) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO app_login_attempts(username,fails,last_fail_at) VALUES(?,1,?)
    ON CONFLICT(username) DO UPDATE SET
      fails=CASE WHEN (julianday(?) - julianday(last_fail_at))*86400 > ? THEN 1 ELSE fails+1 END,
      last_fail_at=excluded.last_fail_at
  `).bind(username,now,now,LOGIN_WINDOW_SEC).run();
}

async function clearLoginFails(env, username) {
  await env.DB.prepare(`DELETE FROM app_login_attempts WHERE username=?`).bind(username).run();
}

async function loginHandler(request, env) {
  const body = await parseJson(request) || {};
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const remember = Boolean(body.remember);
  if (!username || !password) return json({ok:false,message:"Username dan password wajib diisi."},400);
  const loginKey = username.toLowerCase();
  if (await loginBlocked(env, loginKey)) return json({ok:false,message:"Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi."},429);
  const user = await findUserByUsername(env, username);
  if (!user) {
    await recordLoginFail(env, loginKey);
    return json({ok:false,message:"Username atau password salah."},401);
  }
  if (String(user.status || "").toLowerCase() === "nonaktif") return json({ok:false,message:"Akun nonaktif."},403);
  const check = await verifyPassword(password, user.password);
  if (!check.ok) {
    await recordLoginFail(env, loginKey);
    return json({ok:false,message:"Username atau password salah."},401);
  }
  await clearLoginFails(env, loginKey);
  if (check.upgrade) await setUserPassword(env, user.id, await hashPassword(password));
  const { token, ttl } = await createSession(env, request, user, remember);
  await audit(env, publicUser(user), "LOGIN", "users", user.id, "", {});
  return json({ok:true,user:publicUser(user)},200,{"set-cookie":sessionCookie(request,token,ttl)});
}

async function logoutHandler(request, env, auth) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    try { await env.DB.prepare(`DELETE FROM app_sessions WHERE token_hash=?`).bind(await sha256Hex(token)).run(); } catch (_) {}
  }
  if (auth?.ok) await audit(env, auth.user, "LOGOUT", "users", auth.user.id, "", {});
  return json({ok:true},200,{"set-cookie":clearSessionCookie(request)});
}

async function changePasswordHandler(request, env, auth) {
  const body = await parseJson(request) || {};
  const oldPassword = String(body.oldPassword || "");
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < PASSWORD_MIN_LEN) return json({ok:false,message:`Password minimal ${PASSWORD_MIN_LEN} karakter.`},400);
  const full = await findUserByUsername(env, auth.user.username);
  if (!full) return json({ok:false,message:"Akun tidak ditemukan."},404);
  const check = await verifyPassword(oldPassword, full.password);
  if (!check.ok) return json({ok:false,message:"Password saat ini salah."},401);
  await setUserPassword(env, full.id, await hashPassword(newPassword));
  await env.DB.prepare(`DELETE FROM app_sessions WHERE user_id=? AND token_hash<>?`).bind(full.id, auth.sessionHash).run();
  await audit(env, auth.user, "CHANGE_PASSWORD", "users", full.id, "", {});
  return json({ok:true,message:"Password berhasil diperbarui."});
}

async function getRecord(env, collection, id) {
  const row = await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection=? AND id=? LIMIT 1`).bind(collection,id).first();
  if (!row) return null;
  const data = safeJsonParse(row.data_json, {});
  if (collection === "users") data.password = "";
  return {id:row.id,data,updated_at:row.updated_at};
}

function qsEq(url, name) {
  const v = url.searchParams.get(name);
  return v == null ? null : String(v);
}

async function listRecords(env, collection, url) {
  const projectId = qsEq(url,"projectId");
  const relatedId = qsEq(url,"relatedId");
  const status = qsEq(url,"status");
  const id = qsEq(url,"id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 1000),1),5000);
  const where = ["collection=?"];
  const bind = [collection];
  if (id) { where.push("id=?"); bind.push(id); }
  if (projectId) { where.push("json_extract(data_json,'$.projectId')=?"); bind.push(projectId); }
  if (relatedId) { where.push("json_extract(data_json,'$.relatedId')=?"); bind.push(relatedId); }
  if (status) { where.push("lower(COALESCE(json_extract(data_json,'$.status'),''))=lower(?)"); bind.push(status); }
  bind.push(limit);
  const res = await env.DB.prepare(`
    SELECT id,data_json,updated_at FROM app_records
    WHERE ${where.join(" AND ")}
    ORDER BY updated_at DESC LIMIT ?
  `).bind(...bind).all();
  return (res.results || []).map(r => {
    const data = safeJsonParse(r.data_json, {});
    if (collection === "users") data.password = "";
    return {id:r.id,data,updated_at:r.updated_at};
  });
}

async function upsertRecord(env, collection, id, data, user) {
  if (!data || typeof data !== "object") throw new Error("Data tidak valid");
  const recId = cleanId(id || data.id || crypto.randomUUID());
  if (!recId) throw new Error("ID tidak valid");
  const now = new Date().toISOString();
  const copy = {...data};
  delete copy.id;
  copy.updatedBy = user?.name || user?.username || "";
  copy.updatedAt = now;
  if (!copy.createdAt) copy.createdAt = now;
  if (!copy.createdBy) copy.createdBy = user?.name || user?.username || "";

  if (collection === "users") {
    const existing = await env.DB.prepare(`SELECT json_extract(data_json,'$.password') AS password FROM app_records WHERE collection='users' AND id=?`).bind(recId).first();
    const incoming = String(copy.password || "");
    if (!incoming) copy.password = existing?.password || "";
    else if (!isHashed(incoming)) copy.password = await hashPassword(incoming);
  }

  await env.DB.prepare(`
    INSERT INTO app_records(collection,id,data_json,updated_at)
    VALUES(?,?,?,?)
    ON CONFLICT(collection,id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
  `).bind(collection,recId,JSON.stringify(copy),now).run();
  await audit(env,user,"UPSERT",collection,recId,copy.projectId || "",{status:copy.status || ""});
  return {id:recId,data:collection === "users" ? {...copy,password:""} : copy,updated_at:now};
}

async function deleteRecord(env, collection, id, user) {
  const existing = await getRecord(env,collection,id);
  if (!existing) return false;
  if (collection === "project_documents" && existing.data.objectKey && env.FILES) {
    try { await env.FILES.delete(existing.data.objectKey); } catch (_) {}
  }
  await env.DB.prepare(`DELETE FROM app_records WHERE collection=? AND id=?`).bind(collection,id).run();
  await audit(env,user,"DELETE",collection,id,existing.data.projectId || "",{});
  return true;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function truthy(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["1","true","yes","ya","y","wajib","aktif"].includes(s);
}

function pickNum(d, keys) {
  for (const k of keys) {
    if (d && d[k] !== undefined && d[k] !== null && d[k] !== "") return num(d[k]);
  }
  return 0;
}

function paidLike(status) {
  const s = String(status || "").trim().toUpperCase();
  return !s || ["PAID","VERIFIED","RECEIVED","RECEIVED_OK","TERBAYAR","DITERIMA","LUNAS"].includes(s);
}

function closedLike(status) {
  const s = String(status || "").trim().toUpperCase();
  return ["CLOSED","CLOSE","DONE","SELESAI","PAID","LUNAS","RELEASED","APPROVED","PASS","PASSED","REJECTED","CANCELLED"].includes(s);
}

function activeLike(status) {
  const s = String(status || "").trim().toUpperCase();
  return !closedLike(s);
}

function latestProgress(projectId, all, project) {
  const rows = all.filter(r => (r.collection === "daily_progress" || r.collection === "weekly_progress") && String(r.data.projectId || "") === projectId);
  rows.sort((a,b) => String(b.data.date || b.updated_at || "").localeCompare(String(a.data.date || a.updated_at || "")));
  if (rows.length) return Math.min(100, Math.max(0, pickNum(rows[0].data,["progress","progressPercent","actualProgress","percent"])));
  return Math.min(100, Math.max(0, pickNum(project,["progress","progressPercent","actualProgress","percent"])));
}

function docSetFor(projectId, all) {
  const set = new Set();
  for (const r of all) {
    if (r.collection !== "project_documents") continue;
    if (String(r.data.projectId || "") !== projectId) continue;
    const cat = String(r.data.category || "").trim().toUpperCase();
    if (cat) set.add(cat);
  }
  return set;
}

function sumCollection(projectId, all, collection, amountKeys, predicate = () => true) {
  return all.filter(r => r.collection === collection && String(r.data.projectId || "") === projectId && predicate(r.data))
    .reduce((s,r) => s + pickNum(r.data,amountKeys),0);
}

function outstandingCollection(projectId, all, collection) {
  return all.filter(r => r.collection === collection && String(r.data.projectId || "") === projectId && activeLike(r.data.status))
    .reduce((s,r) => s + Math.max(0,pickNum(r.data,["amount","nominal","value","total"]) - pickNum(r.data,["paidAmount","paid","terbayar"])),0);
}

function computeProjectMetrics(projectRow, all) {
  const p = projectRow.data;
  const id = projectRow.id;
  const contract = pickNum(p,["contractValue","nilaiKontrak","contract_value","nilai_kontrak","value"]);
  const headerBudget = pickNum(p,["budget","hpp","rabHpp","rab_hpp","nilaiHpp","nilai_hpp"]);
  const lineBudget = sumCollection(id,all,"project_budget",["budgetAmount","amount","nominal","value","total"],d => !d.status || ["APPROVED","REVISED","CLOSED"].includes(String(d.status||"").toUpperCase()));
  const budget = lineBudget > 0 ? lineBudget : headerBudget;
  const income = sumCollection(id,all,"cash_in",["amount","nominal","value","total"],d => paidLike(d.status));
  const expense = sumCollection(id,all,"cash_out",["amount","nominal","value","total"],d => paidLike(d.status));
  const poCommitted = all.filter(r => r.collection === "po" && String(r.data.projectId || "") === id && activeLike(r.data.status))
    .reduce((s,r) => s + Math.max(0,pickNum(r.data,["amount","nominal","value","total"]) - pickNum(r.data,["paidAmount","paid"])),0);
  const receivable = outstandingCollection(id,all,"receivables");
  const payable = outstandingCollection(id,all,"payables");
  const openQc = all.filter(r => r.collection === "qc_inspections" && String(r.data.projectId || "") === id && activeLike(r.data.status) && !["PASS","PASSED"].includes(String(r.data.result || "").toUpperCase())).length;
  const openDefects = all.filter(r => r.collection === "defects" && String(r.data.projectId || "") === id && activeLike(r.data.status)).length;
  const pendingCco = all.filter(r => r.collection === "cco" && String(r.data.projectId || "") === id && activeLike(r.data.status)).length;
  const pendingApprovals = all.filter(r => (r.collection === "approvals" || r.collection === "payment_requests") && String(r.data.projectId || "") === id && activeLike(r.data.status)).length;
  const openCloseout = all.filter(r => r.collection === "closeout" && String(r.data.projectId || "") === id && activeLike(r.data.status)).length;
  const openIssues = all.filter(r => r.collection === "issues" && String(r.data.projectId || "") === id && activeLike(r.data.status)).length;
  const progress = latestProgress(id,all,p);
  const forecastCostBase = pickNum(p,["forecastFinalCost","forecastCost","forecast_cost"]);
  const forecastCost = forecastCostBase || Math.max(budget,expense + poCommitted);
  const marginForecast = contract - forecastCost;
  const marginPercent = contract > 0 ? marginForecast / contract * 100 : 0;
  const endDate = p.endDate || p.targetFinish || p.targetDate || "";
  const scheduleRows = all.filter(r => r.collection === "schedule" && String(r.data.projectId || "") === id);
  const hasDelayedActivity = scheduleRows.some(r => {
    const st = String(r.data.status || "").toUpperCase();
    const end = r.data.endDate || r.data.end || "";
    const act = pickNum(r.data,["actualProgress","progress","percent"]);
    return st === "DELAY" || (end && new Date(end).getTime() < Date.now() && act < 100 && !closedLike(st));
  });
  const scheduleStatus = hasDelayedActivity ? "DELAY" : (p.scheduleStatus || (endDate && new Date(endDate).getTime() < Date.now() && progress < 100 ? "DELAY" : "ON TRACK"));
  return {
    id, name:p.name || p.namaProject || p.projectName || p.nama || id,
    contract,budget,income,expense,netCash:income-expense,committed:poCommitted,
    remainingBudget:budget-expense-poCommitted,receivable,payable,progress,openQc,openDefects,pendingCco,pendingApprovals,openCloseout,openIssues,
    forecastCost,marginForecast,marginPercent,scheduleStatus,currentStatus:p.status || ""
  };
}

function evaluateProject(projectRow, all) {
  const p = projectRow.data;
  const m = computeProjectMetrics(projectRow,all);
  const docs = docSetFor(projectRow.id,all);
  const missing = arr => arr.filter(x => !docs.has(x));
  const coreMissing = missing(DOC_CORE);
  const preconMissing = missing(DOC_PRECON);
  const phoMissing = missing(DOC_PHO);
  const retentionRequired = truthy(p.retentionRequired ?? p.retensiRequired ?? p.retention_required);
  const fhoRequired = truthy(p.fhoRequired) || retentionRequired;
  const retentionRows = all.filter(r => r.collection === "retention" && String(r.data.projectId || "") === projectRow.id);
  const retentionOpen = retentionRequired && (!retentionRows.length || retentionRows.some(r => activeLike(r.data.status)));
  const fhoMissing = fhoRequired ? missing(DOC_FHO) : [];
  const finMissing = missing(DOC_FIN);
  let status = "CLOSED";
  let gate = "Project Closed";
  let blockers = [];

  if (coreMissing.length) { status="SETUP"; gate="Project Setup"; blockers=coreMissing.map(x=>`Dokumen ${x} belum ada`); }
  else if (preconMissing.length) { status="PRECON"; gate="Pre-Construction"; blockers=preconMissing.map(x=>`Dokumen ${x} belum ada`); }
  else if (m.progress <= 0) { status="MOBILIZATION"; gate="Mobilisasi"; blockers=["Progress pelaksanaan belum dimulai"]; }
  else if (m.progress < 100) { status="EXECUTION"; gate="Pelaksanaan"; blockers=[`Progress ${m.progress.toFixed(1)}%`]; }
  else if (m.openQc > 0 || m.openDefects > 0 || m.openIssues > 0 || phoMissing.length) {
    status="PHO"; gate="PHO & Final QC";
    blockers=[...(m.openQc? [`${m.openQc} QC masih terbuka`]:[]),...(m.openDefects? [`${m.openDefects} defect masih terbuka`]:[]),...(m.openIssues? [`${m.openIssues} issue/corrective action masih terbuka`]:[]),...phoMissing.map(x=>`Dokumen ${x} belum ada`)];
  }
  else if (retentionOpen) { status="RETENTION"; gate="Retensi / Masa Pemeliharaan"; blockers=["Retensi belum selesai/released"]; }
  else if (fhoMissing.length) { status="FHO"; gate="FHO"; blockers=fhoMissing.map(x=>`Dokumen ${x} belum ada`); }
  else if (m.receivable > 0 || m.payable > 0 || m.pendingCco > 0 || m.pendingApprovals > 0 || m.openCloseout > 0 || finMissing.length) {
    status="FINANCIAL_CLOSE"; gate="Financial Close-Out";
    blockers=[...(m.receivable>0?[`Piutang tersisa ${m.receivable}`]:[]),...(m.payable>0?[`Hutang tersisa ${m.payable}`]:[]),...(m.pendingCco>0?[`${m.pendingCco} CCO belum closed`]:[]),...(m.pendingApprovals>0?[`${m.pendingApprovals} approval/payment request belum selesai`]:[]),...(m.openCloseout>0?[`${m.openCloseout} checklist close-out belum selesai`]:[]),...finMissing.map(x=>`Dokumen ${x} belum ada`)];
  }

  const flow = [
    {code:"SETUP",label:"Project Setup",done:!coreMissing.length},
    {code:"PRECON",label:"Pre-Construction",done:!coreMissing.length && !preconMissing.length},
    {code:"MOBILIZATION",label:"Mobilisasi",done:m.progress>0},
    {code:"EXECUTION",label:"Pelaksanaan",done:m.progress>=100},
    {code:"PHO",label:"PHO",done:m.progress>=100 && m.openQc===0 && m.openDefects===0 && m.openIssues===0 && phoMissing.length===0},
    {code:"RETENTION",label:"Retensi",done:!retentionRequired || !retentionOpen},
    {code:"FHO",label:"FHO",done:!fhoRequired || fhoMissing.length===0},
    {code:"FINANCIAL_CLOSE",label:"Financial Close-Out",done:m.receivable===0 && m.payable===0 && m.pendingCco===0 && m.pendingApprovals===0 && m.openCloseout===0 && finMissing.length===0},
    {code:"CLOSED",label:"Project Closed",done:status==="CLOSED"}
  ];
  return {status,gate,blockers,flow,metrics:m,documents:[...docs].sort()};
}

async function loadControlRows(env) {
  const cols = ["projects","project_budget","cash_in","cash_out","receivables","payables","payment_requests","approvals","po","daily_progress","weekly_progress","schedule","milestones","issues","qc_inspections","defects","cco","retention","closeout","project_documents"];
  const marks = cols.map(()=>"?").join(",");
  const res = await env.DB.prepare(`SELECT collection,id,data_json,updated_at FROM app_records WHERE collection IN (${marks}) ORDER BY updated_at DESC`).bind(...cols).all();
  return (res.results || []).map(r => ({collection:r.collection,id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
}

async function dashboardHandler(env) {
  const all = await loadControlRows(env);
  const projects = all.filter(r => r.collection === "projects");
  const rows = projects.map(p => ({...computeProjectMetrics(p,all), evaluatedStatus:evaluateProject(p,all).status}));
  const sum = key => rows.reduce((s,r)=>s+num(r[key]),0);
  return json({
    ok:true,
    generatedAt:new Date().toISOString(),
    totals:{
      projects:rows.length,
      active:rows.filter(r=>r.evaluatedStatus!=="CLOSED").length,
      closed:rows.filter(r=>r.evaluatedStatus==="CLOSED").length,
      contract:sum("contract"),income:sum("income"),expense:sum("expense"),netCash:sum("netCash"),
      budget:sum("budget"),committed:sum("committed"),remainingBudget:sum("remainingBudget"),
      receivable:sum("receivable"),payable:sum("payable"),openQc:sum("openQc"),openDefects:sum("openDefects"),pendingCco:sum("pendingCco"),pendingApprovals:sum("pendingApprovals"),openIssues:sum("openIssues"),openCloseout:sum("openCloseout")
    },
    projects:rows
  });
}

function safeFilename(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").slice(0,120) || "file";
}

async function uploadDocument(request, env, user) {
  if (!env.FILES) return json({ok:false,message:"R2 binding FILES belum tersedia."},503);
  let fd;
  try { fd = await request.formData(); } catch { return json({ok:false,message:"Form upload tidak valid."},400); }
  const file = fd.get("file");
  const projectId = String(fd.get("projectId") || "").trim();
  if (!projectId) return json({ok:false,message:"Project wajib dipilih."},400);
  if (!(file instanceof File)) return json({ok:false,message:"File wajib dipilih."},400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ok:false,message:"Ukuran file maksimal 25 MB."},413);
  const id = crypto.randomUUID();
  const category = String(fd.get("category") || "OTHER").trim().toUpperCase();
  const key = `projects/${safeFilename(projectId)}/${safeFilename(category)}/${id}-${safeFilename(file.name)}`;
  await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type || "application/octet-stream"}});
  const data = {
    projectId,category,
    title:String(fd.get("title") || file.name),
    notes:String(fd.get("notes") || ""),
    relatedCollection:String(fd.get("relatedCollection") || ""),
    relatedId:String(fd.get("relatedId") || ""),
    originalName:file.name,mimeType:file.type || "application/octet-stream",size:file.size,
    objectKey:key,version:1,status:"ACTIVE",uploadedAt:new Date().toISOString(),uploadedBy:user.name || user.username
  };
  const rec = await upsertRecord(env,"project_documents",id,data,user);
  await audit(env,user,"UPLOAD_DOCUMENT","project_documents",id,projectId,{category,title:data.title});
  return json({ok:true,document:rec},201);
}

async function updateDocument(request, env, user, id) {
  const old = await getRecord(env,"project_documents",id);
  if (!old) return json({ok:false,message:"Dokumen tidak ditemukan."},404);
  const type = (request.headers.get("content-type") || "").toLowerCase();
  let patch = {};
  let newFile = null;
  if (type.includes("multipart/form-data")) {
    const fd = await request.formData();
    for (const k of ["projectId","category","title","notes","relatedCollection","relatedId","status"]) {
      if (fd.has(k)) patch[k] = String(fd.get(k) || "");
    }
    const f = fd.get("file");
    if (f instanceof File && f.size > 0) newFile = f;
  } else {
    patch = await parseJson(request) || {};
  }
  const merged = {...old.data,...patch};
  if (patch.category) merged.category = String(patch.category).toUpperCase();
  if (newFile) {
    if (!env.FILES) return json({ok:false,message:"R2 binding FILES belum tersedia."},503);
    if (newFile.size > MAX_UPLOAD_BYTES) return json({ok:false,message:"Ukuran file maksimal 25 MB."},413);
    const category = String(merged.category || "OTHER").toUpperCase();
    const key = `projects/${safeFilename(merged.projectId)}/${safeFilename(category)}/${id}-v${num(merged.version)+1}-${safeFilename(newFile.name)}`;
    await env.FILES.put(key,newFile.stream(),{httpMetadata:{contentType:newFile.type || "application/octet-stream"}});
    if (old.data.objectKey) { try { await env.FILES.delete(old.data.objectKey); } catch (_) {} }
    merged.objectKey = key;
    merged.originalName = newFile.name;
    merged.mimeType = newFile.type || "application/octet-stream";
    merged.size = newFile.size;
    merged.version = num(old.data.version) + 1;
    merged.replacedAt = new Date().toISOString();
    merged.replacedBy = user.name || user.username;
  }
  const rec = await upsertRecord(env,"project_documents",id,merged,user);
  await audit(env,user,"EDIT_DOCUMENT","project_documents",id,merged.projectId || "",{version:merged.version || 1});
  return json({ok:true,document:rec});
}

async function deleteDocument(env,user,id) {
  const old = await getRecord(env,"project_documents",id);
  if (!old) return json({ok:false,message:"Dokumen tidak ditemukan."},404);
  if (env.FILES && old.data.objectKey) { try { await env.FILES.delete(old.data.objectKey); } catch (_) {} }
  await env.DB.prepare(`DELETE FROM app_records WHERE collection='project_documents' AND id=?`).bind(id).run();
  await audit(env,user,"DELETE_DOCUMENT","project_documents",id,old.data.projectId || "",{title:old.data.title || old.data.originalName || ""});
  return json({ok:true});
}

async function downloadDocument(env,id) {
  const old = await getRecord(env,"project_documents",id);
  if (!old) return json({ok:false,message:"Dokumen tidak ditemukan."},404);
  if (!env.FILES || !old.data.objectKey) return json({ok:false,message:"File tidak tersedia."},404);
  const obj = await env.FILES.get(old.data.objectKey);
  if (!obj) return json({ok:false,message:"File tidak ditemukan di R2."},404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag",obj.httpEtag);
  headers.set("cache-control","private, max-age=300");
  headers.set("content-disposition",`inline; filename="${safeFilename(old.data.originalName || "document")}"`);
  return new Response(obj.body,{headers});
}

async function listDocuments(env,url) {
  const rows = await listRecords(env,"project_documents",url);
  return json({ok:true,documents:rows});
}

async function auditHandler(env,url) {
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100),1),500);
  let res;
  if (projectId) {
    res = await env.DB.prepare(`SELECT * FROM kendali_audit_log WHERE project_id=? ORDER BY created_at DESC LIMIT ?`).bind(projectId,limit).all();
  } else {
    res = await env.DB.prepare(`SELECT * FROM kendali_audit_log ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  }
  return json({ok:true,logs:res.results || []});
}

async function syncProjectStatus(env,user,projectId) {
  const all = await loadControlRows(env);
  const projectRow = all.find(r => r.collection === "projects" && r.id === projectId);
  if (!projectRow) return json({ok:false,message:"Project tidak ditemukan."},404);
  const evaluation = evaluateProject(projectRow,all);
  const updated = {...projectRow.data,status:evaluation.status,statusGate:evaluation.gate,statusSyncedAt:new Date().toISOString()};
  await upsertRecord(env,"projects",projectId,updated,user);
  await audit(env,user,"SYNC_PROJECT_STATUS","projects",projectId,projectId,{status:evaluation.status,blockers:evaluation.blockers});
  return json({ok:true,evaluation});
}

async function projectFlow(env,projectId) {
  const all = await loadControlRows(env);
  const projectRow = all.find(r => r.collection === "projects" && r.id === projectId);
  if (!projectRow) return json({ok:false,message:"Project tidak ditemukan."},404);
  return json({ok:true,evaluation:evaluateProject(projectRow,all)});
}


function storageParts(pathname) {
  const prefix = "/storage/v1/object/";
  if (!pathname.startsWith(prefix)) return null;
  let rest = pathname.slice(prefix.length);
  let isPublic = false;
  if (rest.startsWith("public/")) { isPublic = true; rest = rest.slice(7); }
  const slash = rest.indexOf("/");
  if (slash < 1) return null;
  const bucket = rest.slice(0, slash);
  let key;
  try { key = decodeURIComponent(rest.slice(slash + 1)); } catch { return null; }
  key = key.replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\")) return null;
  return { isPublic, bucket, key };
}

async function legacyStorageHandler(request, env, url) {
  if (!env.FILES) return json({statusCode:"503",error:"StorageUnavailable",message:"R2 binding FILES belum tersedia."},503);
  const parts = storageParts(url.pathname);
  if (!parts) return json({statusCode:"400",error:"InvalidRequest",message:"Invalid storage path"},400);
  if (parts.bucket !== STORAGE_BUCKET && parts.bucket !== "kendali-files") return json({statusCode:"404",error:"BucketNotFound",message:"Bucket not found"},404);
  if (request.method === "GET" || request.method === "HEAD") {
    const obj = await env.FILES.get(parts.key);
    if (!obj) return json({statusCode:"404",error:"not_found",message:"Object not found"},404);
    const headers = new Headers(); obj.writeHttpMetadata(headers);
    headers.set("etag",obj.httpEtag); headers.set("cache-control",parts.isPublic?"private, max-age=3600":"private, no-store");
    const download = url.searchParams.get("download");
    if (download !== null) headers.set("content-disposition",`attachment; filename="${safeFilename(download || parts.key.split("/").pop())}"`);
    return new Response(request.method === "HEAD" ? null : obj.body,{headers});
  }
  if (request.method === "POST" || request.method === "PUT") {
    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_UPLOAD_BYTES) return json({statusCode:"413",error:"PayloadTooLarge",message:"File too large"},413);
    const existing = request.method === "POST" && String(request.headers.get("x-upsert") || "false").toLowerCase() !== "true" ? await env.FILES.head(parts.key) : null;
    if (existing) return json({statusCode:"409",error:"Duplicate",message:"The resource already exists"},409);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_UPLOAD_BYTES) return json({statusCode:"413",error:"PayloadTooLarge",message:"File too large"},413);
    await env.FILES.put(parts.key,buf,{httpMetadata:{contentType:request.headers.get("content-type") || "application/octet-stream"},customMetadata:{source:"KENDALI-V2.8"}});
    return json({Key:`${parts.bucket}/${parts.key}`,Id:crypto.randomUUID()});
  }
  if (request.method === "DELETE") { await env.FILES.delete(parts.key); return json({message:"Successfully deleted"}); }
  return json({statusCode:"405",error:"MethodNotAllowed",message:"Method not allowed"},405);
}

function isAdminRole(user) {
  const role = String(user?.role || "").trim().toLowerCase();
  return role === "admin" || role === "administrator" || role === "direktur";
}

async function diagnostics(env) {
  const counts = await env.DB.prepare(`SELECT collection,COUNT(*) AS count FROM app_records GROUP BY collection ORDER BY collection`).all();
  const meta = await env.DB.prepare(`SELECT key,value,updated_at FROM schema_meta ORDER BY key`).all();
  return json({ok:true,appVersion:APP_VERSION,service:SERVICE_NAME,d1:Boolean(env.DB),r2:Boolean(env.FILES),collections:counts.results || [],meta:meta.results || []});
}

async function serveAssets(request, env) {
  if (!env.ASSETS) return json({ok:false,message:"ASSETS binding belum tersedia."},503);
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;
  const indexReq = new Request(new URL("/index.html",request.url),{method:"GET",headers:request.headers});
  return env.ASSETS.fetch(indexReq);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null,{status:204});
    if (path === "/app-build.json") return json({ok:true,appVersion:APP_VERSION,service:SERVICE_NAME,architecture:"worker+d1+r2+assets"});
    if (path === "/api/health") return diagnostics(env);
    if (path === "/api/auth/login" && request.method === "POST") return loginHandler(request,env);

    const auth = await authenticate(request,env);
    if (path === "/api/auth/me" || path === "/api/access/session") return auth.ok ? json({ok:true,user:auth.user,username:auth.user.username,email:auth.user.email||"",landing_route:auth.user.role === "Pelaksana Lapangan" ? "/lapangan" : "/"}) : authFailure(auth);
    if (path === "/api/auth/logout" && (request.method === "POST" || request.method === "GET")) return logoutHandler(request,env,auth);
    if ((path.startsWith("/api/") || path.startsWith("/rest/") || path.startsWith("/storage/")) && !auth.ok) return authFailure(auth);

    if (path === "/api/auth/change-password" && request.method === "POST") return changePasswordHandler(request,env,auth);
    if (path === "/api/diagnostics") return isAdminRole(auth.user) ? diagnostics(env) : json({ok:false,message:"Diagnostics hanya untuk Administrator/Direktur."},403);
    if (path === "/api/dashboard" && request.method === "GET") return dashboardHandler(env);
    if (path === "/api/audit" && request.method === "GET") return auditHandler(env,url);

    if (path === "/api/documents" && request.method === "GET") return listDocuments(env,url);
    if (path === "/api/documents" && request.method === "POST") return uploadDocument(request,env,auth.user);
    const docFileMatch = path.match(/^\/api\/documents\/([^/]+)\/file$/);
    if (docFileMatch && request.method === "GET") return downloadDocument(env,decodeURIComponent(docFileMatch[1]));
    const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch && (request.method === "PUT" || request.method === "PATCH")) return updateDocument(request,env,auth.user,decodeURIComponent(docMatch[1]));
    if (docMatch && request.method === "DELETE") return deleteDocument(env,auth.user,decodeURIComponent(docMatch[1]));

    const flowMatch = path.match(/^\/api\/projects\/([^/]+)\/flow$/);
    if (flowMatch && request.method === "GET") return projectFlow(env,decodeURIComponent(flowMatch[1]));
    const syncMatch = path.match(/^\/api\/projects\/([^/]+)\/sync-status$/);
    if (syncMatch && request.method === "POST") return syncProjectStatus(env,auth.user,decodeURIComponent(syncMatch[1]));

    const recordsRoot = path.match(/^\/api\/records\/([^/]+)$/);
    if (recordsRoot) {
      const collection = safeCollection(decodeURIComponent(recordsRoot[1]));
      if (!collection) return json({ok:false,message:"Collection tidak dikenal."},404);
      if (request.method === "GET") return json({ok:true,rows:await listRecords(env,collection,url)});
      if (request.method === "POST") {
        const body = await parseJson(request);
        if (!body) return json({ok:false,message:"JSON tidak valid."},400);
        const rec = await upsertRecord(env,collection,body.id || null,body.data || body,auth.user);
        return json({ok:true,row:rec},201);
      }
    }

    const recordOne = path.match(/^\/api\/records\/([^/]+)\/([^/]+)$/);
    if (recordOne) {
      const collection = safeCollection(decodeURIComponent(recordOne[1]));
      const id = decodeURIComponent(recordOne[2]);
      if (!collection) return json({ok:false,message:"Collection tidak dikenal."},404);
      if (request.method === "GET") {
        const rec = await getRecord(env,collection,id);
        return rec ? json({ok:true,row:rec}) : json({ok:false,message:"Data tidak ditemukan."},404);
      }
      if (request.method === "PUT" || request.method === "PATCH") {
        const body = await parseJson(request);
        if (!body) return json({ok:false,message:"JSON tidak valid."},400);
        const rec = await upsertRecord(env,collection,id,body.data || body,auth.user);
        return json({ok:true,row:rec});
      }
      if (request.method === "DELETE") {
        const ok = await deleteRecord(env,collection,id,auth.user);
        return ok ? json({ok:true}) : json({ok:false,message:"Data tidak ditemukan."},404);
      }
    }

    // Backward compatibility with older KENDALI /rest/v1/<collection> adapter.
    const legacy = path.match(/^\/rest\/v1\/([^/]+)$/);
    if (legacy) {
      const collection = safeCollection(decodeURIComponent(legacy[1]));
      if (!collection) return json({message:"Unknown table"},404);
      if (request.method === "GET") return json(await listRecords(env,collection,url),200,{"content-range":"0-*/ *"});
      if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
        const body = await parseJson(request);
        if (!body) return json({message:"Invalid JSON"},400);
        const list = Array.isArray(body) ? body : [body];
        for (const row of list) await upsertRecord(env,collection,row.id,row.data ?? row,auth.user);
        return json(null,201);
      }
      if (request.method === "DELETE") {
        const raw = url.searchParams.get("id") || "";
        const m = raw.match(/^eq\.(.+)$/);
        if (m) await deleteRecord(env,collection,m[1],auth.user);
        return new Response(null,{status:204});
      }
    }

    if (path.startsWith("/storage/v1/object/")) return legacyStorageHandler(request,env,url);
    if (path.startsWith("/auth/v1/")) return json({message:"Authentication is handled by KENDALI."},404);

    return serveAssets(request,env);
  }
};
