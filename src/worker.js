/**
 * KENDALI Natara V3.1 — Field, Procurement, QC & ATI
 * Cloudflare Worker + D1 + R2 + Static Assets
 */

const APP_VERSION = "APP-V3.1";
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
  "milestones", "retention", "closeout", "project_documents", "issues", "schedule", "procurement",
  "qc_work_items", "daily_workers", "qc_actions", "qc_verifications", "ati_assessments", "ati_work_requests", "ati_field_issues", "ati_issue_evaluations"
]);

const PROJECT_SCOPED_COLLECTIONS = new Set([
  "projects","rabs","po","project_budget","cash_in","cash_out","receivables","payables","payment_requests",
  "daily_progress","weekly_progress","opname","qc_inspections","defects","cco","approvals","milestones",
  "retention","closeout","project_documents","issues","schedule","procurement","qc_work_items","daily_workers","qc_actions","qc_verifications","ati_assessments","ati_work_requests","ati_field_issues","ati_issue_evaluations"
]);

const DOC_CORE = ["CONTRACT", "RAB_BASELINE", "DED_FINAL", "TIME_SCHEDULE"];
const DOC_PRECON = ["PCM", "MC0"];
const DOC_PHO = ["PHO_BAST", "AS_BUILT"];
const DOC_FHO = ["FHO_BAST"];
const DOC_FIN = ["FINAL_RECONCILIATION"];


const ROLE_LABELS = {
  administrator: "Administrator",
  direktur: "Direktur",
  head_unit_bisnis: "Head Unit Bisnis",
  manager_operasional: "Manager Operasional",
  admin_teknik: "Admin Teknik",
  project_manager: "Project Manager",
  pelaksana_lapangan: "Pelaksana Lapangan",
  qs: "QS / Quantity Surveyor",
  qc: "QC / Quality Control",
  finance: "Finance",
  procurement: "Logistik / Procurement",
  kepala_ati: "Kepala ATI",
  instruktur_ati: "Instruktur ATI",
  viewer: "Viewer"
};

const ALL_VIEWS = ["dashboard","projects","finance","fund_requests","progress","opname","qc","cco","procurement","ati","documents","flow","closeout","employees","master","audit"];
const ROLE_VIEWS = {
  administrator: ALL_VIEWS,
  direktur: ALL_VIEWS,
  head_unit_bisnis: ALL_VIEWS,
  manager_operasional: ["dashboard","projects","finance","fund_requests","progress","opname","qc","cco","procurement","ati","documents","flow","closeout","master","audit"],
  admin_teknik: ["dashboard","projects","finance","fund_requests","progress","opname","qc","cco","procurement","ati","documents","flow","closeout","master"],
  project_manager: ["dashboard","projects","fund_requests","progress","opname","qc","cco","procurement","documents","flow","closeout"],
  pelaksana_lapangan: ["dashboard","projects","fund_requests","progress","qc","cco","procurement","documents","flow"],
  qs: ["dashboard","projects","fund_requests","progress","opname","cco","documents","flow"],
  qc: ["dashboard","projects","fund_requests","progress","qc","documents","flow"],
  finance: ["dashboard","projects","finance","fund_requests","procurement","documents","flow","closeout"],
  procurement: ["dashboard","projects","fund_requests","procurement","documents","flow"],
  kepala_ati: ["dashboard","ati","progress","documents","master"],
  instruktur_ati: ["dashboard","ati","documents","master"],
  viewer: ["dashboard","projects","documents","flow"]
};

function normalizeRole(input) {
  const raw = typeof input === "string" ? input : (input?.role || input?.jabatan || "");
  const s = String(raw || "").trim().toLowerCase().replace(/[._-]+/g," ").replace(/\s+/g," ");
  const aliases = new Map([
    ["admin","administrator"],["administrator","administrator"],["superadmin","administrator"],["super admin","administrator"],
    ["direktur","direktur"],["director","direktur"],["ceo","direktur"],
    ["head unit bisnis","head_unit_bisnis"],["head bu","head_unit_bisnis"],["head unit","head_unit_bisnis"],
    ["manager operasional","manager_operasional"],["manajer operasional","manager_operasional"],["head operational","manager_operasional"],["head operasional","manager_operasional"],["spv operasional","manager_operasional"],
    ["admin teknik","admin_teknik"],["administrasi teknik","admin_teknik"],["administrasi proyek","admin_teknik"],
    ["project manager","project_manager"],["pm","project_manager"],
    ["pelaksana lapangan","pelaksana_lapangan"],["pelaksana","pelaksana_lapangan"],["pengawas","pelaksana_lapangan"],["pengawas lapangan","pelaksana_lapangan"],
    ["quantity surveyor","qs"],["qs / quantity surveyor","qs"],["qs","qs"],
    ["quality control","qc"],["qc / quality control","qc"],["qc","qc"],["qc arsitektur","qc"],["qc interior","qc"],["qc mep","qc"],
    ["finance","finance"],["keuangan","finance"],["finance officer","finance"],
    ["logistik","procurement"],["logistik / procurement","procurement"],["procurement","procurement"],["purchasing","procurement"],["logistik procurement","procurement"],
    ["kepala ati","kepala_ati"],["head ati","kepala_ati"],["manager ati","kepala_ati"],
    ["instruktur ati","instruktur_ati"],["instruktur","instruktur_ati"],["trainer ati","instruktur_ati"],
    ["viewer","viewer"]
  ]);
  return aliases.get(s) || (ROLE_LABELS[s] ? s : "viewer");
}

function roleIn(user, roles) { return roles.includes(normalizeRole(user)); }
function isTopRole(user) { return roleIn(user,["administrator","direktur","head_unit_bisnis"]); }
function isManagementRole(user) { return roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]); }
function isAdminProjectRole(user) { return roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]); }

function isProjectScopedRole(user) {
  return roleIn(user,["project_manager","pelaksana_lapangan"]);
}

function sameUserRef(value,user) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return false;
  const refs = [user?.id,user?.username].map(x=>String(x||"").trim().toLowerCase()).filter(Boolean);
  return refs.includes(v);
}

function projectAssignedToUser(project,user) {
  if (!isProjectScopedRole(user)) return true;
  const d = project?.data || project || {};
  const role = normalizeRole(user);
  const fields = role === "project_manager"
    ? ["pmUserId","projectManagerUserId","pmUsername","projectManagerUsername"]
    : ["pelaksanaUserId","pengawasUserId","pelaksanaUsername","pengawasUsername"];
  return fields.some(k=>sameUserRef(d[k],user));
}

function recordProjectId(collection,id,data={}) {
  if (collection === "projects") return String(id || data.id || "").trim();
  return String(data.projectId || data.project_id || "").trim();
}

async function accessibleProjectIds(env,user) {
  if (!isProjectScopedRole(user)) return null;
  const res = await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='projects'`).all();
  const set = new Set();
  for (const row of (res.results || [])) {
    const data = safeJsonParse(row.data_json,{});
    if (projectAssignedToUser(data,user)) set.add(String(row.id));
  }
  return set;
}

async function userCanAccessProject(env,user,projectId) {
  if (!isProjectScopedRole(user)) return true;
  const id = String(projectId || "").trim();
  if (!id) return false;
  const project = await getRecord(env,"projects",id);
  return Boolean(project && projectAssignedToUser(project.data,user));
}

async function requireProjectAccess(env,user,projectId) {
  const ok = await userCanAccessProject(env,user,projectId);
  if (!ok) return json({ok:false,message:"Anda tidak ditugaskan pada proyek ini."},403);
  return null;
}

async function recordAllowedByProjectScope(env,user,collection,id,data={}) {
  if (!isProjectScopedRole(user)) return true;
  const projectId = recordProjectId(collection,id,data);
  if (!projectId) {
    return !PROJECT_SCOPED_COLLECTIONS.has(collection);
  }
  return userCanAccessProject(env,user,projectId);
}

function storageProjectSegment(key) {
  const m = String(key || "").match(/^projects\/([^/]+)\//i);
  return m ? m[1] : "";
}

async function userCanAccessStorageKey(env,user,key) {
  if (!isProjectScopedRole(user)) return true;
  const segment = storageProjectSegment(key);
  if (!segment) return false;
  const ids = await accessibleProjectIds(env,user);
  return [...ids].some(id => safeFilename(id) === segment);
}

function collectionPermission(user, collection) {
  const role = normalizeRole(user);
  const top = ["administrator","direktur","head_unit_bisnis"].includes(role);
  if (top) return {read:true,create:true,update:true,delete:true};
  const allow = (readRoles=[], writeRoles=[], deleteRoles=[]) => ({
    read:readRoles.includes(role), create:writeRoles.includes(role), update:writeRoles.includes(role), delete:deleteRoles.includes(role)
  });
  const projectReaders=["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc","finance","procurement","viewer"];
  const projectOps=["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan"];
  const fieldReaders=["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc"];

  if (collection === "users") return allow();
  if (collection === "projects") return allow(projectReaders,["manager_operasional","admin_teknik"]);
  if (["cash_in","cash_out","receivables","payables"].includes(collection)) return allow(["finance","manager_operasional","admin_teknik"],["finance"]);
  if (collection === "project_budget") return allow(["finance","manager_operasional","admin_teknik","qs","project_manager"],["finance","qs","manager_operasional","admin_teknik"]);
  if (collection === "payment_requests") return allow(["finance","manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc","procurement"],["finance","manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc","procurement"],["finance","manager_operasional"]);
  if (["daily_progress","weekly_progress","schedule","milestones","issues"].includes(collection)) return allow(fieldReaders,projectOps);
  if (collection === "daily_workers") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","finance","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan"],["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan"]);
  if (["qc_actions","qc_verifications"].includes(collection)) return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qc"],[],[]);
  if (collection === "ati_assessments") return allow(["manager_operasional","admin_teknik","project_manager","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "ati_work_requests") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","project_manager","kepala_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "ati_field_issues") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "ati_issue_evaluations") return allow(["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "opname") return allow(["manager_operasional","admin_teknik","project_manager","qs"],["manager_operasional","admin_teknik","qs"]);
  if (collection === "qc_work_items") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc"],["manager_operasional","qc"]);
  if (collection === "qc_inspections") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc"],[],["manager_operasional"]);
  if (collection === "defects") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc"],["manager_operasional","project_manager","pelaksana_lapangan","qc"]);
  if (collection === "cco") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs"],["manager_operasional","admin_teknik","qs","project_manager","pelaksana_lapangan"],["manager_operasional"]);
  if (collection === "approvals") return allow(["manager_operasional","admin_teknik","finance"],["manager_operasional","admin_teknik","finance"]);
  if (collection === "procurement") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","procurement","finance"],["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","procurement"]);
  if (collection === "po") return allow(["manager_operasional","admin_teknik","project_manager","procurement","finance"],["manager_operasional","procurement","finance"]);
  if (collection === "project_documents") return allow(projectReaders,["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","qs","qc","finance","procurement"],["manager_operasional"]);
  if (["retention","closeout"].includes(collection)) return allow(["manager_operasional","admin_teknik","project_manager","finance"],["manager_operasional","admin_teknik","finance"]);
  if (collection === "rabs") return allow(["manager_operasional","admin_teknik","project_manager","qs"],["manager_operasional","admin_teknik","qs"]);
  if (collection === "surat") return allow(["manager_operasional","admin_teknik"],["manager_operasional","admin_teknik"]);
  if (collection === "vendor") return allow(["manager_operasional","admin_teknik","procurement","finance"],["manager_operasional","procurement","finance"]);
  if (collection === "tukang") return allow(["manager_operasional","admin_teknik","project_manager","pelaksana_lapangan","finance","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "aset") return allow(["manager_operasional","admin_teknik","procurement"],["manager_operasional","admin_teknik"]);
  if (collection === "pelatihan") return allow(["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"]);
  if (collection === "proyeksi") return allow(["manager_operasional","admin_teknik"],["manager_operasional","admin_teknik"]);
  return allow();
}

function buildAccess(user) {
  const roleKey = normalizeRole(user);
  const views = ROLE_VIEWS[roleKey] || ROLE_VIEWS.viewer;
  const collections = {};
  for (const c of COLLECTIONS) collections[c] = collectionPermission(user,c);
  return {
    roleKey,
    roleLabel: ROLE_LABELS[roleKey] || user?.role || "Viewer",
    views,
    collections,
    capabilities: {
      manageEmployees: isTopRole(user),
      audit: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]),
      ccoFieldSubmit: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","project_manager","pelaksana_lapangan"]),
      ccoAdmin: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]),
      ccoQs: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","qs"]),
      ccoEscalation: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]),
      financeApprove: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","finance"]),
      financePay: roleIn(user,["administrator","direktur","head_unit_bisnis","finance"]),
      procurementApprove: roleIn(user,["head_unit_bisnis","manager_operasional"]),
      procurementVendorSelect: roleIn(user,["head_unit_bisnis","manager_operasional"]),
      procurementOrder: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","procurement"]),
      qcInspect: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","qc"]),
      qcVerify: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","qc"]),
      atiManage: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik","kepala_ati","instruktur_ati"]),
      qcSyncRab: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","qc","qs"])
    }
  };
}

function canSeeFinanceModule(user) {
  return (ROLE_VIEWS[normalizeRole(user)] || []).includes("finance");
}

function sanitizeMetricsForUser(metrics,user) {
  const out = {...metrics};
  if (!canSeeFinanceModule(user)) {
    for (const key of ["income","expense","netCash","committed","remainingBudget","receivable","payable","forecastCost","marginForecast","marginPercent"]) delete out[key];
  }
  return out;
}

function sanitizeEvaluationForUser(evaluation,user) {
  if (canSeeFinanceModule(user)) return evaluation;
  const out = {...evaluation,metrics:sanitizeMetricsForUser(evaluation.metrics || {},user)};
  out.blockers = (evaluation.blockers || []).map(x => {
    const t = String(x || "");
    if (/^Piutang tersisa/i.test(t)) return "Penyelesaian piutang masih menunggu Finance";
    if (/^Hutang tersisa/i.test(t)) return "Penyelesaian hutang masih menunggu Finance";
    return t;
  });
  return out;
}

function collectionDenied(user, collection, action) {
  const p = collectionPermission(user,collection);
  return !p?.[action];
}

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
    status: u.status || "Aktif",
    roleKey: normalizeRole(u)
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

async function listRecords(env, collection, url, user=null) {
  const projectId = qsEq(url,"projectId");
  const relatedId = qsEq(url,"relatedId");
  const status = qsEq(url,"status");
  const id = qsEq(url,"id");
  if (projectId && user && !(await userCanAccessProject(env,user,projectId))) return [];
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 1000),1),5000);
  const where = ["collection=?"];
  const bind = [collection];
  if (id) { where.push("id=?"); bind.push(id); }
  if (projectId) {
    where.push("(json_extract(data_json,'$.projectId')=? OR json_extract(data_json,'$.project_id')=?)");
    bind.push(projectId,projectId);
  }
  if (relatedId) { where.push("json_extract(data_json,'$.relatedId')=?"); bind.push(relatedId); }
  if (status) { where.push("lower(COALESCE(json_extract(data_json,'$.status'),''))=lower(?)"); bind.push(status); }
  bind.push(limit);
  const res = await env.DB.prepare(`
    SELECT id,data_json,updated_at FROM app_records
    WHERE ${where.join(" AND ")}
    ORDER BY updated_at DESC LIMIT ?
  `).bind(...bind).all();
  let rows = (res.results || []).map(r => {
    const data = safeJsonParse(r.data_json, {});
    if (collection === "users") data.password = "";
    return {id:r.id,data,updated_at:r.updated_at};
  });
  if (user && isProjectScopedRole(user)) {
    const ids = await accessibleProjectIds(env,user);
    rows = rows.filter(r => {
      if (collection === "projects") return ids.has(String(r.id));
      const pid = recordProjectId(collection,r.id,r.data);
      return pid ? ids.has(pid) : !PROJECT_SCOPED_COLLECTIONS.has(collection);
    });
  }
  return rows;
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


function progressSeriesFor(projectId, all) {
  const byDate = new Map();
  const rows = all.filter(r => (r.collection === "daily_progress" || r.collection === "weekly_progress") && String(r.data.projectId || "") === projectId);
  rows.sort((a,b) => String(a.data.date || a.updated_at || "").localeCompare(String(b.data.date || b.updated_at || "")));
  for (const r of rows) {
    const date = String(r.data.date || r.updated_at || "").slice(0,10);
    if (!date) continue;
    const actual = Math.min(100,Math.max(0,pickNum(r.data,["progress","actualProgress","percent"])));
    const plan = Math.min(100,Math.max(0,pickNum(r.data,["planProgress","plannedProgress","plan","rencana"])));
    const prev = byDate.get(date);
    // Daily input is the most granular source, so it wins if both exist on same date.
    if (!prev || r.collection === "daily_progress") byDate.set(date,{date,actual,plan,source:r.collection});
  }
  return [...byDate.values()].slice(-60);
}

function qcStatusCounts(projectId, all) {
  const inspections = all.filter(r => r.collection === "qc_inspections" && String(r.data.projectId || "") === projectId);
  const workItems = all.filter(r => r.collection === "qc_work_items" && String(r.data.projectId || "") === projectId && String(r.data.status || "ACTIVE").toUpperCase() !== "CLOSED");
  const latest = new Map();
  for (const r of inspections) {
    const key = String(r.data.workItemId || r.data.item || r.id);
    const stamp = String(r.data.date || r.updated_at || "");
    const cur = latest.get(key);
    if (!cur || stamp > cur.stamp) latest.set(key,{stamp,result:String(r.data.result || "").toUpperCase()});
  }
  let nonPass=0,uninspected=0;
  if (workItems.length) {
    for (const w of workItems) {
      if (w.data.required === false || String(w.data.required).toLowerCase()==="false") continue;
      const v=latest.get(String(w.id));
      if (!v) uninspected++;
      else if (!["PASS","PASSED"].includes(v.result)) nonPass++;
    }
  } else {
    for (const v of latest.values()) if (!["PASS","PASSED"].includes(v.result)) nonPass++;
  }
  return {open:nonPass+uninspected,nonPass,uninspected,total:workItems.length};
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
  const budgetRows = all.filter(r => r.collection === "project_budget" && String(r.data.projectId || "") === id && (!r.data.status || ["APPROVED","REVISED","CLOSED"].includes(String(r.data.status||"").toUpperCase())));
  const detailedBudgetRows = budgetRows.filter(r => !truthy(r.data.systemGenerated));
  const effectiveBudgetRows = detailedBudgetRows.length ? detailedBudgetRows : budgetRows;
  const lineBudget = effectiveBudgetRows.reduce((sum,r)=>sum+pickNum(r.data,["budgetAmount","amount","nominal","value","total"]),0);
  const budget = lineBudget > 0 ? lineBudget : headerBudget;
  const income = sumCollection(id,all,"cash_in",["amount","nominal","value","total"],d => paidLike(d.status));
  const expense = sumCollection(id,all,"cash_out",["amount","nominal","value","total"],d => paidLike(d.status));
  const poCommitted = all.filter(r => r.collection === "po" && String(r.data.projectId || "") === id && activeLike(r.data.status))
    .reduce((s,r) => s + Math.max(0,pickNum(r.data,["amount","nominal","value","total"]) - pickNum(r.data,["paidAmount","paid"])),0);
  const receivable = outstandingCollection(id,all,"receivables");
  const payable = outstandingCollection(id,all,"payables");
  const qcCounts = qcStatusCounts(id,all);
  const openQc = qcCounts.open;
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
    remainingBudget:budget-expense-poCommitted,receivable,payable,progress,openQc,qcUninspected:qcCounts.uninspected,qcTotalItems:qcCounts.total,openDefects,pendingCco,pendingApprovals,openCloseout,openIssues,
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
  const qcRequired = p.qcRequired === undefined ? true : truthy(p.qcRequired);
  const qcChecklistMissing = qcRequired && m.qcTotalItems === 0;
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
  else if (qcChecklistMissing || m.openQc > 0 || m.openDefects > 0 || m.openIssues > 0 || phoMissing.length) {
    status="PHO"; gate="PHO & Final QC";
    blockers=[...(qcChecklistMissing?["Checklist item pekerjaan QC belum disiapkan/sinkron dari RAB"]:[]),...(m.qcUninspected? [`${m.qcUninspected} item QC wajib belum pernah diinspeksi`]:[]),...(m.openQc-m.qcUninspected>0? [`${m.openQc-m.qcUninspected} item QC latest result belum PASS`]:[]),...(m.openDefects? [`${m.openDefects} defect masih terbuka`]:[]),...(m.openIssues? [`${m.openIssues} issue/corrective action masih terbuka`]:[]),...phoMissing.map(x=>`Dokumen ${x} belum ada`)];
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
    {code:"PHO",label:"PHO",done:m.progress>=100 && !qcChecklistMissing && m.openQc===0 && m.openDefects===0 && m.openIssues===0 && phoMissing.length===0},
    {code:"RETENTION",label:"Retensi",done:!retentionRequired || !retentionOpen},
    {code:"FHO",label:"FHO",done:!fhoRequired || fhoMissing.length===0},
    {code:"FINANCIAL_CLOSE",label:"Financial Close-Out",done:m.receivable===0 && m.payable===0 && m.pendingCco===0 && m.pendingApprovals===0 && m.openCloseout===0 && finMissing.length===0},
    {code:"CLOSED",label:"Project Closed",done:status==="CLOSED"}
  ];
  return {status,gate,blockers,flow,metrics:m,documents:[...docs].sort()};
}

async function loadControlRows(env,user=null) {
  const cols = ["projects","project_budget","cash_in","cash_out","receivables","payables","payment_requests","approvals","po","daily_progress","weekly_progress","schedule","milestones","issues","qc_work_items","qc_inspections","defects","cco","retention","closeout","project_documents","rabs","procurement"];
  const marks = cols.map(()=>"?").join(",");
  const res = await env.DB.prepare(`SELECT collection,id,data_json,updated_at FROM app_records WHERE collection IN (${marks}) ORDER BY updated_at DESC`).bind(...cols).all();
  let rows = (res.results || []).map(r => ({collection:r.collection,id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
  if (user && isProjectScopedRole(user)) {
    const ids = await accessibleProjectIds(env,user);
    rows = rows.filter(r => r.collection === "projects" ? ids.has(String(r.id)) : ids.has(recordProjectId(r.collection,r.id,r.data)));
  }
  return rows;
}

async function dashboardHandler(env,user=null) {
  const all = await loadControlRows(env,user);
  const projects = all.filter(r => r.collection === "projects");
  const rows = projects.map(p => ({...computeProjectMetrics(p,all), evaluatedStatus:evaluateProject(p,all).status, progressSeries:progressSeriesFor(p.id,all)}));
  const sum = key => rows.reduce((s,r)=>s+num(r[key]),0);
  const financeVisible = canSeeFinanceModule(user);
  const totals = {
    projects:rows.length,
    active:rows.filter(r=>r.evaluatedStatus!=="CLOSED").length,
    closed:rows.filter(r=>r.evaluatedStatus==="CLOSED").length,
    contract:sum("contract"),budget:sum("budget"),
    openQc:sum("openQc"),openDefects:sum("openDefects"),pendingCco:sum("pendingCco"),pendingApprovals:sum("pendingApprovals"),openIssues:sum("openIssues"),openCloseout:sum("openCloseout")
  };
  if (financeVisible) Object.assign(totals,{
    income:sum("income"),expense:sum("expense"),netCash:sum("netCash"),committed:sum("committed"),
    remainingBudget:sum("remainingBudget"),receivable:sum("receivable"),payable:sum("payable")
  });
  return json({
    ok:true,
    generatedAt:new Date().toISOString(),
    projectScope:isProjectScopedRole(user)?"assigned-only":"role-wide",
    totals,
    projects:rows.map(r=>sanitizeMetricsForUser(r,user))
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
  const denied = await requireProjectAccess(env,user,projectId); if (denied) return denied;
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
  const deniedOld = await requireProjectAccess(env,user,old.data.projectId); if (deniedOld) return deniedOld;
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
  const deniedNew = await requireProjectAccess(env,user,merged.projectId); if (deniedNew) return deniedNew;
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
  const denied = await requireProjectAccess(env,user,old.data.projectId); if (denied) return denied;
  if (env.FILES && old.data.objectKey) { try { await env.FILES.delete(old.data.objectKey); } catch (_) {} }
  await env.DB.prepare(`DELETE FROM app_records WHERE collection='project_documents' AND id=?`).bind(id).run();
  await audit(env,user,"DELETE_DOCUMENT","project_documents",id,old.data.projectId || "",{title:old.data.title || old.data.originalName || ""});
  return json({ok:true});
}

async function downloadDocument(env,user,id) {
  const old = await getRecord(env,"project_documents",id);
  if (!old) return json({ok:false,message:"Dokumen tidak ditemukan."},404);
  const denied = await requireProjectAccess(env,user,old.data.projectId); if (denied) return denied;
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

async function listDocuments(env,url,user=null) {
  const rows = await listRecords(env,"project_documents",url,user);
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
  const denied = await requireProjectAccess(env,user,projectId); if (denied) return denied;
  const all = await loadControlRows(env,user);
  const projectRow = all.find(r => r.collection === "projects" && r.id === projectId);
  if (!projectRow) return json({ok:false,message:"Project tidak ditemukan."},404);
  const evaluation = evaluateProject(projectRow,all);
  const updated = {...projectRow.data,status:evaluation.status,statusGate:evaluation.gate,statusSyncedAt:new Date().toISOString()};
  await upsertRecord(env,"projects",projectId,updated,user);
  await audit(env,user,"SYNC_PROJECT_STATUS","projects",projectId,projectId,{status:evaluation.status,blockers:evaluation.blockers});
  return json({ok:true,evaluation});
}

async function projectFlow(env,user,projectId) {
  const denied = await requireProjectAccess(env,user,projectId); if (denied) return denied;
  const all = await loadControlRows(env,user);
  const projectRow = all.find(r => r.collection === "projects" && r.id === projectId);
  if (!projectRow) return json({ok:false,message:"Project tidak ditemukan."},404);
  return json({ok:true,evaluation:sanitizeEvaluationForUser(evaluateProject(projectRow,all),user)});
}


async function listEmployees(env) {
  const res = await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection='users' ORDER BY lower(COALESCE(json_extract(data_json,'$.name'),json_extract(data_json,'$.username'),id))`).all();
  const employees = (res.results || []).map(r => {
    const d = safeJsonParse(r.data_json,{});
    return {
      id:r.id,
      name:d.name || d.username || d.email || r.id,
      username:d.username || r.id,
      role:d.role || "",
      roleKey:normalizeRole(d),
      jabatan:d.jabatan || d.role || "",
      unit:d.unit || "",
      departemen:d.departemen || "",
      email:d.email || "",
      phone:d.phone || d.telepon || "",
      status:d.status || "Aktif"
    };
  });
  return employees.filter(e => String(e.status || "").toLowerCase() !== "nonaktif");
}

async function getProjectBudgetValue(env, projectId) {
  const project = await getRecord(env,"projects",projectId);
  if (!project) return 0;
  const rows = await env.DB.prepare(`SELECT data_json FROM app_records WHERE collection='project_budget' AND json_extract(data_json,'$.projectId')=?`).bind(projectId).all();
  const parsed=(rows.results || []).map(r=>safeJsonParse(r.data_json,{})).filter(d=>!d.status || ["APPROVED","REVISED","CLOSED"].includes(String(d.status).toUpperCase()));
  const detailed=parsed.filter(d=>!truthy(d.systemGenerated));
  const effective=detailed.length?detailed:parsed;
  const sum=effective.reduce((a,d)=>a+pickNum(d,["budgetAmount","amount","nominal","value","total"]),0);
  return sum > 0 ? sum : pickNum(project.data,["budget","hpp","rabHpp","rab_hpp","nilaiHpp","nilai_hpp"]);
}

async function afterRecordUpsert(env, collection, record, user) {
  const d = record?.data || {};
  if (collection === "projects") {
    const budget = pickNum(d,["budget","hpp","rabHpp","rab_hpp","nilaiHpp","nilai_hpp"]);
    if (budget > 0) {
      const id = `AUTO-BUDGET-${record.id}`;
      const old = await getRecord(env,"project_budget",id);
      await upsertRecord(env,"project_budget",id,{
        ...(old?.data || {}),projectId:record.id,costCode:"BASELINE",category:"Baseline Proyek",
        description:"Baseline HPP/RAB dari master proyek",budgetAmount:budget,status:"APPROVED",systemGenerated:true
      },user);
    }
  }
  if (collection === "po") {
    const st = String(d.status || "").toUpperCase();
    if (["APPROVED","ORDERED","PARTIAL","PAID","CLOSED"].includes(st) && d.projectId) {
      const amount = pickNum(d,["amount","nominal","value","total"]);
      const paidAmount = st === "PAID" ? amount : pickNum(d,["paidAmount","paid"]);
      const id = `AUTO-PO-${record.id}`;
      const old = await getRecord(env,"payables",id);
      await upsertRecord(env,"payables",id,{
        ...(old?.data || {}),projectId:d.projectId,description:`PO/SPK ${d.number || record.id} - ${d.description || ""}`.trim(),
        vendor:d.vendor || "",amount,paidAmount,dueDate:d.deliveryDate || d.date || "",status:paidAmount >= amount && amount > 0 ? "PAID" : "OPEN",
        poId:record.id,systemGenerated:true
      },user);
    }
  }
  if (collection === "cash_in" && d.receivableId) {
    const rec = await getRecord(env,"receivables",String(d.receivableId));
    if (rec && paidLike(d.status)) {
      const totalReceipts = await env.DB.prepare(`SELECT data_json FROM app_records WHERE collection='cash_in' AND json_extract(data_json,'$.receivableId')=?`).bind(String(d.receivableId)).all();
      let paid = 0;
      for (const x of (totalReceipts.results || [])) { const xd=safeJsonParse(x.data_json,{}); if (paidLike(xd.status)) paid += pickNum(xd,["amount","nominal","value","total"]); }
      const amount = pickNum(rec.data,["amount","nominal","value","total"]);
      await upsertRecord(env,"receivables",rec.id,{...rec.data,paidAmount:paid,status:paid >= amount && amount > 0 ? "PAID" : "OPEN"},user);
    }
  }
}

function rabItemCandidates(data) {
  const out = [];
  const arrays = [data.items,data.rows,data.details,data.workItems,data.pekerjaan,data.uraianItems,data.rabItems].filter(Array.isArray);
  const pushOne = (v, idx=0) => {
    if (typeof v === "string") { if (v.trim()) out.push({item:v.trim(),code:"",category:""}); return; }
    if (!v || typeof v !== "object") return;
    const item = v.item || v.description || v.uraian || v.pekerjaan || v.name || v.nama || v.workItem || v.work || "";
    if (!String(item).trim()) return;
    out.push({item:String(item).trim(),code:String(v.code || v.kode || v.no || idx+1),category:String(v.category || v.kategori || v.group || "")});
  };
  arrays.forEach(arr => arr.forEach(pushOne));
  for (const key of ["itemsText","workItemsText","uraianText","daftarPekerjaan"]) {
    const text=String(data[key] || "").trim();
    if (text) text.split(/\r?\n/).map(x=>x.replace(/^[-•*\d.\s]+/,"").trim()).filter(Boolean).forEach((x,i)=>pushOne({item:x,code:i+1},i));
  }
  if (!arrays.length && !out.length) pushOne(data,0);
  return out;
}

async function syncQcFromRab(env,user,projectId) {
  const denied = await requireProjectAccess(env,user,projectId); if (denied) throw new Error("Anda tidak ditugaskan pada proyek ini.");
  const rabs = await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='rabs' AND (json_extract(data_json,'$.projectId')=? OR json_extract(data_json,'$.project_id')=?)`).bind(projectId,projectId).all();
  const existing = await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='qc_work_items' AND json_extract(data_json,'$.projectId')=?`).bind(projectId).all();
  const keys = new Set((existing.results || []).map(r => String(safeJsonParse(r.data_json,{}).item || "").trim().toLowerCase()).filter(Boolean));
  let created=0, found=0;
  for (const r of (rabs.results || [])) {
    const d = safeJsonParse(r.data_json,{});
    for (const it of rabItemCandidates(d)) {
      found++;
      const key = it.item.toLowerCase();
      if (keys.has(key)) continue;
      keys.add(key);
      await upsertRecord(env,"qc_work_items",crypto.randomUUID(),{
        projectId,item:it.item,code:it.code,category:it.category,sourceRabId:r.id,status:"ACTIVE",required:true
      },user);
      created++;
    }
  }
  // Fallback: detailed project_budget/RAB lines are also valid QC work items.
  const budgetRows=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='project_budget' AND json_extract(data_json,'$.projectId')=?`).bind(projectId).all();
  for (const r of (budgetRows.results || [])) {
    const d=safeJsonParse(r.data_json,{});
    if (truthy(d.systemGenerated)) continue;
    const item=String(d.description || d.item || d.uraian || "").trim();
    if (!item) continue;
    found++;
    const key=item.toLowerCase(); if(keys.has(key)) continue; keys.add(key);
    await upsertRecord(env,"qc_work_items",crypto.randomUUID(),{projectId,item,code:String(d.costCode||""),category:String(d.category||""),sourceRabId:`BUDGET:${r.id}`,status:"ACTIVE",required:true},user);
    created++;
  }
  await audit(env,user,"QC_SYNC_RAB","qc_work_items","",projectId,{found,created});
  return {found,created};
}

async function storeEvidenceDocument(env,user,file,meta) {
  if (!env.FILES) throw new Error("R2 binding FILES belum tersedia.");
  if (!(file instanceof File) || file.size <= 0) throw new Error("Bukti foto/dokumen wajib di-upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Ukuran file maksimal 25 MB.");
  const id = crypto.randomUUID();
  const category = String(meta.category || "OTHER").toUpperCase();
  const key = `projects/${safeFilename(meta.projectId)}/${safeFilename(category)}/${id}-${safeFilename(file.name)}`;
  await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type || "application/octet-stream"}});
  const data = {
    projectId:meta.projectId,category,title:meta.title || file.name,notes:meta.notes || "",
    relatedCollection:meta.relatedCollection || "",relatedId:meta.relatedId || "",originalName:file.name,
    mimeType:file.type || "application/octet-stream",size:file.size,objectKey:key,version:1,status:"ACTIVE",
    uploadedAt:new Date().toISOString(),uploadedBy:user.name || user.username
  };
  return upsertRecord(env,"project_documents",id,data,user);
}

async function qcInspectHandler(request,env,user) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak memiliki akses melakukan QC Inspection."},403);
  let fd; try { fd=await request.formData(); } catch { return json({ok:false,message:"Form QC tidak valid."},400); }
  const projectId=String(fd.get("projectId") || "").trim();
  const workItemId=String(fd.get("workItemId") || "").trim();
  const result=String(fd.get("result") || "").trim().toUpperCase();
  const date=String(fd.get("date") || new Date().toISOString().slice(0,10));
  const notes=String(fd.get("notes") || "");
  const qcUserId=String(fd.get("qcUserId") || user.id || "");
  const file=fd.get("file");
  if (!projectId || !workItemId) return json({ok:false,message:"Proyek dan item pekerjaan QC wajib dipilih."},400);
  const denied = await requireProjectAccess(env,user,projectId); if (denied) return denied;
  if (!["PASS","NG","CONDITIONAL"].includes(result)) return json({ok:false,message:"Hasil QC harus PASS, NG, atau CONDITIONAL."},400);
  if (!(file instanceof File) || file.size<=0) return json({ok:false,message:"Setiap QC Inspection wajib upload bukti."},400);
  const workItem = await getRecord(env,"qc_work_items",workItemId);
  if (!workItem || String(workItem.data.projectId || "") !== projectId) return json({ok:false,message:"Item pekerjaan QC tidak ditemukan pada proyek ini."},404);
  const id=crypto.randomUUID();
  const inspection=await upsertRecord(env,"qc_inspections",id,{
    projectId,workItemId,item:workItem.data.item || workItemId,date,result,status:"RECORDED",qcUserId,qc:user.name || user.username,notes,
    evidenceRequired:true
  },user);
  const doc=await storeEvidenceDocument(env,user,file,{projectId,category:"QC_EVIDENCE",title:`QC ${workItem.data.item || workItemId} - ${date}`,notes,relatedCollection:"qc_inspections",relatedId:id});
  await upsertRecord(env,"qc_work_items",workItemId,{...workItem.data,lastInspectionId:id,lastInspectionDate:date,lastResult:result,lastEvidenceId:doc.id},user);
  const openDefects = await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='defects' AND json_extract(data_json,'$.projectId')=? AND json_extract(data_json,'$.workItemId')=?`).bind(projectId,workItemId).all();
  if (result === "PASS") {
    for (const r of (openDefects.results || [])) {
      const d=safeJsonParse(r.data_json,{}); if (activeLike(d.status)) await upsertRecord(env,"defects",r.id,{...d,status:"CLOSED",closedByInspectionId:id,closedAt:new Date().toISOString()},user);
    }
  } else {
    const hasOpen=(openDefects.results || []).some(r=>activeLike(safeJsonParse(r.data_json,{}).status));
    if (!hasOpen) await upsertRecord(env,"defects",crypto.randomUUID(),{
      projectId,workItemId,qcInspectionId:id,date,item:workItem.data.item || "",severity:result==="NG"?"MAJOR":"MINOR",status:"OPEN",
      picUserId:"",deadline:"",correctiveAction:"",notes:`Auto dari QC Inspection ${result}: ${notes}`
    },user);
  }
  await audit(env,user,"QC_INSPECTION","qc_inspections",id,projectId,{workItemId,result,evidenceId:doc.id});
  return json({ok:true,inspection,document:doc});
}

async function ccoActionHandler(request,env,user,id) {
  const rec=await getRecord(env,"cco",id);
  if (!rec) return json({ok:false,message:"CCO tidak ditemukan."},404);
  const denied = await requireProjectAccess(env,user,rec.data.projectId); if (denied) return denied;
  const body=await parseJson(request) || {};
  const action=String(body.action || "").trim().toLowerCase();
  const access=buildAccess(user).capabilities;
  const oldStatus=String(rec.data.status || "DRAFT").toUpperCase();
  let next=oldStatus;
  const d={...rec.data};
  const allowed=(cap)=>Boolean(access[cap]);
  const need=(cond,msg)=>{ if(!cond) throw new Error(msg); };
  try {
    if (action==="submit-admin") { need(allowed("ccoFieldSubmit"),"Role ini tidak boleh mengajukan CCO."); need(isManagementRole(user) || !d.requestedByUserId || d.requestedByUserId===user.id,"Hanya pengaju atau Manajemen yang dapat submit CCO ini."); need(["DRAFT","RETURNED_TO_FIELD"].includes(oldStatus),"CCO hanya dapat diajukan dari DRAFT/RETURNED_TO_FIELD."); next="SUBMITTED_TO_ADMIN"; d.submittedByUserId=user.id; d.submittedAt=new Date().toISOString(); }
    else if (action==="send-qs") { need(allowed("ccoAdmin"),"Hanya Admin/Manajemen yang dapat meneruskan CCO ke QS."); need(["SUBMITTED_TO_ADMIN","ADMIN_REVIEW"].includes(oldStatus),"CCO belum berada pada tahap review Admin."); next="SENT_TO_QS"; d.adminForwardedBy=user.id; d.adminForwardedAt=new Date().toISOString(); }
    else if (action==="start-pricing") { need(allowed("ccoQs"),"Hanya QS/Manajemen yang dapat memulai RAB CCO."); need(oldStatus==="SENT_TO_QS","CCO belum dikirim ke QS."); next="QS_PRICING"; d.qsUserId=user.id; d.qsStartedAt=new Date().toISOString(); }
    else if (action==="complete-pricing") {
      need(allowed("ccoQs"),"Hanya QS/Manajemen yang dapat menyelesaikan RAB CCO."); need(["SENT_TO_QS","QS_PRICING"].includes(oldStatus),"Tahap CCO tidak sesuai untuk finalisasi RAB.");
      const amount=num(body.amount ?? d.amount); need(amount>0,"Nilai RAB CCO wajib diisi."); d.amount=amount; d.rabNumber=String(body.rabNumber || d.rabNumber || ""); d.rabNotes=String(body.notes || d.rabNotes || "");
      const base=await getProjectBudgetValue(env,String(d.projectId || "")); d.percentOfRab=base>0?amount/base*100:0;
      d.escalationLevel=d.percentOfRab>10?"WAJIB ESKALASI SOP/SP":d.percentOfRab>8?"REVIEW KHUSUS":"NORMAL";
      d.qsCompletedBy=user.id; d.qsCompletedAt=new Date().toISOString(); next="RAB_READY";
    }
    else if (action==="approve-escalation") { need(allowed("ccoEscalation"),"Eskalasi >10% hanya dapat disetujui Manajemen."); need(num(d.percentOfRab)>10,"CCO ini tidak memerlukan approval eskalasi >10%."); d.sopEscalationApproved=true; d.sopEscalationApprovedBy=user.id; d.sopEscalationApprovedAt=new Date().toISOString(); next=oldStatus; }
    else if (action==="send-client") { need(allowed("ccoAdmin"),"Hanya Admin/Manajemen yang dapat mengirim CCO ke client."); need(["RAB_READY","READY_FOR_CLIENT"].includes(oldStatus),"RAB CCO belum siap dikirim ke client."); if(num(d.percentOfRab)>10) need(truthy(d.sopEscalationApproved),"CCO >10% harus melalui approval eskalasi SOP/SP sebelum dikirim ke client."); next="SENT_TO_CLIENT"; d.sentClientBy=user.id; d.sentClientAt=new Date().toISOString(); }
    else if (action==="client-approve") { need(allowed("ccoAdmin"),"Hanya Admin/Manajemen yang mencatat keputusan client."); need(oldStatus==="SENT_TO_CLIENT","CCO belum dikirim ke client."); next="CLIENT_APPROVED"; d.clientDecisionAt=new Date().toISOString(); d.clientDecision="APPROVED"; }
    else if (action==="client-reject") { need(allowed("ccoAdmin"),"Hanya Admin/Manajemen yang mencatat keputusan client."); need(oldStatus==="SENT_TO_CLIENT","CCO belum dikirim ke client."); next="CLIENT_REJECTED"; d.clientDecisionAt=new Date().toISOString(); d.clientDecision="REJECTED"; d.clientDecisionNote=String(body.notes || ""); }
    else if (action==="start-addendum") { need(allowed("ccoAdmin"),"Hanya Admin/Manajemen yang memproses Addendum."); need(oldStatus==="CLIENT_APPROVED","Client belum menyetujui CCO."); next="ADDENDUM_PROCESS"; }
    else if (action==="return-field") { need(allowed("ccoAdmin") || allowed("ccoQs"),"Tidak berhak mengembalikan CCO."); need(!["CLOSED","CLIENT_APPROVED","ADDENDUM_PROCESS"].includes(oldStatus),"CCO pada tahap ini tidak dapat dikembalikan ke lapangan."); next="RETURNED_TO_FIELD"; d.returnReason=String(body.notes || "Perlu perbaikan data pengajuan"); }
    else if (action==="close") {
      need(allowed("ccoAdmin"),"Hanya Admin/Manajemen yang dapat menutup CCO."); need(["CLIENT_APPROVED","ADDENDUM_PROCESS"].includes(oldStatus),"CCO belum berada pada tahap Addendum.");
      const doc=await env.DB.prepare(`SELECT id FROM app_records WHERE collection='project_documents' AND json_extract(data_json,'$.projectId')=? AND json_extract(data_json,'$.relatedCollection')='cco' AND json_extract(data_json,'$.relatedId')=? AND upper(COALESCE(json_extract(data_json,'$.category'),''))='CCO_ADDENDUM' LIMIT 1`).bind(String(d.projectId||""),id).first();
      need(Boolean(doc),"Upload dokumen Addendum final terlebih dahulu sebelum CCO ditutup."); next="CLOSED"; d.closedAt=new Date().toISOString(); d.closedBy=user.id;
    }
    else return json({ok:false,message:"Action CCO tidak dikenal."},400);
  } catch (e) { return json({ok:false,message:e.message || "Action CCO ditolak."},409); }
  d.status=next;
  const hist=Array.isArray(d.history)?d.history.slice(-30):[]; hist.push({at:new Date().toISOString(),action,from:oldStatus,to:next,by:user.id,note:String(body.notes||"")}); d.history=hist;
  const out=await upsertRecord(env,"cco",id,d,user);
  await audit(env,user,"CCO_ACTION", "cco", id, d.projectId || "", {action,from:oldStatus,to:next});
  return json({ok:true,row:out});
}

async function paymentRequestActionHandler(request,env,user,id) {
  const rec=await getRecord(env,"payment_requests",id); if(!rec) return json({ok:false,message:"Payment Request tidak ditemukan."},404);
  const denied = await requireProjectAccess(env,user,rec.data.projectId); if (denied) return denied;
  const body=await parseJson(request) || {}; const action=String(body.action||"").toLowerCase(); const access=buildAccess(user).capabilities;
  const d={...rec.data}; const old=String(d.status||"DRAFT").toUpperCase(); let next=old;
  if(action==="submit") { if(!isManagementRole(user) && d.requesterUserId && d.requesterUserId!==user.id) return json({ok:false,message:"Hanya pengaju atau Manajemen yang dapat submit pengajuan ini."},403); if(!["DRAFT","REJECTED"].includes(old)) return json({ok:false,message:"Hanya DRAFT/REJECTED yang dapat diajukan."},409); next="PENDING"; d.submittedAt=new Date().toISOString(); d.requesterUserId=d.requesterUserId||user.id; }
  else if(action==="approve") { if(!access.financeApprove) return json({ok:false,message:"Role ini tidak dapat approve pengajuan dana."},403); if(old!=="PENDING") return json({ok:false,message:"Pengajuan belum berstatus PENDING."},409); next="APPROVED"; d.approvedByUserId=user.id; d.approvedAt=new Date().toISOString(); }
  else if(action==="reject") { if(!access.financeApprove) return json({ok:false,message:"Role ini tidak dapat reject pengajuan dana."},403); if(!["PENDING","APPROVED"].includes(old)) return json({ok:false,message:"Status pengajuan tidak dapat direject."},409); next="REJECTED"; d.rejectReason=String(body.notes||""); d.rejectedByUserId=user.id; d.rejectedAt=new Date().toISOString(); }
  else if(action==="pay") {
    if(!access.financePay) return json({ok:false,message:"Hanya Finance/Manajemen yang dapat mencatat pembayaran."},403); if(old!=="APPROVED") return json({ok:false,message:"Pengajuan harus APPROVED sebelum dibayar."},409);
    next="PAID"; d.paidAt=String(body.paymentDate||new Date().toISOString().slice(0,10)); d.paidByUserId=user.id; d.paymentReference=String(body.reference||""); d.paymentAccount=String(body.account||"");
    const cashId=`PAYREQ-${id}`; await upsertRecord(env,"cash_out",cashId,{projectId:d.projectId,date:d.paidAt,category:d.category||"Operasional",vendor:d.payee||d.vendor||"",amount:num(d.amount),status:"PAID",costCode:d.costCode||"",reference:d.paymentReference,account:d.paymentAccount,paymentRequestId:id,notes:`Otomatis dari Payment Request: ${d.description||""}`,systemGenerated:true},user);
  }
  else return json({ok:false,message:"Action Payment Request tidak dikenal."},400);
  d.status=next; const out=await upsertRecord(env,"payment_requests",id,d,user); await audit(env,user,"PAYMENT_REQUEST_ACTION","payment_requests",id,d.projectId||"",{action,from:old,to:next}); return json({ok:true,row:out});
}


async function employeeRoleKey(env,id) {
  if (!id) return "";
  const rec=await getRecord(env,"users",String(id));
  return rec ? normalizeRole(rec.data) : "";
}

async function projectAssignment(env,projectId,key) {
  const p=await getRecord(env,"projects",String(projectId || ""));
  if (!p) return "";
  const fields = key === "pelaksana" ? ["pelaksanaUserId","pengawasUserId"] : key === "pm" ? ["pmUserId","projectManagerUserId"] : [];
  for (const f of fields) if (p.data[f]) return String(p.data[f]);
  return "";
}

async function normalizeOperationalResponsibility(env,collection,data) {
  const d={...data};
  if (["daily_progress","weekly_progress"].includes(collection)) {
    const assigned=await projectAssignment(env,d.projectId,"pelaksana");
    if (assigned) d.picUserId=assigned;
    if (!d.picUserId) throw new Error("Proyek belum memiliki Pelaksana Lapangan. Tetapkan Pelaksana pada master proyek terlebih dahulu.");
    if ((await employeeRoleKey(env,d.picUserId)) !== "pelaksana_lapangan") throw new Error("PIC laporan progress wajib Pelaksana Lapangan.");
  }
  if (["schedule","milestones","issues"].includes(collection) && d.picUserId && (await employeeRoleKey(env,d.picUserId)) !== "pelaksana_lapangan") throw new Error("PIC pelaksanaan wajib Pelaksana Lapangan.");
  if (collection === "defects" && d.picUserId && (await employeeRoleKey(env,d.picUserId)) !== "pelaksana_lapangan") throw new Error("PIC perbaikan QC wajib Pelaksana Lapangan.");
  if (collection === "opname" && d.qsUserId && (await employeeRoleKey(env,d.qsUserId)) !== "qs") throw new Error("PIC Opname wajib QS / Quantity Surveyor.");
  if (collection === "po" && d.picUserId && (await employeeRoleKey(env,d.picUserId)) !== "procurement") throw new Error("PIC PO/SPK wajib Logistik / Procurement.");
  if (collection === "cco" && d.requestedByUserId) { const rk=await employeeRoleKey(env,d.requestedByUserId); if(!["project_manager","pelaksana_lapangan"].includes(rk)) throw new Error("Pengaju lapangan CCO wajib Project Manager atau Pelaksana Lapangan."); }
  if (collection === "surat" && d.picUserId && (await employeeRoleKey(env,d.picUserId)) !== "admin_teknik") throw new Error("PIC administrasi surat wajib Admin Teknik.");
  if (collection === "aset" && d.picUserId) { const rk=await employeeRoleKey(env,d.picUserId); if(!["procurement","admin_teknik"].includes(rk)) throw new Error("PIC aset wajib Logistik/Procurement atau Admin Teknik."); }
  if (collection === "retention" && d.picUserId) { const rk=await employeeRoleKey(env,d.picUserId); if(!["finance","admin_teknik","manager_operasional"].includes(rk)) throw new Error("PIC retensi wajib Finance/Admin Teknik/Manager Operasional."); }
  if (collection === "closeout" && d.ownerUserId) { const rk=await employeeRoleKey(env,d.ownerUserId); if(!["admin_teknik","manager_operasional","project_manager"].includes(rk)) throw new Error("PIC close-out wajib Admin Teknik/Manager Operasional/Project Manager."); }
  return d;
}

function normalizePrArrays(d) {
  const out={...d};
  out.items=Array.isArray(out.items)?out.items:[];
  out.vendorOffers=Array.isArray(out.vendorOffers)?out.vendorOffers:[];
  out.items=out.items.map((x,i)=>({id:String(x.id||crypto.randomUUID()),description:String(x.description||x.item||"").trim(),qty:num(x.qty),unit:String(x.unit||""),hppUnit:num(x.hppUnit),totalHpp:num(x.totalHpp)||num(x.qty)*num(x.hppUnit),notes:String(x.notes||"")})).filter(x=>x.description);
  out.vendorOffers=out.vendorOffers.map(x=>({id:String(x.id||crypto.randomUUID()),vendorId:String(x.vendorId||""),vendorName:String(x.vendorName||""),vendorVmlId:String(x.vendorVmlId||""),amount:num(x.amount),term:String(x.term||""),leadTime:String(x.leadTime||""),notes:String(x.notes||""),quoteDocumentId:String(x.quoteDocumentId||"")})).filter(x=>x.vendorId||x.vendorName);
  out.totalHpp=out.items.reduce((a,x)=>a+num(x.totalHpp),0);
  return out;
}

async function qcFindingActionHandler(request,env,user,id) {
  const rec=await getRecord(env,"defects",id); if(!rec) return json({ok:false,message:"Temuan QC tidak ditemukan."},404);
  const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied) return denied;
  let action="", note="", file=null, result="";
  const ct=request.headers.get("content-type")||"";
  if(ct.includes("multipart/form-data")) { const fd=await request.formData(); action=String(fd.get("action")||"").toLowerCase(); note=String(fd.get("note")||fd.get("description")||""); result=String(fd.get("result")||"").toUpperCase(); file=fd.get("file"); }
  else { const b=await parseJson(request)||{}; action=String(b.action||"").toLowerCase(); note=String(b.note||b.description||""); result=String(b.result||"").toUpperCase(); }
  const d={...rec.data}; const old=String(d.status||"OPEN").toUpperCase();
  const role=normalizeRole(user); const isPic=d.picUserId && String(d.picUserId)===String(user.id);
  if(action==="start") {
    if(!isPic && !roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik","project_manager"])) return json({ok:false,message:"Hanya PIC Pelaksana atau manajemen proyek yang dapat memulai perbaikan."},403);
    if(!["OPEN","REVISION REQUIRED"].includes(old)) return json({ok:false,message:"Temuan tidak berada pada status yang dapat mulai dikerjakan."},409);
    d.status="ON PROGRESS"; d.startedAt=new Date().toISOString(); d.startedByUserId=user.id;
  } else if(action==="submit-fix") {
    if(!isPic && !roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik","project_manager"])) return json({ok:false,message:"Hanya PIC Pelaksana atau manajemen proyek yang dapat mengirim hasil perbaikan."},403);
    if(old!=="ON PROGRESS") return json({ok:false,message:"Temuan harus ON PROGRESS sebelum dikirim ke QC."},409);
    if(!(file instanceof File) || file.size<=0) return json({ok:false,message:"Foto hasil perbaikan wajib di-upload."},400);
    const aid=crypto.randomUUID(); const doc=await storeEvidenceDocument(env,user,file,{projectId:d.projectId,category:"QC_EVIDENCE",title:`Hasil Perbaikan QC - ${d.item||d.area||id}`,notes:note,relatedCollection:"qc_actions",relatedId:aid});
    await upsertRecord(env,"qc_actions",aid,{projectId:d.projectId,findingId:id,date:new Date().toISOString().slice(0,10),action:"SUBMIT_FIX",description:note,afterDocumentId:doc.id,byUserId:user.id},user);
    d.status="WAITING QC CHECK"; d.lastFixDocumentId=doc.id; d.lastFixNote=note; d.submittedFixAt=new Date().toISOString();
  } else if(action==="verify") {
    if(!buildAccess(user).capabilities.qcVerify) return json({ok:false,message:"Hanya QC/Manajemen yang dapat memverifikasi perbaikan."},403);
    if(old!=="WAITING QC CHECK") return json({ok:false,message:"Temuan belum menunggu verifikasi QC."},409);
    if(!["SESUAI","TIDAK SESUAI"].includes(result)) return json({ok:false,message:"Hasil verifikasi wajib SESUAI atau TIDAK SESUAI."},400);
    if(result==="TIDAK SESUAI" && !note.trim()) return json({ok:false,message:"Catatan QC wajib diisi jika hasil tidak sesuai."},400);
    const vid=crypto.randomUUID(); await upsertRecord(env,"qc_verifications",vid,{projectId:d.projectId,findingId:id,date:new Date().toISOString().slice(0,10),result,note,qcUserId:user.id},user);
    d.status=result==="SESUAI"?"CLOSED":"REVISION REQUIRED"; d.lastVerificationId=vid; d.verifiedAt=new Date().toISOString(); d.qcNote=note;
    if(result==="SESUAI") d.closedAt=new Date().toISOString();
  } else return json({ok:false,message:"Action QC tidak dikenal."},400);
  const out=await upsertRecord(env,"defects",id,d,user); await audit(env,user,"QC_FINDING_ACTION","defects",id,d.projectId||"",{action,from:old,to:d.status,result}); return json({ok:true,row:out});
}

async function procurementActionHandler(request,env,user,id) {
  const rec=await getRecord(env,"procurement",id); if(!rec) return json({ok:false,message:"PR tidak ditemukan."},404);
  const denied = await requireProjectAccess(env,user,rec.data.projectId); if (denied) return denied;
  const body=await parseJson(request)||{}; const action=String(body.action||"").toLowerCase(); const caps=buildAccess(user).capabilities; let d=normalizePrArrays(rec.data); const old=String(d.status||"DRAFT").toUpperCase(); let next=old;
  if(action==="submit") {
    if(d.requesterUserId && d.requesterUserId!==user.id && !roleIn(user,["head_unit_bisnis","manager_operasional"])) return json({ok:false,message:"PR hanya dapat disubmit oleh Project Manager proyek, Head Operational, atau Head Unit Bisnis."},403);
    if(!["DRAFT","REJECTED","REQUESTED"].includes(old)) return json({ok:false,message:"PR tidak dapat diajukan dari status ini."},409);
    if(!d.items.length) return json({ok:false,message:"PR wajib memiliki minimal 1 item pekerjaan/material/jasa."},400);
    if(!truthy(d.coiDeclaration)) return json({ok:false,message:"Deklarasi Conflict of Interest wajib disetujui oleh pengaju sebelum PR diajukan."},400);
    next="SUBMITTED"; d.submittedByUserId=user.id; d.submittedAt=new Date().toISOString();
  }
  else if(action==="select-vendor" || action==="approve") {
    if(!caps.procurementVendorSelect) return json({ok:false,message:"Hanya Head Operational atau Head Unit Bisnis yang dapat memilih vendor PR."},403);
    if(old!=="SUBMITTED") return json({ok:false,message:"PR harus SUBMITTED sebelum pemilihan vendor."},409);
    const offerId=String(body.vendorOfferId||body.offerId||"");
    const offer=d.vendorOffers.find(x=>x.id===offerId);
    if(!offer) return json({ok:false,message:"Pilih salah satu penawaran vendor yang tersedia."},400);
    next="APPROVED"; d.selectedVendorOfferId=offer.id; d.selectedVendorId=offer.vendorId; d.selectedVendorName=offer.vendorName; d.selectedVendorVmlId=offer.vendorVmlId; d.selectedOfferAmount=num(offer.amount); d.approvedByUserId=user.id; d.approvedAt=new Date().toISOString();
  }
  else if(action==="reject") { if(!caps.procurementApprove) return json({ok:false,message:"Role ini tidak dapat reject PR."},403); if(!["SUBMITTED","APPROVED"].includes(old)) return json({ok:false,message:"PR tidak dapat direject dari status ini."},409); next="REJECTED"; d.rejectReason=String(body.notes||""); }
  else if(action==="order") { if(!caps.procurementOrder) return json({ok:false,message:"Role ini tidak dapat menandai PR sebagai dipesan."},403); if(old!=="APPROVED") return json({ok:false,message:"PR harus APPROVED sebelum ORDERED."},409); if(!d.selectedVendorId && !d.selectedVendorName) return json({ok:false,message:"Vendor terpilih belum ditetapkan."},409); next="ORDERED"; d.orderedAt=new Date().toISOString(); }
  else if(action==="receive") { if(!caps.procurementOrder) return json({ok:false,message:"Role ini tidak dapat menerima material."},403); if(old!=="ORDERED") return json({ok:false,message:"PR harus ORDERED sebelum RECEIVED."},409); next="RECEIVED"; d.receivedAt=new Date().toISOString(); }
  else return json({ok:false,message:"Action PR tidak dikenal."},400);
  d.status=next; const out=await upsertRecord(env,"procurement",id,d,user); await audit(env,user,"PROCUREMENT_ACTION","procurement",id,d.projectId||"",{action,from:old,to:next,selectedVendor:d.selectedVendorName||""}); return json({ok:true,row:out});
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

async function legacyStorageHandler(request, env, url, user=null) {
  if (!env.FILES) return json({statusCode:"503",error:"StorageUnavailable",message:"R2 binding FILES belum tersedia."},503);
  const parts = storageParts(url.pathname);
  if (!parts) return json({statusCode:"400",error:"InvalidRequest",message:"Invalid storage path"},400);
  if (parts.bucket !== STORAGE_BUCKET && parts.bucket !== "kendali-files") return json({statusCode:"404",error:"BucketNotFound",message:"Bucket not found"},404);
  if (user && !(await userCanAccessStorageKey(env,user,parts.key))) return json({statusCode:"403",error:"Forbidden",message:"Anda tidak ditugaskan pada proyek file ini."},403);
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
    await env.FILES.put(parts.key,buf,{httpMetadata:{contentType:request.headers.get("content-type") || "application/octet-stream"},customMetadata:{source:"KENDALI-V3.0"}});
    return json({Key:`${parts.bucket}/${parts.key}`,Id:crypto.randomUUID()});
  }
  if (request.method === "DELETE") { await env.FILES.delete(parts.key); return json({message:"Successfully deleted"}); }
  return json({statusCode:"405",error:"MethodNotAllowed",message:"Method not allowed"},405);
}

function isAdminRole(user) { return isTopRole(user); }

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
    if (path === "/app-build.json") return json({ok:true,appVersion:APP_VERSION,service:SERVICE_NAME,architecture:"worker+d1+r2+assets",workflow:"v3.1-field-pr-qc-ati"});
    if (path === "/api/health") return diagnostics(env);
    if (path === "/api/auth/login" && request.method === "POST") return loginHandler(request,env);

    const auth = await authenticate(request,env);
    if (path === "/api/auth/me" || path === "/api/access/session") {
      if (!auth.ok) return authFailure(auth);
      return json({ok:true,user:auth.user,username:auth.user.username,email:auth.user.email||"",access:buildAccess(auth.user),landing_route:"/"});
    }
    if (path === "/api/auth/logout" && (request.method === "POST" || request.method === "GET")) return logoutHandler(request,env,auth);
    if ((path.startsWith("/api/") || path.startsWith("/rest/") || path.startsWith("/storage/")) && !auth.ok) return authFailure(auth);

    if (path === "/api/auth/change-password" && request.method === "POST") return changePasswordHandler(request,env,auth);
    if (path === "/api/diagnostics") return isTopRole(auth.user) ? diagnostics(env) : json({ok:false,message:"Diagnostics hanya untuk Administrator/Direktur/Head Unit Bisnis."},403);
    if (path === "/api/employees" && request.method === "GET") return json({ok:true,employees:await listEmployees(env)});
    if (path === "/api/dashboard" && request.method === "GET") return dashboardHandler(env,auth.user);
    if (path === "/api/audit" && request.method === "GET") return buildAccess(auth.user).capabilities.audit ? auditHandler(env,url) : json({ok:false,message:"Role ini tidak memiliki akses Audit Log."},403);

    // Workflow endpoints: status changes are performed here so field users cannot skip gates.
    if (path === "/api/qc/sync-rab" && request.method === "POST") {
      if (!buildAccess(auth.user).capabilities.qcSyncRab) return json({ok:false,message:"Role ini tidak dapat sinkron item QC dari RAB."},403);
      const body=await parseJson(request)||{}; const projectId=String(body.projectId||"").trim();
      if(!projectId) return json({ok:false,message:"Project wajib dipilih."},400);
      return json({ok:true,...await syncQcFromRab(env,auth.user,projectId)});
    }
    if (path === "/api/qc/inspect" && request.method === "POST") return qcInspectHandler(request,env,auth.user);
    const qcFindingAction = path.match(/^\/api\/qc\/findings\/([^/]+)\/action$/);
    if (qcFindingAction && request.method === "POST") return qcFindingActionHandler(request,env,auth.user,decodeURIComponent(qcFindingAction[1]));

    const ccoAction = path.match(/^\/api\/cco\/([^/]+)\/action$/);
    if (ccoAction && request.method === "POST") return ccoActionHandler(request,env,auth.user,decodeURIComponent(ccoAction[1]));
    const payAction = path.match(/^\/api\/payment-requests\/([^/]+)\/action$/);
    if (payAction && request.method === "POST") return paymentRequestActionHandler(request,env,auth.user,decodeURIComponent(payAction[1]));
    const prAction = path.match(/^\/api\/procurement\/([^/]+)\/action$/);
    if (prAction && request.method === "POST") return procurementActionHandler(request,env,auth.user,decodeURIComponent(prAction[1]));

    // Documents are project records too and obey role access.
    if (path === "/api/documents" && request.method === "GET") {
      if (collectionDenied(auth.user,"project_documents","read")) return json({ok:false,message:"Akses dokumen ditolak."},403);
      return listDocuments(env,url,auth.user);
    }
    if (path === "/api/documents" && request.method === "POST") {
      if (collectionDenied(auth.user,"project_documents","create")) return json({ok:false,message:"Role ini tidak dapat upload dokumen."},403);
      return uploadDocument(request,env,auth.user);
    }
    const docFileMatch = path.match(/^\/api\/documents\/([^/]+)\/file$/);
    if (docFileMatch && request.method === "GET") {
      if (collectionDenied(auth.user,"project_documents","read")) return json({ok:false,message:"Akses dokumen ditolak."},403);
      return downloadDocument(env,auth.user,decodeURIComponent(docFileMatch[1]));
    }
    const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch && (request.method === "PUT" || request.method === "PATCH")) {
      if (collectionDenied(auth.user,"project_documents","update")) return json({ok:false,message:"Role ini tidak dapat edit dokumen."},403);
      return updateDocument(request,env,auth.user,decodeURIComponent(docMatch[1]));
    }
    if (docMatch && request.method === "DELETE") {
      if (collectionDenied(auth.user,"project_documents","delete")) return json({ok:false,message:"Role ini tidak dapat hapus dokumen."},403);
      return deleteDocument(env,auth.user,decodeURIComponent(docMatch[1]));
    }

    const flowMatch = path.match(/^\/api\/projects\/([^/]+)\/flow$/);
    if (flowMatch && request.method === "GET") return projectFlow(env,auth.user,decodeURIComponent(flowMatch[1]));
    const syncMatch = path.match(/^\/api\/projects\/([^/]+)\/sync-status$/);
    if (syncMatch && request.method === "POST") {
      if (!isAdminProjectRole(auth.user)) return json({ok:false,message:"Sync status proyek hanya untuk Admin/Manajemen."},403);
      return syncProjectStatus(env,auth.user,decodeURIComponent(syncMatch[1]));
    }

    const recordsRoot = path.match(/^\/api\/records\/([^/]+)$/);
    if (recordsRoot) {
      const collection = safeCollection(decodeURIComponent(recordsRoot[1]));
      if (!collection) return json({ok:false,message:"Collection tidak dikenal."},404);
      if (request.method === "GET") {
        if (collectionDenied(auth.user,collection,"read")) return json({ok:false,message:`Role ${auth.user.role || ""} tidak memiliki akses membaca ${collection}.`},403);
        return json({ok:true,rows:await listRecords(env,collection,url,auth.user)});
      }
      if (request.method === "POST") {
        if (collectionDenied(auth.user,collection,"create")) return json({ok:false,message:`Role ${auth.user.role || ""} tidak dapat menambah ${collection}.`},403);
        if (collection === "qc_inspections") return json({ok:false,message:"QC Inspection wajib melalui form inspeksi dengan upload bukti."},409);
        const body = await parseJson(request);
        if (!body) return json({ok:false,message:"JSON tidak valid."},400);
        let data={...(body.data || body)};
        try { data=await normalizeOperationalResponsibility(env,collection,data); } catch(e) { return json({ok:false,message:e.message},400); }
        if (collection === "procurement") data=normalizePrArrays(data);
        const targetProjectId = recordProjectId(collection,body.id || "",data);
        if (targetProjectId) { const denied = await requireProjectAccess(env,auth.user,targetProjectId); if (denied) return denied; }
        if (collection === "cco") data.status="DRAFT";
        if (collection === "payment_requests") { data.status="DRAFT"; data.requesterUserId=auth.user.id; }
        if (collection === "procurement") { const assignedPm=await projectAssignment(env,data.projectId,"pm"); if(!assignedPm) return json({ok:false,message:"Proyek belum memiliki Project Manager. Tetapkan PM sebelum membuat PR."},400); data.status="DRAFT"; data.requesterUserId=assignedPm; data.projectManagerUserId=assignedPm; data.totalHpp=(data.items||[]).reduce((a,x)=>a+num(x.totalHpp),0); }
        if (collection === "defects") { data.status="OPEN"; data.picUserId=data.picUserId || await projectAssignment(env,data.projectId,"pelaksana"); }
        const rec = await upsertRecord(env,collection,body.id || null,data,auth.user);
        await afterRecordUpsert(env,collection,rec,auth.user);
        return json({ok:true,row:rec},201);
      }
    }

    const recordOne = path.match(/^\/api\/records\/([^/]+)\/([^/]+)$/);
    if (recordOne) {
      const collection = safeCollection(decodeURIComponent(recordOne[1]));
      const id = decodeURIComponent(recordOne[2]);
      if (!collection) return json({ok:false,message:"Collection tidak dikenal."},404);
      if (request.method === "GET") {
        if (collectionDenied(auth.user,collection,"read")) return json({ok:false,message:"Akses data ditolak."},403);
        const rec = await getRecord(env,collection,id);
        if (!rec) return json({ok:false,message:"Data tidak ditemukan."},404);
        if (!(await recordAllowedByProjectScope(env,auth.user,collection,id,rec.data))) return json({ok:false,message:"Anda tidak ditugaskan pada proyek data ini."},403);
        return json({ok:true,row:rec});
      }
      if (request.method === "PUT" || request.method === "PATCH") {
        if (collectionDenied(auth.user,collection,"update")) return json({ok:false,message:`Role ${auth.user.role || ""} tidak dapat mengubah ${collection}.`},403);
        if (collection === "qc_inspections") return json({ok:false,message:"QC Inspection merupakan log inspeksi. Buat inspeksi ulang, jangan mengubah bukti lama."},409);
        const body = await parseJson(request);
        if (!body) return json({ok:false,message:"JSON tidak valid."},400);
        let data={...(body.data || body)};
        const old=await getRecord(env,collection,id);
        if (!old) return json({ok:false,message:"Data tidak ditemukan."},404);
        if (!(await recordAllowedByProjectScope(env,auth.user,collection,id,old.data))) return json({ok:false,message:"Anda tidak ditugaskan pada proyek data ini."},403);
        const mergedProjectId = recordProjectId(collection,id,{...old.data,...data});
        if (mergedProjectId) { const denied = await requireProjectAccess(env,auth.user,mergedProjectId); if (denied) return denied; }
        try { data=await normalizeOperationalResponsibility(env,collection,{...old.data,...data}); } catch(e) { return json({ok:false,message:e.message},400); }
        if (collection === "procurement") data=normalizePrArrays({...old.data,...data});
        const roleKey=normalizeRole(auth.user);
        if (collection === "payment_requests") {
          if (!["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik","finance"].includes(roleKey)) {
            if (old.data.requesterUserId && old.data.requesterUserId !== auth.user.id) return json({ok:false,message:"Anda hanya dapat mengedit pengajuan dana milik Anda sendiri."},403);
            if (!["DRAFT","REJECTED"].includes(String(old.data.status||"DRAFT").toUpperCase())) return json({ok:false,message:"Pengajuan yang sudah diproses tidak dapat diedit oleh pengaju."},409);
          }
          // Identitas pengaju tidak boleh dipindahkan ke karyawan lain saat edit.
          data.requesterUserId=old.data.requesterUserId || auth.user.id;
        }
        if (collection === "cco" && ["project_manager","pelaksana_lapangan"].includes(roleKey)) {
          if (old.data.requestedByUserId && old.data.requestedByUserId !== auth.user.id) return json({ok:false,message:"Anda hanya dapat mengedit CCO yang Anda ajukan."},403);
          if (!["DRAFT","RETURNED_TO_FIELD"].includes(String(old.data.status||"DRAFT").toUpperCase())) return json({ok:false,message:"CCO yang sudah masuk proses Admin/QS tidak dapat diedit oleh lapangan."},409);
        }
        if (collection === "procurement") {
          const st=String(old.data.status||"DRAFT").toUpperCase();
          const fieldRole=["project_manager","pelaksana_lapangan"].includes(roleKey);
          if (fieldRole && old.data.requesterUserId && old.data.requesterUserId !== auth.user.id) return json({ok:false,message:"PR ini menjadi tanggung jawab Project Manager proyek."},403);
          if (fieldRole && !["DRAFT","REJECTED"].includes(st)) return json({ok:false,message:"PR yang sudah diajukan hanya dapat dilengkapi Procurement/Manajemen."},409);
          if (!["DRAFT","REJECTED","SUBMITTED"].includes(st) && !isManagementRole(auth.user)) return json({ok:false,message:"PR yang sudah dipilih vendornya tidak dapat diedit pada tahap ini."},409);
          const assignedPm=await projectAssignment(env,data.projectId || old.data.projectId,"pm");
          if(!assignedPm) return json({ok:false,message:"Proyek belum memiliki Project Manager. Tetapkan PM sebelum mengubah PR."},400);
          data.requesterUserId=assignedPm; data.projectManagerUserId=assignedPm;
        }
        // Critical workflow statuses cannot be edited manually; use the action endpoints above.
        if (["cco","payment_requests","procurement"].includes(collection)) data.status=old.data.status || data.status || "DRAFT";
        const rec = await upsertRecord(env,collection,id,{...old.data,...data},auth.user);
        await afterRecordUpsert(env,collection,rec,auth.user);
        return json({ok:true,row:rec});
      }
      if (request.method === "DELETE") {
        if (collectionDenied(auth.user,collection,"delete")) return json({ok:false,message:`Role ${auth.user.role || ""} tidak dapat menghapus ${collection}.`},403);
        const old = await getRecord(env,collection,id);
        if (old && !(await recordAllowedByProjectScope(env,auth.user,collection,id,old.data))) return json({ok:false,message:"Anda tidak ditugaskan pada proyek data ini."},403);
        const ok = await deleteRecord(env,collection,id,auth.user);
        return ok ? json({ok:true}) : json({ok:false,message:"Data tidak ditemukan."},404);
      }
    }

    // Backward compatibility. Still protected by the same RBAC rules.
    const legacy = path.match(/^\/rest\/v1\/([^/]+)$/);
    if (legacy) {
      const collection = safeCollection(decodeURIComponent(legacy[1]));
      if (!collection) return json({message:"Unknown table"},404);
      if (request.method === "GET") {
        if (collectionDenied(auth.user,collection,"read")) return json({message:"Forbidden"},403);
        return json(await listRecords(env,collection,url,auth.user),200,{"content-range":"0-*/ *"});
      }
      if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
        const action=request.method==="POST"?"create":"update";
        if (collectionDenied(auth.user,collection,action)) return json({message:"Forbidden"},403);
        const body = await parseJson(request); if (!body) return json({message:"Invalid JSON"},400);
        const list = Array.isArray(body) ? body : [body];
        for (const row of list) {
          let payload = {...(row.data ?? row)};
          const pid = recordProjectId(collection,row.id,payload);
          if (pid && !(await userCanAccessProject(env,auth.user,pid))) return json({message:"Forbidden: project scope"},403);
          try { payload=await normalizeOperationalResponsibility(env,collection,payload); } catch(e) { return json({message:e.message},400); }
          if (collection === "procurement") {
            payload=normalizePrArrays(payload);
            const assignedPm=await projectAssignment(env,payload.projectId,"pm");
            if(!assignedPm) return json({message:"Proyek belum memiliki Project Manager. Tetapkan PM sebelum membuat PR."},400);
            payload.requesterUserId=assignedPm; payload.projectManagerUserId=assignedPm;
          }
          if (collection === "payment_requests") payload.requesterUserId=auth.user.id;
          const rec=await upsertRecord(env,collection,row.id,payload,auth.user); await afterRecordUpsert(env,collection,rec,auth.user);
        }
        return json(null,201);
      }
      if (request.method === "DELETE") {
        if (collectionDenied(auth.user,collection,"delete")) return json({message:"Forbidden"},403);
        const raw = url.searchParams.get("id") || ""; const m = raw.match(/^eq\.(.+)$/);
        if (m) {
          const old = await getRecord(env,collection,m[1]);
          if (old && !(await recordAllowedByProjectScope(env,auth.user,collection,m[1],old.data))) return json({message:"Forbidden: project scope"},403);
          await deleteRecord(env,collection,m[1],auth.user);
        }
        return new Response(null,{status:204});
      }
    }

    if (path.startsWith("/storage/v1/object/")) {
      if (request.method === "GET" || request.method === "HEAD") {
        if (collectionDenied(auth.user,"project_documents","read")) return json({message:"Forbidden"},403);
      } else if (collectionDenied(auth.user,"project_documents","create")) return json({message:"Forbidden"},403);
      return legacyStorageHandler(request,env,url,auth.user);
    }
    if (path.startsWith("/auth/v1/")) return json({message:"Authentication is handled by KENDALI."},404);

    return serveAssets(request,env);
  }
};
