/**
 * Nara System V3.4.29 — Pindah jenis mitra (Toko/Vendor/Subkon/Reimburse)
 * Cloudflare Worker + D1 + R2 + Static Assets
 */

const APP_VERSION = "APP-V3.4.29";
const SERVICE_NAME = "Nara System";
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

const COLLECTIONS = new Set(["partners","project_terms","partner_payments","projects","users","rabs","surat","tukang","pelatihan","aset","proyeksi","vendor","po","project_budget","cash_in","cash_out","receivables","payables","payment_requests","daily_progress","weekly_progress","opname","qc_inspections","defects","cco","approvals","milestones","retention","closeout","project_documents","issues","schedule","procurement","qc_work_items","qc_inspection_sessions","qc_inspection_items","qc_work_groups","daily_workers","qc_actions","qc_verifications","ati_assessments","ati_work_requests","ati_field_issues","ati_issue_evaluations","public_project_settings","public_updates","public_site_settings","public_portfolio","qc_reports","ati_reports","workflow_tasks","as_built_progress","qc_visit_routes"]);

const PROJECT_SCOPED_COLLECTIONS = new Set(["project_terms","partner_payments","projects","rabs","po","project_budget","cash_in","cash_out","receivables","payables","payment_requests","daily_progress","weekly_progress","opname","qc_inspections","defects","cco","approvals","milestones","retention","closeout","project_documents","issues","schedule","procurement","as_built_progress","qc_work_items","qc_inspection_sessions","qc_inspection_items","daily_workers","qc_actions","qc_verifications","ati_assessments","ati_work_requests","ati_field_issues","ati_issue_evaluations","public_project_settings","public_updates","workflow_tasks","qc_visit_routes"]);

const DOC_CORE = ["CONTRACT", "RAB_BASELINE", "DED_FINAL", "TIME_SCHEDULE"];
const DOC_PRECON = ["PCM", "MC0"];
const DOC_PHO = ["PHO_BAST", "AS_BUILT"];
const DOC_FHO = ["FHO_BAST"];
const DOC_FIN = ["FINAL_RECONCILIATION"];


const ROLE_LABELS = {
  administrator: "Administrator",
  direktur: "Direktur",
  head_unit_bisnis: "Head Unit Bisnis",
  manager_operasional: "Head of Operational",
  koordinator_engineering: "Head of Engineering",
  koordinator_supporting: "Head of Supporting",
  admin_teknik: "Admin Teknik",
  site_manager: "Site Manager",
  estimator: "Estimator",
  qs: "QS / Quantity Surveyor",
  drafter: "Drafter / BIM",
  qc: "QC",
  mep_engineer: "MEP Engineer",
  finance: "Finance",
  procurement: "Admin Logistik",
  kepala_ati: "Kepala ATI",
  instruktur_ati: "Instruktur ATI",
  viewer: "Viewer"
};

const ALL_VIEWS = ["dashboard","tasks","projects","finance","payments","directory","fund_requests","progress","opname","asbuilt","qc","qc_archive","cco","procurement","ati","documents","flow","closeout","public_info","employees","master","audit"];
const ROLE_VIEWS = {
  administrator: ALL_VIEWS,
  direktur: ALL_VIEWS,
  head_unit_bisnis: ALL_VIEWS,
  manager_operasional: ["dashboard","tasks","projects","finance","payments","directory","fund_requests","progress","opname","asbuilt","qc","qc_archive","cco","procurement","ati","documents","flow","closeout","public_info","master","audit"],
  koordinator_engineering: ["dashboard","tasks","projects","progress","opname","asbuilt","qc","cco","procurement","documents","flow","closeout"],
  koordinator_supporting: ["dashboard","tasks","projects","progress","qc","qc_archive","documents","flow","closeout"],
  admin_teknik: ["dashboard","tasks","projects","finance","payments","directory","fund_requests","progress","opname","asbuilt","qc","qc_archive","cco","procurement","ati","documents","flow","closeout","public_info","master"],
  site_manager: ["dashboard","tasks","projects","payments","directory","fund_requests","progress","opname","asbuilt","qc","cco","procurement","ati","documents","flow","closeout"],
  estimator: ["dashboard","tasks","projects","cco","documents","flow"],
  qs: ["dashboard","tasks","projects","fund_requests","progress","opname","cco","documents","flow"],
  drafter: ["dashboard","tasks","projects","asbuilt","documents","flow"],
  qc: ["dashboard","tasks","projects","fund_requests","progress","qc","qc_archive","documents","flow"],
  mep_engineer: ["dashboard","tasks","projects","progress","qc","documents","flow"],
  finance: ["dashboard","tasks","projects","finance","payments","directory","fund_requests","procurement","documents","flow","closeout"],
  procurement: ["dashboard","tasks","projects","payments","directory","fund_requests","procurement","documents","flow"],
  kepala_ati: ["dashboard","tasks","ati","progress","master"],
  instruktur_ati: ["dashboard","tasks","ati","master"],
  viewer: ["dashboard","projects","documents","flow"]
};

function normalizeRole(input) {
  const candidates = typeof input === "string"
    ? [input]
    : [input?.position, input?.jabatan, input?.role, input?.roleKey].filter(Boolean);
  const aliases = new Map([
    ["admin","administrator"],["administrator","administrator"],["superadmin","administrator"],["super admin","administrator"],
    ["direktur","direktur"],["director","direktur"],["ceo","direktur"],
    ["head unit bisnis","head_unit_bisnis"],["head bu","head_unit_bisnis"],["head unit","head_unit_bisnis"],
    ["head of operational","manager_operasional"],["head operational","manager_operasional"],["head operasional","manager_operasional"],["manager operasional","manager_operasional"],["manajer operasional","manager_operasional"],["spv operasional","manager_operasional"],
    ["head of engineering","koordinator_engineering"],["head engineering","koordinator_engineering"],["koordinator engineering","koordinator_engineering"],["coordinator engineering","koordinator_engineering"],
    ["head of supporting","koordinator_supporting"],["head supporting","koordinator_supporting"],["koordinator supporting","koordinator_supporting"],["coordinator supporting","koordinator_supporting"],
    ["admin teknik","admin_teknik"],["administrasi teknik","admin_teknik"],["administrasi proyek","admin_teknik"],
    // V3.4.17: Project Manager dan Pelaksana Lapangan dilebur menjadi Site Manager (langsung di bawah Head of Operational).
    ["site manager","site_manager"],["sm","site_manager"],["site_manager","site_manager"],
    ["project manager","site_manager"],["pm","site_manager"],["project manager","site_manager"],
    ["project manager superintendent","site_manager"],["project manager / superintendent","site_manager"],["superintendent / project manager","site_manager"],["pm / superintendent","site_manager"],
    ["project manager (superintendent)","site_manager"],["superintendent","site_manager"],["site superintendent","site_manager"],["superindtent","site_manager"],
    ["pelaksana lapangan","site_manager"],["pelaksana","site_manager"],
    ["pengawas","site_manager"],["pengawas lapangan","site_manager"],["site supervisor","site_manager"],
    ["estimator","estimator"],["senior estimator","estimator"],
    ["drafter","drafter"],["bim","drafter"],["bim / bim modeller","drafter"],["bim / bim modeler","drafter"],["bim modeller","drafter"],["bim modeler","drafter"],
    ["quantity surveyor","qs"],["qs / quantity surveyor","qs"],["qs","qs"],
    ["quality control","qc"],["qc / quality control","qc"],["qc","qc"],["senior qc","qc"],["qc arsitektur","qc"],["qc interior","qc"],["qc mep","qc"],
    ["mep engineer","mep_engineer"],["engineer mep","mep_engineer"],
    ["finance","finance"],["keuangan","finance"],["finance officer","finance"],
    ["logistik","procurement"],["admin logistik","procurement"],["admin logistic","procurement"],["staff logistik","procurement"],["staf logistik","procurement"],["manager logistik","procurement"],["logistik / procurement","procurement"],["procurement","procurement"],["procurement / purchasing","procurement"],["purchasing","procurement"],["logistik procurement","procurement"],
    ["kepala ati","kepala_ati"],["head ati","kepala_ati"],["manager ati","kepala_ati"],
    ["instruktur ati","instruktur_ati"],["instruktur","instruktur_ati"],["trainer ati","instruktur_ati"],
    ["viewer","viewer"]
  ]);
  for (const raw of candidates) {
    const s = String(raw || "").trim().toLowerCase().replace(/[._-]+/g," ").replace(/\s*\/\s*/g," / ").replace(/\s+/g," ");
    if (ROLE_LABELS[s]) return s;
    const mapped = aliases.get(s);
    if (mapped) return mapped;
  }
  return "viewer";
}

function roleIn(user, roles) { return roles.includes(normalizeRole(user)); }
function isTopRole(user) { return roleIn(user,["administrator","direktur","head_unit_bisnis"]); }
function isManagementRole(user) { return roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]); }
function isAdminProjectRole(user) { return roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]); }

// Field penugasan Site Manager pada Master Proyek. Field pm*/sm* lama dibaca untuk kompatibilitas data.
const SITE_MANAGER_FIELDS = ["siteManagerUserId","pmUserId","projectManagerUserId","smUserId","siteManagerUsername","pmUsername","projectManagerUsername","smUsername"];
function projectSiteManagerId(d={}) {
  for (const k of ["siteManagerUserId","pmUserId","projectManagerUserId","smUserId"]) if (String(d?.[k]||"").trim()) return String(d[k]).trim();
  return "";
}

function isProjectScopedRole(user) {
  return roleIn(user,["site_manager"]);
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
  return SITE_MANAGER_FIELDS.some(k=>sameUserRef(d[k],user));
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
  const projectId = recordProjectId(collection,id,data);
  if (normalizeRole(user)==="drafter" && collection==="as_built_progress") {
    if(!projectId) return false;
    const assigned=await projectAssignment(env,projectId,"drafter");
    return String(assigned||"")===String(user.id||"");
  }
  if (!isProjectScopedRole(user)) return true;
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
  const allow = (readRoles=[], writeRoles=[], deleteRoles=[]) => ({
    read:readRoles.includes(role), create:writeRoles.includes(role), update:writeRoles.includes(role), delete:deleteRoles.includes(role)
  });
  if (collection === "workflow_tasks") return allow([],[],[]);
  // Temuan QC: hanya QC & Head of Supporting (dan Administrator sistem) yang boleh membuat/mengubah/menghapus. Site Manager hanya mengirim foto perbaikan lewat alur tindak lanjut.
  if (collection === "defects") return allow(["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","qc","mep_engineer"],["administrator","koordinator_supporting","qc"],["administrator","koordinator_supporting","qc"]);
  const top = ["administrator","direktur","head_unit_bisnis"].includes(role);
  if (top) return {read:true,create:true,update:true,delete:true};
  const projectReaders=["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","estimator","qs","drafter","qc","mep_engineer","finance","procurement","viewer"];
  const projectOps=["manager_operasional","koordinator_engineering","admin_teknik","site_manager"];
  const fieldReaders=["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","estimator","qs","qc","mep_engineer"];

  if (collection === "users") return allow();
  if (["public_project_settings","public_updates","public_site_settings","public_portfolio"].includes(collection)) return allow(["manager_operasional","admin_teknik"],["manager_operasional","admin_teknik"],["manager_operasional","admin_teknik"]);
  if (collection === "qc_reports") return allow(["manager_operasional","koordinator_supporting","admin_teknik","qc"],[],[]);
  if (collection === "ati_reports") return allow(["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],[],[]);
  if (collection === "projects") return allow([...projectReaders,"kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik"]); // ATI perlu nama proyek (baca saja)
  if (["cash_in","cash_out","receivables","payables"].includes(collection)) return allow(["finance","manager_operasional","admin_teknik"],["finance"]);
  if (collection === "project_budget") return allow(["finance","manager_operasional","koordinator_engineering","admin_teknik","estimator","qs","site_manager"],["finance","estimator","qs","manager_operasional","koordinator_engineering","admin_teknik"]);
  if (collection === "payment_requests") return allow(["finance","manager_operasional","admin_teknik","site_manager","qs","qc","procurement"],["finance","manager_operasional","admin_teknik","site_manager","qs","qc","procurement"],["finance","manager_operasional"]);
  if (["daily_progress","weekly_progress","schedule","milestones","issues"].includes(collection)) return allow(fieldReaders,projectOps);
  if (collection === "daily_workers") return allow(["manager_operasional","admin_teknik","site_manager","finance","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","site_manager"],["manager_operasional","admin_teknik","site_manager"]);
  if (["qc_actions","qc_verifications"].includes(collection)) return allow(["manager_operasional","koordinator_supporting","admin_teknik","site_manager","qc"],[],[]);
  if (collection === "ati_assessments") return allow(["manager_operasional","admin_teknik","site_manager","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "ati_work_requests") return allow(["manager_operasional","admin_teknik","site_manager","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","site_manager","kepala_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "ati_field_issues") return allow(["manager_operasional","admin_teknik","site_manager","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","site_manager","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "ati_issue_evaluations") return allow(["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati","instruktur_ati"],["manager_operasional","admin_teknik","kepala_ati"]);
  if (collection === "opname") return allow(["manager_operasional","koordinator_engineering","admin_teknik","site_manager","qs"],["manager_operasional","koordinator_engineering","admin_teknik","qs"]);
  if (collection === "as_built_progress") return allow(["manager_operasional","koordinator_engineering","admin_teknik","site_manager","drafter"],["koordinator_engineering","admin_teknik","drafter"],["koordinator_engineering","admin_teknik"]);
  if (collection === "qc_work_items") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","qc","mep_engineer"],["manager_operasional","koordinator_supporting","qc"],["manager_operasional","koordinator_supporting","qc"]);
  if (collection === "qc_work_groups") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","qc","mep_engineer"],["manager_operasional","koordinator_supporting","admin_teknik","qc"],["manager_operasional","koordinator_supporting"]);
  if (collection === "qc_visit_routes") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","qc","mep_engineer"],["manager_operasional","koordinator_supporting","qc"],["manager_operasional","koordinator_supporting","qc"]);
  if (collection === "qc_inspection_sessions") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","qc","mep_engineer"],[],[]);
  if (collection === "qc_inspection_items") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","qc","mep_engineer"],[],[]);
  if (collection === "qc_inspections") return allow(["manager_operasional","koordinator_supporting","admin_teknik","site_manager","qs","qc"],["manager_operasional","koordinator_supporting","qc"],["manager_operasional","koordinator_supporting","qc"]);
  if (collection === "cco") return allow(["manager_operasional","koordinator_engineering","admin_teknik","site_manager","estimator","qs"],["manager_operasional","koordinator_engineering","admin_teknik","qs","site_manager"],["manager_operasional"]);
  if (collection === "approvals") return allow(["manager_operasional","admin_teknik","finance"],["manager_operasional","admin_teknik","finance"]);
  if (collection === "procurement") return allow(["manager_operasional","koordinator_engineering","admin_teknik","site_manager","procurement","finance"],["manager_operasional","admin_teknik","site_manager","procurement"]);
  // V3.4.24 — Keuangan proyek
  if (collection === "partners") return allow(["manager_operasional","admin_teknik","site_manager","procurement","finance","koordinator_engineering"],["manager_operasional","admin_teknik","site_manager","procurement","finance"],["manager_operasional","finance"]);
  if (collection === "project_terms") return allow(["manager_operasional","admin_teknik","finance","site_manager"],["manager_operasional","admin_teknik"],["manager_operasional","admin_teknik"]);
  if (collection === "partner_payments") return allow(["manager_operasional","admin_teknik","site_manager","procurement","finance"],[],[]);
  if (collection === "po") return allow(["manager_operasional","admin_teknik","site_manager","procurement","finance"],["manager_operasional","admin_teknik","procurement","finance"]);
  if (collection === "project_documents") return allow(projectReaders,["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","qs","drafter","qc","finance","procurement"],["manager_operasional","koordinator_engineering","admin_teknik"]);
  if (["retention","closeout"].includes(collection)) return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager","finance"],["manager_operasional","admin_teknik","finance"]);
  if (collection === "rabs") return allow(["manager_operasional","koordinator_engineering","admin_teknik","site_manager","estimator","qs"],["manager_operasional","koordinator_engineering","admin_teknik","estimator","qs"]);
  if (collection === "surat") return allow(["manager_operasional","admin_teknik"],["manager_operasional","admin_teknik"]);
  if (collection === "vendor") return allow(["manager_operasional","admin_teknik","site_manager","procurement","finance"],["manager_operasional","admin_teknik","procurement","finance"]);
  if (collection === "tukang") return allow(["manager_operasional","admin_teknik","site_manager","finance","kepala_ati","instruktur_ati","procurement"],["manager_operasional","admin_teknik","kepala_ati","site_manager","finance"],["manager_operasional","admin_teknik","kepala_ati"]);
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
    roleLabel: ROLE_LABELS[roleKey] || "Viewer",
    views,
    collections,
    capabilities: {
      manageEmployees: isTopRole(user),
      workflowOversight: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_engineering","koordinator_supporting"]),
      audit: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]),
      qcReportCreate: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting","qc"]),
      atiReportCreate: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","kepala_ati","instruktur_ati"]),
      divisionReportReview: roleIn(user,["administrator","direktur","head_unit_bisnis"]),
      ccoFieldSubmit: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","site_manager"]),
      ccoAdmin: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]),
      ccoQs: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","qs"]),
      ccoEscalation: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]),
      financeApprove: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","finance"]),
      financePay: roleIn(user,["administrator","direktur","head_unit_bisnis","finance"]),
      partnerPaymentCreate: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","site_manager"]),
      partnerPaymentOpsApprove: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional"]),
      partnerPaymentHubApprove: roleIn(user,["administrator","direktur","head_unit_bisnis"]),
      termBill: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]),
      contractManage: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]),
      financeSettings: roleIn(user,["administrator","direktur","head_unit_bisnis"]),
      financeImport: roleIn(user,["administrator","direktur","head_unit_bisnis","finance"]),
      directoryMerge: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","finance"]),
      directoryEdit: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik","site_manager","procurement","finance"]),
      procurementApprove: roleIn(user,["head_unit_bisnis","manager_operasional"]),
      procurementVendorSelect: roleIn(user,["head_unit_bisnis","manager_operasional"]),
      procurementSpkCreate: roleIn(user,["administrator","direktur","head_unit_bisnis","admin_teknik"]),
      procurementOrder: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","site_manager"]),
      projectManagerProcurementAccess: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","site_manager"]),
      projectManagerQcReadAccess: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting","site_manager"]),
      qcInspect: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting","qc"]),
      qcFindingManage: roleIn(user,["administrator","koordinator_supporting","qc"]),
      qcVerify: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting","qc"]),
      qcCloseSession: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting"]),
      qcDeleteSession: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting","qc"]),
      qcRouteManage: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_supporting","qc"]),
      qcDeleteFinding: roleIn(user,["administrator","koordinator_supporting","qc"]),
      atiManage: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik","kepala_ati","instruktur_ati"]),
      managePublicInfo: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"]),
      qcSyncRab: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","koordinator_engineering","koordinator_supporting","qc","qs"]),
      asBuiltApprove: roleIn(user,["administrator","direktur","head_unit_bisnis","koordinator_engineering"]),
      asBuiltEdit: roleIn(user,["administrator","direktur","head_unit_bisnis","koordinator_engineering","admin_teknik","drafter"])
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
    role: u.role || u.jabatan || u.position || "",
    jabatan: u.jabatan || u.position || u.role || "",
    position: u.position || u.jabatan || u.role || "",
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
  if (user && normalizeRole(user)==="drafter" && ["as_built_progress","project_documents"].includes(collection)) {
    const assigned=new Set();
    const projects=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='projects'`).all();
    for(const p of (projects.results||[])){const d=safeJsonParse(p.data_json,{});if(String(d.drafterUserId||"")===String(user.id||""))assigned.add(String(p.id));}
    rows=rows.filter(r=>assigned.has(String(r.data.projectId||"")));
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

async function deleteRelatedDocuments(env,user,relatedCollection,relatedId) {
  const q=await env.DB.prepare(`SELECT id FROM app_records WHERE collection='project_documents' AND json_extract(data_json,'$.relatedCollection')=? AND json_extract(data_json,'$.relatedId')=?`).bind(String(relatedCollection||""),String(relatedId||"")).all();
  for (const r of (q.results||[])) await deleteRecord(env,"project_documents",r.id,user);
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


function progressSeriesFor(projectId, all, project={}) {
  const byDate = new Map();
  const rows = all.filter(r => (r.collection === "daily_progress" || r.collection === "weekly_progress") && String(r.data.projectId || "") === projectId);
  rows.sort((a,b) => String(a.data.date || a.updated_at || "").localeCompare(String(b.data.date || b.updated_at || "")));
  const readOptional = (data,keys) => {
    for (const k of keys) {
      if (data && data[k] !== undefined && data[k] !== null && data[k] !== "") return Math.min(100,Math.max(0,num(data[k])));
    }
    return null;
  };
  const mergePoint = (date,patch,priority=1) => {
    if (!date) return;
    const prev = byDate.get(date) || {date,actual:null,plan:null,actualPriority:0,planPriority:0};
    if (patch.actual !== null && patch.actual !== undefined && priority >= prev.actualPriority) { prev.actual=patch.actual; prev.actualPriority=priority; }
    if (patch.plan !== null && patch.plan !== undefined && priority >= prev.planPriority) { prev.plan=patch.plan; prev.planPriority=priority; }
    byDate.set(date,prev);
  };
  for (const r of rows) {
    const date = String(r.data.date || r.updated_at || "").slice(0,10);
    if (!date) continue;
    const actual = readOptional(r.data,["progress","progressPercent","actualProgress","percent"]);
    const plan = readOptional(r.data,["planProgress","plannedProgress","plan","rencana"]);
    mergePoint(date,{actual,plan},r.collection === "daily_progress" ? 3 : 2);
  }

  // Tambahkan titik awal 0% agar satu input progress tetap terbaca sebagai garis,
  // bukan hanya satu titik. Tanggal awal berasal dari master proyek, bukan asumsi baru.
  const startDate = String(project.startDate || project.start || "").slice(0,10);
  if (startDate) {
    const firstDate = [...byDate.keys()].sort()[0] || "";
    if (!firstDate || startDate < firstDate) mergePoint(startDate,{actual:0,plan:0},1);
  }

  // Jika ada Time Schedule / Kurva-S, bentuk baseline rencana kumulatif dari bobot aktivitas.
  // Nilai plan yang diinput langsung pada progress tetap memiliki prioritas lebih tinggi.
  const schedule = all.filter(r => r.collection === "schedule" && String(r.data.projectId || "") === projectId && num(r.data.weight) > 0 && (r.data.startDate || r.data.endDate));
  if (schedule.length) {
    const dateSet = new Set([...byDate.keys()]);
    for (const r of schedule) {
      const a=String(r.data.startDate||"").slice(0,10), b=String(r.data.endDate||r.data.startDate||"").slice(0,10);
      if(a) dateSet.add(a); if(b) dateSet.add(b);
    }
    const totalWeight=schedule.reduce((sum,r)=>sum+Math.max(0,num(r.data.weight)),0) || 100;
    const plannedAt = date => {
      const t=new Date(`${date}T12:00:00Z`).getTime();
      let weighted=0;
      for(const r of schedule){
        const w=Math.max(0,num(r.data.weight));
        const a=String(r.data.startDate||r.data.endDate||"").slice(0,10), b=String(r.data.endDate||r.data.startDate||"").slice(0,10);
        if(!a||!b) continue;
        const ta=new Date(`${a}T12:00:00Z`).getTime(), tb=new Date(`${b}T12:00:00Z`).getTime();
        let f=0;
        if(t>=tb) f=1; else if(t<=ta) f=0; else if(tb===ta) f=1; else f=(t-ta)/(tb-ta);
        weighted += w*Math.max(0,Math.min(1,f));
      }
      return Math.min(100,Math.max(0,(weighted/totalWeight)*100));
    };
    [...dateSet].sort().forEach(date=>mergePoint(date,{plan:plannedAt(date)},1));
  }

  const endDate = String(project.endDate || project.targetFinish || project.targetDate || "").slice(0,10);
  const hasExplicitOrSchedulePlan = [...byDate.values()].some(p => p.plan !== null);
  if (endDate && hasExplicitOrSchedulePlan) mergePoint(endDate,{plan:100},1);

  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-90).map(({actualPriority,planPriority,...p})=>p);
}

function qcStatusCounts(projectId, all) {
  // V3.4: gunakan Continuous QC Inspection sebagai sumber utama. Legacy checklist tetap fallback.
  const continuousItems=all.filter(r=>r.collection==='qc_inspection_items' && String(r.data.projectId||'')===projectId);
  const sessions=all.filter(r=>r.collection==='qc_inspection_sessions' && String(r.data.projectId||'')===projectId);
  if(continuousItems.length || sessions.length){
    const total=continuousItems.length;
    const nonPass=continuousItems.filter(r=>['TIDAK SESUAI','BUTUH KONFIRMASI'].includes(String(r.data.result||'').toUpperCase())).length; // konfirmasi belum selesai = belum lolos
    return {open:nonPass,nonPass,uninspected:0,total};
  }
  const inspections = all.filter(r => r.collection === "qc_inspections" && String(r.data.projectId || "") === projectId);
  const workItems = all.filter(r => r.collection === "qc_work_items" && String(r.data.projectId || "") === projectId && String(r.data.status || "ACTIVE").toUpperCase() !== "CLOSED");
  const latest = new Map();
  for (const r of inspections) { const key=String(r.data.workItemId||r.data.item||r.id); const stamp=String(r.data.date||r.updated_at||""); const cur=latest.get(key); if(!cur||stamp>cur.stamp) latest.set(key,{stamp,result:String(r.data.result||"").toUpperCase()}); }
  let nonPass=0,uninspected=0;
  if(workItems.length){for(const w of workItems){if(w.data.required===false||String(w.data.required).toLowerCase()==='false')continue;const v=latest.get(String(w.id));if(!v)uninspected++;else if(!['PASS','PASSED'].includes(v.result))nonPass++;}}
  else for(const v of latest.values())if(!['PASS','PASSED'].includes(v.result))nonPass++;
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
  const phoMissing = missing(["PHO_BAST"]);
  const asBuiltRows=all.filter(r=>r.collection==="as_built_progress"&&String(r.data.projectId||"")===String(projectRow.id));
  const asBuiltApproved=asBuiltRows.some(r=>String(r.data.status||"").toUpperCase()==="APPROVED");
  // Backward compatibility: proyek lama tanpa tracker As-Built tetap boleh memakai dokumen AS_BUILT legacy.
  if(asBuiltRows.length ? !asBuiltApproved : !docs.has("AS_BUILT")) phoMissing.push("AS_BUILT");
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
  const cols = ["projects","project_budget","cash_in","cash_out","receivables","payables","payment_requests","approvals","po","daily_progress","weekly_progress","schedule","milestones","issues","qc_work_items","qc_inspections","qc_inspection_sessions","qc_inspection_items","defects","cco","retention","closeout","project_documents","rabs","procurement"];
  const marks = cols.map(()=>"?").join(",");
  const res = await env.DB.prepare(`SELECT collection,id,data_json,updated_at FROM app_records WHERE collection IN (${marks}) ORDER BY updated_at DESC`).bind(...cols).all();
  let rows = (res.results || []).map(r => ({collection:r.collection,id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
  if (user && isProjectScopedRole(user)) {
    const ids = await accessibleProjectIds(env,user);
    rows = rows.filter(r => r.collection === "projects" ? ids.has(String(r.id)) : ids.has(recordProjectId(r.collection,r.id,r.data)));
  }
  return rows;
}

// V3.4.18: kelompokkan data per proyek sekali (O(n)), bukan memfilter seluruh data untuk setiap proyek (O(proyek × n)).
function groupRowsByProject(all) {
  const groups=new Map();
  for (const r of all) { const pid=recordProjectId(r.collection,r.id,r.data); if(!pid) continue; if(!groups.has(pid)) groups.set(pid,[]); groups.get(pid).push(r); }
  return groups;
}
async function dashboardHandler(env,user=null) {
  const all = await loadControlRows(env,user);
  const projects = all.filter(r => r.collection === "projects");
  const groups = groupRowsByProject(all);
  const rows = projects.map(p => { const g=groups.get(String(p.id))||[]; return {...computeProjectMetrics(p,g), evaluatedStatus:evaluateProject(p,g).status, progressSeries:progressSeriesFor(p.id,g,p.data)}; });
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
  if (normalizeRole(user)==="drafter") { const assigned=await projectAssignment(env,projectId,"drafter"); if(String(assigned||"")!==String(user.id||"")) return json({ok:false,message:"Anda bukan Drafter yang ditugaskan pada proyek ini."},403); }
  if (!(file instanceof File)) return json({ok:false,message:"File wajib dipilih."},400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ok:false,message:"Ukuran file maksimal 25 MB."},413);
  const id = crypto.randomUUID();
  const category = String(fd.get("category") || "OTHER").trim().toUpperCase();
  if (normalizeRole(user)==="drafter" && category!=="AS_BUILT") return json({ok:false,message:"Drafter hanya dapat upload dokumen kategori AS_BUILT."},403);
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
  if (normalizeRole(user)==="drafter") { const assigned=await projectAssignment(env,old.data.projectId,"drafter"); if(String(assigned||"")!==String(user.id||"")) return json({ok:false,message:"Anda bukan Drafter yang ditugaskan pada proyek ini."},403); }
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
  if (normalizeRole(user)==="drafter" && String(merged.category||"").toUpperCase()!=="AS_BUILT") return json({ok:false,message:"Drafter hanya dapat mengubah dokumen kategori AS_BUILT."},403);
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
  if (normalizeRole(user)==="drafter") return json({ok:false,message:"Drafter tidak dapat menghapus dokumen proyek; gunakan Ganti File As-Built."},403);
  if (env.FILES && old.data.objectKey) { try { await env.FILES.delete(old.data.objectKey); } catch (_) {} }
  await env.DB.prepare(`DELETE FROM app_records WHERE collection='project_documents' AND id=?`).bind(id).run();
  await audit(env,user,"DELETE_DOCUMENT","project_documents",id,old.data.projectId || "",{title:old.data.title || old.data.originalName || ""});
  return json({ok:true});
}

async function downloadDocument(env,user,id) {
  const old = await getRecord(env,"project_documents",id);
  if (!old) return json({ok:false,message:"Dokumen tidak ditemukan."},404);
  const denied = await requireProjectAccess(env,user,old.data.projectId); if (denied) return denied;
  if (normalizeRole(user)==="drafter") { const assigned=await projectAssignment(env,old.data.projectId,"drafter"); if(String(assigned||"")!==String(user.id||"")) return json({ok:false,message:"Anda bukan Drafter yang ditugaskan pada proyek dokumen ini."},403); }
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


const WORKFLOW_SOURCE_COLLECTIONS = new Set(["daily_progress","weekly_progress","opname","defects","cco","payment_requests","procurement","issues","retention","closeout","ati_work_requests","ati_field_issues","qc_reports","ati_reports","as_built_progress","qc_inspection_items","partner_payments","project_terms"]);

function workflowRoleLabel(role) { return ROLE_LABELS[role] || role || ""; }
function workflowActiveStatus(status) { return ["OPEN","IN_PROGRESS"].includes(String(status||"").toUpperCase()); }
function workflowSourceView(collection) {
  return ({daily_progress:"progress",weekly_progress:"progress",opname:"opname",defects:"qc",cco:"cco",payment_requests:"fund_requests",procurement:"procurement",issues:"progress",retention:"closeout",closeout:"closeout",ati_work_requests:"ati",ati_field_issues:"ati",qc_reports:"qc",ati_reports:"ati",as_built_progress:"asbuilt",qc_inspection_items:"qc",partner_payments:"payments",project_terms:"finance"})[collection] || "dashboard";
}
async function projectRoleUser(env, projectId, roleKey, ctx=null) {
  if (!projectId) return "";
  const p=ctx?.projects ? ctx.projects.get(String(projectId)) : await getRecord(env,"projects",String(projectId)); if(!p) return "";
  if(["site_manager"].includes(roleKey)) return projectSiteManagerId(p.data);
  const map={qs:["qsUserId"],admin_teknik:["adminUserId"],estimator:["estimatorUserId"],drafter:["drafterUserId"],mep_engineer:["mepUserId"]};
  for(const k of (map[roleKey]||[])) if(p.data[k]) return String(p.data[k]);
  return "";
}
async function workflowTaskSpec(env, collection, id, d={}, ctx=null) {
  const status=String(d.status||"DRAFT").toUpperCase();
  const projectId=recordProjectId(collection,id,d);
  const base={projectId,sourceCollection:collection,sourceId:id,targetView:workflowSourceView(collection),priority:"NORMAL",dueDate:String(d.deadline||d.dueDate||d.neededDate||d.releaseDate||"")};
  const sm=projectId?await projectRoleUser(env,projectId,"site_manager",ctx):"";
  const qs=projectId?await projectRoleUser(env,projectId,"qs",ctx):"";
  const mk=(stage,title,waitingFor,actionLabel,assigneeUserId="",assigneeRole="",extra={})=>({...base,stage,title,waitingFor,actionLabel,assigneeUserId:String(assigneeUserId||""),assigneeRole:String(assigneeRole||""),assigneeRoleLabel:workflowRoleLabel(assigneeRole),...extra});
  if(collection==="daily_progress"||collection==="weekly_progress"){
    const label=collection==="daily_progress"?"Laporan Progress Harian":"Laporan Progress Mingguan";
    if(["DRAFT","RETURNED_TO_FIELD"].includes(status)) return mk("PROGRESS_FIELD",label,"Site Manager melengkapi laporan lalu kirim ke Head of Operational","Kirim ke Head of Operational",d.picUserId||sm,"site_manager");
    if(PROGRESS_WAITING_OPERATIONAL.includes(status)) return mk("PROGRESS_OPERATIONAL_REVIEW",label,"Head of Operational memeriksa dan mereview laporan Site Manager","Review Operational","","manager_operasional");
    return null;
  }
  if(collection==="opname"){
    if(["DRAFT","RETURNED_TO_QS"].includes(status)) return mk("OPNAME_QS","Opname / QS", "QS mengisi Volume RAB dan Volume Realisasi pekerjaan","Kirim ke Head of Engineering",d.qsUserId||qs,"qs");
    if(status==="SUBMITTED_TO_ENGINEERING") return mk("OPNAME_ENGINEERING","Review Opname", "Head of Engineering memeriksa opname QS","Verifikasi Opname","","koordinator_engineering");
    if(status==="VERIFIED") return mk("OPNAME_ADMIN_CLOSE","Finalisasi BA Opname", "Admin Teknik memastikan BA/dokumen lengkap lalu menutup opname","Finalisasi & Tutup","","admin_teknik");
    return null;
  }
  if(collection==="as_built_progress"){
    const drafter=projectId?await projectRoleUser(env,projectId,"drafter",ctx):"";
    if(["NOT STARTED","IN PROGRESS","REVISION REQUIRED","DRAFT"].includes(status)) return mk("ASBUILT_DRAFTER","Progress As-Built", "Drafter memperbarui progres Arsitektur/Struktur/MEP dan file As-Built","Update As-Built",d.drafterUserId||drafter,"drafter");
    if(status==="READY FOR APPROVAL") return mk("ASBUILT_ENGINEERING","Review As-Built", "Head of Engineering memeriksa file final As-Built","Approve / Revisi","","koordinator_engineering",{priority:"HIGH"});
    return null;
  }
  if(collection==="defects"){
    if(["OPEN","ON PROGRESS","IN PROGRESS","REVISION REQUIRED"].includes(status)) return mk("QC_PM_FOLLOWUP","Tindak Lanjut Temuan QC", "Site Manager menindaklanjuti temuan dan mengunggah bukti hasil perbaikan","Tindak Lanjut Temuan",d.picUserId||sm,"site_manager",{priority:String(d.severity||"").toUpperCase().includes("KRIT")?"CRITICAL":"HIGH"});
    if(["WAITING QC CHECK","WAITING"].includes(status)) return mk("QC_VERIFY","Verifikasi Perbaikan QC", "Tim QC memeriksa ulang hasil perbaikan","Verifikasi QC","","qc",{priority:"HIGH"});
    return null;
  }
  if(collection==="cco"){
    if(["DRAFT","RETURNED_TO_FIELD","CLIENT_REJECTED"].includes(status)) return mk("CCO_FIELD","Pengajuan CCO", "Pengaju lapangan melengkapi/revisi CCO lalu ajukan ke Admin","Ajukan ke Admin",d.requestedByUserId||sm,"site_manager");
    if(status==="SUBMITTED_TO_ADMIN") return mk("CCO_ADMIN_REVIEW","Review Pengajuan CCO", "Admin Teknik memeriksa lalu meneruskan ke QS","Teruskan ke QS","","admin_teknik");
    if(["SENT_TO_QS","QS_PRICING"].includes(status)) return mk("CCO_QS","RAB CCO", "QS menyusun dan memfinalkan RAB CCO","Finalisasi RAB CCO",d.qsUserId||qs,"qs");
    if(status==="RAB_READY" && num(d.percentOfRab)>10 && !truthy(d.sopEscalationApproved)) return mk("CCO_ESCALATION","Eskalasi CCO >10%", "Head of Operational/Head Unit Bisnis menyetujui eskalasi SOP/SP","Setujui Eskalasi","","manager_operasional",{priority:"HIGH"});
    if(status==="RAB_READY") return mk("CCO_SEND_CLIENT","Kirim CCO ke Client", "Admin Teknik mengirim RAB CCO ke client","Kirim ke Client","","admin_teknik");
    if(status==="SENT_TO_CLIENT") return mk("CCO_CLIENT_FOLLOWUP","Follow Up Keputusan Client", "Admin Teknik menunggu/mencatat keputusan client","Catat Keputusan Client","","admin_teknik");
    if(["CLIENT_APPROVED","ADDENDUM_PROCESS"].includes(status)) return mk("CCO_ADDENDUM","Proses Addendum CCO", "Admin Teknik menyiapkan/upload Addendum final lalu menutup CCO","Proses Addendum","","admin_teknik");
    return null;
  }
  if(collection==="payment_requests"){
    if(["DRAFT","REJECTED"].includes(status)) return mk("FUND_REQUESTER","Pengajuan Dana", "Pengaju melengkapi lalu mengirim pengajuan","Ajukan Dana",d.requesterUserId,"",{priority:"NORMAL"});
    if(status==="PENDING") return mk("FUND_APPROVAL","Approval Pengajuan Dana", "Head of Operational memeriksa kebutuhan dana","Approve / Reject","","manager_operasional");
    if(status==="APPROVED") return mk("FUND_PAY","Pembayaran Pengajuan Dana", "Finance melakukan pembayaran dan input bukti/referensi","Bayar Pengajuan","","finance",{priority:"HIGH"});
    return null;
  }
  if(collection==="procurement"){
    if(["DRAFT","REJECTED"].includes(status)) return mk("PR_PM_REQUEST","Purchase Request Vendor", "Site Manager melengkapi kebutuhan, HPP, dan pembanding vendor lalu mengirim ke Head of Operational","Kirim PR ke Head",sm||d.projectManagerUserId,"site_manager");
    if(status==="SUBMITTED") return mk("PR_PM_VENDOR","Lengkapi Pembanding Vendor", "Site Manager melengkapi penawaran/quotation vendor lalu mengirim ke Head of Operational","Kirim ke Head",sm||d.projectManagerUserId,"site_manager");
    if(status==="READY_FOR_APPROVAL") return mk("PR_APPROVAL","Pilih Vendor PR", "Head of Operational/Head Unit Bisnis memilih dan menyetujui vendor","Pilih Vendor","","manager_operasional",{priority:"HIGH"});
    if(status==="APPROVED") return mk("PR_SPK_ADMIN","Buat SPK / PO Vendor", "Admin Teknik membuat SPK berdasarkan vendor terpilih lalu menambahkannya ke register PO/SPK","Buat SPK / PO","","admin_teknik",{priority:"HIGH"});
    if(status==="SPK_CREATED") return mk("PR_ORDER","Tindak Lanjut Vendor", "Site Manager menindaklanjuti SPK/PO ke vendor dan menandai pekerjaan/pemesanan dimulai","Tandai Ordered",sm||d.projectManagerUserId,"site_manager");
    if(status==="ORDERED") return mk("PR_RECEIVE","Konfirmasi Pekerjaan / Material", "Site Manager mengonfirmasi material/jasa vendor telah diterima atau pekerjaan vendor telah selesai sesuai tahap","Konfirmasi Diterima",sm||d.projectManagerUserId,"site_manager");
    return null;
  }
  if(collection==="issues"){
    if(["OPEN","IN PROGRESS"].includes(status)) return mk("ISSUE_ACTION","Corrective Action", "PIC menyelesaikan tindakan koreksi","Kerjakan Issue",d.picUserId||sm,"site_manager",{priority:"HIGH"});
    if(status==="WAITING") return mk("ISSUE_REVIEW","Review Corrective Action", "Head of Operational memeriksa hasil corrective action Site Manager","Review Issue","","manager_operasional");
    return null;
  }
  if(collection==="retention"){
    if(["OPEN","HOLD"].includes(status)) return mk("RETENTION_MONITOR","Retensi / Masa Pemeliharaan", "PIC memonitor masa retensi sampai siap release","Proses Retensi",d.picUserId,"finance");
    if(status==="RELEASED") return mk("RETENTION_CLOSE","Finalisasi Retensi", "Admin Teknik/Finance menutup administrasi retensi","Tutup Retensi","","admin_teknik");
    return null;
  }
  if(collection==="closeout"){
    if(["OPEN","IN PROGRESS"].includes(status)) return mk("CLOSEOUT_ITEM","Checklist Close-Out", "PIC menyelesaikan checklist penutupan proyek","Selesaikan Checklist",d.ownerUserId,"admin_teknik",{priority:"HIGH"});
    return null;
  }
  if(collection==="ati_work_requests"){
    if(status==="DRAFT") return mk("ATI_REQUESTER","Pengajuan Tenaga ATI", "Pengaju melengkapi kebutuhan tenaga lalu kirim ke ATI","Ajukan ke ATI",d.requestedByUserId||sm,"site_manager");
    if(status==="DIAJUKAN") return mk("ATI_PROCESS","Proses Kebutuhan Tenaga ATI", "Kepala ATI menyiapkan tenaga sesuai skill/jumlah","Proses Pengajuan ATI","","kepala_ati");
    if(status==="DIPROSES") return mk("ATI_FULFILL","Pemenuhan Tenaga ATI", "Kepala ATI/Instruktur memastikan tenaga siap ditempatkan","Tandai Terpenuhi","","kepala_ati");
    if(status==="TERPENUHI") return mk("ATI_CONFIRM","Konfirmasi Penempatan ATI", "Pengaju mengonfirmasi kebutuhan tenaga telah terpenuhi","Selesaikan Pengajuan",d.requestedByUserId||sm,"site_manager");
    return null;
  }
  if(collection==="ati_field_issues"){
    if(["OPEN","IN PROGRESS"].includes(status)) return mk("ATI_ISSUE_ACTION","Masalah Lapangan ATI", "PIC menangani masalah tenaga/operasional ATI","Tangani Masalah",d.picUserId,"kepala_ati",{priority:"HIGH"});
    if(status==="WAITING EVALUATION") return mk("ATI_ISSUE_EVAL","Evaluasi Masalah ATI", "Kepala ATI melakukan evaluasi dan menutup masalah","Evaluasi Masalah","","kepala_ati");
    return null;
  }
  if(collection==="partner_payments"){
    const cat=PAYMENT_CATEGORY_LABEL[d.category]||"Pembayaran"; const who=d.partnerName||(d.category==="TUKANG"?"Tukang":"-");
    const ttl=`Pembayaran ${cat} — ${who}`; const amt=`Rp ${Math.round(num(d.netAmount||d.grossAmount)).toLocaleString("id-ID")}`;
    if(status==="DRAFT") return mk("PAY_DRAFT",ttl,`Lengkapi lalu ajukan pembayaran ${cat} ${amt}.`,"Ajukan",d.requesterUserId||sm,"site_manager");
    if(status==="RETURNED") return mk("PAY_FIX",ttl,`Pengajuan dikembalikan: ${d.returnNote||"perlu perbaikan"}.`,"Perbaiki & Ajukan Ulang",d.requesterUserId||sm,"site_manager",{priority:"HIGH"});
    if(status==="SUBMITTED") return mk("PAY_OPS_APPROVE",ttl,`Head of Operational memeriksa pengajuan ${cat} ${amt}.`,"ACC / Kembalikan","","manager_operasional");
    if(status==="OPS_APPROVED") return mk("PAY_HUB_APPROVE",ttl,`Material di atas batas — Head Unit Bisnis menyetujui ${amt}.`,"ACC / Kembalikan","","head_unit_bisnis");
    if(status==="APPROVED") return mk("PAY_FINANCE",ttl,`Finance memverifikasi dan membayar ${amt}, lalu mengunggah bukti transfer.`,"Verifikasi & Bayar","","finance",{priority:"HIGH"});
    return null;
  }
  if(collection==="project_terms"){
    const ttl=`Termin ${d.label||d.termNo||""} — pemasukan proyek`;
    if(status==="BILLED") return mk("TERM_RECEIVE",ttl,`Termin sudah ditagih (Rp ${Math.round(num(d.netAmount)).toLocaleString("id-ID")}). Finance memverifikasi uang masuk + bukti transfer.`,"Verifikasi Uang Masuk","","finance",{priority:"HIGH"});
    if(status==="RETURNED") return mk("TERM_FIX",ttl,`Finance mengembalikan tagihan termin: ${d.returnNote||"perlu dicek"}.`,"Perbaiki Tagihan","","admin_teknik");
    return null;
  }
  if(collection==="qc_inspection_items"){
    // V3.4.21 — alur Butuh Konfirmasi: QC tanya → Site Manager / Head of Engineering jawab → QC putuskan; lewat batas → Head of Operational.
    if(normalizeContinuousQcResult(d.result)!=="BUTUH KONFIRMASI") return null;
    const st=String(d.confirmStatus||"MENUNGGU_JAWABAN").toUpperCase(); const q=String(d.confirmationNote||d.note||"").slice(0,240);
    const ex={dueDate:String(d.confirmDueDate||""),title:"Konfirmasi QC"};
    if(st==="DIJAWAB") return mk("QC_CONFIRM_DECIDE","Putuskan Hasil Konfirmasi QC",`Jawaban sudah masuk untuk "${d.item||"-"}". QC memutuskan Sesuai atau Tidak sesuai.`,"Putuskan Hasil",d.confirmationRequestedBy||d.inspectorUserId||"","qc",{dueDate:"",priority:"HIGH"});
    if(truthy(d.confirmEscalated)) return mk("QC_CONFIRM_ESCALATED","Eskalasi Konfirmasi QC",`Konfirmasi "${d.item||"-"}" belum dijawab melewati batas waktu. Pertanyaan QC: ${q}`,"Jawab / Tindak Lanjuti","","manager_operasional",{dueDate:ex.dueDate,priority:"HIGH"});
    if(String(d.confirmTarget||"")==="koordinator_engineering") return mk("QC_CONFIRM_ANSWER","Jawab Konfirmasi QC",`QC butuh konfirmasi untuk "${d.item||"-"}": ${q}`,"Jawab Konfirmasi","","koordinator_engineering",{dueDate:ex.dueDate});
    return mk("QC_CONFIRM_ANSWER","Jawab Konfirmasi QC",`QC butuh konfirmasi untuk "${d.item||"-"}": ${q}`,"Jawab Konfirmasi",sm,"site_manager",{dueDate:ex.dueDate});
  }
  if(collection==="qc_reports"||collection==="ati_reports"){
    if(status==="SUBMITTED") return mk(collection==="qc_reports"?"QC_REPORT_REVIEW":"ATI_REPORT_REVIEW",collection==="qc_reports"?"Review Laporan QC":"Review Laporan ATI", "Head Unit Bisnis mereview laporan mingguan/bulanan","Review Laporan","","head_unit_bisnis");
    return null;
  }
  return null;
}

async function activeWorkflowTasksForSource(env, collection, sourceId) {
  const res=await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection='workflow_tasks' AND json_extract(data_json,'$.sourceCollection')=? AND json_extract(data_json,'$.sourceId')=? AND upper(COALESCE(json_extract(data_json,'$.status'),'OPEN')) IN ('OPEN','IN_PROGRESS') ORDER BY updated_at DESC`).bind(collection,String(sourceId)).all();
  return (res.results||[]).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
}
async function syncWorkflowTask(env, collection, sourceId, sourceData, actor=null) {
  if(!WORKFLOW_SOURCE_COLLECTIONS.has(collection)) return;
  const current=await activeWorkflowTasksForSource(env,collection,sourceId);
  const spec=await workflowTaskSpec(env,collection,sourceId,sourceData||{});
  const now=new Date().toISOString();
  const same=spec?current.find(t=>t.data.stage===spec.stage && String(t.data.assigneeUserId||"")===String(spec.assigneeUserId||"") && String(t.data.assigneeRole||"")===String(spec.assigneeRole||"")):null;
  if(same) return; // tahap dan penerima belum berubah; jangan membuat audit/update palsu saat inbox dibuka.
  for(const t of current){
    const done={...t.data,status:"DONE",completedAt:now,completedByUserId:actor?.id||"",completedByName:actor?.name||actor?.username||"Nara System",completionNote:`Tahap berpindah dari ${t.data.stage||""}`};
    await upsertRecord(env,"workflow_tasks",t.id,done,actor||{id:"system",name:"Nara System Workflow",username:"system"});
  }
  if(!spec) return;
  const payload={...spec,status:"OPEN",fromUserId:actor?.id||"",fromUserName:actor?.name||actor?.username||"Nara System",assignedAt:now,startedAt:""};
  const taskId=crypto.randomUUID();
  await upsertRecord(env,"workflow_tasks",taskId,payload,actor||{id:"system",name:"Nara System Workflow",username:"system"});
  // V3.4.19: tugas baru hasil tindakan pengguna → email ke penerima (backfill sistem tidak mengirim email).
  if(actor && actor.id && actor.id!=="system") { try { await enqueueTaskEmails(env,taskId,payload,actor); } catch(e) { console.log("enqueueTaskEmails",e?.message||e); } }
}
async function cancelWorkflowTasks(env, collection, sourceId, actor=null) {
  const current=await activeWorkflowTasksForSource(env,collection,sourceId); const now=new Date().toISOString();
  for(const t of current) await upsertRecord(env,"workflow_tasks",t.id,{...t.data,status:"CANCELLED",completedAt:now,completedByUserId:actor?.id||""},actor||{id:"system",name:"Nara System Workflow",username:"system"});
}
// V3.4.18 — Sinkronisasi Tugas Saya dibuat massal (3 query baca + batch tulis) dan dibatasi frekuensinya.
// Setiap perubahan data sudah memanggil syncWorkflowTask secara langsung; backfill hanya jaring pengaman
// untuk data lama/migrasi, sehingga tidak perlu berjalan setiap kali Tugas Saya dibuka.
const WORKFLOW_BACKFILL_INTERVAL_MS = 10 * 60 * 1000;
const WORKFLOW_BACKFILL_KEY = "workflow_backfill_at";
async function backfillWorkflowTasks(env,user,{force=false}={}) {
  const nowMs=Date.now(); const nowIso=new Date(nowMs).toISOString();
  if(!force){
    try{ const last=await env.DB.prepare(`SELECT value FROM schema_meta WHERE key=?`).bind(WORKFLOW_BACKFILL_KEY).first(); if(last && nowMs-Date.parse(last.value)<WORKFLOW_BACKFILL_INTERVAL_MS) return {skipped:true}; }catch(_){}
  }
  try{ await env.DB.prepare(`INSERT INTO schema_meta(key,value,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(WORKFLOW_BACKFILL_KEY,nowIso).run(); }catch(_){}
  const cols=[...WORKFLOW_SOURCE_COLLECTIONS]; const marks=cols.map(()=>'?').join(',');
  const [src,projects,tasks]=await Promise.all([
    env.DB.prepare(`SELECT collection,id,data_json FROM app_records WHERE collection IN (${marks}) ORDER BY updated_at DESC LIMIT 10000`).bind(...cols).all(),
    env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='projects'`).all(),
    env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='workflow_tasks' AND upper(COALESCE(json_extract(data_json,'$.status'),'OPEN')) IN ('OPEN','IN_PROGRESS')`).all()
  ]);
  const ctx={projects:new Map((projects.results||[]).map(r=>[String(r.id),{id:r.id,data:safeJsonParse(r.data_json,{})}]))};
  const active=new Map();
  for(const r of (tasks.results||[])){ const d=safeJsonParse(r.data_json,{}); const k=`${d.sourceCollection}|${d.sourceId}`; if(!active.has(k)) active.set(k,[]); active.get(k).push({id:r.id,data:d}); }
  const stmts=[]; const actor="Nara System Workflow";
  const put=(id,data)=>stmts.push(env.DB.prepare(`INSERT INTO app_records(collection,id,data_json,updated_at) VALUES('workflow_tasks',?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at`).bind(id,JSON.stringify(data),nowIso));
  for(const r of (src.results||[])){
    const d=safeJsonParse(r.data_json,{}); const current=active.get(`${r.collection}|${r.id}`)||[];
    const spec=await workflowTaskSpec(env,r.collection,r.id,d,ctx);
    const same=spec?current.find(t=>t.data.stage===spec.stage && String(t.data.assigneeUserId||"")===String(spec.assigneeUserId||"") && String(t.data.assigneeRole||"")===String(spec.assigneeRole||"")):null;
    if(same || (!spec && !current.length)) continue;
    for(const t of current) put(t.id,{...t.data,status:"DONE",completedAt:nowIso,completedByUserId:"",completedByName:actor,completionNote:`Tahap berpindah dari ${t.data.stage||""}`,updatedAt:nowIso,updatedBy:actor});
    if(spec) put(crypto.randomUUID(),{...spec,status:"OPEN",fromUserId:"",fromUserName:"Nara System",assignedAt:nowIso,startedAt:"",createdAt:nowIso,createdBy:actor,updatedAt:nowIso,updatedBy:actor});
  }
  for(let k=0;k<stmts.length;k+=100) await env.DB.batch(stmts.slice(k,k+100));
  return {written:stmts.length};
}

function taskVisibleToUser(task,user) {
  const d=task.data||{}; const role=normalizeRole(user);
  return String(d.assigneeUserId||"")===String(user.id||"") || (!d.assigneeUserId && String(d.assigneeRole||"")===role);
}
async function listWorkflowTasks(env,user,url) {
  await backfillWorkflowTasks(env,user,{force:truthy(url.searchParams.get('resync'))});
  const scope=String(url.searchParams.get('scope')||'mine').toLowerCase(); const includeDone=truthy(url.searchParams.get('includeDone')); const projectId=String(url.searchParams.get('projectId')||'');
  if(projectId && !(await userCanAccessProject(env,user,projectId))) return [];
  const res=await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection='workflow_tasks' ORDER BY CASE upper(json_extract(data_json,'$.priority')) WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END, COALESCE(json_extract(data_json,'$.dueDate'),'9999-12-31'), updated_at DESC LIMIT 2000`).all();
  let rows=(res.results||[]).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
  if(projectId) rows=rows.filter(r=>String(r.data.projectId||'')===projectId);
  if(!includeDone) rows=rows.filter(r=>workflowActiveStatus(r.data.status));
  if(scope==='mine') rows=rows.filter(r=>taskVisibleToUser(r,user));
  else if(scope==='team') { if(!buildAccess(user).capabilities.workflowOversight) rows=rows.filter(r=>taskVisibleToUser(r,user)); }
  else if(scope==='project') { /* access already checked by project endpoint */ }
  else rows=rows.filter(r=>taskVisibleToUser(r,user));
  if(isProjectScopedRole(user)){ const ids=await accessibleProjectIds(env,user); rows=rows.filter(r=>!r.data.projectId||ids.has(String(r.data.projectId))); }
  return rows;
}
// V3.4.18 — Hitung badge Tugas Saya dengan satu query ringan (tanpa sinkronisasi).
async function countMyWorkflowTasks(env,user) {
  const role=normalizeRole(user);
  const res=await env.DB.prepare(`SELECT json_extract(data_json,'$.projectId') AS projectId FROM app_records WHERE collection='workflow_tasks' AND upper(COALESCE(json_extract(data_json,'$.status'),'OPEN')) IN ('OPEN','IN_PROGRESS') AND (COALESCE(json_extract(data_json,'$.assigneeUserId'),'')=? OR (COALESCE(json_extract(data_json,'$.assigneeUserId'),'')='' AND COALESCE(json_extract(data_json,'$.assigneeRole'),'')=?))`).bind(String(user.id||""),role).all();
  let rows=res.results||[];
  if(isProjectScopedRole(user)){ const ids=await accessibleProjectIds(env,user); rows=rows.filter(r=>!r.projectId||ids.has(String(r.projectId))); }
  return rows.length;
}
async function taskActionHandler(request,env,user,id){
  const task=await getRecord(env,'workflow_tasks',id); if(!task) return json({ok:false,message:'Tugas tidak ditemukan.'},404);
  if(task.data.projectId){ const denied=await requireProjectAccess(env,user,task.data.projectId); if(denied) return denied; }
  const body=await parseJson(request)||{}; const action=String(body.action||'').toLowerCase(); const d={...task.data}; const role=normalizeRole(user);
  const assignedToMe=String(d.assigneeUserId||'')===String(user.id||''); const roleQueue=!d.assigneeUserId && String(d.assigneeRole||'')===role;
  if(!assignedToMe && !roleQueue && !buildAccess(user).capabilities.workflowOversight) return json({ok:false,message:'Tugas ini bukan untuk Anda.'},403);
  if(action==='claim') { if(!workflowActiveStatus(d.status)) return json({ok:false,message:'Tugas sudah selesai.'},409); d.assigneeUserId=user.id; d.assigneeName=user.name||user.username; d.claimedAt=new Date().toISOString(); }
  else if(action==='start') { if(!workflowActiveStatus(d.status)) return json({ok:false,message:'Tugas sudah selesai.'},409); if(!d.assigneeUserId){d.assigneeUserId=user.id;d.assigneeName=user.name||user.username;d.claimedAt=new Date().toISOString();} d.status='IN_PROGRESS'; d.startedAt=d.startedAt||new Date().toISOString(); }
  else return json({ok:false,message:'Action tugas tidak dikenal. Penyelesaian tugas dilakukan melalui tombol workflow pada modul sumber agar tugas berikutnya otomatis terbentuk.'},400);
  const row=await upsertRecord(env,'workflow_tasks',id,d,user); return json({ok:true,row});
}

// V3.4.17: Site Manager mengirim laporan langsung ke Head of Operational. Status lama SUBMITTED_TO_PM/PM_APPROVED diperlakukan sama.
const PROGRESS_WAITING_OPERATIONAL = ["SUBMITTED_TO_OPERATIONAL","SUBMITTED_TO_PM","PM_APPROVED"];
async function progressWorkflowAction(request,env,user,collection,id){
  if(!['daily_progress','weekly_progress'].includes(collection)) return json({ok:false,message:'Jenis progress tidak valid.'},400);
  const rec=await getRecord(env,collection,id); if(!rec) return json({ok:false,message:'Laporan progress tidak ditemukan.'},404); const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied)return denied;
  const b=await parseJson(request)||{}; const action=String(b.action||'').toLowerCase(); const d={...rec.data}; const old=String(d.status||'DRAFT').toUpperCase(); const role=normalizeRole(user); const sm=await projectRoleUser(env,d.projectId,'site_manager'); const isOps=roleIn(user,['manager_operasional','head_unit_bisnis','administrator','direktur']);
  if(action==='submit'){ if(!['DRAFT','RETURNED_TO_FIELD'].includes(old))return json({ok:false,message:'Laporan tidak dapat dikirim dari status ini.'},409); if(![String(d.picUserId||''),String(sm||'')].includes(String(user.id))&&!isManagementRole(user))return json({ok:false,message:'Hanya Site Manager PIC proyek yang dapat mengirim laporan.'},403); d.status='SUBMITTED_TO_OPERATIONAL';d.submittedAt=new Date().toISOString(); }
  else if(action==='return-field'){ if(!PROGRESS_WAITING_OPERATIONAL.includes(old))return json({ok:false,message:'Status tidak sesuai.'},409); if(!isOps)return json({ok:false,message:'Hanya Head of Operational/Head Unit Bisnis yang dapat mengembalikan laporan ke Site Manager.'},403);d.status='RETURNED_TO_FIELD';d.returnReason=String(b.notes||'Perlu perbaikan laporan'); }
  else if(action==='operational-review'||action==='pm-approve'){ if(!PROGRESS_WAITING_OPERATIONAL.includes(old))return json({ok:false,message:'Laporan belum dikirim Site Manager ke Head of Operational.'},409); if(!isOps)return json({ok:false,message:'Hanya Head of Operational/Head Unit Bisnis yang dapat review laporan.'},403);d.status='REVIEWED';d.operationalReviewedAt=new Date().toISOString();d.operationalReviewedBy=user.id; }
  else return json({ok:false,message:'Action progress tidak dikenal.'},400);
  const row=await upsertRecord(env,collection,id,d,user);await syncWorkflowTask(env,collection,id,d,user);return json({ok:true,row});
}
async function opnameWorkflowAction(request,env,user,id){
  const rec=await getRecord(env,'opname',id);if(!rec)return json({ok:false,message:'Opname tidak ditemukan.'},404);const denied=await requireProjectAccess(env,user,rec.data.projectId);if(denied)return denied;
  const b=await parseJson(request)||{};const action=String(b.action||'').toLowerCase();const d={...rec.data};const old=String(d.status||'DRAFT').toUpperCase();const role=normalizeRole(user);
  if(action==='submit'){if(!['DRAFT','RETURNED_TO_QS'].includes(old))return json({ok:false,message:'Opname tidak dapat disubmit.'},409);if(String(d.qsUserId||'')!==String(user.id)&&!roleIn(user,['koordinator_engineering','manager_operasional','head_unit_bisnis','administrator','direktur']))return json({ok:false,message:'Hanya QS PIC yang dapat submit.'},403);d.status='SUBMITTED_TO_ENGINEERING';d.submittedAt=new Date().toISOString();}
  else if(action==='verify'){if(old!=='SUBMITTED_TO_ENGINEERING')return json({ok:false,message:'Opname belum menunggu Head of Engineering.'},409);if(!roleIn(user,['koordinator_engineering','head_unit_bisnis','administrator','direktur']))return json({ok:false,message:'Hanya Head of Engineering yang dapat verifikasi.'},403);d.status='VERIFIED';d.verifiedAt=new Date().toISOString();d.verifiedByUserId=user.id;}
  else if(action==='return-qs'){if(old!=='SUBMITTED_TO_ENGINEERING')return json({ok:false,message:'Status tidak sesuai.'},409);if(!roleIn(user,['koordinator_engineering','head_unit_bisnis','administrator','direktur']))return json({ok:false,message:'Hanya Head of Engineering yang dapat mengembalikan.'},403);d.status='RETURNED_TO_QS';d.returnReason=String(b.notes||'Perlu koreksi opname');}
  else if(action==='close'){if(old!=='VERIFIED')return json({ok:false,message:'Opname belum VERIFIED.'},409);if(!roleIn(user,['admin_teknik','koordinator_engineering','manager_operasional','head_unit_bisnis','administrator','direktur']))return json({ok:false,message:'Tidak berhak menutup opname.'},403);d.status='CLOSED';d.closedAt=new Date().toISOString();d.closedByUserId=user.id;}
  else return json({ok:false,message:'Action opname tidak dikenal.'},400);
  const row=await upsertRecord(env,'opname',id,d,user);await syncWorkflowTask(env,'opname',id,d,user);return json({ok:true,row});
}
async function issueWorkflowAction(request,env,user,id){
  const rec=await getRecord(env,'issues',id);if(!rec)return json({ok:false,message:'Issue tidak ditemukan.'},404);const denied=await requireProjectAccess(env,user,rec.data.projectId);if(denied)return denied;const b=await parseJson(request)||{};const action=String(b.action||'').toLowerCase();const d={...rec.data};const old=String(d.status||'OPEN').toUpperCase();const sm=await projectRoleUser(env,d.projectId,'site_manager');const isPic=[String(d.picUserId||''),String(sm||'')].includes(String(user.id));
  if(action==='start'){if(old!=='OPEN')return json({ok:false,message:'Issue bukan OPEN.'},409);if(!isPic&&!isManagementRole(user))return json({ok:false,message:'Hanya PIC yang dapat memulai.'},403);d.status='IN PROGRESS';}
  else if(action==='submit-review'){if(old!=='IN PROGRESS')return json({ok:false,message:'Issue harus IN PROGRESS.'},409);if(!isPic&&!isManagementRole(user))return json({ok:false,message:'Hanya PIC yang dapat mengirim review.'},403);d.status='WAITING';d.resolutionNote=String(b.notes||d.decision||'');}
  else if(action==='close'){if(old!=='WAITING')return json({ok:false,message:'Issue belum menunggu review.'},409);if(!isManagementRole(user))return json({ok:false,message:'Hanya Head of Operational/Manajemen yang dapat menutup issue.'},403);d.status='CLOSED';d.closedAt=new Date().toISOString();}
  else if(action==='return'){if(old!=='WAITING')return json({ok:false,message:'Status tidak sesuai.'},409);if(!isManagementRole(user))return json({ok:false,message:'Hanya Head of Operational/Manajemen yang dapat mengembalikan issue ke Site Manager.'},403);d.status='IN PROGRESS';d.reviewNote=String(b.notes||'Perlu perbaikan');}
  else return json({ok:false,message:'Action issue tidak dikenal.'},400);
  const row=await upsertRecord(env,'issues',id,d,user);await syncWorkflowTask(env,'issues',id,d,user);return json({ok:true,row});
}
async function closeoutWorkflowAction(request,env,user,collection,id){
  if(!['retention','closeout'].includes(collection))return json({ok:false,message:'Workflow tidak dikenal.'},400);const rec=await getRecord(env,collection,id);if(!rec)return json({ok:false,message:'Data tidak ditemukan.'},404);const denied=await requireProjectAccess(env,user,rec.data.projectId);if(denied)return denied;const b=await parseJson(request)||{};const action=String(b.action||'').toLowerCase();const d={...rec.data};const old=String(d.status||'OPEN').toUpperCase();
  const owner=collection==='retention'?d.picUserId:d.ownerUserId;const mine=String(owner||'')===String(user.id);
  if(collection==='closeout'){
    if(action==='start'){if(old!=='OPEN')return json({ok:false,message:'Checklist bukan OPEN.'},409);if(!mine&&!isManagementRole(user)&&!roleIn(user,['admin_teknik']))return json({ok:false,message:'Hanya PIC yang dapat memulai.'},403);d.status='IN PROGRESS';}
    else if(action==='complete'){if(!['OPEN','IN PROGRESS'].includes(old))return json({ok:false,message:'Checklist tidak dapat ditutup.'},409);if(!mine&&!isManagementRole(user)&&!roleIn(user,['admin_teknik']))return json({ok:false,message:'Hanya PIC yang dapat menyelesaikan.'},403);d.status='CLOSED';d.closedAt=new Date().toISOString();}
    else return json({ok:false,message:'Action close-out tidak dikenal.'},400);
  } else {
    if(action==='release'){if(!['OPEN','HOLD'].includes(old))return json({ok:false,message:'Retensi tidak dapat direlease.'},409);if(!mine&&!roleIn(user,['finance','admin_teknik','manager_operasional','head_unit_bisnis','administrator','direktur']))return json({ok:false,message:'Tidak berhak release retensi.'},403);d.status='RELEASED';d.releasedAt=new Date().toISOString();}
    else if(action==='close'){if(old!=='RELEASED')return json({ok:false,message:'Retensi belum RELEASED.'},409);if(!roleIn(user,['finance','admin_teknik','manager_operasional','head_unit_bisnis','administrator','direktur']))return json({ok:false,message:'Tidak berhak menutup retensi.'},403);d.status='CLOSED';d.closedAt=new Date().toISOString();}
    else return json({ok:false,message:'Action retensi tidak dikenal.'},400);
  }
  const row=await upsertRecord(env,collection,id,d,user);await syncWorkflowTask(env,collection,id,d,user);return json({ok:true,row});
}
async function atiWorkflowAction(request,env,user,collection,id){
  if(!['ati_work_requests','ati_field_issues'].includes(collection))return json({ok:false,message:'Workflow ATI tidak dikenal.'},400);const rec=await getRecord(env,collection,id);if(!rec)return json({ok:false,message:'Data ATI tidak ditemukan.'},404);if(rec.data.projectId){const denied=await requireProjectAccess(env,user,rec.data.projectId);if(denied)return denied;}const b=await parseJson(request)||{};const action=String(b.action||'').toLowerCase();const d={...rec.data};const old=String(d.status||'DRAFT').toUpperCase();const role=normalizeRole(user);
  if(collection==='ati_work_requests'){
    if(action==='submit'){if(old!=='DRAFT')return json({ok:false,message:'Pengajuan bukan DRAFT.'},409);if(String(d.requestedByUserId||'')!==String(user.id)&&!isManagementRole(user))return json({ok:false,message:'Hanya pengaju yang dapat submit.'},403);d.status='DIAJUKAN';}
    else if(action==='process'){if(old!=='DIAJUKAN')return json({ok:false,message:'Pengajuan belum DIAJUKAN.'},409);if(!['kepala_ati','manager_operasional','head_unit_bisnis','administrator','direktur'].includes(role))return json({ok:false,message:'Hanya Kepala ATI yang dapat memproses.'},403);d.status='DIPROSES';}
    else if(action==='fulfill'){if(old!=='DIPROSES')return json({ok:false,message:'Pengajuan belum DIPROSES.'},409);if(!['kepala_ati','instruktur_ati','manager_operasional','head_unit_bisnis','administrator','direktur'].includes(role))return json({ok:false,message:'ATI belum dapat menandai terpenuhi.'},403);d.status='TERPENUHI';}
    else if(action==='complete'){if(old!=='TERPENUHI')return json({ok:false,message:'Pengajuan belum TERPENUHI.'},409);if(String(d.requestedByUserId||'')!==String(user.id)&&!isManagementRole(user)&&role!=='kepala_ati')return json({ok:false,message:'Hanya pengaju/ATI yang dapat menyelesaikan.'},403);d.status='SELESAI';}
    else if(action==='reject'){if(!['DIAJUKAN','DIPROSES'].includes(old))return json({ok:false,message:'Status tidak dapat ditolak.'},409);if(!['kepala_ati','manager_operasional','head_unit_bisnis','administrator','direktur'].includes(role))return json({ok:false,message:'Tidak berhak menolak.'},403);d.status='DITOLAK';d.rejectReason=String(b.notes||'');}
    else return json({ok:false,message:'Action ATI tidak dikenal.'},400);
  } else {
    const mine=String(d.picUserId||'')===String(user.id);
    if(action==='start'){if(old!=='OPEN')return json({ok:false,message:'Masalah bukan OPEN.'},409);if(!mine&&!isManagementRole(user)&&role!=='kepala_ati')return json({ok:false,message:'Hanya PIC yang dapat memulai.'},403);d.status='IN PROGRESS';}
    else if(action==='submit-evaluation'){if(old!=='IN PROGRESS')return json({ok:false,message:'Masalah harus IN PROGRESS.'},409);if(!mine&&!isManagementRole(user)&&role!=='kepala_ati')return json({ok:false,message:'Hanya PIC yang dapat mengirim evaluasi.'},403);d.status='WAITING EVALUATION';}
    else if(action==='close'){if(old!=='WAITING EVALUATION')return json({ok:false,message:'Masalah belum menunggu evaluasi.'},409);if(!['kepala_ati','manager_operasional','head_unit_bisnis','administrator','direktur'].includes(role))return json({ok:false,message:'Hanya Kepala ATI/Manajemen yang dapat menutup.'},403);d.status='CLOSED';d.closedAt=new Date().toISOString();}
    else return json({ok:false,message:'Action masalah ATI tidak dikenal.'},400);
  }
  const row=await upsertRecord(env,collection,id,d,user);await syncWorkflowTask(env,collection,id,d,user);return json({ok:true,row});
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
    // PO/SPK yang berasal dari PR menandai handoff Admin Teknik selesai dan meneruskan tugas ke Procurement.
    if (d.prId) {
      const pr=await getRecord(env,"procurement",String(d.prId));
      if (pr) {
        const prStatus=String(pr.data.status||"").toUpperCase();
        if (prStatus === "APPROVED" || prStatus === "SPK_CREATED") {
          const pd={...pr.data,status:"SPK_CREATED",poId:record.id,poNumber:d.number||record.id,spkCreatedAt:new Date().toISOString(),spkCreatedByUserId:user?.id||"",spkCreatedByName:user?.name||user?.username||""};
          await upsertRecord(env,"procurement",pr.id,pd,user);
          await syncWorkflowTask(env,"procurement",pr.id,pd,user);
        }
      }
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
  }  if (WORKFLOW_SOURCE_COLLECTIONS.has(collection)) await syncWorkflowTask(env,collection,record.id,d,user);
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
  await upsertRecord(env,"qc_inspections",id,{...inspection.data,evidenceDocumentId:doc.id,evidenceOriginalName:file.name},user);
  await upsertRecord(env,"qc_work_items",workItemId,{...workItem.data,lastInspectionId:id,lastInspectionDate:date,lastResult:result,lastEvidenceId:doc.id},user);
  const openDefects = await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='defects' AND json_extract(data_json,'$.projectId')=? AND json_extract(data_json,'$.workItemId')=?`).bind(projectId,workItemId).all();
  if (result === "PASS") {
    for (const r of (openDefects.results || [])) {
      const d=safeJsonParse(r.data_json,{}); if (activeLike(d.status)) { const nd={...d,status:"CLOSED",closedByInspectionId:id,closedAt:new Date().toISOString()}; await upsertRecord(env,"defects",r.id,nd,user); await syncWorkflowTask(env,"defects",r.id,nd,user); }
    }
  } else {
    const hasOpen=(openDefects.results || []).some(r=>activeLike(safeJsonParse(r.data_json,{}).status));
    if (!hasOpen) {
      const picUserId=await projectAssignment(env,projectId,"pm");
      if (!picUserId) return json({ok:false,message:"Proyek belum memiliki Site Manager. Tetapkan Site Manager sebelum menerbitkan temuan QC."},400);
      const fid=crypto.randomUUID(); const fd={
        projectId,workItemId,qcInspectionId:id,date,item:workItem.data.item || "",area:workItem.data.item || "",category:workItem.data.category || "",
        severity:result==="NG"?"B - MAYOR":"C - MINOR",status:"OPEN",picUserId,deadline:"",
        description:`Hasil QC Inspection ${result}: ${notes || workItem.data.item || "Perlu tindak lanjut"}`,
        suggestion:"Lakukan corrective action sesuai hasil inspeksi dan kirim bukti foto setelah perbaikan.",
        notes:`Auto dari QC Inspection ${result}: ${notes}`
      }; await upsertRecord(env,"defects",fid,fd,user); await syncWorkflowTask(env,"defects",fid,fd,user);
    }
  }
  await audit(env,user,"QC_INSPECTION","qc_inspections",id,projectId,{workItemId,result,evidenceId:doc.id});
  return json({ok:true,inspection,document:doc});
}


const QC_DEFAULT_GROUPS = [
  ["Pekerjaan Persiapan",10],
  ["Pekerjaan Struktur Bawah",20],
  ["Pekerjaan Struktur Atas",30],
  ["Pekerjaan Arsitektur",40],
  ["Pekerjaan Sanitasi",50],
  ["Pekerjaan Elektrikal",60],
  ["Pekerjaan Landscaping",70]
];

function normalizeContinuousQcResult(value) {
  const v=String(value||"").trim().toUpperCase();
  if (["SESUAI","PASS","OK"].includes(v)) return "SESUAI";
  if (["TIDAK SESUAI","NG","FAIL","NOT OK"].includes(v)) return "TIDAK SESUAI";
  if (["BUTUH KONFIRMASI","BUTUH_KONFIRMASI","PERLU KONFIRMASI","KONFIRMASI","HOLD"].includes(v)) return "BUTUH KONFIRMASI"; // V3.4.20
  return "";
}

const QC_CONFIRM_DAYS = 3;
const QC_CONFIRM_TARGETS = {site_manager:"Site Manager",koordinator_engineering:"Head of Engineering"};
function witaToday(offsetDays=0){ return new Date(Date.now()+8*3600e3+offsetDays*864e5).toISOString().slice(0,10); }
function qcConfirmFields(target,note,user){
  const t=QC_CONFIRM_TARGETS[String(target||"")]?String(target):"site_manager";
  return {confirmTarget:t,confirmStatus:"MENUNGGU_JAWABAN",confirmDueDate:witaToday(QC_CONFIRM_DAYS),confirmEscalated:false,confirmEscalatedAt:"",confirmAnswer:"",confirmAnswerDocId:"",confirmAnsweredAt:"",confirmAnsweredBy:"",confirmationRequestedAt:new Date().toISOString(),confirmationRequestedBy:user.id,confirmationNote:String(note||"")};
}

async function qcWorkGroups(env) {
  const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='qc_work_groups'`).all();
  const rows=(q.results||[]).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{})}))
    .filter(r=>String(r.data.status||"ACTIVE").toUpperCase()!=="INACTIVE")
    .sort((a,b)=>num(a.data.order)-num(b.data.order));
  if (rows.length) return rows.map(r=>({id:r.id,name:String(r.data.name||r.data.value||r.id),order:num(r.data.order)}));
  return QC_DEFAULT_GROUPS.map(([name,order],i)=>({id:`DEFAULT-${i+1}`,name,order}));
}

async function qcSessionItems(env,sessionId) {
  const q=await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection='qc_inspection_items' AND json_extract(data_json,'$.sessionId')=? ORDER BY COALESCE(json_extract(data_json,'$.createdAt'),updated_at), id`).bind(sessionId).all();
  return (q.results||[]).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
}

async function recomputeQcSession(env,user,sessionId) {
  const session=await getRecord(env,"qc_inspection_sessions",sessionId);
  if (!session) throw new Error("Catatan pemeriksaan QC tidak ditemukan.");
  const items=await qcSessionItems(env,sessionId);
  const sesuai=items.filter(x=>normalizeContinuousQcResult(x.data.result)==="SESUAI").length;
  const tidak=items.filter(x=>normalizeContinuousQcResult(x.data.result)==="TIDAK SESUAI").length;
  const konfirmasi=items.filter(x=>normalizeContinuousQcResult(x.data.result)==="BUTUH KONFIRMASI").length;
  const total=sesuai+tidak+konfirmasi;
  const decided=sesuai+tidak; // kesesuaian hanya dari item yang sudah diputuskan
  const score=decided?Math.round(sesuai/decided*100):0;
  return upsertRecord(env,"qc_inspection_sessions",sessionId,{...session.data,total,sesuai,tidak,konfirmasi,score,updatedAt:new Date().toISOString()},user);
}

async function qcSessionDetail(env,user,id) {
  const session=await getRecord(env,"qc_inspection_sessions",id);
  if (!session) return null;
  const denied=await requireProjectAccess(env,user,session.data.projectId); if (denied) return {denied};
  const items=await qcSessionItems(env,id);
  const groups=await qcWorkGroups(env);
  const known=new Set(groups.map(g=>g.name));
  for (const it of items) {
    const name=String(it.data.workGroup||"Lainnya");
    if (!known.has(name)) { groups.push({id:`USED-${groups.length+1}`,name,order:999+groups.length}); known.add(name); }
  }
  groups.sort((a,b)=>a.order-b.order);
  const emp=await getRecord(env,"users",String(session.data.inspectorUserId||""));
  return {session,items,groups,inspectorName:emp?.data?.name||session.data.inspectorName||session.data.inspectorUserId||"-"};
}

async function qcSessionListHandler(env,user,url) {
  const projectId=String(url.searchParams.get("projectId")||"").trim();
  const q=await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection='qc_inspection_sessions' ORDER BY COALESCE(json_extract(data_json,'$.startDate'),updated_at) DESC`).all();
  const rows=[];
  const scopeIds=isProjectScopedRole(user)?await accessibleProjectIds(env,user):null; // satu query, bukan per baris
  for (const r of (q.results||[])) {
    const data=safeJsonParse(r.data_json,{});
    if (projectId && String(data.projectId||"")!==projectId) continue;
    if (scopeIds && !scopeIds.has(String(data.projectId||""))) continue;
    rows.push({id:r.id,data,updated_at:r.updated_at});
  }
  return json({ok:true,rows});
}

async function qcSessionStartHandler(request,env,user) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak memiliki akses memulai QC Inspection."},403);
  const body=await parseJson(request)||{};
  const projectId=String(body.projectId||"").trim();
  if (!projectId) return json({ok:false,message:"Proyek wajib dipilih."},400);
  const denied=await requireProjectAccess(env,user,projectId); if (denied) return denied;
  const existing=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='qc_inspection_sessions' AND json_extract(data_json,'$.projectId')=? AND UPPER(COALESCE(json_extract(data_json,'$.status'),'DRAFT'))='DRAFT' LIMIT 1`).bind(projectId).first();
  if (existing) return json({ok:true,id:existing.id,continued:true,row:{id:existing.id,data:safeJsonParse(existing.data_json,{})}});
  const id=crypto.randomUUID();
  const date=String(body.date||new Date().toISOString().slice(0,10));
  const rec=await upsertRecord(env,"qc_inspection_sessions",id,{projectId,startDate:date,status:"DRAFT",note:String(body.note||""),inspectorUserId:user.id,inspectorName:user.name||user.username,total:0,sesuai:0,tidak:0,score:0,createdAt:new Date().toISOString()},user);
  await audit(env,user,"QC_SESSION_START","qc_inspection_sessions",id,projectId,{date});
  return json({ok:true,id,continued:false,row:rec},201);
}

async function qcSessionDetailHandler(env,user,id) {
  const d=await qcSessionDetail(env,user,id);
  if (!d) return json({ok:false,message:"Catatan pemeriksaan QC tidak ditemukan."},404);
  if (d.denied) return d.denied;
  return json({ok:true,...d,canEdit:buildAccess(user).capabilities.qcInspect && String(d.session.data.status||"DRAFT").toUpperCase()==="DRAFT",canClose:buildAccess(user).capabilities.qcCloseSession,canDelete:buildAccess(user).capabilities.qcDeleteSession});
}

async function qcSessionUpdateHandler(request,env,user,id) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak dapat mengubah catatan inspeksi QC."},403);
  const session=await getRecord(env,"qc_inspection_sessions",id);
  if (!session) return json({ok:false,message:"Catatan pemeriksaan QC tidak ditemukan."},404);
  if (String(session.data.status||"DRAFT").toUpperCase()!=="DRAFT") return json({ok:false,message:"Catatan pemeriksaan sudah ditutup dan tidak dapat diedit."},409);
  const denied=await requireProjectAccess(env,user,session.data.projectId); if (denied) return denied;
  const body=await parseJson(request)||{};
  const next={...session.data};
  if (body.startDate!==undefined) next.startDate=String(body.startDate||next.startDate);
  if (body.note!==undefined) next.note=String(body.note||"");
  const rec=await upsertRecord(env,"qc_inspection_sessions",id,{...next,updatedAt:new Date().toISOString()},user);
  await audit(env,user,"QC_SESSION_EDIT","qc_inspection_sessions",id,session.data.projectId,{startDate:next.startDate});
  return json({ok:true,row:rec});
}

async function qcSessionAddItemHandler(request,env,user,sessionId) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak dapat menambah sub-pekerjaan QC."},403);
  const session=await getRecord(env,"qc_inspection_sessions",sessionId);
  if (!session) return json({ok:false,message:"Catatan pemeriksaan QC tidak ditemukan."},404);
  if (String(session.data.status||"").toUpperCase()!=="DRAFT") return json({ok:false,message:"Catatan pemeriksaan sudah ditutup."},409);
  const denied=await requireProjectAccess(env,user,session.data.projectId); if (denied) return denied;
  let fd; try { fd=await request.formData(); } catch { return json({ok:false,message:"Form sub-pekerjaan tidak valid."},400); }
  const workGroup=String(fd.get("workGroup")||"").trim();
  const item=String(fd.get("item")||"").trim();
  const result=normalizeContinuousQcResult(fd.get("result"));
  const note=String(fd.get("note")||"");
  const date=String(fd.get("date")||new Date().toISOString().slice(0,10));
  const file=fd.get("file");
  if (!workGroup) return json({ok:false,message:"Item pekerjaan wajib dipilih."},400);
  if (!item) return json({ok:false,message:"Uraian sub-pekerjaan wajib diisi."},400);
  if (result==="BUTUH KONFIRMASI" && !note.trim()) return json({ok:false,message:"Tuliskan di Keterangan apa yang perlu dikonfirmasi (mis. menunggu hasil uji slump / gambar revisi)."},400);
  if (!result) return json({ok:false,message:"Pilih dulu Sesuai atau Tidak sesuai."},400);
  const id=crypto.randomUUID();
  let evidenceDocumentId="";
  if (file instanceof File && file.size>0) {
    const doc=await storeEvidenceDocument(env,user,file,{projectId:session.data.projectId,category:"QC_EVIDENCE",title:`QC ${workGroup} - ${item} - ${date}`,notes:note,relatedCollection:"qc_inspection_items",relatedId:id});
    evidenceDocumentId=doc.id;
  }
  const rec=await upsertRecord(env,"qc_inspection_items",id,{sessionId,projectId:session.data.projectId,workGroup,item,result,note,date,inspectorUserId:user.id,evidenceDocumentId,findingId:"",createdAt:new Date().toISOString(),...(result==="BUTUH KONFIRMASI"?qcConfirmFields(fd.get("confirmTarget"),note,user):{})},user);
  await recomputeQcSession(env,user,sessionId);
  if (result==="BUTUH KONFIRMASI") await syncWorkflowTask(env,"qc_inspection_items",id,rec.data,user);
  await audit(env,user,"QC_SESSION_ITEM_ADD","qc_inspection_items",id,session.data.projectId,{sessionId,workGroup,result});
  return json({ok:true,row:rec});
}

async function qcSessionUpdateItemHandler(request,env,user,id) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak dapat mengubah sub-pekerjaan QC."},403);
  const item=await getRecord(env,"qc_inspection_items",id);
  if (!item) return json({ok:false,message:"Sub-pekerjaan QC tidak ditemukan."},404);
  const session=await getRecord(env,"qc_inspection_sessions",item.data.sessionId);
  if (!session) return json({ok:false,message:"Catatan pemeriksaan tidak ditemukan."},404);
  if (String(session.data.status||"").toUpperCase()!=="DRAFT") return json({ok:false,message:"Catatan pemeriksaan sudah ditutup."},409);
  const denied=await requireProjectAccess(env,user,item.data.projectId); if (denied) return denied;
  const body=await parseJson(request)||{};
  const next={...item.data};
  if (body.result!==undefined) {
    const r=normalizeContinuousQcResult(body.result); if(!r) return json({ok:false,message:"Hasil harus Sesuai, Tidak sesuai, atau Butuh konfirmasi."},400);
    if (item.data.findingId && r!=="TIDAK SESUAI") return json({ok:false,message:"Sub-pekerjaan ini sudah diterbitkan menjadi temuan. Tutup lewat alur verifikasi, jangan ubah hasilnya di inspeksi."},409);
    const prev=normalizeContinuousQcResult(item.data.result); const noteNow=String(body.note!==undefined?body.note:item.data.note||"");
    if (r==="BUTUH KONFIRMASI" && prev!=="BUTUH KONFIRMASI") {
      if (!noteNow.trim()) return json({ok:false,message:"Tuliskan dulu di Keterangan apa yang perlu dikonfirmasi, lalu pilih Butuh konfirmasi."},400);
      Object.assign(next,qcConfirmFields(body.confirmTarget,noteNow,user)); next.confirmationResolvedAt=""; next.confirmationResolution="";
    }
    if (r==="BUTUH KONFIRMASI" && prev==="BUTUH KONFIRMASI" && body.confirmTarget && QC_CONFIRM_TARGETS[body.confirmTarget] && body.confirmTarget!==item.data.confirmTarget) {
      Object.assign(next,qcConfirmFields(body.confirmTarget,noteNow,user)); // ganti penjawab → pertanyaan dikirim ulang
    }
    if (prev==="BUTUH KONFIRMASI" && r!=="BUTUH KONFIRMASI") { next.confirmationResolvedAt=new Date().toISOString(); next.confirmationResolvedBy=user.id; next.confirmationResolution=r; next.confirmStatus="SELESAI"; }
    next.result=r;
  }
  if (body.note!==undefined) next.note=String(body.note||"");
  if (body.item!==undefined) next.item=String(body.item||"").trim()||next.item;
  if (body.date!==undefined) next.date=String(body.date||next.date);
  const rec=await upsertRecord(env,"qc_inspection_items",id,{...next,updatedAt:new Date().toISOString()},user);
  await recomputeQcSession(env,user,item.data.sessionId);
  await syncWorkflowTask(env,"qc_inspection_items",id,rec.data,user);
  return json({ok:true,row:rec});
}

async function qcSessionItemPhotoHandler(request,env,user,id) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak dapat mengubah foto inspeksi."},403);
  const item=await getRecord(env,"qc_inspection_items",id);
  if (!item) return json({ok:false,message:"Sub-pekerjaan QC tidak ditemukan."},404);
  const session=await getRecord(env,"qc_inspection_sessions",item.data.sessionId);
  if (!session || String(session.data.status||"").toUpperCase()!=="DRAFT") return json({ok:false,message:"Catatan pemeriksaan sudah ditutup."},409);
  const denied=await requireProjectAccess(env,user,item.data.projectId); if (denied) return denied;
  let fd; try { fd=await request.formData(); } catch { return json({ok:false,message:"Upload foto tidak valid."},400); }
  const file=fd.get("file");
  if (!(file instanceof File) || file.size<=0) return json({ok:false,message:"Pilih foto terlebih dahulu."},400);
  const doc=await storeEvidenceDocument(env,user,file,{projectId:item.data.projectId,category:"QC_EVIDENCE",title:`QC ${item.data.workGroup||"Inspeksi"} - ${item.data.item||id}`,notes:item.data.note||"",relatedCollection:"qc_inspection_items",relatedId:id});
  const rec=await upsertRecord(env,"qc_inspection_items",id,{...item.data,evidenceDocumentId:doc.id,updatedAt:new Date().toISOString()},user);
  return json({ok:true,row:rec,document:doc});
}

// V3.4.21 — Jawab konfirmasi (Site Manager proyek / Head of Engineering / Head of Operational / manajemen)
async function qcConfirmAnswerHandler(request,env,user,id) {
  const item=await getRecord(env,"qc_inspection_items",id);
  if (!item) return json({ok:false,message:"Sub-pekerjaan QC tidak ditemukan."},404);
  const d={...item.data};
  if (normalizeContinuousQcResult(d.result)!=="BUTUH KONFIRMASI") return json({ok:false,message:"Sub-pekerjaan ini tidak sedang menunggu konfirmasi."},409);
  if (String(d.confirmStatus||"MENUNGGU_JAWABAN").toUpperCase()==="DIJAWAB") return json({ok:false,message:"Konfirmasi ini sudah dijawab dan menunggu keputusan QC."},409);
  const denied=await requireProjectAccess(env,user,d.projectId); if (denied) return denied;
  const role=normalizeRole(user); const target=String(d.confirmTarget||"site_manager");
  const sm=await projectAssignment(env,d.projectId,"site_manager");
  const allowed=isManagementRole(user) || (target==="site_manager" && role==="site_manager" && String(sm)===String(user.id)) || (target==="koordinator_engineering" && role==="koordinator_engineering");
  if (!allowed) return json({ok:false,message:`Konfirmasi ini ditujukan ke ${QC_CONFIRM_TARGETS[target]||"Site Manager"} proyek. Head of Operational dapat menjawab bila perlu.`},403);
  let fd; try { fd=await request.formData(); } catch { return json({ok:false,message:"Form jawaban tidak valid."},400); }
  const answer=String(fd.get("answer")||"").trim(); const file=fd.get("file");
  if (!answer) return json({ok:false,message:"Jawaban konfirmasi wajib diisi."},400);
  if (file instanceof File && file.size>0) {
    const doc=await storeEvidenceDocument(env,user,file,{projectId:d.projectId,category:"QC_EVIDENCE",title:`Jawaban konfirmasi QC - ${d.item||id}`,notes:answer,relatedCollection:"qc_inspection_items",relatedId:id});
    d.confirmAnswerDocId=doc.id; d.confirmAnswerDocName=file.name;
  }
  const history=Array.isArray(d.confirmHistory)?d.confirmHistory:[];
  history.push({at:new Date().toISOString(),by:user.id,byName:user.name||user.username||"",type:"JAWAB",text:answer,docId:d.confirmAnswerDocId||""});
  Object.assign(d,{confirmStatus:"DIJAWAB",confirmAnswer:answer,confirmAnsweredAt:new Date().toISOString(),confirmAnsweredBy:user.id,confirmAnsweredByName:user.name||user.username||"",confirmHistory:history.slice(-20),updatedAt:new Date().toISOString()});
  const rec=await upsertRecord(env,"qc_inspection_items",id,d,user);
  await syncWorkflowTask(env,"qc_inspection_items",id,d,user);
  await audit(env,user,"QC_CONFIRM_ANSWER","qc_inspection_items",id,d.projectId,{target});
  return json({ok:true,row:rec});
}
// V3.4.21 — QC meminta jawaban ulang (jawaban belum cukup) → kembali ke penjawab dengan batas baru
async function qcConfirmReaskHandler(request,env,user,id) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Hanya QC/Head of Supporting yang dapat meminta jawaban ulang."},403);
  const item=await getRecord(env,"qc_inspection_items",id);
  if (!item) return json({ok:false,message:"Sub-pekerjaan QC tidak ditemukan."},404);
  const denied=await requireProjectAccess(env,user,item.data.projectId); if (denied) return denied;
  if (normalizeContinuousQcResult(item.data.result)!=="BUTUH KONFIRMASI") return json({ok:false,message:"Sub-pekerjaan ini tidak sedang menunggu konfirmasi."},409);
  const body=await parseJson(request)||{}; const note=String(body.note||"").trim();
  if (!note) return json({ok:false,message:"Tuliskan apa yang masih kurang dari jawaban."},400);
  const d={...item.data}; const history=Array.isArray(d.confirmHistory)?d.confirmHistory:[];
  history.push({at:new Date().toISOString(),by:user.id,byName:user.name||user.username||"",type:"MINTA_ULANG",text:note});
  const target=QC_CONFIRM_TARGETS[body.confirmTarget]?body.confirmTarget:(d.confirmTarget||"site_manager");
  Object.assign(d,{confirmTarget:target,confirmStatus:"MENUNGGU_JAWABAN",confirmDueDate:witaToday(QC_CONFIRM_DAYS),confirmEscalated:false,confirmEscalatedAt:"",confirmationNote:`${d.confirmationNote||d.note||""}\nTambahan QC: ${note}`.trim(),confirmHistory:history.slice(-20),updatedAt:new Date().toISOString()});
  const rec=await upsertRecord(env,"qc_inspection_items",id,d,user);
  await syncWorkflowTask(env,"qc_inspection_items",id,d,user);
  await audit(env,user,"QC_CONFIRM_REASK","qc_inspection_items",id,d.projectId,{target});
  return json({ok:true,row:rec});
}
// V3.4.21 — eskalasi otomatis (dipanggil Cron): konfirmasi lewat batas & belum dijawab → Head of Operational
const QC_ESCALATION_ACTOR = {id:"system-escalation",name:"Nara System (eskalasi otomatis)",username:"system-escalation"};
async function escalateOverdueQcConfirmations(env) {
  const today=witaToday(0);
  const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='qc_inspection_items' AND upper(COALESCE(json_extract(data_json,'$.result'),''))='BUTUH KONFIRMASI' AND upper(COALESCE(json_extract(data_json,'$.confirmStatus'),'MENUNGGU_JAWABAN'))='MENUNGGU_JAWABAN' AND COALESCE(json_extract(data_json,'$.confirmEscalated'),0) IN (0,'false','') AND ( (COALESCE(json_extract(data_json,'$.confirmDueDate'),'')<>'' AND json_extract(data_json,'$.confirmDueDate') < ?) OR (COALESCE(json_extract(data_json,'$.confirmDueDate'),'')='' AND date(json_extract(data_json,'$.confirmationRequestedAt'),'+${QC_CONFIRM_DAYS} days') < ?) )`).bind(today,today).all();
  let n=0;
  for (const r of (q.results||[])) {
    const d={...safeJsonParse(r.data_json,{}),confirmEscalated:true,confirmEscalatedAt:new Date().toISOString()};
    await upsertRecord(env,"qc_inspection_items",r.id,d,QC_ESCALATION_ACTOR);
    await syncWorkflowTask(env,"qc_inspection_items",r.id,d,QC_ESCALATION_ACTOR);
    n++;
  }
  return n;
}

async function qcSessionDeleteItemHandler(env,user,id) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak dapat menghapus sub-pekerjaan QC."},403);
  const item=await getRecord(env,"qc_inspection_items",id);
  if (!item) return json({ok:true});
  const linkedFindingId=String(item.data.findingId||"");
  if (linkedFindingId && !buildAccess(user).capabilities.qcDeleteFinding) return json({ok:false,message:`Sub-pekerjaan sudah diterbitkan menjadi temuan ${linkedFindingId}. Hanya QC/Head of Supporting yang dapat menghapusnya.`},409);
  const session=await getRecord(env,"qc_inspection_sessions",item.data.sessionId);
  if (!session || String(session.data.status||"").toUpperCase()!=="DRAFT") return json({ok:false,message:"Catatan pemeriksaan sudah ditutup."},409);
  const denied=await requireProjectAccess(env,user,item.data.projectId); if (denied) return denied;
  if (linkedFindingId) await deleteQcFindingData(env,user,linkedFindingId,{checkAccess:false});
  await deleteRelatedDocuments(env,user,"qc_inspection_items",id);
  await cancelWorkflowTasks(env,"qc_inspection_items",id,user);
  await deleteRecord(env,"qc_inspection_items",id,user);
  await recomputeQcSession(env,user,item.data.sessionId);
  return json({ok:true});
}

async function qcSessionPublishHandler(request,env,user,id) {
  if (!buildAccess(user).capabilities.qcInspect) return json({ok:false,message:"Role ini tidak dapat menerbitkan temuan dari inspeksi."},403);
  const session=await getRecord(env,"qc_inspection_sessions",id);
  if (!session) return json({ok:false,message:"Catatan pemeriksaan tidak ditemukan."},404);
  const denied=await requireProjectAccess(env,user,session.data.projectId); if (denied) return denied;
  const body=await parseJson(request)||{};
  const deadline=String(body.deadline||"").trim();
  const severity=String(body.severity||"B - MAYOR").trim();
  const suggestion=String(body.suggestion||"Lakukan perbaikan sesuai hasil inspeksi QC dan ajukan bukti hasil perbaikan.");
  if (!deadline) return json({ok:false,message:"Deadline perbaikan wajib diisi."},400);
  const picUserId=await projectAssignment(env,session.data.projectId,"pm");
  if (!picUserId) return json({ok:false,message:"Proyek belum memiliki Site Manager. Tetapkan Site Manager sebelum menerbitkan temuan."},400);
  const items=await qcSessionItems(env,id);
  const targets=items.filter(x=>normalizeContinuousQcResult(x.data.result)==="TIDAK SESUAI"&&!x.data.findingId);
  if (!targets.length) return json({ok:false,message:"Tidak ada sub-pekerjaan Tidak sesuai yang belum diterbitkan menjadi temuan."},409);
  const created=[];
  for (const it of targets) {
    const fid=crypto.randomUUID();
    const fd={projectId:session.data.projectId,qcSessionId:id,qcInspectionItemId:it.id,date:it.data.date,item:it.data.item,area:it.data.workGroup,category:it.data.workGroup,severity,status:"OPEN",picUserId,deadline,description:it.data.item,suggestion,notes:it.data.note||"",beforeDocumentId:it.data.evidenceDocumentId||""}; await upsertRecord(env,"defects",fid,fd,user); await syncWorkflowTask(env,"defects",fid,fd,user);
    await upsertRecord(env,"qc_inspection_items",it.id,{...it.data,findingId:fid,updatedAt:new Date().toISOString()},user);
    created.push(fid);
  }
  await audit(env,user,"QC_SESSION_PUBLISH_FINDINGS","qc_inspection_sessions",id,session.data.projectId,{count:created.length,deadline,picUserId});
  return json({ok:true,count:created.length,ids:created});
}

async function qcSessionCloseHandler(env,user,id) {
  if (!buildAccess(user).capabilities.qcCloseSession) return json({ok:false,message:"Penutupan catatan pemeriksaan hanya untuk QC/Head of Supporting/Manajemen."},403);
  const session=await getRecord(env,"qc_inspection_sessions",id);
  if (!session) return json({ok:false,message:"Catatan pemeriksaan tidak ditemukan."},404);
  const items=await qcSessionItems(env,id);
  if (!items.length) return json({ok:false,message:"Belum ada sub-pekerjaan. Tambahkan minimal satu sebelum catatan ditutup."},409);
  const pending=items.filter(x=>normalizeContinuousQcResult(x.data.result)==="TIDAK SESUAI"&&!x.data.findingId);
  if (pending.length) return json({ok:false,message:`Masih ada ${pending.length} sub-pekerjaan Tidak sesuai yang belum diterbitkan menjadi temuan.`},409);
  const waitingConfirm=items.filter(x=>normalizeContinuousQcResult(x.data.result)==="BUTUH KONFIRMASI");
  if (waitingConfirm.length) return json({ok:false,message:`Masih ada ${waitingConfirm.length} sub-pekerjaan Butuh konfirmasi. Putuskan dulu menjadi Sesuai atau Tidak sesuai sebelum catatan ditutup.`},409);
  const rec=await upsertRecord(env,"qc_inspection_sessions",id,{...session.data,status:"CLOSED",closedAt:new Date().toISOString(),closedByUserId:user.id},user);
  await audit(env,user,"QC_SESSION_CLOSE","qc_inspection_sessions",id,session.data.projectId,{total:items.length});
  return json({ok:true,row:rec});
}

async function deleteQcFindingData(env,user,id,{checkAccess=true}={}) {
  const finding=await getRecord(env,"defects",id);
  if (!finding) return false;
  if (checkAccess) { const denied=await requireProjectAccess(env,user,finding.data.projectId); if (denied) throw new Error("Anda tidak ditugaskan pada proyek temuan ini."); }
  const linked=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='qc_inspection_items' AND json_extract(data_json,'$.findingId')=?`).bind(id).all();
  for (const r of (linked.results||[])) { const d=safeJsonParse(r.data_json,{}); await upsertRecord(env,"qc_inspection_items",r.id,{...d,findingId:"",updatedAt:new Date().toISOString()},user); }
  const acts=await env.DB.prepare(`SELECT id FROM app_records WHERE collection='qc_actions' AND json_extract(data_json,'$.findingId')=?`).bind(id).all();
  for (const r of (acts.results||[])) { await deleteRelatedDocuments(env,user,"qc_actions",r.id); await deleteRecord(env,"qc_actions",r.id,user); }
  const vers=await env.DB.prepare(`SELECT id FROM app_records WHERE collection='qc_verifications' AND json_extract(data_json,'$.findingId')=?`).bind(id).all();
  for (const r of (vers.results||[])) await deleteRecord(env,"qc_verifications",r.id,user);
  await deleteRelatedDocuments(env,user,"defects",id);
  await cancelWorkflowTasks(env,"defects",id,user);
  await deleteRecord(env,"defects",id,user);
  await audit(env,user,"QC_FINDING_DELETE","defects",id,finding.data.projectId||"",{linkedItems:(linked.results||[]).length});
  return true;
}

async function qcFindingUpdateHandler(request,env,user,id) {
  if (!buildAccess(user).capabilities.qcFindingManage) return json({ok:false,message:"Edit temuan QC hanya untuk QC dan Head of Supporting. Site Manager cukup mengirim foto hasil perbaikan."},403);
  const rec=await getRecord(env,"defects",id); if(!rec) return json({ok:false,message:"Temuan QC tidak ditemukan."},404);
  const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied) return denied;
  const body=await parseJson(request)||{}; const next={...rec.data};
  for (const k of ["date","area","item","category","severity","deadline","description","suggestion","notes"]) if (body[k]!==undefined) next[k]=String(body[k]||"");
  const assignedPm=await projectAssignment(env,rec.data.projectId,"pm"); if(!assignedPm) return json({ok:false,message:"Proyek belum memiliki Site Manager."},400); next.picUserId=assignedPm;
  if(!String(next.description||"").trim()) return json({ok:false,message:"Deskripsi temuan wajib diisi."},400);
  if(!String(next.deadline||"").trim()) return json({ok:false,message:"Deadline perbaikan wajib diisi."},400);
  const out=await upsertRecord(env,"defects",id,{...next,updatedAt:new Date().toISOString()},user);
  await syncWorkflowTask(env,"defects",id,out.data,user);
  await audit(env,user,"QC_FINDING_EDIT","defects",id,rec.data.projectId||"",{status:rec.data.status||""});
  return json({ok:true,row:out});
}

async function qcFindingDeleteHandler(env,user,id) {
  if (!buildAccess(user).capabilities.qcDeleteFinding) return json({ok:false,message:"Hapus temuan QC hanya untuk QC dan Head of Supporting."},403);
  const rec=await getRecord(env,"defects",id); if(!rec) return json({ok:true});
  const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied) return denied;
  await deleteQcFindingData(env,user,id,{checkAccess:false});
  return json({ok:true});
}

async function qcSessionDeleteHandler(env,user,id) {
  if (!buildAccess(user).capabilities.qcDeleteSession) return json({ok:false,message:"Hapus catatan inspeksi hanya untuk QC/Head of Supporting/Manajemen."},403);
  const session=await getRecord(env,"qc_inspection_sessions",id);
  if (!session) return json({ok:true});
  const denied=await requireProjectAccess(env,user,session.data.projectId); if(denied) return denied;
  const items=await qcSessionItems(env,id);
  const findingIds=[...new Set(items.map(x=>String(x.data.findingId||"")).filter(Boolean))];
  for (const fid of findingIds) await deleteQcFindingData(env,user,fid,{checkAccess:false});
  for (const it of items) { await deleteRelatedDocuments(env,user,"qc_inspection_items",it.id); await cancelWorkflowTasks(env,"qc_inspection_items",it.id,user); await deleteRecord(env,"qc_inspection_items",it.id,user); }
  await deleteRelatedDocuments(env,user,"qc_inspection_sessions",id);
  await deleteRecord(env,"qc_inspection_sessions",id,user);
  await audit(env,user,"QC_SESSION_DELETE","qc_inspection_sessions",id,session.data.projectId,{items:items.length,findings:findingIds.length});
  return json({ok:true});
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
  await syncWorkflowTask(env,"cco",id,d,user);
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
  d.status=next; const out=await upsertRecord(env,"payment_requests",id,d,user); await syncWorkflowTask(env,"payment_requests",id,d,user); await audit(env,user,"PAYMENT_REQUEST_ACTION","payment_requests",id,d.projectId||"",{action,from:old,to:next}); return json({ok:true,row:out});
}


async function employeeRoleKey(env,id) {
  if (!id) return "";
  const rec=await getRecord(env,"users",String(id));
  return rec ? normalizeRole(rec.data) : "";
}

async function projectAssignment(env,projectId,key) {
  const p=await getRecord(env,"projects",String(projectId || ""));
  if (!p) return "";
  if (["site_manager","sm","pm","pelaksana","pengawas"].includes(key)) return projectSiteManagerId(p.data);
  const assignmentMap={qs:["qsUserId"],drafter:["drafterUserId"],mep_engineer:["mepUserId"],estimator:["estimatorUserId"],admin_teknik:["adminUserId"]};
  const fields=assignmentMap[key]||[];
  for (const f of fields) if (p.data[f]) return String(p.data[f]);
  return "";
}

async function normalizeOperationalResponsibility(env,collection,data) {
  const d={...data};
  if (["daily_progress","weekly_progress"].includes(collection)) {
    const assigned=await projectAssignment(env,d.projectId,"site_manager");
    if (assigned) d.picUserId=assigned;
    if (!d.picUserId) throw new Error("Proyek belum memiliki Site Manager. Tetapkan Site Manager pada master proyek terlebih dahulu.");
    if ((await employeeRoleKey(env,d.picUserId)) !== "site_manager") throw new Error("PIC laporan progress wajib Site Manager.");
  }
  if (["schedule","milestones","issues"].includes(collection) && d.picUserId && (await employeeRoleKey(env,d.picUserId)) !== "site_manager") throw new Error("PIC pelaksanaan wajib Site Manager.");
  if (collection === "defects") { const assigned=await projectAssignment(env,d.projectId,"pm"); if(!assigned) throw new Error("Proyek belum memiliki Site Manager. Tetapkan Site Manager terlebih dahulu."); d.picUserId=assigned; }
  if (collection === "projects") {
    // V3.4.17: satu Site Manager per proyek. Field lama pm*/pelaksana* disinkronkan agar data lama & laporan tetap konsisten.
    const smId=String(d.siteManagerUserId||"").trim() || projectSiteManagerId(d);
    if (smId) { const rk=await employeeRoleKey(env,smId); if(rk && rk!=="site_manager") throw new Error("Penanggung jawab proyek wajib karyawan dengan posisi Site Manager."); }
    d.siteManagerUserId=smId; d.pmUserId=smId; d.projectManagerUserId=smId; d.pelaksanaUserId=""; d.pengawasUserId="";
  }
  if (collection === "opname") {
    const assigned=await projectAssignment(env,d.projectId,"qs");
    if (assigned) d.qsUserId=assigned;
    if (!d.qsUserId) throw new Error("Proyek belum memiliki QS. Tetapkan QS pada master proyek terlebih dahulu.");
    if ((await employeeRoleKey(env,d.qsUserId)) !== "qs") throw new Error("PIC Opname wajib QS / Quantity Surveyor.");
  }
  if (collection === "po" && d.picUserId && !["site_manager","procurement"].includes(await employeeRoleKey(env,d.picUserId))) throw new Error("PIC PO/SPK wajib Site Manager proyek atau Admin Logistik. ");
  if (collection === "cco" && d.requestedByUserId) { const rk=await employeeRoleKey(env,d.requestedByUserId); if(rk!=="site_manager") throw new Error("Pengaju lapangan CCO wajib Site Manager."); }
  if (collection === "qc_visit_routes") Object.assign(d,await normalizeQcVisitRoute(env,d));
  if (collection === "project_terms") Object.assign(d,await normalizeProjectTerm(env,d));
  if (collection === "po") normalizeContractFields(d);
  if (collection === "partners") Object.assign(d,normalizePartner(d));
  if (collection === "surat" && d.picUserId && (await employeeRoleKey(env,d.picUserId)) !== "admin_teknik") throw new Error("PIC administrasi surat wajib Admin Teknik.");
  if (collection === "aset" && d.picUserId) { const rk=await employeeRoleKey(env,d.picUserId); if(!["procurement","admin_teknik"].includes(rk)) throw new Error("PIC aset wajib Admin Logistik atau Admin Teknik."); }
  if (collection === "retention" && d.picUserId) { const rk=await employeeRoleKey(env,d.picUserId); if(!["finance","admin_teknik","manager_operasional"].includes(rk)) throw new Error("PIC retensi wajib Finance/Admin Teknik/Manager Operasional."); }
  if (collection === "closeout" && d.ownerUserId) { const rk=await employeeRoleKey(env,d.ownerUserId); if(!["admin_teknik","manager_operasional","site_manager"].includes(rk)) throw new Error("PIC close-out wajib Admin Teknik/Manager Operasional/Site Manager."); }
  return d;
}

/* V3.4.16 — Rute Kunjungan QC: jadwal mingguan berulang (berlaku terus sampai diubah/dinonaktifkan). */
const QC_ROUTE_DAY_LABELS = ["","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
async function normalizeQcVisitRoute(env,d) {
  const projectId=String(d.projectId||"").trim();
  if (!projectId) throw new Error("Proyek tujuan kunjungan QC wajib dipilih.");
  const project=await getRecord(env,"projects",projectId);
  if (!project) throw new Error("Proyek tujuan kunjungan QC tidak ditemukan.");
  const rawDays=Array.isArray(d.days)?d.days:String(d.days??"").split(/[,;\s]+/);
  const days=[...new Set(rawDays.map(x=>Number(x)).filter(x=>Number.isInteger(x)&&x>=1&&x<=7))].sort((a,b)=>a-b);
  if (!days.length) throw new Error("Pilih minimal satu hari kunjungan QC.");
  const time=String(d.time||"").trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Format jam kunjungan harus HH:MM.");
  const order=Math.max(1,Math.min(99,Math.round(Number(d.order)||1)));
  const qcUserId=String(d.qcUserId||"").trim();
  if (qcUserId) { const rk=await employeeRoleKey(env,qcUserId); if(!["qc","koordinator_supporting","manager_operasional"].includes(rk)) throw new Error("Petugas kunjungan wajib QC atau Head of Supporting."); }
  const status=String(d.status||"ACTIVE").toUpperCase()==="INACTIVE"?"INACTIVE":"ACTIVE";
  const durationMin=Math.max(0,Math.min(600,Math.round(Number(d.durationMin)||0)));
  return {projectId,days,dayLabels:days.map(x=>QC_ROUTE_DAY_LABELS[x]),time,order,durationMin,qcUserId,focus:String(d.focus||"").trim().slice(0,300),notes:String(d.notes||"").trim().slice(0,1000),status,recurrence:"WEEKLY"};
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
  const role=normalizeRole(user); const projectSm=await projectRoleUser(env,d.projectId,"site_manager"); const isPic=[String(d.picUserId||""),String(projectSm||"")].filter(Boolean).includes(String(user.id));
  if(action==="start") {
    if(!isPic && !roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"])) return json({ok:false,message:"Hanya Site Manager PIC atau manajemen yang dapat memulai tindak lanjut temuan."},403);
    if(!["OPEN","REVISION REQUIRED"].includes(old)) return json({ok:false,message:"Temuan tidak berada pada status yang dapat mulai dikerjakan."},409);
    d.status="ON PROGRESS"; d.startedAt=new Date().toISOString(); d.startedByUserId=user.id;
  } else if(action==="submit-fix") {
    if(!isPic && !roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","admin_teknik"])) return json({ok:false,message:"Hanya Site Manager PIC atau manajemen yang dapat mengirim hasil tindak lanjut."},403);
    if(old!=="ON PROGRESS") return json({ok:false,message:"Temuan harus ON PROGRESS sebelum dikirim ke QC."},409);
    if(!(file instanceof File) || file.size<=0) return json({ok:false,message:"Foto hasil perbaikan wajib di-upload."},400);
    if(file.type && !String(file.type).toLowerCase().startsWith("image/")) return json({ok:false,message:"Bukti hasil perbaikan harus berupa foto/gambar."},400);
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
  const out=await upsertRecord(env,"defects",id,d,user); await syncWorkflowTask(env,"defects",id,d,user); await audit(env,user,"QC_FINDING_ACTION","defects",id,d.projectId||"",{action,from:old,to:d.status,result}); return json({ok:true,row:out});
}

async function procurementActionHandler(request,env,user,id) {
  const rec=await getRecord(env,"procurement",id); if(!rec) return json({ok:false,message:"PR tidak ditemukan."},404);
  const denied = await requireProjectAccess(env,user,rec.data.projectId); if (denied) return denied;
  const body=await parseJson(request)||{}; const action=String(body.action||"").toLowerCase(); const caps=buildAccess(user).capabilities; let d=normalizePrArrays(rec.data); const old=String(d.status||"DRAFT").toUpperCase(); let next=old;
  if(action==="submit") {
    const assignedPm=await projectAssignment(env,d.projectId,"pm"); if(String(assignedPm||d.projectManagerUserId||"")!==String(user.id||"") && !roleIn(user,["head_unit_bisnis","manager_operasional"])) return json({ok:false,message:"PR hanya dapat disubmit oleh Site Manager proyek, Head of Operational, atau Head Unit Bisnis."},403);
    if(!["DRAFT","REJECTED","REQUESTED"].includes(old)) return json({ok:false,message:"PR tidak dapat diajukan dari status ini."},409);
    if(!d.items.length) return json({ok:false,message:"PR wajib memiliki minimal 1 item pekerjaan/material/jasa."},400);
    if(!truthy(d.coiDeclaration)) return json({ok:false,message:"Deklarasi Conflict of Interest wajib disetujui oleh pengaju sebelum PR diajukan."},400);
    if(!d.vendorOffers.length) return json({ok:false,message:"Site Manager wajib menambahkan minimal satu pembanding vendor sebelum PR dikirim ke Head."},400);
    next="READY_FOR_APPROVAL"; d.submittedByUserId=user.id; d.submittedAt=new Date().toISOString(); d.vendorComparisonReadyAt=d.submittedAt; d.vendorComparisonReadyBy=user.id;
  }
  else if(action==="vendor-ready") {
    const assignedPm=await projectAssignment(env,d.projectId,"pm");
    if(String(assignedPm||d.projectManagerUserId||"")!==String(user.id||"") && !roleIn(user,["manager_operasional","head_unit_bisnis","administrator","direktur"])) return json({ok:false,message:"Pembanding vendor hanya dapat diteruskan oleh Site Manager proyek atau Manajemen."},403);
    if(old!=="SUBMITTED") return json({ok:false,message:"PR harus SUBMITTED sebelum pembanding vendor dikirim."},409);
    if(!d.vendorOffers.length) return json({ok:false,message:"Tambahkan minimal satu penawaran vendor terlebih dahulu."},400);
    next="READY_FOR_APPROVAL"; d.vendorComparisonReadyAt=new Date().toISOString(); d.vendorComparisonReadyBy=user.id;
  }
  else if(action==="select-vendor" || action==="approve") {
    if(!caps.procurementVendorSelect) return json({ok:false,message:"Hanya Head of Operational atau Head Unit Bisnis yang dapat memilih vendor PR."},403);
    if(old!=="READY_FOR_APPROVAL") return json({ok:false,message:"PR dan pembanding vendor harus dikirim Site Manager ke Head sebelum vendor dapat dipilih."},409);
    const offerId=String(body.vendorOfferId||body.offerId||"");
    const offer=d.vendorOffers.find(x=>x.id===offerId);
    if(!offer) return json({ok:false,message:"Pilih salah satu penawaran vendor yang tersedia."},400);
    next="APPROVED"; d.selectedVendorOfferId=offer.id; d.selectedVendorId=offer.vendorId; d.selectedVendorName=offer.vendorName; d.selectedVendorVmlId=offer.vendorVmlId; d.selectedOfferAmount=num(offer.amount); d.approvedByUserId=user.id; d.approvedAt=new Date().toISOString();
  }
  else if(action==="reject") { if(!caps.procurementApprove) return json({ok:false,message:"Role ini tidak dapat reject PR."},403); if(!["SUBMITTED","READY_FOR_APPROVAL","APPROVED"].includes(old)) return json({ok:false,message:"PR tidak dapat direject dari status ini."},409); next="REJECTED"; d.rejectReason=String(body.notes||""); }
  else if(action==="order") { if(!caps.procurementOrder) return json({ok:false,message:"Hanya Site Manager proyek atau Manajemen yang dapat menindaklanjuti vendor setelah SPK/PO dibuat."},403); const assignedPm=await projectAssignment(env,d.projectId,"pm"); if(normalizeRole(user)==="site_manager" && String(assignedPm||d.projectManagerUserId||"")!==String(user.id||"")) return json({ok:false,message:"Anda bukan Site Manager proyek ini."},403); if(old!=="SPK_CREATED") return json({ok:false,message:"SPK/PO harus dibuat Admin Teknik sebelum PR dapat ditandai ORDERED."},409); if(!d.poId) return json({ok:false,message:"Referensi PO/SPK belum tersedia."},409); next="ORDERED"; d.orderedAt=new Date().toISOString(); d.orderedByUserId=user.id; }
  else if(action==="receive") { if(!caps.procurementOrder) return json({ok:false,message:"Hanya Site Manager proyek atau Manajemen yang dapat mengonfirmasi penerimaan material/jasa vendor."},403); const assignedPm=await projectAssignment(env,d.projectId,"pm"); if(normalizeRole(user)==="site_manager" && String(assignedPm||d.projectManagerUserId||"")!==String(user.id||"")) return json({ok:false,message:"Anda bukan Site Manager proyek ini."},403); if(old!=="ORDERED") return json({ok:false,message:"PR harus ORDERED sebelum RECEIVED."},409); next="RECEIVED"; d.receivedAt=new Date().toISOString(); d.receivedByUserId=user.id; }
  else return json({ok:false,message:"Action PR tidak dikenal."},400);
  d.status=next;
  const out=await upsertRecord(env,"procurement",id,d,user);
  if(d.poId && ["order","receive"].includes(action)) {
    const po=await getRecord(env,"po",String(d.poId));
    if(po) {
      const pd={...po.data};
      if(action==="order") { pd.status="ORDERED"; pd.orderedAt=d.orderedAt; }
      if(action==="receive") { pd.receivedAt=d.receivedAt; pd.deliveryStatus="RECEIVED"; }
      const poOut=await upsertRecord(env,"po",po.id,pd,user);
      await afterRecordUpsert(env,"po",poOut,user);
    }
  }
  await syncWorkflowTask(env,"procurement",id,d,user);
  await audit(env,user,"PROCUREMENT_ACTION","procurement",id,d.projectId||"",{action,from:old,to:next,selectedVendor:d.selectedVendorName||"",poId:d.poId||""});
  return json({ok:true,row:out});
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
    await env.FILES.put(parts.key,buf,{httpMetadata:{contentType:request.headers.get("content-type") || "application/octet-stream"},customMetadata:{source:"NARA-SYSTEM-V3.4.29"}});
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



function reportDay(value) {
  const x=String(value || "").slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : "";
}
// V3.4.23: periode dapat dipilih bebas (dari–sampai). Tanpa rentang → Mingguan (Senin–Minggu) / Bulanan (tgl 1–akhir) dari tanggal acuan.
const REPORT_PERIOD_LABEL = {WEEKLY:"Mingguan",MONTHLY:"Bulanan",CUSTOM:"Periode Khusus"};
const REPORT_MAX_RANGE_DAYS = 366;
function reportPeriod(periodType, anchorDate, startDate="", endDate="") {
  const s0=reportDay(startDate), e0=reportDay(endDate);
  if (s0 && e0) {
    if (e0 < s0) throw new Error("Tanggal akhir periode tidak boleh sebelum tanggal awal.");
    const days=Math.round((Date.parse(e0+"T00:00:00Z")-Date.parse(s0+"T00:00:00Z"))/864e5)+1;
    if (days > REPORT_MAX_RANGE_DAYS) throw new Error(`Rentang periode maksimal ${REPORT_MAX_RANGE_DAYS} hari.`);
    const t=String(periodType||"").toUpperCase(); const std=reportPeriod(t==="MONTHLY"?"MONTHLY":"WEEKLY",s0);
    const type=(["WEEKLY","MONTHLY"].includes(t) && std.start===s0 && std.end===e0) ? t : "CUSTOM";
    return {periodType:type,start:s0,end:e0,anchor:s0,days};
  }
  const type=String(periodType || "WEEKLY").toUpperCase()==="MONTHLY" ? "MONTHLY" : "WEEKLY";
  const anchor=reportDay(anchorDate) || new Date().toISOString().slice(0,10);
  const d=new Date(anchor+"T12:00:00Z");
  let start,end;
  if(type==="MONTHLY") {
    start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,12));
    end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12));
  } else {
    const day=d.getUTCDay() || 7;
    start=new Date(d); start.setUTCDate(d.getUTCDate()-(day-1));
    end=new Date(start); end.setUTCDate(start.getUTCDate()+6);
  }
  return {periodType:type,start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10),anchor};
}
function inReportPeriod(value,start,end) { const d=reportDay(value); return Boolean(d && d>=start && d<=end); }
function qcSnapshotScore(rows) {
  if(!rows.length) return 100;
  const weights={MINOR:1,MAJOR:2,CRITICAL:3,"C - MINOR":1,"B - MAYOR":2,"A - KRITIS":3};
  let total=0,got=0;
  for(const r of rows){const d=r.data||r;const w=weights[String(d.severity||"MINOR").toUpperCase()]||1;total+=w;if(String(d.status||"").toUpperCase()==="CLOSED"){const late=d.deadline&&d.closedAt&&reportDay(d.closedAt)>reportDay(d.deadline);got+=w*(late ? 0.6 : 1);}}
  return total?Math.round(got/total*100):100;
}
async function headUnitRecipients(env) {
  const rows=await allRows(env,"users");
  return rows.filter(r=>normalizeRole(r.data)==="head_unit_bisnis" && String(r.data.status||"Aktif").toLowerCase()!=="nonaktif").map(r=>({id:r.id,name:r.data.name||r.data.username||r.id,role:r.data.role||"Head Unit Bisnis"}));
}
async function projectNameMap(env) { const rows=await allRows(env,"projects"); return Object.fromEntries(rows.map(r=>[String(r.id),String(r.data.name||r.data.project_name||r.data.projectName||r.data.namaProyek||r.id)])); }
async function employeeNameMap(env) { const rows=await allRows(env,"users"); return Object.fromEntries(rows.map(r=>[String(r.id),String(r.data.name||r.data.username||r.id)])); }

async function buildQcReportSnapshot(env, range, opts={}) {
  const scope=String(opts.projectId||""); const inScope=r=>!scope||String(r.data.projectId||"")===scope; const photos=Boolean(opts.withPhotos);
  let [sessions,items,findings,projects,employees]=await Promise.all([allRows(env,"qc_inspection_sessions"),allRows(env,"qc_inspection_items"),allRows(env,"defects"),projectNameMap(env),employeeNameMap(env)]);
  sessions=sessions.filter(inScope); items=items.filter(inScope); findings=findings.filter(inScope);
  const periodItems=items.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const sessionIds=new Set(periodItems.map(r=>String(r.data.sessionId||"")));
  const periodSessions=sessions.filter(r=>sessionIds.has(String(r.id)));
  const periodFindings=findings.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const allOpen=findings.filter(r=>String(r.data.status||"OPEN").toUpperCase()!=="CLOSED");
  const sesuai=periodItems.filter(r=>String(r.data.result||"").toUpperCase()==="SESUAI").length;
  const tidak=periodItems.filter(r=>String(r.data.result||"").toUpperCase()==="TIDAK SESUAI").length;
  const konfirmasi=periodItems.filter(r=>String(r.data.result||"").toUpperCase()==="BUTUH KONFIRMASI").length;
  const total=periodItems.length;
  const waiting=periodFindings.filter(r=>String(r.data.status||"").toUpperCase()==="WAITING QC CHECK").length;
  const closedRows=periodFindings.filter(r=>String(r.data.status||"").toUpperCase()==="CLOSED");
  const closedOnTime=closedRows.filter(r=>!r.data.deadline||!r.data.closedAt||reportDay(r.data.closedAt)<=reportDay(r.data.deadline)).length;
  const today=new Date().toISOString().slice(0,10);
  const overdue=allOpen.filter(r=>r.data.deadline&&reportDay(r.data.deadline)<today).length;
  const perGroup={};
  for(const r of periodItems){const g=String(r.data.workGroup||"Tanpa Kelompok");if(!perGroup[g])perGroup[g]={workGroup:g,total:0,sesuai:0,tidak:0,konfirmasi:0};perGroup[g].total++;const rr=String(r.data.result).toUpperCase();if(rr==="SESUAI")perGroup[g].sesuai++;else if(rr==="BUTUH KONFIRMASI")perGroup[g].konfirmasi++;else perGroup[g].tidak++;}
  return {
    metrics:{catatanInspeksi:periodSessions.length,subPekerjaan:total,sesuai,tidakSesuai:tidak,butuhKonfirmasi:konfirmasi,kesesuaian:(sesuai+tidak)?Math.round(sesuai/(sesuai+tidak)*100):0,totalTemuan:periodFindings.length,openPerbaikan:periodFindings.filter(r=>String(r.data.status||"").toUpperCase()!=="CLOSED").length,menungguVerifikasi:waiting,closedOnTime,overdue,qcScore:qcSnapshotScore(periodFindings),temuanSelesai:closedRows.length,totalOpen:allOpen.length},
    groups:Object.values(perGroup).sort((a,b)=>a.workGroup.localeCompare(b.workGroup,"id")),
    inspections:periodItems.slice().sort((a,b)=>String(b.data.date||"").localeCompare(String(a.data.date||""))).map(r=>({date:r.data.date,projectId:r.data.projectId,project:projects[r.data.projectId]||r.data.projectId||"-",workGroup:r.data.workGroup||"-",item:r.data.item||"-",result:r.data.result||"-",note:r.data.note||"",inspector:employees[r.data.inspectorUserId]||r.data.inspectorUserId||"-",findingId:r.data.findingId||"",photoDocId:photos?(r.data.evidenceDocumentId||""):""})).slice(0,500),
    findings:periodFindings.slice().sort((a,b)=>String(b.data.date||"").localeCompare(String(a.data.date||""))).map(r=>({id:r.id,date:r.data.date,projectId:r.data.projectId,project:projects[r.data.projectId]||r.data.projectId||"-",area:r.data.area||r.data.item||"-",category:r.data.category||"-",description:r.data.description||r.data.notes||"-",severity:r.data.severity||"-",pic:employees[r.data.picUserId]||r.data.picUserId||"-",deadline:r.data.deadline||"",status:r.data.status||"OPEN",closedAt:r.data.closedAt||"",beforeDocId:photos?(r.data.beforeDocumentId||""):"",afterDocId:photos?(r.data.lastFixDocumentId||""):""})).slice(0,300),
    attention:allOpen.slice().sort((a,b)=>String(a.data.deadline||"9999").localeCompare(String(b.data.deadline||"9999"))).slice(0,30).map(r=>({id:r.id,project:projects[r.data.projectId]||r.data.projectId||"-",description:r.data.description||r.data.item||"-",pic:employees[r.data.picUserId]||r.data.picUserId||"-",deadline:r.data.deadline||"",status:r.data.status||"OPEN"}))
  };
}

async function buildAtiReportSnapshot(env, range) {
  const [workers,attendance,allAssess,training,requests,issues,evals,projects,employees]=await Promise.all([allRows(env,"tukang"),allRows(env,"daily_workers"),allRows(env,"ati_assessments"),allRows(env,"pelatihan"),allRows(env,"ati_work_requests"),allRows(env,"ati_field_issues"),allRows(env,"ati_issue_evaluations"),projectNameMap(env),employeeNameMap(env)]);
  const active=workers.filter(r=>String(r.data.status||"AKTIF").toUpperCase()==="AKTIF");
  const att=attendance.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const assess=allAssess.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const trainings=training.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const req=requests.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const iss=issues.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const ev=evals.filter(r=>inReportPeriod(r.data.date,range.start,range.end));
  const latest=new Map();
  for(const r of allAssess.filter(r=>!reportDay(r.data.date)||reportDay(r.data.date)<=range.end).sort((a,b)=>String(a.data.date||"").localeCompare(String(b.data.date||"")))) latest.set(String(r.data.workerId),Number(r.data.score||0));
  const avg=latest.size?[...latest.values()].reduce((a,b)=>a+b,0)/latest.size:0;
  const available=active.filter(r=>String(r.data.availability||"").toUpperCase()!=="TIDAK TERSEDIA").length;
  const joined=workers.filter(r=>inReportPeriod(r.data.joinDate||r.data.inputDate,range.start,range.end)).length;
  const exited=workers.filter(r=>inReportPeriod(r.data.exitDate,range.start,range.end)).length;
  const presentEntries=att.filter(r=>["HADIR","SETENGAH HARI"].includes(String(r.data.attendanceStatus||"").toUpperCase())).length;
  const payroll=att.reduce((s,r)=>s+Number(r.data.amount||0),0);
  const levels=["L0","L1","L2","L3","L4","L5","L6"].map(level=>({level,count:active.filter(r=>String(r.data.atiLevel||"")===level).length}));
  const top=active.map(w=>({workerId:w.id,name:w.data.name||w.id,skill:w.data.skill1||w.data.skill||"-",level:w.data.atiLevel||"-",score:latest.has(String(w.id))?latest.get(String(w.id)):Number(w.data.rating||0)})).sort((a,b)=>b.score-a.score).slice(0,10);
  return {
    metrics:{totalDatabase:workers.length,aktif:active.length,available,hadirPeriode:presentEntries,masukPeriode:joined,keluarPeriode:exited,totalUpah:payroll,avgPerformance:Math.round(avg*10)/10},
    levels,top,
    attendance:att.slice().sort((a,b)=>String(b.data.date||"").localeCompare(String(a.data.date||""))).map(r=>({date:r.data.date,project:projects[r.data.projectId]||r.data.projectId||"-",worker:r.data.workerName||r.data.workerId||"-",status:r.data.attendanceStatus||"-",dailyRate:Number(r.data.dailyRate||0),overtimeHours:Number(r.data.overtimeHours||0),amount:Number(r.data.amount||0)})).slice(0,500),
    requests:req.map(r=>({date:r.data.date,project:projects[r.data.projectId]||r.data.projectId||"-",workPackage:r.data.workPackage||"-",requiredWorkers:Number(r.data.requiredWorkers||0),requiredSkill:r.data.requiredSkill||"-",status:r.data.status||"-"})).slice(0,200),
    issues:iss.map(r=>({date:r.data.date,project:projects[r.data.projectId]||r.data.projectId||"-",worker:r.data.workerId||"",problem:r.data.problem||"-",pic:employees[r.data.picUserId]||r.data.picUserId||"-",deadline:r.data.deadline||"",status:r.data.status||"OPEN"})).slice(0,200),
    evaluations:ev.map(r=>({date:r.data.date,issueId:r.data.issueId||"",evaluator:employees[r.data.evaluatorUserId]||r.data.evaluatorUserId||"-",rootCause:r.data.rootCause||"-",resolution:r.data.resolution||"-",outcome:r.data.outcome||"",status:r.data.status||"-"})).slice(0,200),
    assessments:assess.map(r=>({date:r.data.date,workerId:r.data.workerId||"",project:projects[r.data.projectId]||r.data.projectId||"-",assessor:employees[r.data.assessorUserId]||r.data.assessorUserId||"-",score:Number(r.data.score||0),notes:r.data.notes||""})).slice(0,200),
    training:trainings.map(r=>({date:r.data.date,workerId:r.data.workerId||"",name:r.data.name||"-",trainer:r.data.trainer||"-",result:r.data.result||"-",status:r.data.status||"-"})).slice(0,200)
  };
}

async function generateDivisionReport(request,env,user,type) {
  const t=String(type||"").toUpperCase();
  const cap=buildAccess(user).capabilities;
  if(t==="QC" && !cap.qcReportCreate) return json({ok:false,message:"Role ini tidak dapat membuat laporan QC."},403);
  if(t==="ATI" && !cap.atiReportCreate) return json({ok:false,message:"Role ini tidak dapat membuat laporan ATI."},403);
  if(!["QC","ATI"].includes(t)) return json({ok:false,message:"Jenis laporan tidak dikenal."},400);
  const body=await parseJson(request)||{}; let range; try { range=reportPeriod(body.periodType,body.anchorDate,body.startDate,body.endDate); } catch(e) { return json({ok:false,message:e.message},400); }
  const recipients=await headUnitRecipients(env);
  if(!recipients.length) return json({ok:false,message:"Belum ada akun aktif dengan role Head Unit Bisnis sebagai penerima laporan."},400);
  const kind=t==="QC"?(String(body.reportKind||"INSPEKSI").toUpperCase()==="TEMUAN"?"TEMUAN":"INSPEKSI"):"";
  const scopeId=t==="QC"?String(body.projectId||""):""; if(scopeId){ const denied=await requireProjectAccess(env,user,scopeId); if(denied) return denied; }
  const withPhotos=t==="QC"&&body.withPhotos!==false&&body.withPhotos!=="false";
  const snapshot=t==="QC"?await buildQcReportSnapshot(env,range,{projectId:scopeId,withPhotos}):await buildAtiReportSnapshot(env,range);
  const pnames=scopeId?await projectNameMap(env):{};
  if(t==="QC"){ const mm=snapshot.metrics||{}; if(kind==="INSPEKSI"&&!mm.subPekerjaan) return json({ok:false,message:"Tidak ada hasil inspeksi QC pada periode/lingkup ini. Pilih periode lain atau buat Laporan Temuan."},400); if(kind==="TEMUAN"&&!mm.totalTemuan&&!(snapshot.attention||[]).length) return json({ok:false,message:"Tidak ada temuan QC pada periode/lingkup ini."},400); }
  const id=crypto.randomUUID(); const label=REPORT_PERIOD_LABEL[range.periodType]||"Mingguan";
  const fmtD=v=>{const [y,m,d]=String(v).split("-");return `${Number(d)} ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][Number(m)-1]||m} ${y}`;};
  const title=t==="QC"?`Laporan ${kind==="TEMUAN"?"Temuan":"Inspeksi"} QC ${label} ${fmtD(range.start)} – ${fmtD(range.end)}${scopeId?` — ${pnames[scopeId]||scopeId}`:""}`:`Laporan ${t} ${label} ${fmtD(range.start)} – ${fmtD(range.end)}`;
  const data={reportType:t,reportKind:kind,projectId:scopeId,projectName:scopeId?(pnames[scopeId]||scopeId):"",withPhotos,periodType:range.periodType,periodStart:range.start,periodEnd:range.end,title,status:"SUBMITTED",notes:String(body.notes||""),submittedAt:new Date().toISOString(),submittedByUserId:user.id,submittedByName:user.name||user.username||user.id,recipientRole:"Head Unit Bisnis",recipients,snapshot};
  const collection=t==="QC"?"qc_reports":"ati_reports"; const row=await upsertRecord(env,collection,id,data,user); await syncWorkflowTask(env,collection,id,data,user); await audit(env,user,"DIVISION_REPORT_SUBMIT",collection,id,"",{periodType:range.periodType,start:range.start,end:range.end,recipients:recipients.map(x=>x.id)}); return json({ok:true,row});
}

async function reviewDivisionReport(env,user,type,id) {
  if(!buildAccess(user).capabilities.divisionReportReview) return json({ok:false,message:"Hanya Head Unit Bisnis/Direktur/Administrator yang dapat menandai laporan telah direview."},403);
  const t=String(type||"").toUpperCase(); const collection=t==="QC"?"qc_reports":t==="ATI"?"ati_reports":""; if(!collection) return json({ok:false,message:"Jenis laporan tidak dikenal."},400);
  const rec=await getRecord(env,collection,id); if(!rec) return json({ok:false,message:"Laporan tidak ditemukan."},404);
  const data={...rec.data,status:"REVIEWED",reviewedAt:new Date().toISOString(),reviewedByUserId:user.id,reviewedByName:user.name||user.username||user.id}; const row=await upsertRecord(env,collection,id,data,user); await syncWorkflowTask(env,collection,id,data,user); await audit(env,user,"DIVISION_REPORT_REVIEW",collection,id,"",{}); return json({ok:true,row});
}

async function readDivisionReport(env,user,type,id) {
  const t=String(type||"").toUpperCase(); const collection=t==="QC"?"qc_reports":t==="ATI"?"ati_reports":""; if(!collection) return json({ok:false,message:"Jenis laporan tidak dikenal."},400);
  const rec=await getRecord(env,collection,id); if(!rec) return json({ok:false,message:"Laporan tidak ditemukan."},404);
  // Hanya penerima (Head Unit Bisnis/Direktur) yang dihitung "Dibaca"; Administrator & pengirim tidak mengubah status.
  if(!roleIn(user,["head_unit_bisnis","direktur"])) return json({ok:true,row:rec,counted:false});
  const reads=Array.isArray(rec.data.reads)?rec.data.reads.slice():[]; const now=new Date().toISOString();
  if(!reads.some(r=>r.userId===user.id)) reads.push({userId:user.id,name:user.name||user.username||user.id,at:now});
  const data={...rec.data,reads,readAt:rec.data.readAt||now,readByUserId:rec.data.readByUserId||user.id,readByName:rec.data.readByName||user.name||user.username||user.id};
  const row=await upsertRecord(env,collection,id,data,user); if(!rec.data.readAt) await audit(env,user,"DIVISION_REPORT_READ",collection,id,"",{});
  return json({ok:true,row,counted:true});
}

async function updateDivisionReport(request,env,user,type,id) {
  const t=String(type||"").toUpperCase(); const cap=buildAccess(user).capabilities;
  if(t==="QC" && !cap.qcReportCreate) return json({ok:false,message:"Role ini tidak dapat mengedit laporan QC."},403);
  if(t==="ATI" && !cap.atiReportCreate) return json({ok:false,message:"Role ini tidak dapat mengedit laporan ATI."},403);
  const collection=t==="QC"?"qc_reports":t==="ATI"?"ati_reports":""; if(!collection) return json({ok:false,message:"Jenis laporan tidak dikenal."},400);
  const rec=await getRecord(env,collection,id); if(!rec) return json({ok:false,message:"Laporan tidak ditemukan."},404);
  const body=await parseJson(request)||{}; const data={...rec.data};
  if(body.title!==undefined) data.title=String(body.title||rec.data.title||"").trim()||rec.data.title;
  if(body.notes!==undefined) data.notes=String(body.notes||"");
  const row=await upsertRecord(env,collection,id,data,user); await audit(env,user,"DIVISION_REPORT_EDIT",collection,id,"",{status:data.status||""}); return json({ok:true,row});
}

async function deleteDivisionReport(env,user,type,id) {
  const t=String(type||"").toUpperCase(); const cap=buildAccess(user).capabilities;
  if(t==="QC" && !cap.qcReportCreate) return json({ok:false,message:"Role ini tidak dapat menghapus laporan QC."},403);
  if(t==="ATI" && !cap.atiReportCreate) return json({ok:false,message:"Role ini tidak dapat menghapus laporan ATI."},403);
  const collection=t==="QC"?"qc_reports":t==="ATI"?"ati_reports":""; if(!collection) return json({ok:false,message:"Jenis laporan tidak dikenal."},400);
  const rec=await getRecord(env,collection,id); if(!rec) return json({ok:true});
  await cancelWorkflowTasks(env,collection,id,user); await deleteRecord(env,collection,id,user); await audit(env,user,"DIVISION_REPORT_DELETE",collection,id,"",{status:rec.data.status||""}); return json({ok:true});
}

function publicSlug(value) {
  return String(value || "").trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90) || "portofolio";
}

async function allRows(env, collection) {
  const res = await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection=? ORDER BY updated_at DESC`).bind(collection).all();
  return (res.results || []).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{}),updated_at:r.updated_at}));
}

function publicPortfolioPayload(row, includeDescription=false) {
  const d=row?.data||{};
  const galleryIds=Array.isArray(d.galleryDocumentIds)?d.galleryDocumentIds.map(String).filter(Boolean):[];
  const staticGallery=Array.isArray(d.galleryUrls)?d.galleryUrls.map(String).filter(Boolean):[];
  const documentGallery=galleryIds.map(id=>`/api/public/media/${encodeURIComponent(id)}`);
  const coverUrl=d.coverDocumentId?`/api/public/media/${encodeURIComponent(d.coverDocumentId)}`:String(d.coverUrl||'');
  const out={
    id:String(row.id||''),slug:String(d.slug||publicSlug(d.title||row.id)),title:String(d.title||'Portofolio Natara'),
    category:String(d.category||'Konstruksi'),location:String(d.location||''),year:String(d.year||''),summary:String(d.summary||''),
    featured:truthy(d.featured),coverDocumentId:String(d.coverDocumentId||''),coverUrl,
    galleryCount:documentGallery.length+staticGallery.length,galleryUrls:[...documentGallery,...staticGallery],
    specs:(d.specs&&typeof d.specs==='object'&&!Array.isArray(d.specs))?d.specs:{}
  };
  if(includeDescription) out.description=String(d.description||'');
  return out;
}

async function publicSiteHandler(env) {
  const row=await getRecord(env,'public_site_settings','main');
  const d=row?.data||{};
  const asList=(v,fallback=[])=>Array.isArray(v)?v:fallback;
  return json({ok:true,site:{
    title:String(d.title||'Natara Konstruksi'),
    tagline:String(d.tagline||'Membangun dengan Arah.'),
    about:String(d.about||'Natara Konstruksi adalah perusahaan jasa konstruksi yang berfokus pada pembangunan yang terencana, terarah, dan bertanggung jawab. Kami hadir sebagai mitra pembangunan bagi klien yang menghargai proses, kejelasan kerja, dan kualitas jangka panjang.'),
    philosophy:String(d.philosophy||'Menata pembangunan dengan arah yang jelas dan tanggung jawab penuh.'),
    vision:String(d.vision||'Menjadi perusahaan konstruksi yang terpercaya dan berkelanjutan melalui sistem kerja yang terarah, profesional, dan bertanggung jawab.'),
    mission:asList(d.mission,[
      'Menyediakan layanan konstruksi yang terencana, terukur, dan sesuai standar teknis.',
      'Menjaga amanah klien melalui transparansi biaya, waktu, dan proses kerja.',
      'Mengedepankan pengawasan dan pengendalian mutu di setiap proyek.',
      'Membangun hubungan jangka panjang dengan klien dan mitra kerja.'
    ]),
    values:asList(d.values,[
      {title:'Amanah',description:'Menjalankan setiap proyek dengan kejujuran dan tanggung jawab.'},
      {title:'Terstruktur',description:'Bekerja dengan sistem, perencanaan, dan alur kerja yang jelas.'},
      {title:'Profesional',description:'Didukung oleh tim dan proses yang rapi serta berorientasi pada kualitas.'},
      {title:'Berkelanjutan',description:'Fokus pada hasil jangka panjang, bukan sekadar penyelesaian cepat.'}
    ]),
    serviceGroups:asList(d.serviceGroups,[
      {title:'Jasa Konstruksi',items:['Pembangunan rumah tinggal','Bangunan komersial & usaha','Bangunan pendukung lainnya']},
      {title:'Renovasi & Pengembangan',items:['Renovasi bangunan eksisting','Pengembangan fungsi dan kualitas bangunan']},
      {title:'Manajemen Proyek',items:['Perencanaan dan pengendalian proyek','Pengawasan pelaksanaan di lapangan','Koordinasi dengan konsultan dan klien']}
    ]),
    approach:asList(d.approach,[
      {title:'Perencanaan',description:'Analisis kebutuhan, penyusunan konsep, dan perhitungan teknis.'},
      {title:'Penataan & Persiapan',description:'Penyusunan anggaran, timeline, dan metode kerja.'},
      {title:'Pelaksanaan & Pengawasan',description:'Pekerjaan lapangan dengan kontrol mutu dan progres yang ketat.'},
      {title:'Evaluasi & Serah Terima',description:'Pemeriksaan hasil akhir dan penyelesaian proyek secara bertanggung jawab.'}
    ]),
    advantages:asList(d.advantages,['Proses kerja jelas dan terstruktur','Fokus pada perencanaan dan pengawasan','Transparansi dalam komunikasi dan anggaran','Komitmen terhadap amanah dan kualitas']),
    audience:asList(d.audience,['Ingin membangun dengan tenang','Menghargai proses dan kejelasan kerja','Berorientasi pada kualitas jangka panjang']),
    closing:String(d.closing||'Natara Konstruksi hadir untuk menjawab kebutuhan pembangunan yang tidak hanya kuat secara fisik, tetapi juga dapat dipertanggungjawabkan secara proses dan nilai.'),
    services:Array.isArray(d.services)?d.services:String(d.services||'Jasa Konstruksi, Renovasi & Pengembangan, Manajemen Proyek').split(',').map(x=>x.trim()).filter(Boolean),
    portfolioIntro:String(d.portfolioIntro||'Portofolio karya Natara Konstruksi dari hunian, usaha, hingga proyek pengembangan bangunan.'),
    contactLabel:String(d.contactLabel||'Hubungi Natara'),contactUrl:String(d.contactUrl||''),instagramUrl:String(d.instagramUrl||''),address:String(d.address||'')
  }});
}

async function publicPortfolioHandler(env) {
  const rows=(await allRows(env,'public_portfolio')).filter(r=>truthy(r.data.published)).map(r=>publicPortfolioPayload(r,false));
  rows.sort((a,b)=>Number(b.featured)-Number(a.featured)||String(b.year||'').localeCompare(String(a.year||''))||a.title.localeCompare(b.title,'id'));
  return json({ok:true,portfolio:rows});
}

async function publicPortfolioDetailHandler(env, slug) {
  const rows=(await allRows(env,'public_portfolio')).filter(r=>truthy(r.data.published));
  const row=rows.find(r=>String(r.data.slug||publicSlug(r.data.title||r.id))===String(slug));
  if(!row) return json({ok:false,message:'Portofolio tidak ditemukan.'},404);
  return json({ok:true,portfolio:publicPortfolioPayload(row,true)});
}

async function publicMediaHandler(env, docId) {
  const id=String(docId||'');
  const portfolio=(await allRows(env,'public_portfolio')).filter(r=>truthy(r.data.published));
  const allowed=portfolio.some(r=>String(r.data.coverDocumentId||'')===id || (Array.isArray(r.data.galleryDocumentIds)&&r.data.galleryDocumentIds.map(String).includes(id)));
  if(!allowed) return json({ok:false,message:'Media tidak tersedia untuk publik.'},404);
  const doc=await getRecord(env,'project_documents',id);
  if(!doc?.data?.objectKey||!env.FILES) return json({ok:false,message:'Media tidak ditemukan.'},404);
  const obj=await env.FILES.get(doc.data.objectKey);
  if(!obj) return json({ok:false,message:'Media tidak ditemukan.'},404);
  const headers=new Headers();
  headers.set('content-type',doc.data.mimeType||obj.httpMetadata?.contentType||'application/octet-stream');
  headers.set('cache-control','public, max-age=3600');
  headers.set('x-content-type-options','nosniff');
  return new Response(obj.body,{headers});
}

async function servePublicPortal(request, env) {
  if(!env.ASSETS) return json({ok:false,message:'ASSETS binding belum tersedia.'},503);
  const u=new URL(request.url);u.pathname='/public.html';u.search='';
  return env.ASSETS.fetch(new Request(u.toString(),{method:'GET',headers:request.headers}));
}

async function serveAssets(request, env) {
  if (!env.ASSETS) return json({ok:false,message:"ASSETS binding belum tersedia."},503);
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;
  const indexReq = new Request(new URL("/index.html",request.url),{method:"GET",headers:request.headers});
  return env.ASSETS.fetch(indexReq);
}


/* ============================================================================
 * V3.4.19 — NOTIFIKASI EMAIL TUGAS
 * Setiap tugas baru (Tugas Saya) yang terbentuk dari tindakan pengguna dikirim
 * ke email penerima. Email disimpan dulu di outbox (collection email_outbox),
 * lalu dikirim di latar belakang (ctx.waitUntil) sehingga tidak memperlambat
 * aplikasi. Gagal kirim dicoba ulang otomatis oleh Cron setiap 5 menit.
 *
 * Konfigurasi (wrangler vars / secrets):
 *   EMAIL_PROVIDER   = "gas" | "brevo" | "resend"   (kosong = notifikasi nonaktif)
 *   EMAIL_GAS_URL    = URL Web App Google Apps Script (provider gas)
 *   EMAIL_GAS_SECRET = kunci rahasia bersama Apps Script (secret)
 *   EMAIL_API_KEY    = API key Brevo / Resend (secret)
 *   EMAIL_FROM       = alamat pengirim terverifikasi (brevo/resend)
 *   EMAIL_FROM_NAME  = nama pengirim
 *   APP_BASE_URL     = alamat aplikasi untuk tombol "Buka Tugas Saya"
 * ==========================================================================*/
const EMAIL_OUTBOX = "email_outbox";
const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_FLUSH_BATCH = 25;
let EMAIL_PENDING_FLUSH = false;
let REQUEST_ORIGIN = "";

function emailConfig(env) {
  const provider=String(env.EMAIL_PROVIDER||"").trim().toLowerCase();
  const cfg={provider,fromName:String(env.EMAIL_FROM_NAME||"Nara System — Natara Konstruksi"),from:String(env.EMAIL_FROM||"").trim(),apiKey:String(env.EMAIL_API_KEY||""),gasUrl:String(env.EMAIL_GAS_URL||"").trim(),gasSecret:String(env.EMAIL_GAS_SECRET||""),baseUrl:String(env.APP_BASE_URL||REQUEST_ORIGIN||"").replace(/\/+$/,"")};
  let ready=false,missing=[];
  if(provider==="gas"){ if(!cfg.gasUrl) missing.push("EMAIL_GAS_URL"); if(!cfg.gasSecret) missing.push("EMAIL_GAS_SECRET"); }
  else if(provider==="brevo"||provider==="resend"){ if(!cfg.apiKey) missing.push("EMAIL_API_KEY"); if(!cfg.from) missing.push("EMAIL_FROM"); }
  else if(provider) missing.push("EMAIL_PROVIDER tidak dikenal (gas/brevo/resend)");
  else missing.push("EMAIL_PROVIDER");
  ready=missing.length===0;
  return {...cfg,ready,missing};
}
function validEmail(v){ return /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(String(v||"").trim()); }
function userWantsEmail(d){ const v=d?.emailNotifications; return !(v===false || String(v).toLowerCase()==="false" || String(v)==="0"); }
function userActive(d){ return !["nonaktif","inactive","disabled"].includes(String(d?.status||"").toLowerCase()); }

async function taskEmailRecipients(env,task,actor) {
  const res=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='users'`).all();
  const users=(res.results||[]).map(r=>({id:String(r.id),data:safeJsonParse(r.data_json,{})}));
  let targets=[];
  if(task.assigneeUserId) targets=users.filter(u=>u.id===String(task.assigneeUserId));
  else if(task.assigneeRole) {
    targets=users.filter(u=>normalizeRole(u.data)===task.assigneeRole);
    // Antrean role yang terikat proyek (mis. Site Manager) hanya ke yang ditugaskan di proyek tsb.
    if(task.projectId && isProjectScopedRole({role:task.assigneeRole})){
      const p=await getRecord(env,"projects",String(task.projectId));
      targets=targets.filter(u=>p && projectAssignedToUser(p.data,{...u.data,id:u.id,username:u.data.username,role:task.assigneeRole}));
    }
  }
  return targets.filter(u=>u.id!==String(actor?.id||"") && userActive(u.data) && userWantsEmail(u.data) && validEmail(u.data.email));
}

function taskEmailContent(task,recipient,projectNameText,baseUrl) {
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const prio=String(task.priority||"NORMAL").toUpperCase();
  const prioColor={CRITICAL:"#b42318",HIGH:"#c4320a"}[prio]||"#475467";
  const link=baseUrl?`${baseUrl}/?view=tasks`:"";
  const deadline=task.dueDate?new Date(task.dueDate).toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Makassar"}):"-";
  const subject=`[Nara System] ${prio!=="NORMAL"?`[${prio}] `:""}${task.title||"Tugas baru"}${projectNameText?` — ${projectNameText}`:""}`;
  const rows=[["Tugas",task.title],["Proyek",projectNameText||"-"],["Yang perlu dilakukan",task.waitingFor],["Tindakan",task.actionLabel],["Prioritas",prio],["Deadline",deadline],["Dari",task.fromUserName||"Nara System"]];
  const html=`<!doctype html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#101828">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden">
<tr><td style="background:#101828;padding:18px 24px;color:#ffffff"><div style="font-size:11px;letter-spacing:2px;color:#f97316;font-weight:bold">NARA SYSTEM · NATARA KONSTRUKSI</div><div style="font-size:18px;font-weight:bold;margin-top:6px">Tugas baru untuk Anda</div></td></tr>
<tr><td style="padding:20px 24px 8px;font-size:14px;line-height:1.5">Halo <b>${esc(recipient.data.name||recipient.data.username||"")}</b>,<br>ada tugas yang menunggu tindakan Anda di Nara System.</td></tr>
<tr><td style="padding:8px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse">
${rows.map(([k,v])=>`<tr><td style="padding:8px 0;border-bottom:1px solid #f2f4f7;color:#667085;width:42%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #f2f4f7;font-weight:bold;${k==="Prioritas"?`color:${prioColor}`:""}">${esc(v||"-")}</td></tr>`).join("")}
</table></td></tr>
${link?`<tr><td style="padding:18px 24px 6px"><a href="${esc(link)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 18px;border-radius:8px">Buka Tugas Saya</a></td></tr>`:""}
<tr><td style="padding:14px 24px 22px;font-size:11px;color:#98a2b3;line-height:1.5">Email ini dikirim otomatis oleh Nara System. Selesaikan tugas melalui tombol workflow di aplikasi agar tahap berikutnya otomatis diteruskan.</td></tr>
</table></td></tr></table></body></html>`;
  const text=`Tugas baru untuk Anda — Nara System\n\n${rows.map(([k,v])=>`${k}: ${v||"-"}`).join("\n")}\n${link?`\nBuka Tugas Saya: ${link}\n`:""}`;
  return {subject,html,text};
}

async function enqueueTaskEmails(env,taskId,task,actor) {
  const recipients=await taskEmailRecipients(env,task,actor);
  if(!recipients.length) return 0;
  let projectNameText="";
  if(task.projectId){ const p=await getRecord(env,"projects",String(task.projectId)); projectNameText=String(p?.data?.name||p?.data?.projectName||p?.data?.namaProyek||""); }
  const cfg=emailConfig(env); const now=new Date().toISOString();
  for(const r of recipients){
    const c=taskEmailContent(task,r,projectNameText,cfg.baseUrl);
    const id=`MAIL-${taskId}-${r.id}`.slice(0,120);
    await env.DB.prepare(`INSERT INTO app_records(collection,id,data_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(collection,id) DO NOTHING`).bind(EMAIL_OUTBOX,id,JSON.stringify({
      kind:"TASK",taskId,projectId:task.projectId||"",stage:task.stage||"",userId:r.id,to:String(r.data.email).trim(),toName:r.data.name||r.data.username||"",
      subject:c.subject,html:c.html,text:c.text,status:cfg.ready?"PENDING":"NOT_CONFIGURED",attempts:0,createdAt:now,createdBy:actor?.name||actor?.username||""
    }),now).run();
  }
  if(cfg.ready) EMAIL_PENDING_FLUSH=true;
  return recipients.length;
}

async function sendEmailViaProvider(cfg,mail) {
  let res;
  if(cfg.provider==="gas"){
    res=await fetch(cfg.gasUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({secret:cfg.gasSecret,to:mail.to,toName:mail.toName,subject:mail.subject,html:mail.html,text:mail.text,fromName:cfg.fromName}),redirect:"follow"});
    const body=await res.text(); let out=null; try{out=JSON.parse(body);}catch(_){}
    if(!res.ok || !out || out.ok!==true) throw new Error(`Apps Script: ${out?.message||body.slice(0,180)||res.status}`);
    return out.id||"gas";
  }
  if(cfg.provider==="brevo"){
    res=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"content-type":"application/json","accept":"application/json","api-key":cfg.apiKey},body:JSON.stringify({sender:{name:cfg.fromName,email:cfg.from},to:[{email:mail.to,name:mail.toName||mail.to}],subject:mail.subject,htmlContent:mail.html,textContent:mail.text})});
    const out=await res.json().catch(()=>({})); if(!res.ok) throw new Error(`Brevo ${res.status}: ${out.message||out.code||""}`); return out.messageId||"brevo";
  }
  if(cfg.provider==="resend"){
    res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${cfg.apiKey}`},body:JSON.stringify({from:`${cfg.fromName} <${cfg.from}>`,to:[mail.to],subject:mail.subject,html:mail.html,text:mail.text})});
    const out=await res.json().catch(()=>({})); if(!res.ok) throw new Error(`Resend ${res.status}: ${out.message||out.name||""}`); return out.id||"resend";
  }
  throw new Error("Provider email belum dikonfigurasi.");
}

async function flushEmailOutbox(env,{retry=false,limit=EMAIL_FLUSH_BATCH}={}) {
  const cfg=emailConfig(env); if(!cfg.ready) return {sent:0,failed:0,skipped:"not-configured"};
  const nowIso=new Date().toISOString();
  if(retry){
    // pulihkan yang macet di SENDING > 10 menit, dan antrekan ulang yang gagal (maks EMAIL_MAX_ATTEMPTS)
    await env.DB.prepare(`UPDATE app_records SET data_json=json_set(data_json,'$.status','PENDING'), updated_at=? WHERE collection=? AND json_extract(data_json,'$.status')='SENDING' AND updated_at < ?`).bind(nowIso,EMAIL_OUTBOX,new Date(Date.now()-10*60000).toISOString()).run();
    await env.DB.prepare(`UPDATE app_records SET data_json=json_set(data_json,'$.status','PENDING'), updated_at=? WHERE collection=? AND json_extract(data_json,'$.status') IN ('FAILED','NOT_CONFIGURED') AND COALESCE(json_extract(data_json,'$.attempts'),0) < ?`).bind(nowIso,EMAIL_OUTBOX,EMAIL_MAX_ATTEMPTS).run();
  }
  const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection=? AND json_extract(data_json,'$.status')='PENDING' ORDER BY updated_at ASC LIMIT ?`).bind(EMAIL_OUTBOX,limit).all();
  let sent=0,failed=0;
  for(const r of (q.results||[])){
    const claim=await env.DB.prepare(`UPDATE app_records SET data_json=json_set(data_json,'$.status','SENDING'), updated_at=? WHERE collection=? AND id=? AND json_extract(data_json,'$.status')='PENDING'`).bind(new Date().toISOString(),EMAIL_OUTBOX,r.id).run();
    if(!(claim?.meta?.changes>0)) continue; // sudah diambil proses lain → hindari email ganda
    const d=safeJsonParse(r.data_json,{}); const attempts=num(d.attempts)+1;
    try{
      const providerId=await sendEmailViaProvider(cfg,d);
      await env.DB.prepare(`UPDATE app_records SET data_json=json_set(data_json,'$.status','SENT','$.attempts',?,'$.sentAt',?,'$.providerId',?,'$.provider',?,'$.lastError',''), updated_at=? WHERE collection=? AND id=?`).bind(attempts,new Date().toISOString(),String(providerId),cfg.provider,new Date().toISOString(),EMAIL_OUTBOX,r.id).run();
      sent++;
    }catch(e){
      await env.DB.prepare(`UPDATE app_records SET data_json=json_set(data_json,'$.status','FAILED','$.attempts',?,'$.lastError',?,'$.provider',?), updated_at=? WHERE collection=? AND id=?`).bind(attempts,String(e?.message||e).slice(0,400),cfg.provider,new Date().toISOString(),EMAIL_OUTBOX,r.id).run();
      failed++;
    }
  }
  return {sent,failed};
}

async function emailStatusHandler(env,user) {
  if(!isTopRole(user)) return json({ok:false,message:"Hanya Administrator/Direktur/Head Unit Bisnis."},403);
  const cfg=emailConfig(env);
  const counts=await env.DB.prepare(`SELECT json_extract(data_json,'$.status') AS status, count(*) AS n FROM app_records WHERE collection=? GROUP BY 1`).bind(EMAIL_OUTBOX).all();
  const recent=await env.DB.prepare(`SELECT id,data_json,updated_at FROM app_records WHERE collection=? ORDER BY updated_at DESC LIMIT 40`).bind(EMAIL_OUTBOX).all();
  const users=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='users'`).all();
  const noEmail=(users.results||[]).map(r=>({id:r.id,d:safeJsonParse(r.data_json,{})})).filter(u=>userActive(u.d)&&!validEmail(u.d.email)).map(u=>u.d.name||u.d.username||u.id);
  return json({ok:true,config:{provider:cfg.provider||"",ready:cfg.ready,missing:cfg.missing,from:cfg.provider==="gas"?"Akun Google pemilik Apps Script":cfg.from,fromName:cfg.fromName,baseUrl:cfg.baseUrl},
    counts:Object.fromEntries((counts.results||[]).map(r=>[r.status||"-",r.n])),usersWithoutEmail:noEmail,
    recent:(recent.results||[]).map(r=>{const d=safeJsonParse(r.data_json,{});return {id:r.id,to:d.to,toName:d.toName,subject:d.subject,status:d.status,attempts:d.attempts||0,lastError:d.lastError||"",createdAt:d.createdAt,sentAt:d.sentAt||"",updated_at:r.updated_at};})});
}
async function emailTestHandler(request,env,user) {
  if(!isTopRole(user)) return json({ok:false,message:"Hanya Administrator/Direktur/Head Unit Bisnis."},403);
  const cfg=emailConfig(env); if(!cfg.ready) return json({ok:false,message:`Notifikasi email belum dikonfigurasi: ${cfg.missing.join(", ")}`},400);
  const body=await parseJson(request)||{}; const to=String(body.to||user.email||"").trim();
  if(!validEmail(to)) return json({ok:false,message:"Alamat email tujuan tidak valid."},400);
  const task={title:"Email uji Nara System",waitingFor:"Jika email ini sampai, notifikasi Tugas Saya sudah berfungsi.",actionLabel:"Tidak perlu tindakan",priority:"NORMAL",fromUserName:user.name||user.username};
  const c=taskEmailContent(task,{data:{name:user.name||user.username}},"",cfg.baseUrl);
  try{ const id=await sendEmailViaProvider(cfg,{to,toName:"",subject:c.subject,html:c.html,text:c.text}); await audit(env,user,"EMAIL_TEST",EMAIL_OUTBOX,"","",{to,provider:cfg.provider}); return json({ok:true,message:`Email uji terkirim ke ${to} via ${cfg.provider}.`,providerId:id}); }
  catch(e){ return json({ok:false,message:`Gagal kirim: ${e?.message||e}`},502); }
}
async function emailRetryHandler(env,user) {
  if(!isTopRole(user)) return json({ok:false,message:"Hanya Administrator/Direktur/Head Unit Bisnis."},403);
  const nowIso=new Date().toISOString();
  await env.DB.prepare(`UPDATE app_records SET data_json=json_set(data_json,'$.status','PENDING','$.attempts',0), updated_at=? WHERE collection=? AND json_extract(data_json,'$.status') IN ('FAILED','NOT_CONFIGURED')`).bind(nowIso,EMAIL_OUTBOX).run();
  const r=await flushEmailOutbox(env,{limit:50});
  return json({ok:true,...r});
}


/* ============================================================================
 * V3.4.24 — KEUANGAN PROYEK
 * Pemasukan : project_terms (termin kontrak client) → Admin Teknik tagih → Finance verifikasi uang masuk + bukti TF → cash_in.
 * Pengeluaran: partner_payments kategori VENDOR / SUBKON (dari PO/SPK + termin), TUKANG (dari absensi), MATERIAL (toko, form + file).
 *   Site Manager ajukan → Head of Operational ACC → (Material > batas: Head Unit Bisnis ACC) → Finance verifikasi & bayar + bukti TF → cash_out.
 * Master pihak: partners (VENDOR/SUBKON/SUPPLIER) — dibuat otomatis dari pengajuan pertama, lalu tinggal dipilih.
 * Operasional (bensin, makan, sewa alat) tetap lewat Pengajuan Dana (payment_requests).
 * ==========================================================================*/
const PAYMENT_CATEGORIES = ["VENDOR","SUBKON","TUKANG","MATERIAL"];
const PAYMENT_CATEGORY_LABEL = {VENDOR:"Vendor",SUBKON:"Subkon",TUKANG:"Tukang",MATERIAL:"Material",OPERASIONAL:"Operasional"};
const PARTNER_TYPES = {VENDOR:"Vendor",SUBKON:"Subkon",SUPPLIER:"Toko Material",REIMBURSE:"Reimburse / Perorangan"};
const FINANCE_SETTINGS_ID = "finance";
const DEFAULT_MATERIAL_HUB_THRESHOLD = 5000000;
const rp = v => `Rp ${Math.round(num(v)).toLocaleString("id-ID")}`;
const nameKey = v => String(v||"").toLowerCase().replace(/\b(pt|cv|ud|tb|toko)\.?\s+/g,"").replace(/[^a-z0-9]+/g," ").trim();

function normalizePartner(d) {
  const t=String(d.partnerType||"").toUpperCase(); if(!PARTNER_TYPES[t]) throw new Error("Jenis pihak harus Vendor, Subkon, Toko Material, atau Reimburse.");
  const name=String(d.name||"").trim(); if(!name) throw new Error("Nama pihak wajib diisi.");
  return {partnerType:t,name,nameKey:nameKey(name),phone:String(d.phone||"").trim(),address:String(d.address||"").trim(),bankName:String(d.bankName||"").trim(),accountNo:String(d.accountNo||"").trim(),accountName:String(d.accountName||"").trim(),specialty:String(d.specialty||"").trim(),notes:String(d.notes||"").trim(),aliases:Array.isArray(d.aliases)?d.aliases.map(String).slice(0,20):[],createdByUserId:d.createdByUserId||"",createdByName:d.createdByName||"",status:String(d.status||"ACTIVE").toUpperCase()==="INACTIVE"?"INACTIVE":"ACTIVE"};
}
async function findOrCreatePartner(env,user,type,data) {
  const t=String(type||"").toUpperCase(); const base=normalizePartner({...data,partnerType:t});
  const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='partners' AND json_extract(data_json,'$.partnerType')=? AND json_extract(data_json,'$.nameKey')=? LIMIT 1`).bind(t,base.nameKey).first();
  if(q) { const cur=safeJsonParse(q.data_json,{}); const patch={}; for(const k of ["phone","address","bankName","accountNo","accountName","specialty"]) if(!cur[k]&&base[k]) patch[k]=base[k]; if(Object.keys(patch).length) await upsertRecord(env,"partners",q.id,{...cur,...patch},user); return {id:q.id,data:{...cur,...patch}}; }
  const id=`PTN-${crypto.randomUUID().slice(0,8)}`; const rec=await upsertRecord(env,"partners",id,{...base,createdByUserId:user.id,createdByName:user.name||user.username||""},user);
  return {id,data:rec.data||base};
}
function normalizeContractFields(d) {
  // PO/SPK = kontrak vendor/subkon. Field tambahan: jenis pihak, retensi, skema termin.
  if(d.partnerType!==undefined||d.terms!==undefined||d.retentionPct!==undefined){
    const t=String(d.partnerType||"VENDOR").toUpperCase(); d.partnerType=t==="SUBKON"?"SUBKON":"VENDOR";
    d.retentionPct=Math.max(0,Math.min(20,num(d.retentionPct)));
    const terms=(Array.isArray(d.terms)?d.terms:[]).map(x=>({label:String(x.label||"").trim(),percent:Math.max(0,Math.min(100,num(x.percent))),condition:String(x.condition||"").trim()})).filter(x=>x.percent>0).map((x,i)=>({no:i+1,...x,label:x.label||`Termin ${i+1}`}));
    const sum=terms.reduce((a,x)=>a+x.percent,0); if(sum>100.0001) throw new Error(`Total persentase termin ${sum}% melebihi 100%.`);
    d.terms=terms;
  }
}
async function normalizeProjectTerm(env,d) {
  if(!d.projectId) throw new Error("Proyek wajib dipilih.");
  const st=String(d.status||"PLANNED").toUpperCase();
  if(!["PLANNED","RETURNED"].includes(st)) throw new Error("Termin yang sudah ditagih/diterima tidak dapat diubah dari form ini.");
  const p=await getRecord(env,"projects",String(d.projectId)); if(!p) throw new Error("Proyek tidak ditemukan.");
  const cv=num(d.contractValue)||pickNum(p.data,["contractValue","nilaiKontrak","contract","value"]);
  const percent=Math.max(0,Math.min(100,num(d.percent)));
  let gross=num(d.grossAmount); if(!gross && percent && cv) gross=Math.round(cv*percent/100);
  if(gross<=0) throw new Error("Nilai termin wajib diisi (persentase × nilai kontrak, atau nominal).");
  const retentionPct=Math.max(0,Math.min(20,num(d.retentionPct))); const retentionAmount=Math.round(gross*retentionPct/100);
  return {status:st,termNo:Math.max(1,Math.round(num(d.termNo)||1)),label:String(d.label||`Termin ${num(d.termNo)||1}`).trim(),percent,contractValue:cv,grossAmount:gross,retentionPct,retentionAmount,netAmount:gross-retentionAmount,progressRequired:Math.max(0,Math.min(100,num(d.progressRequired))),dueDate:String(d.dueDate||"")};
}
async function financeSettings(env) {
  const r=await getRecord(env,"app_settings",FINANCE_SETTINGS_ID);
  return {materialHubThreshold:num(r?.data?.materialHubThreshold)||DEFAULT_MATERIAL_HUB_THRESHOLD};
}
async function contractPaymentsTotals(env,contractId,excludeId="") {
  const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='partner_payments' AND json_extract(data_json,'$.contractId')=?`).bind(String(contractId)).all();
  let gross=0,retention=0,released=0,paidGross=0,maxProgress=0;
  for(const r of (q.results||[])){ if(r.id===excludeId) continue; const x=safeJsonParse(r.data_json,{}); if(["REJECTED"].includes(String(x.status).toUpperCase())) continue;
    if(x.isRetentionRelease) { released+=num(x.grossAmount); continue; }
    gross+=num(x.grossAmount); retention+=num(x.retentionAmount); maxProgress=Math.max(maxProgress,num(x.workProgressPct)); if(String(x.status).toUpperCase()==="PAID") paidGross+=num(x.grossAmount); }
  return {gross,retention,released,paidGross,maxProgress};
}
async function normalizePartnerPayment(env,d,id="") {
  const cat=String(d.category||"").toUpperCase(); if(!PAYMENT_CATEGORIES.includes(cat)) throw new Error("Kategori pembayaran harus Vendor, Subkon, Tukang, atau Material.");
  if(!d.projectId) throw new Error("Proyek wajib dipilih.");
  const out={category:cat,projectId:String(d.projectId),notes:String(d.notes||"").trim(),retentionPct:0,retentionAmount:0,isRetentionRelease:false};
  if(cat==="VENDOR"||cat==="SUBKON"){
    const c=await getRecord(env,"po",String(d.contractId||"")); if(!c) throw new Error("Pilih SPK/kontrak vendor atau subkon.");
    if(String(c.data.projectId)!==out.projectId) throw new Error("SPK tidak sesuai dengan proyek yang dipilih.");
    const value=num(c.data.contractValue||c.data.amount); if(value<=0) throw new Error("Nilai SPK belum diisi. Minta Admin Teknik melengkapi nilai SPK.");
    const t=await contractPaymentsTotals(env,c.id,id); const retPct=num(c.data.retentionPct);
    Object.assign(out,{contractId:c.id,contractNumber:c.data.number||c.id,contractValue:value,partnerId:c.data.partnerId||"",partnerName:c.data.partnerName||c.data.vendor||""});
    if(truthy(d.isRetentionRelease)){
      const held=t.retention-t.released; const gross=num(d.grossAmount)||held;
      if(held<=0) throw new Error("Tidak ada retensi yang tertahan untuk SPK ini.");
      if(gross>held+1) throw new Error(`Pelepasan retensi maksimal ${rp(held)}.`);
      Object.assign(out,{isRetentionRelease:true,termNo:0,termLabel:"Pelepasan retensi",workProgressPct:t.maxProgress,grossAmount:gross,netAmount:gross});
    } else {
      const progress=Math.max(0,Math.min(100,num(d.workProgressPct))); if(progress<=0) throw new Error("Isi progres pekerjaan vendor/subkon (kumulatif %).");
      const terms=Array.isArray(c.data.terms)?c.data.terms:[]; const term=terms.find(x=>String(x.no)===String(d.termNo));
      const gross=Math.round(num(d.grossAmount)||(term?value*num(term.percent)/100:0)); if(gross<=0) throw new Error("Nilai yang ditagih wajib diisi.");
      const worked=Math.round(value*progress/100);
      if(t.gross+gross>worked+1) throw new Error(`Total tagihan (${rp(t.gross+gross)}) melebihi nilai pekerjaan yang sudah dikerjakan ${progress}% (${rp(worked)}).`);
      if(t.gross+gross>value+1) throw new Error(`Total tagihan melebihi nilai SPK ${rp(value)}.`);
      const retAmt=Math.round(gross*retPct/100);
      Object.assign(out,{termNo:term?term.no:num(d.termNo)||0,termLabel:term?term.label:String(d.termLabel||"Tagihan"),workProgressPct:progress,workValue:worked,grossAmount:gross,retentionPct:retPct,retentionAmount:retAmt,netAmount:gross-retAmt});
    }
  } else if(cat==="TUKANG"){
    const a=reportDay(d.periodStart), b=reportDay(d.periodEnd); if(!a||!b||b<a) throw new Error("Isi periode upah tukang (dari–sampai) dengan benar.");
    const lines=(Array.isArray(d.lines)?d.lines:[]).map(x=>({workerId:String(x.workerId||""),workerName:String(x.workerName||x.workerId||"").trim(),days:num(x.days),overtimeHours:num(x.overtimeHours),attendanceAmount:num(x.attendanceAmount),amount:Math.round(num(x.amount)),note:String(x.note||"")})).filter(x=>x.workerName&&x.amount>0);
    if(!lines.length) throw new Error("Belum ada upah tukang pada periode ini. Ambil dari absensi atau isi manual.");
    const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='partner_payments' AND json_extract(data_json,'$.category')='TUKANG' AND json_extract(data_json,'$.projectId')=?`).bind(out.projectId).all();
    for(const r of (q.results||[])){ if(r.id===id) continue; const x=safeJsonParse(r.data_json,{}); if(String(x.status).toUpperCase()==="REJECTED") continue; if(!(b<x.periodStart||a>x.periodEnd)) throw new Error(`Periode bertabrakan dengan pengajuan upah ${fmtDay(x.periodStart)}–${fmtDay(x.periodEnd)} yang sudah ada.`); }
    const gross=lines.reduce((s,x)=>s+x.amount,0);
    Object.assign(out,{periodStart:a,periodEnd:b,lines,partnerName:`Upah tukang ${fmtDay(a)}–${fmtDay(b)}`,grossAmount:gross,netAmount:gross,workerCount:lines.length});
  } else {
    const items=(Array.isArray(d.items)?d.items:[]).map(x=>({name:String(x.name||"").trim(),qty:num(x.qty),unit:String(x.unit||"").trim(),price:num(x.price),total:Math.round(num(x.qty)*num(x.price))})).filter(x=>x.name&&x.qty>0);
    if(!items.length) throw new Error("Isi minimal satu item material (nama, jumlah, harga).");
    if(!d.partnerId) throw new Error("Pilih toko/supplier material.");
    const sup=await getRecord(env,"partners",String(d.partnerId)); if(!sup||sup.data.partnerType!=="SUPPLIER") throw new Error("Toko material tidak ditemukan.");
    const gross=items.reduce((s,x)=>s+x.total,0);
    Object.assign(out,{partnerId:sup.id,partnerName:sup.data.name,items,grossAmount:gross,netAmount:gross,neededDate:String(d.neededDate||"")});
  }
  if(cat!=="TUKANG" && out.partnerId===undefined) out.partnerId="";
  return out;
}
function fmtDay(v){ const x=reportDay(v); if(!x) return "-"; const [y,m,dd]=x.split("-"); return `${dd}/${m}/${y}`; }
function paymentHistory(d,user,action,note="") { const h=Array.isArray(d.history)?d.history:[]; h.push({at:new Date().toISOString(),by:user.id,byName:user.name||user.username||"",action,note:String(note||"")}); return h.slice(-30); }
async function attachFiles(env,user,fd,meta) {
  const ids=[]; for(const f of fd.getAll("files")){ if(f instanceof File && f.size>0){ const doc=await storeEvidenceDocument(env,user,f,meta); ids.push(doc.id); } } return ids;
}

async function partnerPaymentSaveHandler(request,env,user,id="") {
  const cap=buildAccess(user).capabilities; if(!cap.partnerPaymentCreate) return json({ok:false,message:"Role ini tidak dapat mengajukan pembayaran."},403);
  let fd; try{ fd=await request.formData(); }catch{ return json({ok:false,message:"Form pengajuan tidak valid."},400); }
  const body=safeJsonParse(String(fd.get("payload")||"{}"),{});
  let old=null;
  if(id){ old=await getRecord(env,"partner_payments",id); if(!old) return json({ok:false,message:"Pengajuan tidak ditemukan."},404);
    if(!["DRAFT","RETURNED"].includes(String(old.data.status).toUpperCase())) return json({ok:false,message:"Pengajuan yang sudah diproses tidak dapat diubah."},409);
    if(old.data.requesterUserId!==user.id && !isManagementRole(user)) return json({ok:false,message:"Hanya pengaju atau Head of Operational yang dapat mengubah pengajuan ini."},403); }
  const projectId=String(body.projectId||old?.data?.projectId||"");
  const denied=await requireProjectAccess(env,user,projectId); if(denied) return denied;
  try{
    const cat=String(body.category||old?.data?.category||"").toUpperCase();
    if(cat==="MATERIAL" && !body.partnerId && body.newPartner?.name){ const pt=await findOrCreatePartner(env,user,"SUPPLIER",body.newPartner); body.partnerId=pt.id; }
    const norm=await normalizePartnerPayment(env,{...(old?.data||{}),...body,projectId,category:cat},id);
    const pid=id||`PAY-${crypto.randomUUID().slice(0,12)}`;
    const newDocs=await attachFiles(env,user,fd,{projectId,category:"FINANCE_PAYMENT",title:`Lampiran pembayaran ${PAYMENT_CATEGORY_LABEL[cat]} - ${norm.partnerName||""}`,relatedCollection:"partner_payments",relatedId:pid});
    const removed=new Set(Array.isArray(body.removeDocIds)?body.removeDocIds:[]);
    const docs=[...(old?.data?.attachmentDocIds||[]).filter(x=>!removed.has(x)),...newDocs];
    let d={...(old?.data||{}),...norm,attachmentDocIds:docs,requesterUserId:old?.data?.requesterUserId||user.id,requesterName:old?.data?.requesterName||user.name||user.username||"",status:old?String(old.data.status).toUpperCase():"DRAFT",updatedAt:new Date().toISOString()};
    if(!old) d.history=paymentHistory(d,user,"BUAT"); 
    if(truthy(body.submit)) d=await submitPartnerPayment(env,user,d);
    const rec=await upsertRecord(env,"partner_payments",pid,d,user);
    await syncWorkflowTask(env,"partner_payments",pid,d,user);
    await audit(env,user,id?"PARTNER_PAYMENT_UPDATE":"PARTNER_PAYMENT_CREATE","partner_payments",pid,projectId,{category:cat,amount:d.grossAmount,status:d.status});
    return json({ok:true,row:rec});
  }catch(e){ return json({ok:false,message:e.message||String(e)},400); }
}
async function submitPartnerPayment(env,user,d) {
  if(d.category==="MATERIAL" && !(d.attachmentDocIds||[]).length) throw new Error("Upload form/nota/penawaran material sebelum diajukan.");
  if((d.category==="VENDOR"||d.category==="SUBKON") && !d.isRetentionRelease && !(d.attachmentDocIds||[]).length) throw new Error("Upload BAP/foto progres pekerjaan sebelum diajukan.");
  const st=await financeSettings(env);
  const needsHub=d.category==="MATERIAL" && num(d.grossAmount)>st.materialHubThreshold;
  return {...d,status:"SUBMITTED",needsHub,hubThreshold:st.materialHubThreshold,submittedAt:new Date().toISOString(),returnNote:"",history:paymentHistory(d,user,"AJUKAN")};
}
async function partnerPaymentActionHandler(request,env,user,id) {
  const rec=await getRecord(env,"partner_payments",id); if(!rec) return json({ok:false,message:"Pengajuan tidak ditemukan."},404);
  const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied) return denied;
  const body=await parseJson(request)||{}; const action=String(body.action||"").toLowerCase(); const note=String(body.note||"").trim();
  const cap=buildAccess(user).capabilities; let d={...rec.data}; const st=String(d.status||"DRAFT").toUpperCase();
  try{
    if(action==="submit"){ if(!["DRAFT","RETURNED"].includes(st)) throw new Error("Pengajuan sudah diajukan."); if(d.requesterUserId!==user.id && !isManagementRole(user)) throw new Error("Hanya pengaju yang dapat mengajukan."); d=await submitPartnerPayment(env,user,d); }
    else if(action==="ops-approve"){ if(!cap.partnerPaymentOpsApprove) throw new Error("Hanya Head of Operational yang dapat ACC."); if(st!=="SUBMITTED") throw new Error("Pengajuan tidak menunggu ACC Head of Operational.");
      d.opsApprovedAt=new Date().toISOString(); d.opsApprovedBy=user.id; d.opsApprovedByName=user.name||user.username||""; d.status=d.needsHub?"OPS_APPROVED":"APPROVED"; d.history=paymentHistory(d,user,"ACC_HEAD_OPERATIONAL",note); }
    else if(action==="hub-approve"){ if(!cap.partnerPaymentHubApprove) throw new Error("Hanya Head Unit Bisnis yang dapat ACC tahap ini."); if(st!=="OPS_APPROVED") throw new Error("Pengajuan tidak menunggu ACC Head Unit Bisnis.");
      d.hubApprovedAt=new Date().toISOString(); d.hubApprovedBy=user.id; d.hubApprovedByName=user.name||user.username||""; d.status="APPROVED"; d.history=paymentHistory(d,user,"ACC_HEAD_UNIT_BISNIS",note); }
    else if(action==="return"||action==="reject"){
      const can=(st==="SUBMITTED"&&cap.partnerPaymentOpsApprove)||(st==="OPS_APPROVED"&&cap.partnerPaymentHubApprove)||(st==="APPROVED"&&cap.financePay);
      if(!can) throw new Error("Anda tidak berwenang pada tahap pengajuan ini.");
      if(!note) throw new Error("Tuliskan alasannya.");
      if(action==="reject" && st==="APPROVED") throw new Error("Finance hanya dapat mengembalikan, bukan menolak.");
      d.status=action==="return"?"RETURNED":"REJECTED"; d.returnNote=note; d.history=paymentHistory(d,user,action==="return"?"KEMBALIKAN":"TOLAK",note); }
    else throw new Error("Aksi tidak dikenal.");
  }catch(e){ return json({ok:false,message:e.message},400); }
  d.updatedAt=new Date().toISOString();
  const out=await upsertRecord(env,"partner_payments",id,d,user); await syncWorkflowTask(env,"partner_payments",id,d,user);
  await audit(env,user,"PARTNER_PAYMENT_ACTION","partner_payments",id,d.projectId,{action,from:st,to:d.status});
  return json({ok:true,row:out});
}
async function partnerPaymentPayHandler(request,env,user,id) {
  if(!buildAccess(user).capabilities.financePay) return json({ok:false,message:"Hanya Finance yang dapat memverifikasi dan membayar."},403);
  const rec=await getRecord(env,"partner_payments",id); if(!rec) return json({ok:false,message:"Pengajuan tidak ditemukan."},404);
  if(String(rec.data.status).toUpperCase()!=="APPROVED") return json({ok:false,message:"Pengajuan belum disetujui lengkap."},409);
  let fd; try{ fd=await request.formData(); }catch{ return json({ok:false,message:"Form pembayaran tidak valid."},400); }
  const d={...rec.data}; const file=fd.get("file");
  if(!(file instanceof File)||file.size<=0) return json({ok:false,message:"Upload bukti transfer wajib."},400);
  const paidAmount=Math.round(num(fd.get("paidAmount"))||num(d.netAmount)); if(paidAmount<=0) return json({ok:false,message:"Nominal dibayar wajib diisi."},400);
  if(paidAmount>num(d.netAmount)+1) return json({ok:false,message:`Nominal dibayar melebihi yang disetujui (${rp(d.netAmount)}).`},400);
  const paidAt=reportDay(fd.get("paidAt"))||new Date().toISOString().slice(0,10);
  const doc=await storeEvidenceDocument(env,user,file,{projectId:d.projectId,category:"FINANCE_PROOF",title:`Bukti transfer ${PAYMENT_CATEGORY_LABEL[d.category]} - ${d.partnerName||""}`,relatedCollection:"partner_payments",relatedId:id});
  Object.assign(d,{status:"PAID",paidAmount,paidAt,paidAccount:String(fd.get("account")||""),paidReference:String(fd.get("reference")||""),proofDocId:doc.id,paidByUserId:user.id,paidByName:user.name||user.username||"",history:paymentHistory(d,user,"DIBAYAR",`${rp(paidAmount)}`)});
  const cashId=`PP-${id}`;
  await upsertRecord(env,"cash_out",cashId,{projectId:d.projectId,date:paidAt,category:PAYMENT_CATEGORY_LABEL[d.category],categoryKey:d.category,partnerId:d.partnerId||"",partnerName:d.partnerName||"",vendor:d.partnerName||"",amount:paidAmount,status:"PAID",reference:d.paidReference,paymentId:id,description:`${PAYMENT_CATEGORY_LABEL[d.category]} — ${d.termLabel||d.partnerName||""}`,proofDocId:doc.id},user);
  d.cashOutId=cashId;
  const out=await upsertRecord(env,"partner_payments",id,d,user); await syncWorkflowTask(env,"partner_payments",id,d,user);
  await audit(env,user,"PARTNER_PAYMENT_PAID","partner_payments",id,d.projectId,{amount:paidAmount});
  return json({ok:true,row:out});
}
async function payrollPreviewHandler(env,user,url) {
  const projectId=String(url.searchParams.get("projectId")||""); const a=reportDay(url.searchParams.get("start")), b=reportDay(url.searchParams.get("end"));
  if(!projectId||!a||!b) return json({ok:false,message:"Pilih proyek dan periode."},400);
  const denied=await requireProjectAccess(env,user,projectId); if(denied) return denied;
  const q=await env.DB.prepare(`SELECT data_json FROM app_records WHERE collection='daily_workers' AND json_extract(data_json,'$.projectId')=? AND json_extract(data_json,'$.date')>=? AND json_extract(data_json,'$.date')<=?`).bind(projectId,a,b).all();
  const by=new Map();
  for(const r of (q.results||[])){ const x=safeJsonParse(r.data_json,{}); const key=String(x.workerId||x.workerName||""); if(!key) continue; const stt=String(x.attendanceStatus||x.status||"HADIR").toUpperCase();
    const cur=by.get(key)||{workerId:String(x.workerId||""),workerName:String(x.workerName||x.workerId||""),days:0,overtimeHours:0,attendanceAmount:0,dailyRate:num(x.dailyRate||x.wage||x.rate)};
    if(!cur.dailyRate) cur.dailyRate=num(x.dailyRate||x.wage||x.rate);
    if(!["ALPA","IZIN","SAKIT"].includes(stt)) cur.days+= stt==="SETENGAH HARI"||stt==="HALF"?0.5:1;
    cur.overtimeHours+=num(x.overtimeHours); cur.attendanceAmount+=num(x.amount); by.set(key,cur); }
  const lines=[...by.values()].map(x=>({...x,amount:Math.round(x.attendanceAmount||(x.days*x.dailyRate))})).sort((x,y)=>x.workerName.localeCompare(y.workerName));
  return json({ok:true,lines,total:lines.reduce((s,x)=>s+x.amount,0)});
}
async function termBillHandler(request,env,user,id) {
  if(!buildAccess(user).capabilities.termBill) return json({ok:false,message:"Hanya Admin Teknik/Head of Operational yang dapat menagih termin."},403);
  const rec=await getRecord(env,"project_terms",id); if(!rec) return json({ok:false,message:"Termin tidak ditemukan."},404);
  const st=String(rec.data.status||"PLANNED").toUpperCase(); if(!["PLANNED","RETURNED"].includes(st)) return json({ok:false,message:"Termin sudah ditagih."},409);
  const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied) return denied;
  let fd; try{ fd=await request.formData(); }catch{ return json({ok:false,message:"Form tagihan tidak valid."},400); }
  const d={...rec.data}; const prog=num(fd.get("progressPct"));
  if(prog<num(d.progressRequired)) return json({ok:false,message:`Progres ${prog}% belum memenuhi syarat termin (${num(d.progressRequired)}%).`},400);
  const file=fd.get("file"); let docId=d.invoiceDocId||"";
  if(file instanceof File && file.size>0){ const doc=await storeEvidenceDocument(env,user,file,{projectId:d.projectId,category:"FINANCE_INVOICE",title:`Tagihan ${d.label}`,relatedCollection:"project_terms",relatedId:id}); docId=doc.id; }
  if(!docId) return json({ok:false,message:"Upload invoice/BAP progres termin."},400);
  Object.assign(d,{status:"BILLED",billedProgress:prog,invoiceNo:String(fd.get("invoiceNo")||"").trim(),billedAt:reportDay(fd.get("billedAt"))||new Date().toISOString().slice(0,10),billedByUserId:user.id,billedByName:user.name||user.username||"",invoiceDocId:docId,returnNote:""});
  const out=await upsertRecord(env,"project_terms",id,d,user); await syncWorkflowTask(env,"project_terms",id,d,user); await audit(env,user,"TERM_BILLED","project_terms",id,d.projectId,{progress:prog});
  return json({ok:true,row:out});
}
async function termReceiveHandler(request,env,user,id) {
  if(!buildAccess(user).capabilities.financePay) return json({ok:false,message:"Hanya Finance yang dapat memverifikasi uang masuk."},403);
  const rec=await getRecord(env,"project_terms",id); if(!rec) return json({ok:false,message:"Termin tidak ditemukan."},404);
  if(String(rec.data.status).toUpperCase()!=="BILLED") return json({ok:false,message:"Termin belum ditagih."},409);
  let fd; try{ fd=await request.formData(); }catch{ return json({ok:false,message:"Form tidak valid."},400); }
  const d={...rec.data};
  if(String(fd.get("action")||"")==="return"){ const note=String(fd.get("note")||"").trim(); if(!note) return json({ok:false,message:"Tuliskan alasan pengembalian."},400); d.status="RETURNED"; d.returnNote=note; const out=await upsertRecord(env,"project_terms",id,d,user); await syncWorkflowTask(env,"project_terms",id,d,user); return json({ok:true,row:out}); }
  const file=fd.get("file"); if(!(file instanceof File)||file.size<=0) return json({ok:false,message:"Upload bukti transfer dari client."},400);
  const amount=Math.round(num(fd.get("receivedAmount"))); if(amount<=0) return json({ok:false,message:"Isi nominal yang benar-benar masuk."},400);
  const doc=await storeEvidenceDocument(env,user,file,{projectId:d.projectId,category:"FINANCE_PROOF",title:`Bukti transfer masuk ${d.label}`,relatedCollection:"project_terms",relatedId:id});
  Object.assign(d,{status:"PAID",receivedAmount:amount,receivedAt:reportDay(fd.get("receivedAt"))||new Date().toISOString().slice(0,10),receivedAccount:String(fd.get("account")||""),receivedReference:String(fd.get("reference")||""),proofDocId:doc.id,verifiedByUserId:user.id,verifiedByName:user.name||user.username||"",shortfall:Math.max(0,num(d.netAmount)-amount)});
  const cashId=`TERM-${id}`;
  await upsertRecord(env,"cash_in",cashId,{projectId:d.projectId,date:d.receivedAt,amount,status:"RECEIVED",source:"Termin",termId:id,description:`${d.label} (${d.percent||0}%)`,reference:d.receivedReference,proofDocId:doc.id},user);
  d.cashInId=cashId;
  const out=await upsertRecord(env,"project_terms",id,d,user); await syncWorkflowTask(env,"project_terms",id,d,user); await audit(env,user,"TERM_RECEIVED","project_terms",id,d.projectId,{amount});
  return json({ok:true,row:out});
}
// Atur kontrak SPK (PO) atau catat SPK baru (mis. subkon dari luar menu PR). Pihak otomatis masuk database.
async function contractSaveHandler(request,env,user,poId="") {
  if(!buildAccess(user).capabilities.contractManage) return json({ok:false,message:"Hanya Admin Teknik/Head of Operational yang dapat mengatur kontrak SPK."},403);
  let fd; try{ fd=await request.formData(); }catch{ return json({ok:false,message:"Form kontrak tidak valid."},400); }
  const b=safeJsonParse(String(fd.get("payload")||"{}"),{});
  let po=poId?await getRecord(env,"po",poId):null; if(poId&&!po) return json({ok:false,message:"SPK tidak ditemukan."},404);
  const projectId=String(po?.data?.projectId||b.projectId||""); if(!projectId) return json({ok:false,message:"Proyek wajib dipilih."},400);
  const denied=await requireProjectAccess(env,user,projectId); if(denied) return denied;
  try{
    const type=String(b.partnerType||po?.data?.partnerType||"VENDOR").toUpperCase()==="SUBKON"?"SUBKON":"VENDOR";
    let partner=null;
    if(b.partnerId){ const r=await getRecord(env,"partners",String(b.partnerId)); if(!r) throw new Error("Pihak tidak ditemukan."); partner={id:r.id,data:r.data}; }
    else { const name=String(b.partnerName||po?.data?.vendor||"").trim(); if(!name) throw new Error("Nama vendor/subkon wajib diisi."); partner=await findOrCreatePartner(env,user,type,{name,phone:b.phone,bankName:b.bankName,accountNo:b.accountNo,accountName:b.accountName,specialty:b.specialty}); }
    const value=Math.round(num(b.contractValue)||num(po?.data?.amount)); if(value<=0) throw new Error("Nilai SPK wajib diisi.");
    const d={...(po?.data||{}),projectId,partnerType:type,partnerId:partner.id,partnerName:partner.data.name,vendor:partner.data.name,contractValue:value,amount:value,retentionPct:b.retentionPct,terms:b.terms,
      number:String(b.number||po?.data?.number||"").trim(),date:reportDay(b.date)||po?.data?.date||new Date().toISOString().slice(0,10),description:String(b.description??po?.data?.description??"").trim(),status:po?.data?.status||"ACTIVE"};
    if(!d.number) throw new Error("Nomor SPK wajib diisi.");
    normalizeContractFields(d);
    const id=poId||`SPK-${crypto.randomUUID().slice(0,10)}`;
    const file=fd.get("file"); if(file instanceof File && file.size>0){ const doc=await storeEvidenceDocument(env,user,file,{projectId,category:"PO_SPK",title:`SPK ${d.number} - ${d.vendor}`,relatedCollection:"po",relatedId:id}); d.spkDocId=doc.id; }
    const rec=await upsertRecord(env,"po",id,d,user); await audit(env,user,poId?"CONTRACT_UPDATE":"CONTRACT_CREATE","po",id,projectId,{partnerType:type,value});
    return json({ok:true,row:rec});
  }catch(e){ return json({ok:false,message:e.message},400); }
}

async function financeSettingsHandler(request,env,user) {
  if(request.method==="GET") return json({ok:true,settings:await financeSettings(env)});
  if(!buildAccess(user).capabilities.financeSettings) return json({ok:false,message:"Hanya pimpinan yang dapat mengubah pengaturan keuangan."},403);
  const b=await parseJson(request)||{}; const t=Math.round(num(b.materialHubThreshold)); if(t<0) return json({ok:false,message:"Batas tidak valid."},400);
  await upsertRecord(env,"app_settings",FINANCE_SETTINGS_ID,{materialHubThreshold:t},user); await audit(env,user,"FINANCE_SETTINGS","app_settings",FINANCE_SETTINGS_ID,"",{materialHubThreshold:t});
  return json({ok:true,settings:{materialHubThreshold:t}});
}
async function financeSummaryHandler(env,user,url) {
  const projectFilter=String(url.searchParams.get("projectId")||"");
  const scope=isProjectScopedRole(user)?await accessibleProjectIds(env,user):null;
  const ok=pid=>(!projectFilter||String(pid)===projectFilter)&&(!scope||scope.has(String(pid)));
  const load=async c=>((await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection=?`).bind(c).all()).results||[]).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{})}));
  const [projects,terms,pays,pos,cashOut,cashIn,partners,workers,tukang]=await Promise.all(["projects","project_terms","partner_payments","po","cash_out","cash_in","partners","daily_workers","tukang"].map(load));
  const P=projects.filter(p=>ok(p.id)); const pname=new Map(projects.map(p=>[p.id,p.data.name||p.id]));
  const T=terms.filter(x=>ok(x.data.projectId)), PAY=pays.filter(x=>ok(x.data.projectId)), PO=pos.filter(x=>ok(x.data.projectId)), CO=cashOut.filter(x=>ok(x.data.projectId)&&paidLike(x.data.status)), CI=cashIn.filter(x=>ok(x.data.projectId)&&paidLike(x.data.status)), W=workers.filter(x=>ok(x.data.projectId));
  const sum=(a,f)=>a.reduce((s,x)=>s+num(f(x)),0); const live=x=>String(x.data.status).toUpperCase()!=="REJECTED";
  const catOf=x=>x.data.categoryKey&&PAYMENT_CATEGORY_LABEL[x.data.categoryKey]?x.data.categoryKey:"OPERASIONAL";
  const projectsOut=P.map(p=>{const id=p.id; const t=T.filter(x=>x.data.projectId===id); const co=CO.filter(x=>x.data.projectId===id); const ci=CI.filter(x=>x.data.projectId===id); const pay=PAY.filter(x=>x.data.projectId===id&&live(x));
    const byCat={}; for(const k of [...PAYMENT_CATEGORIES,"OPERASIONAL"]) byCat[k]=sum(co.filter(x=>catOf(x)===k),x=>x.data.amount);
    const received=sum(ci,x=>x.data.amount); const out=sum(co,x=>x.data.amount);
    return {projectId:id,name:p.data.name||id,contractValue:pickNum(p.data,["contractValue","nilaiKontrak"]),termsPlanned:sum(t,x=>x.data.grossAmount),termsReceived:sum(t.filter(x=>x.data.status==="PAID"),x=>x.data.receivedAmount),termsBilledOpen:sum(t.filter(x=>x.data.status==="BILLED"),x=>x.data.netAmount),retentionHeldByClient:sum(t.filter(x=>["BILLED","PAID"].includes(x.data.status)),x=>x.data.retentionAmount),cashIn:received,cashOut:out,byCategory:byCat,balance:received-out,
      payablesApproved:sum(pay.filter(x=>["APPROVED"].includes(x.data.status)),x=>x.data.netAmount),payablesInApproval:sum(pay.filter(x=>["SUBMITTED","OPS_APPROVED"].includes(x.data.status)),x=>x.data.netAmount)};});
  // Rekap pihak
  const partnerRows=[];
  const partnerInfo=pt=>({status:pt.data.status||"ACTIVE",address:pt.data.address||"",specialty:pt.data.specialty||"",bankName:pt.data.bankName||"",accountNo:pt.data.accountNo||"",accountName:pt.data.accountName||"",createdAt:pt.data.createdAt||""});
  for(const pt of partners){ const t=pt.data.partnerType; const name=pt.data.name;
    const matchPo=x=>x.data.partnerId===pt.id||(!x.data.partnerId&&nameKey(x.data.vendor||x.data.partnerName)===pt.data.nameKey);
    if(t==="VENDOR"||t==="SUBKON"){
      const contracts=PO.filter(x=>matchPo(x)&&String(x.data.partnerType||"VENDOR")===t).map(c=>{const value=num(c.data.contractValue||c.data.amount); const cp=PAY.filter(x=>x.data.contractId===c.id&&live(x)); const prog=Math.max(0,...cp.filter(x=>!x.data.isRetentionRelease).map(x=>num(x.data.workProgressPct)));
        const paidGross=sum(cp.filter(x=>x.data.status==="PAID"&&!x.data.isRetentionRelease),x=>x.data.grossAmount); const paidNet=sum(cp.filter(x=>x.data.status==="PAID"),x=>x.data.paidAmount||x.data.netAmount);
        const retHeld=sum(cp.filter(x=>x.data.status==="PAID"&&!x.data.isRetentionRelease),x=>x.data.retentionAmount)-sum(cp.filter(x=>x.data.status==="PAID"&&x.data.isRetentionRelease),x=>x.data.grossAmount);
        const worked=Math.round(value*prog/100);
        return {contractId:c.id,number:c.data.number||c.id,projectId:c.data.projectId,projectName:pname.get(c.data.projectId)||"-",description:c.data.description||"",value,progress:prog,worked,paidGross,paidNet,retentionHeld:retHeld,inProcess:sum(cp.filter(x=>["SUBMITTED","OPS_APPROVED","APPROVED"].includes(x.data.status)),x=>x.data.netAmount),unpaidWorked:Math.max(0,worked-paidGross),notWorked:Math.max(0,value-worked)};});
      const direct=PAY.filter(x=>x.data.partnerId===pt.id&&!x.data.contractId&&live(x)); const directPaid=sum(direct.filter(x=>x.data.status==="PAID"),x=>x.data.paidAmount||x.data.netAmount);
      if(!contracts.length && !direct.length && projectFilter) continue;
      partnerRows.push({id:pt.id,type:t,name,...partnerInfo(pt),phone:pt.data.phone||"",bank:[pt.data.bankName,pt.data.accountNo,pt.data.accountName].filter(Boolean).join(" · "),contracts,direct:{count:direct.length,paid:directPaid,inProcess:sum(direct.filter(x=>x.data.status!=="PAID"),x=>x.data.netAmount),projects:[...new Set(direct.map(x=>pname.get(x.data.projectId)||"-"))]},totals:{value:sum(contracts,x=>x.value),worked:sum(contracts,x=>x.worked),paid:sum(contracts,x=>x.paidNet)+directPaid,directPaid,paidGross:sum(contracts,x=>x.paidGross),retentionHeld:sum(contracts,x=>x.retentionHeld),inProcess:sum(contracts,x=>x.inProcess),unpaidWorked:sum(contracts,x=>x.unpaidWorked),notWorked:sum(contracts,x=>x.notWorked)}});
    } else if(t==="SUPPLIER"||t==="REIMBURSE"){
      const ps=PAY.filter(x=>x.data.partnerId===pt.id&&live(x));
      if(!ps.length && projectFilter) continue;
      const byProject={}; for(const x of ps){ const k=x.data.projectId; byProject[k]=byProject[k]||{projectId:k,projectName:pname.get(k)||"-",purchased:0,paid:0}; byProject[k].purchased+=num(x.data.grossAmount); if(x.data.status==="PAID") byProject[k].paid+=num(x.data.paidAmount||x.data.netAmount); }
      partnerRows.push({id:pt.id,type:t,name,...partnerInfo(pt),phone:pt.data.phone||"",bank:[pt.data.bankName,pt.data.accountNo,pt.data.accountName].filter(Boolean).join(" · "),projects:Object.values(byProject),purchases:ps.map(x=>({id:x.id,projectName:pname.get(x.data.projectId)||"-",date:x.data.submittedAt||x.data.createdAt||"",items:(x.data.items||[]).length,amount:x.data.grossAmount,status:x.data.status})),totals:{purchased:sum(ps,x=>x.data.grossAmount),paid:sum(ps.filter(x=>x.data.status==="PAID"),x=>x.data.paidAmount||x.data.netAmount),inProcess:sum(ps.filter(x=>x.data.status!=="PAID"),x=>x.data.grossAmount)}});
    }
  }
  // SPK yang vendornya belum terdaftar sebagai pihak → tetap direkap per nama
  const seen=new Set(partnerRows.flatMap(r=>(r.contracts||[]).map(c=>c.contractId))); const loose=new Map();
  for(const c of PO){ if(seen.has(c.id)) continue; const nm=String(c.data.vendor||c.data.partnerName||"").trim(); if(!nm) continue; const t=String(c.data.partnerType||"VENDOR").toUpperCase()==="SUBKON"?"SUBKON":"VENDOR"; const k=`${t}|${nameKey(nm)}`; if(!loose.has(k)) loose.set(k,{t,nm,list:[]}); loose.get(k).list.push(c); }
  for(const [k,g] of loose){ const contracts=g.list.map(c=>{const value=num(c.data.contractValue||c.data.amount); const cp=PAY.filter(x=>x.data.contractId===c.id&&live(x)); const prog=Math.max(0,...cp.filter(x=>!x.data.isRetentionRelease).map(x=>num(x.data.workProgressPct))); const worked=Math.round(value*prog/100); const paidGross=sum(cp.filter(x=>x.data.status==="PAID"&&!x.data.isRetentionRelease),x=>x.data.grossAmount);
      return {contractId:c.id,number:c.data.number||c.id,projectId:c.data.projectId,projectName:pname.get(c.data.projectId)||"-",description:c.data.description||"",value,progress:prog,worked,paidGross,paidNet:sum(cp.filter(x=>x.data.status==="PAID"),x=>x.data.paidAmount||x.data.netAmount),retentionHeld:0,inProcess:sum(cp.filter(x=>["SUBMITTED","OPS_APPROVED","APPROVED"].includes(x.data.status)),x=>x.data.netAmount),unpaidWorked:Math.max(0,worked-paidGross),notWorked:Math.max(0,value-worked),needsSetup:true};});
    partnerRows.push({id:`unregistered:${k}`,type:g.t,name:g.nm,unregistered:true,phone:"",bank:"",contracts,totals:{value:sum(contracts,x=>x.value),worked:sum(contracts,x=>x.worked),paid:sum(contracts,x=>x.paidNet),paidGross:sum(contracts,x=>x.paidGross),retentionHeld:0,inProcess:sum(contracts,x=>x.inProcess),unpaidWorked:sum(contracts,x=>x.unpaidWorked),notWorked:sum(contracts,x=>x.notWorked)}}); }
  // Rekap tukang (dari absensi vs upah yang diajukan/dibayar)
  const tk=new Map(); const tById=new Map(tukang.map(x=>[x.id,x])); const tByName=new Map(); for(const x of tukang){ const nk=nameKey(x.data.name||x.data.nama); if(nk&&!tByName.has(nk)) tByName.set(nk,x.id); }
  const newRow=(k,name,master)=>({key:k,id:master?.id||"",name:master?.data?.name||name||k,unlinked:!master,workerType:master?.data?.workerType||master?.data?.skill1||master?.data?.skill||"",phone:master?.data?.phone||"",dailyRate:num(master?.data?.dailyRate),overtimeRate:num(master?.data?.overtimeRate),bankName:master?.data?.bankName||"",accountNo:master?.data?.accountNo||"",accountName:master?.data?.accountName||"",status:String(master?.data?.status||"AKTIF").toUpperCase(),atiLevel:master?.data?.atiLevel||"",days:0,earned:0,submitted:0,paid:0,projects:new Set(),aliases:new Set()});
  // Kunci tukang: ID master; bila absensi lama hanya berisi nama → dicocokkan ke master dengan nama yang sama, sisanya ditandai "belum terhubung".
  const resolve=(workerId,workerName)=>{ if(workerId&&tById.has(workerId)) return {k:workerId,master:tById.get(workerId)}; const nk=nameKey(workerName); if(nk&&tByName.has(nk)) return {k:tByName.get(nk),master:tById.get(tByName.get(nk))}; return {k:workerId||`name:${nk}`,master:null}; };
  const rowFor=(workerId,workerName)=>{ const {k,master}=resolve(workerId,workerName); if(!k||k==="name:") return null; const r=tk.get(k)||newRow(k,workerName,master); if(workerName&&String(workerName).trim()!==String(r.name).trim()) r.aliases.add(String(workerName).trim()); tk.set(k,r); return r; };
  if(!projectFilter) for(const x of tukang) if(!tk.has(x.id)) tk.set(x.id,newRow(x.id,x.data.name,x));
  for(const w of W){ const r=rowFor(w.data.workerId,w.data.workerName); if(!r) continue; const stt=String(w.data.attendanceStatus||w.data.status||"HADIR").toUpperCase(); const dd=["ALPA","IZIN","SAKIT"].includes(stt)?0:(stt==="SETENGAH HARI"||stt==="HALF"?0.5:1); r.days+=dd; r.earned+=num(w.data.amount)||Math.round(dd*num(w.data.dailyRate||w.data.wage||w.data.rate)); r.projects.add(pname.get(w.data.projectId)||"-"); }
  for(const pay of PAY.filter(x=>x.data.category==="TUKANG"&&live(x))) for(const l of (pay.data.lines||[])){ const r=rowFor(l.workerId,l.workerName); if(!r) continue; if(pay.data.status==="PAID") r.paid+=num(l.amount); else r.submitted+=num(l.amount); r.projects.add(pname.get(pay.data.projectId)||"-"); }
  const workersOut=[...tk.values()].map(r=>({...r,projects:[...r.projects],aliases:[...r.aliases],notSubmitted:Math.max(0,r.earned-r.paid-r.submitted)})).sort((a,b)=>b.earned-a.earned||a.name.localeCompare(b.name));
  const totals={cashIn:sum(projectsOut,x=>x.cashIn),cashOut:sum(projectsOut,x=>x.cashOut),termsBilledOpen:sum(projectsOut,x=>x.termsBilledOpen),retentionHeldByClient:sum(projectsOut,x=>x.retentionHeldByClient),payablesApproved:sum(projectsOut,x=>x.payablesApproved),payablesInApproval:sum(projectsOut,x=>x.payablesInApproval),byCategory:Object.fromEntries([...PAYMENT_CATEGORIES,"OPERASIONAL"].map(k=>[k,sum(projectsOut,x=>x.byCategory[k])]))};
  totals.balance=totals.cashIn-totals.cashOut;
  return json({ok:true,totals,projects:projectsOut,partners:partnerRows,workers:workersOut,settings:await financeSettings(env)});
}


// ===== V3.4.28 — Impor data keuangan dari Google Sheet / Excel =====
// Klien membaca file .xlsx (unduhan Google Sheet), mencocokkan proyek, lalu mengirim data bertahap ke endpoint ini.
// ID dibuat deterministik dari isi baris sehingga impor ulang memperbarui data (tidak dobel).
function importCan(user){ return roleIn(user,["administrator","direktur","head_unit_bisnis","finance"]); }
async function importPutMany(env,items){
  const now=new Date().toISOString();
  const stmts=items.map(({collection,id,data})=>env.DB.prepare(`INSERT INTO app_records(collection,id,data_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at`).bind(collection,id,JSON.stringify({...data,updatedAt:now,createdAt:data.createdAt||now}),now));
  for(let i=0;i<stmts.length;i+=90) await env.DB.batch(stmts.slice(i,i+90));
}
const IMPORT_PROJECT_STATUS={"IN PROGRESS":"IN PROGRESS","COMPLETED":"CLOSED","SELESAI":"CLOSED","ON HOLD":"ON HOLD","HOLD":"ON HOLD"};
async function importProjectsHandler(request,env,user){
  if(!importCan(user)) return json({ok:false,message:"Impor keuangan hanya untuk Finance dan pimpinan."},403);
  const b=await parseJson(request)||{}; const batch=String(b.batch||"").slice(0,80)||"SHEET"; const list=Array.isArray(b.projects)?b.projects.slice(0,500):[];
  const existing=await rowsWhere(env,"projects"); const byId=new Map(existing.map(r=>[r.id,r])); const byName=new Map(existing.map(r=>[nameKey(r.data.name),r]));
  const map={}, items=[]; let created=0, updated=0, skipped=0; const now=new Date().toISOString();
  for(const it of list){
    const d=it.data||{}; const key=String(it.key||d.name||""); if(!key) continue;
    if(it.mode==="skip"){ skipped++; continue; }
    let rec=it.mode==="existing"&&it.existingId?byId.get(String(it.existingId)):null;
    if(!rec&&it.mode!=="new") rec=byName.get(nameKey(d.name))||null;
    const fields={name:String(d.name||"").trim(),client:d.client||"",location:d.location||"",contractNo:d.contractNo||"",contractValue:num(d.contractValue),budget:num(d.budget),startDate:d.startDate||"",endDate:d.endDate||"",status:IMPORT_PROJECT_STATUS[String(d.status||"").toUpperCase()]||String(d.status||"").toUpperCase()||"",sheetPic:d.picName||"",sheetSupervisor:d.supervisorName||"",addendumSale:num(d.addendumSale),addendumCost:num(d.addendumCost),addendumStatus:d.addendumStatus||"",costVarianceNote:d.costNote||""};
    if(rec){
      const cur={...rec.data}; for(const [k,v] of Object.entries(fields)){ if(k==="name") continue; const empty=cur[k]===undefined||cur[k]===""||cur[k]===null||(typeof cur[k]==="number"&&!cur[k]); if((it.overwrite||empty)&&v!==""&&v!==0) cur[k]=v; }
      cur.importBatch=cur.importBatch||batch; items.push({collection:"projects",id:rec.id,data:cur}); map[key]=rec.id; updated++;
    } else {
      if(!fields.name) continue; const id=`PRJ-${nameKey(fields.name).replace(/[^a-z0-9]+/g,"-").slice(0,40)}-${String(Math.abs(hashStr(fields.name))).slice(0,5)}`;
      const cur=byId.get(id)?.data||{}; const data={...cur,...Object.fromEntries(Object.entries(fields).filter(([,v])=>v!==""&&v!==0)),importBatch:batch,importedAt:now,importedByName:user.name||user.username||""};
      items.push({collection:"projects",id,data}); map[key]=id; byName.set(nameKey(fields.name),{id,data}); byId.set(id,{id,data}); created++;
    }
  }
  await importPutMany(env,items);
  await audit(env,user,"FINANCE_IMPORT_PROJECTS","projects",batch,"",{created,updated,skipped});
  return json({ok:true,map,created,updated,skipped});
}
function hashStr(v){ let h=2166136261; const s=String(v); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
async function importTransactionsHandler(request,env,user){
  if(!importCan(user)) return json({ok:false,message:"Impor keuangan hanya untuk Finance dan pimpinan."},403);
  const b=await parseJson(request)||{}; const batch=String(b.batch||"").slice(0,80)||"SHEET"; const rows=Array.isArray(b.rows)?b.rows.slice(0,600):[];
  const createSuppliers=b.createSuppliers!==false; const projectIds=new Set((await rowsWhere(env,"projects")).map(r=>r.id));
  const partnerCache=new Map(); const items=[]; let co=0, pp=0, bad=0, newPartners=0; const now=new Date().toISOString();
  // Nama yang sudah dipindah (Vendor/Subkon/Reimburse) atau digabung (alias) tetap dipakai — impor ulang tidak memunculkan lagi sebagai toko.
  const known=new Map(); for(const r of await rowsWhere(env,"partners")){ for(const nm of [r.data.name,...(r.data.aliases||[])]){ const k=nameKey(nm); if(k&&(!known.has(k)||nameKey(r.data.name)===k)) known.set(k,{id:r.id,data:r.data}); } }
  for(const r of rows){
    const id=String(r.id||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,60); const pid=String(r.projectId||""); const amount=num(r.amount); const cat=["MATERIAL","TUKANG","SUBKON","VENDOR","OPERASIONAL"].includes(String(r.category))?String(r.category):"OPERASIONAL";
    if(!id||!projectIds.has(pid)||!amount||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||""))){ bad++; continue; }
    const name=String(r.partnerName||"").trim(); let partner=null; let cat2=cat;
    if(cat==="MATERIAL"&&name&&known.has(nameKey(name))){ partner=known.get(nameKey(name)); cat2=MOVE_CATEGORY[partner.data.partnerType]||cat; }
    else if(cat==="MATERIAL"&&createSuppliers&&name){
      const k=nameKey(name); if(partnerCache.has(k)) partner=partnerCache.get(k); else { const before=await env.DB.prepare(`SELECT id FROM app_records WHERE collection='partners' AND json_extract(data_json,'$.partnerType')='SUPPLIER' AND json_extract(data_json,'$.nameKey')=? LIMIT 1`).bind(k).first(); partner=await findOrCreatePartner(env,user,"SUPPLIER",{name,notes:"Dibuat dari impor Google Sheet"}); if(!before) newPartners++; partnerCache.set(k,partner); }
    }
    const itemsArr=(Array.isArray(r.items)?r.items:[]).slice(0,80).map(x=>({name:String(x.name||"").slice(0,160),qty:num(x.qty),unit:String(x.unit||"").slice(0,20),price:num(x.price),total:num(x.total)||Math.round(num(x.qty)*num(x.price))}));
    const desc=String(r.description||"").slice(0,400); const coId=`IMP-CO-${id}`; const ppId=partner?`IMP-PP-${id}`:"";
    items.push({collection:"cash_out",id:coId,data:{projectId:pid,date:r.date,category:PAYMENT_CATEGORY_LABEL[cat2],categoryKey:cat2,partnerId:partner?.id||"",partnerName:name,vendor:name,amount,status:"PAID",description:desc,notes:desc,items:itemsArr,account:String(r.bank||""),reference:String(r.source||""),paymentId:ppId,imported:true,importBatch:batch,importSource:String(r.source||""),importLocation:String(r.location||""),createdBy:"Impor Google Sheet"}}); co++;
    if(partner){ items.push({collection:"partner_payments",id:ppId,data:{projectId:pid,category:cat2,partnerId:partner.id,partnerName:partner.data?.name||name,items:itemsArr.length?itemsArr:[{name:desc||"Belanja material",qty:1,unit:"",price:amount,total:amount}],grossAmount:amount,retentionAmount:0,netAmount:amount,paidAmount:amount,status:"PAID",submittedAt:r.date,paidAt:r.date,paidAccount:String(r.bank||""),cashOutId:coId,requesterName:"Impor Google Sheet",notes:desc,imported:true,importBatch:batch,history:[{action:"IMPORTED",byName:user.name||user.username||"",at:now,note:`Dari ${r.source||"Google Sheet"}`}]}}); pp++; }
  }
  await importPutMany(env,items);
  return json({ok:true,cashOut:co,payments:pp,skipped:bad,newPartners});
}
async function importBatchesHandler(env,user){
  if(!importCan(user)) return json({ok:false,message:"Hanya Finance dan pimpinan."},403);
  const q=await env.DB.prepare(`SELECT json_extract(data_json,'$.importBatch') AS batch, COUNT(*) AS n, SUM(json_extract(data_json,'$.amount')) AS total, MIN(json_extract(data_json,'$.date')) AS first, MAX(json_extract(data_json,'$.date')) AS last, MAX(updated_at) AS at FROM app_records WHERE collection='cash_out' AND json_extract(data_json,'$.imported')=1 GROUP BY batch ORDER BY at DESC`).all();
  return json({ok:true,batches:q.results||[]});
}
async function importDeleteHandler(env,user,batch){
  if(!roleIn(user,["administrator","direktur","head_unit_bisnis","finance"])) return json({ok:false,message:"Hanya Finance dan pimpinan."},403);
  const r=await env.DB.prepare(`DELETE FROM app_records WHERE collection IN ('cash_out','partner_payments') AND json_extract(data_json,'$.imported')=1 AND json_extract(data_json,'$.importBatch')=?`).bind(batch).run();
  await audit(env,user,"FINANCE_IMPORT_DELETE","cash_out",batch,"",{deleted:r.meta?.changes||0});
  return json({ok:true,deleted:r.meta?.changes||0});
}

// ===== V3.4.25 — Database Mitra (Tukang, Vendor, Subkon, Toko Material) =====
const PARTY_COLLECTIONS = new Set(["partners","tukang"]);
async function rowsWhere(env,collection,sql="",binds=[]) {
  const q=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection=?${sql?` AND ${sql}`:""}`).bind(collection,...binds).all();
  return (q.results||[]).map(r=>({id:r.id,data:safeJsonParse(r.data_json,{})}));
}
async function partyInUse(env,collection,id) {
  if(collection==="partners"){
    const n=await env.DB.prepare(`SELECT COUNT(*) AS n FROM app_records WHERE collection IN ('partner_payments','po','cash_out') AND json_extract(data_json,'$.partnerId')=?`).bind(id).first();
    return num(n?.n)>0?"Pihak ini sudah dipakai di SPK/pengajuan/pembayaran. Ubah status menjadi Nonaktif agar riwayatnya tetap utuh.":"";
  }
  if(collection==="tukang"){
    const n=await env.DB.prepare(`SELECT COUNT(*) AS n FROM app_records WHERE collection='daily_workers' AND json_extract(data_json,'$.workerId')=?`).bind(id).first();
    if(num(n?.n)>0) return "Tukang ini sudah tercatat di absensi. Ubah status menjadi Nonaktif agar riwayat upahnya tetap utuh.";
    const p=await env.DB.prepare(`SELECT COUNT(*) AS n FROM app_records WHERE collection='partner_payments' AND instr(data_json,?)>0`).bind(`"workerId":"${String(id).replace(/"/g,"")}"`).first();
    return num(p?.n)>0?"Tukang ini sudah ada di pengajuan upah. Ubah status menjadi Nonaktif.":"";
  }
  return "";
}
async function partyDuplicate(env,collection,id,data) {
  if(collection==="partners"){
    const t=String(data.partnerType||"").toUpperCase(); const nk=nameKey(data.name); if(!nk) return "";
    const hit=await env.DB.prepare(`SELECT id,data_json FROM app_records WHERE collection='partners' AND json_extract(data_json,'$.partnerType')=? AND json_extract(data_json,'$.nameKey')=? AND id<>? LIMIT 1`).bind(t,nk,String(id||"")).first();
    return hit?`${PARTNER_TYPES[t]||"Pihak"} "${safeJsonParse(hit.data_json,{}).name}" sudah terdaftar. Gunakan data yang ada, atau gabungkan bila duplikat.`:"";
  }
  if(collection==="tukang"){
    const nk=nameKey(data.name); if(!nk) return "";
    for(const r of await rowsWhere(env,"tukang")) if(r.id!==String(id||"")&&nameKey(r.data.name)===nk&&(!data.phone||!r.data.phone||String(r.data.phone).replace(/\D/g,"")===String(data.phone).replace(/\D/g,""))) return `Tukang "${r.data.name}" sudah terdaftar${r.data.phone?` (${r.data.phone})`:""}. Bila orang berbeda dengan nama sama, isi No. HP yang berbeda.`;
  }
  return "";
}
async function batchPut(env,items) {
  const now=new Date().toISOString(); const stmts=items.map(({collection,id,data})=>env.DB.prepare(`UPDATE app_records SET data_json=?, updated_at=? WHERE collection=? AND id=?`).bind(JSON.stringify({...data,updatedAt:now}),now,collection,id));
  for(let i=0;i<stmts.length;i+=80) await env.DB.batch(stmts.slice(i,i+80));
}
async function partyHistoryHandler(env,user,kind,id) {
  const pname=new Map((await rowsWhere(env,"projects")).map(p=>[p.id,p.data.name||p.id]));
  const scope=isProjectScopedRole(user)?await accessibleProjectIds(env,user):null; const ok=pid=>!scope||scope.has(String(pid));
  if(kind==="tukang"){
    let master=null, nk="";
    if(id.startsWith("name:")) nk=id.slice(5); else { master=await getRecord(env,"tukang",id); if(!master) return json({ok:false,message:"Tukang tidak ditemukan."},404); nk=nameKey(master.data.name); }
    const att=(await rowsWhere(env,"daily_workers")).filter(w=>ok(w.data.projectId)&&((master&&w.data.workerId===master.id)||(!w.data.workerId&&nameKey(w.data.workerName)===nk)||(!master&&nameKey(w.data.workerName)===nk&&!w.data.workerId)));
    const att2=att.map(w=>{const stt=String(w.data.attendanceStatus||w.data.status||"HADIR").toUpperCase(); const dd=["ALPA","IZIN","SAKIT"].includes(stt)?0:(stt==="SETENGAH HARI"||stt==="HALF"?0.5:1); return {date:w.data.date||"",projectId:w.data.projectId,projectName:pname.get(w.data.projectId)||"-",status:stt,days:dd,overtimeHours:num(w.data.overtimeHours),amount:num(w.data.amount)||Math.round(dd*num(w.data.dailyRate||w.data.wage||w.data.rate))};}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const pays=[]; for(const p of await rowsWhere(env,"partner_payments","json_extract(data_json,'$.category')='TUKANG'")){ if(!ok(p.data.projectId)) continue; for(const l of (p.data.lines||[])) if((master&&l.workerId===master.id)||nameKey(l.workerName)===nk&&(!l.workerId||!master)) pays.push({id:p.id,projectName:pname.get(p.data.projectId)||"-",period:`${p.data.periodStart||""} – ${p.data.periodEnd||""}`,amount:num(l.amount),days:num(l.days),status:p.data.status,paidAt:p.data.paidAt||"",proofDocId:p.data.proofDocId||""}); }
    const byProject={}; for(const a of att2){ const b=byProject[a.projectId]||(byProject[a.projectId]={projectName:a.projectName,days:0,earned:0,first:a.date,last:a.date}); b.days+=a.days; b.earned+=a.amount; if(a.date<b.first) b.first=a.date; if(a.date>b.last) b.last=a.date; }
    return json({ok:true,kind,master,attendance:att2.slice(0,300),attendanceCount:att2.length,byProject:Object.values(byProject),payments:pays.sort((a,b)=>String(b.period).localeCompare(String(a.period)))});
  }
  const pt=await getRecord(env,"partners",id); if(!pt) return json({ok:false,message:"Data tidak ditemukan."},404);
  const contracts=(await rowsWhere(env,"po")).filter(c=>ok(c.data.projectId)&&(c.data.partnerId===id||(!c.data.partnerId&&nameKey(c.data.vendor||c.data.partnerName)===pt.data.nameKey)));
  const cids=new Set(contracts.map(c=>c.id));
  const pays=(await rowsWhere(env,"partner_payments")).filter(p=>ok(p.data.projectId)&&(p.data.partnerId===id||cids.has(p.data.contractId)));
  return json({ok:true,kind,partner:pt,
    contracts:contracts.map(c=>({id:c.id,number:c.data.number||c.id,projectName:pname.get(c.data.projectId)||"-",date:c.data.date||"",description:c.data.description||"",value:num(c.data.contractValue||c.data.amount),retentionPct:num(c.data.retentionPct),terms:c.data.terms||[],spkDocId:c.data.spkDocId||""})),
    payments:pays.map(p=>({id:p.id,projectName:pname.get(p.data.projectId)||"-",category:p.data.category,contractNumber:p.data.contractNumber||"",termLabel:p.data.termLabel||"",items:(p.data.items||[]).map(x=>`${x.name} ${num(x.qty)} ${x.unit||""}`.trim()),date:p.data.submittedAt||p.data.createdAt||"",gross:num(p.data.grossAmount),retention:num(p.data.retentionAmount),net:num(p.data.netAmount),status:p.data.status,paidAmount:num(p.data.paidAmount),paidAt:p.data.paidAt||"",proofDocId:p.data.proofDocId||"",attachmentDocIds:p.data.attachmentDocIds||[]})).sort((a,b)=>String(b.date).localeCompare(String(a.date)))});
}
const MOVE_CATEGORY={VENDOR:"VENDOR",SUBKON:"SUBKON",SUPPLIER:"MATERIAL",REIMBURSE:"MATERIAL"};
async function partyMoveHandler(request,env,user) {
  if(!buildAccess(user).capabilities.directoryMerge) return json({ok:false,message:"Hanya Head of Operational/Finance yang dapat memindahkan jenis mitra."},403);
  const b=await parseJson(request)||{}; const to=String(b.toType||"").toUpperCase(); if(!PARTNER_TYPES[to]) return json({ok:false,message:"Jenis tujuan tidak dikenal."},400);
  const ids=[...new Set((b.ids||[]).map(String))].slice(0,500); if(!ids.length) return json({ok:false,message:"Pilih minimal satu data."},400);
  const pays=await rowsWhere(env,"partner_payments","json_extract(data_json,'$.partnerId') IS NOT NULL"); const cos=await rowsWhere(env,"cash_out","json_extract(data_json,'$.partnerId') IS NOT NULL"); const pos=await rowsWhere(env,"po","json_extract(data_json,'$.partnerId') IS NOT NULL");
  const all=await rowsWhere(env,"partners"); const byKey=new Map(all.filter(r=>r.data.partnerType===to).map(r=>[r.data.nameKey,r]));
  const updates=[]; let moved=0, merged=0, blocked=[];
  for(const id of ids){
    const pt=all.find(r=>r.id===id); if(!pt||pt.data.partnerType===to) continue;
    const spk=pos.filter(x=>x.data.partnerId===id);
    if(spk.length&&!["VENDOR","SUBKON"].includes(to)){ blocked.push(`${pt.data.name} (punya ${spk.length} SPK)`); continue; }
    const target=byKey.get(pt.data.nameKey); const newId=target?target.id:id; const newName=target?target.data.name:pt.data.name; const cat=MOVE_CATEGORY[to];
    for(const x of pays.filter(x=>x.data.partnerId===id)){ const d={...x.data,partnerId:newId,partnerName:newName}; if(!d.contractId&&String(d.status).toUpperCase()==="PAID") d.category=cat; updates.push({collection:"partner_payments",id:x.id,data:d}); }
    for(const x of cos.filter(x=>x.data.partnerId===id)){ const d={...x.data,partnerId:newId,partnerName:newName,vendor:newName}; const linked=pays.find(p=>p.id===d.paymentId); if(!linked?.data?.contractId){ d.categoryKey=cat; d.category=PAYMENT_CATEGORY_LABEL[cat]; } updates.push({collection:"cash_out",id:x.id,data:d}); }
    for(const x of spk) updates.push({collection:"po",id:x.id,data:{...x.data,partnerId:newId,partnerName:newName,vendor:newName,partnerType:to}});
    if(target){ const patch={}; for(const k of ["phone","address","bankName","accountNo","accountName","specialty"]) if(!target.data[k]&&pt.data[k]) patch[k]=pt.data[k]; updates.push({collection:"partners",id:target.id,data:{...target.data,...patch,aliases:[...new Set([...(target.data.aliases||[]),pt.data.name])].slice(0,20)}}); await deleteRecord(env,"partners",id,user); merged++; }
    else { updates.push({collection:"partners",id,data:{...pt.data,partnerType:to,movedFrom:pt.data.partnerType,movedAt:new Date().toISOString()}}); byKey.set(pt.data.nameKey,{id,data:{...pt.data,partnerType:to}}); moved++; }
  }
  await batchPut(env,updates);
  await audit(env,user,"PARTY_MOVE","partners",to,"",{ids:ids.slice(0,50),moved,merged,blocked});
  return json({ok:true,moved,merged,blocked,records:updates.length});
}
async function partyMergeHandler(request,env,user) {
  if(!buildAccess(user).capabilities.directoryMerge) return json({ok:false,message:"Hanya Head of Operational/Finance yang dapat menggabungkan data."},403);
  const b=await parseJson(request)||{}; const kind=b.kind==="tukang"?"tukang":"partners"; const keepId=String(b.keepId||""); const mergeIds=[...new Set((b.mergeIds||[]).map(String))].filter(x=>x&&x!==keepId);
  if(!keepId||!mergeIds.length) return json({ok:false,message:"Pilih data utama dan minimal satu data yang digabungkan."},400);
  const keep=await getRecord(env,kind,keepId); if(!keep) return json({ok:false,message:"Data utama tidak ditemukan."},404);
  const updates=[]; let touched=0;
  if(kind==="partners"){
    const olds=[]; for(const mid of mergeIds){ const r=await getRecord(env,"partners",mid); if(!r) continue; if(r.data.partnerType!==keep.data.partnerType) return json({ok:false,message:"Hanya data dengan jenis yang sama yang bisa digabungkan."},400); olds.push(r); }
    const ids=new Set(olds.map(r=>r.id)); const nm=keep.data.name;
    for(const col of ["po","partner_payments","cash_out"]) for(const r of await rowsWhere(env,col,"json_extract(data_json,'$.partnerId') IS NOT NULL")) if(ids.has(r.data.partnerId)){ const d={...r.data,partnerId:keepId}; if(col!=="partner_payments"||r.data.category!=="TUKANG") d.partnerName=nm; if(col==="po") d.vendor=nm; updates.push({collection:col,id:r.id,data:d}); }
    const patch={}; for(const o of olds) for(const k of ["phone","address","bankName","accountNo","accountName","specialty"]) if(!keep.data[k]&&!patch[k]&&o.data[k]) patch[k]=o.data[k];
    const aliases=[...new Set([...(keep.data.aliases||[]),...olds.map(o=>o.data.name)])];
    await batchPut(env,updates); touched=updates.length;
    await upsertRecord(env,"partners",keepId,{...keep.data,...patch,aliases},user);
    for(const o of olds) await deleteRecord(env,"partners",o.id,user);
  } else {
    const ids=new Set(), names=new Set(), olds=[];
    for(const mid of mergeIds){ if(mid.startsWith("name:")) names.add(mid.slice(5)); else { const r=await getRecord(env,"tukang",mid); if(r){ ids.add(r.id); olds.push(r); } } }
    const nm=keep.data.name;
    const hit=(wid,wname)=>ids.has(String(wid||""))||(!wid&&names.has(nameKey(wname)));
    for(const r of await rowsWhere(env,"daily_workers")) if(hit(r.data.workerId,r.data.workerName)) updates.push({collection:"daily_workers",id:r.id,data:{...r.data,workerId:keepId,workerName:nm}});
    for(const r of await rowsWhere(env,"partner_payments","json_extract(data_json,'$.category')='TUKANG'")){ let ch=false; const lines=(r.data.lines||[]).map(l=>{ if(hit(l.workerId,l.workerName)){ ch=true; return {...l,workerId:keepId,workerName:nm}; } return l; }); if(ch) updates.push({collection:"partner_payments",id:r.id,data:{...r.data,lines}}); }
    await batchPut(env,updates); touched=updates.length;
    const patch={}; for(const o of olds) for(const k of ["phone","bankName","accountNo","accountName","dailyRate","overtimeRate","workerType","domicile"]) if(!keep.data[k]&&!patch[k]&&o.data[k]) patch[k]=o.data[k];
    if(Object.keys(patch).length) await upsertRecord(env,"tukang",keepId,{...keep.data,...patch},user);
    for(const o of olds) await deleteRecord(env,"tukang",o.id,user);
  }
  await audit(env,user,"PARTY_MERGE",kind,keepId,"",{merged:mergeIds,records:touched});
  return json({ok:true,records:touched});
}

export default {
  async fetch(request, env, ctx) {
    REQUEST_ORIGIN = new URL(request.url).origin;
    const response = await handleRequest(request, env);
    if (EMAIL_PENDING_FLUSH) { EMAIL_PENDING_FLUSH=false; const job=flushEmailOutbox(env).catch(e=>console.log("flushEmailOutbox",e?.message||e)); if (ctx?.waitUntil) ctx.waitUntil(job); else await job; }
    return response;
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async()=>{
      try { await escalateOverdueQcConfirmations(env); } catch(e) { console.log("qc escalation",e?.message||e); }
      await flushEmailOutbox(env,{retry:true,limit:100}).catch(e=>console.log("scheduled email",e?.message||e));
    })());
  }
};

async function handleRequest(request, env) {
  {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null,{status:204});
    if (path === "/app-build.json") return json({ok:true,appVersion:APP_VERSION,service:SERVICE_NAME,architecture:"worker+d1+r2+assets",workflow:"v3.4.29-partner-move"});
    if (path === "/api/health") return diagnostics(env);
    if ((path === "/info" || path === "/public" || path === "/informasi") && request.method === "GET") return servePublicPortal(request,env);
    if (path === "/api/public/site" && request.method === "GET") return publicSiteHandler(env);
    if ((path === "/api/public/portfolio" || path === "/api/public/projects") && request.method === "GET") return publicPortfolioHandler(env);
    const publicPortfolioMatch=path.match(/^\/api\/public\/(?:portfolio|projects)\/([^/]+)$/);
    if(publicPortfolioMatch && request.method === "GET") return publicPortfolioDetailHandler(env,decodeURIComponent(publicPortfolioMatch[1]));
    const publicMediaMatch=path.match(/^\/api\/public\/media\/([^/]+)$/);
    if(publicMediaMatch && request.method === "GET") return publicMediaHandler(env,decodeURIComponent(publicMediaMatch[1]));
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
    if (path === "/api/reports/qc/generate" && request.method === "POST") return generateDivisionReport(request,env,auth.user,"QC");
    if (path === "/api/reports/ati/generate" && request.method === "POST") return generateDivisionReport(request,env,auth.user,"ATI");
    const reportReviewMatch=path.match(/^\/api\/reports\/(qc|ati)\/([^/]+)\/review$/);
    if (reportReviewMatch && request.method === "POST") return reviewDivisionReport(env,auth.user,reportReviewMatch[1],decodeURIComponent(reportReviewMatch[2]));
    const reportReadMatch=path.match(/^\/api\/reports\/(qc|ati)\/([^/]+)\/read$/);
    if (reportReadMatch && request.method === "POST") return readDivisionReport(env,auth.user,reportReadMatch[1],decodeURIComponent(reportReadMatch[2]));
    const reportManageMatch=path.match(/^\/api\/reports\/(qc|ati)\/([^/]+)$/);
    if (reportManageMatch && request.method === "PATCH") return updateDivisionReport(request,env,auth.user,reportManageMatch[1],decodeURIComponent(reportManageMatch[2]));
    if (reportManageMatch && request.method === "DELETE") return deleteDivisionReport(env,auth.user,reportManageMatch[1],decodeURIComponent(reportManageMatch[2]));

    if (path === "/api/finance/import/projects" && request.method === "POST") return importProjectsHandler(request,env,auth.user);
    if (path === "/api/finance/import/transactions" && request.method === "POST") return importTransactionsHandler(request,env,auth.user);
    if (path === "/api/finance/import" && request.method === "GET") return importBatchesHandler(env,auth.user);
    const importDelMatch = path.match(/^\/api\/finance\/import\/([^/]+)$/);
    if (importDelMatch && request.method === "DELETE") return importDeleteHandler(env,auth.user,decodeURIComponent(importDelMatch[1]));
    const partyHistMatch = path.match(/^\/api\/finance\/directory\/(tukang|partners)\/([^/]+)\/history$/);
    if (partyHistMatch && request.method === "GET") return partyHistoryHandler(env,auth.user,partyHistMatch[1],decodeURIComponent(partyHistMatch[2]));
    if (path === "/api/finance/directory/merge" && request.method === "POST") return partyMergeHandler(request,env,auth.user);
    if (path === "/api/finance/directory/move" && request.method === "POST") return partyMoveHandler(request,env,auth.user);
    if (path === "/api/finance/summary" && request.method === "GET") return financeSummaryHandler(env,auth.user,url);
    if (path === "/api/finance/settings" && ["GET","PUT"].includes(request.method)) return financeSettingsHandler(request,env,auth.user);
    if (path === "/api/finance/contracts" && request.method === "POST") return contractSaveHandler(request,env,auth.user,"");
    const finContractMatch = path.match(/^\/api\/finance\/contracts\/([^/]+)$/);
    if (finContractMatch && request.method === "POST") return contractSaveHandler(request,env,auth.user,decodeURIComponent(finContractMatch[1]));
    if (path === "/api/finance/payroll-preview" && request.method === "GET") return payrollPreviewHandler(env,auth.user,url);
    if (path === "/api/finance/payments" && request.method === "POST") return partnerPaymentSaveHandler(request,env,auth.user,"");
    const finPayMatch = path.match(/^\/api\/finance\/payments\/([^/]+)(?:\/(action|pay))?$/);
    if (finPayMatch && request.method === "POST") { const pid=decodeURIComponent(finPayMatch[1]); if(finPayMatch[2]==="action") return partnerPaymentActionHandler(request,env,auth.user,pid); if(finPayMatch[2]==="pay") return partnerPaymentPayHandler(request,env,auth.user,pid); return partnerPaymentSaveHandler(request,env,auth.user,pid); }
    const finTermMatch = path.match(/^\/api\/finance\/terms\/([^/]+)\/(bill|receive)$/);
    if (finTermMatch && request.method === "POST") return finTermMatch[2]==="bill" ? termBillHandler(request,env,auth.user,decodeURIComponent(finTermMatch[1])) : termReceiveHandler(request,env,auth.user,decodeURIComponent(finTermMatch[1]));
    if (path === "/api/notifications/email" && request.method === "GET") return emailStatusHandler(env,auth.user);
    if (path === "/api/notifications/email/test" && request.method === "POST") return emailTestHandler(request,env,auth.user);
    if (path === "/api/notifications/email/retry" && request.method === "POST") return emailRetryHandler(env,auth.user);
    if (path === "/api/tasks/count" && request.method === "GET") return json({ok:true,count:await countMyWorkflowTasks(env,auth.user)});
    if (path === "/api/tasks/my" && request.method === "GET") return json({ok:true,rows:await listWorkflowTasks(env,auth.user,url)});
    const taskProjectMatch=path.match(/^\/api\/tasks\/project\/([^/]+)$/);
    if(taskProjectMatch && request.method==="GET"){const pid=decodeURIComponent(taskProjectMatch[1]);const denied=await requireProjectAccess(env,auth.user,pid);if(denied)return denied;const u=new URL(request.url);u.searchParams.set('scope','project');u.searchParams.set('projectId',pid);if(!u.searchParams.has('includeDone'))u.searchParams.set('includeDone','true');return json({ok:true,rows:await listWorkflowTasks(env,auth.user,u)});}
    const taskActionMatch=path.match(/^\/api\/tasks\/([^/]+)\/action$/);
    if(taskActionMatch && request.method==="POST") return taskActionHandler(request,env,auth.user,decodeURIComponent(taskActionMatch[1]));
    const progressActionMatch=path.match(/^\/api\/progress\/(daily_progress|weekly_progress)\/([^/]+)\/action$/);
    if(progressActionMatch && request.method==="POST") return progressWorkflowAction(request,env,auth.user,progressActionMatch[1],decodeURIComponent(progressActionMatch[2]));
    const opnameActionMatch=path.match(/^\/api\/opname\/([^/]+)\/action$/);
    if(opnameActionMatch && request.method==="POST") return opnameWorkflowAction(request,env,auth.user,decodeURIComponent(opnameActionMatch[1]));
    const issueActionMatch=path.match(/^\/api\/issues\/([^/]+)\/action$/);
    if(issueActionMatch && request.method==="POST") return issueWorkflowAction(request,env,auth.user,decodeURIComponent(issueActionMatch[1]));
    const closeoutActionMatch=path.match(/^\/api\/(retention|closeout)\/([^/]+)\/action$/);
    if(closeoutActionMatch && request.method==="POST") return closeoutWorkflowAction(request,env,auth.user,closeoutActionMatch[1],decodeURIComponent(closeoutActionMatch[2]));
    const atiActionMatch=path.match(/^\/api\/ati\/(ati_work_requests|ati_field_issues)\/([^/]+)\/action$/);
    if(atiActionMatch && request.method==="POST") return atiWorkflowAction(request,env,auth.user,atiActionMatch[1],decodeURIComponent(atiActionMatch[2]));

    // Workflow endpoints: status changes are performed here so field users cannot skip gates.
    if (path === "/api/qc/sync-rab" && request.method === "POST") {
      if (!buildAccess(auth.user).capabilities.qcSyncRab) return json({ok:false,message:"Role ini tidak dapat sinkron item QC dari RAB."},403);
      const body=await parseJson(request)||{}; const projectId=String(body.projectId||"").trim();
      if(!projectId) return json({ok:false,message:"Project wajib dipilih."},400);
      return json({ok:true,...await syncQcFromRab(env,auth.user,projectId)});
    }
    if (path === "/api/qc/inspect" && request.method === "POST") return qcInspectHandler(request,env,auth.user);
    if (path === "/api/qc/sessions" && request.method === "GET") return qcSessionListHandler(env,auth.user,url);
    if (path === "/api/qc/sessions" && request.method === "POST") return qcSessionStartHandler(request,env,auth.user);
    const qcSessionDetailMatch = path.match(/^\/api\/qc\/sessions\/([^/]+)$/);
    if (qcSessionDetailMatch && request.method === "GET") return qcSessionDetailHandler(env,auth.user,decodeURIComponent(qcSessionDetailMatch[1]));
    if (qcSessionDetailMatch && request.method === "PATCH") return qcSessionUpdateHandler(request,env,auth.user,decodeURIComponent(qcSessionDetailMatch[1]));
    if (qcSessionDetailMatch && request.method === "DELETE") return qcSessionDeleteHandler(env,auth.user,decodeURIComponent(qcSessionDetailMatch[1]));
    const qcSessionItemsMatch = path.match(/^\/api\/qc\/sessions\/([^/]+)\/items$/);
    if (qcSessionItemsMatch && request.method === "POST") return qcSessionAddItemHandler(request,env,auth.user,decodeURIComponent(qcSessionItemsMatch[1]));
    const qcSessionPublishMatch = path.match(/^\/api\/qc\/sessions\/([^/]+)\/publish-findings$/);
    if (qcSessionPublishMatch && request.method === "POST") return qcSessionPublishHandler(request,env,auth.user,decodeURIComponent(qcSessionPublishMatch[1]));
    const qcSessionCloseMatch = path.match(/^\/api\/qc\/sessions\/([^/]+)\/close$/);
    if (qcSessionCloseMatch && request.method === "POST") return qcSessionCloseHandler(env,auth.user,decodeURIComponent(qcSessionCloseMatch[1]));
    const qcSessionItemMatch = path.match(/^\/api\/qc\/session-items\/([^/]+)$/);
    if (qcSessionItemMatch && request.method === "PATCH") return qcSessionUpdateItemHandler(request,env,auth.user,decodeURIComponent(qcSessionItemMatch[1]));
    if (qcSessionItemMatch && request.method === "DELETE") return qcSessionDeleteItemHandler(env,auth.user,decodeURIComponent(qcSessionItemMatch[1]));
    const qcConfirmMatch = path.match(/^\/api\/qc\/session-items\/([^/]+)\/confirm-(answer|reask)$/);
    if (qcConfirmMatch && request.method === "POST") return qcConfirmMatch[2]==="answer" ? qcConfirmAnswerHandler(request,env,auth.user,decodeURIComponent(qcConfirmMatch[1])) : qcConfirmReaskHandler(request,env,auth.user,decodeURIComponent(qcConfirmMatch[1]));
    const qcSessionPhotoMatch = path.match(/^\/api\/qc\/session-items\/([^/]+)\/photo$/);
    if (qcSessionPhotoMatch && request.method === "POST") return qcSessionItemPhotoHandler(request,env,auth.user,decodeURIComponent(qcSessionPhotoMatch[1]));
    const qcFindingMatch = path.match(/^\/api\/qc\/findings\/([^/]+)$/);
    if (qcFindingMatch && request.method === "PATCH") return qcFindingUpdateHandler(request,env,auth.user,decodeURIComponent(qcFindingMatch[1]));
    if (qcFindingMatch && request.method === "DELETE") return qcFindingDeleteHandler(env,auth.user,decodeURIComponent(qcFindingMatch[1]));
    const qcFindingAction = path.match(/^\/api\/qc\/findings\/([^/]+)\/action$/);
    if (qcFindingAction && request.method === "POST") return qcFindingActionHandler(request,env,auth.user,decodeURIComponent(qcFindingAction[1]));

    const ccoAction = path.match(/^\/api\/cco\/([^/]+)\/action$/);
    if (ccoAction && request.method === "POST") return ccoActionHandler(request,env,auth.user,decodeURIComponent(ccoAction[1]));
    const payAction = path.match(/^\/api\/payment-requests\/([^/]+)\/action$/);
    if (payAction && request.method === "POST") return paymentRequestActionHandler(request,env,auth.user,decodeURIComponent(payAction[1]));
    const prAction = path.match(/^\/api\/procurement\/([^/]+)\/action$/);
    if (prAction && request.method === "POST") return procurementActionHandler(request,env,auth.user,decodeURIComponent(prAction[1]));

    const asBuiltAction = path.match(/^\/api\/as-built\/([^/]+)\/action$/);
    if (asBuiltAction && request.method === "POST") return asBuiltActionHandler(request,env,auth.user,decodeURIComponent(asBuiltAction[1]));

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
        if (["qc_inspections","qc_inspection_sessions","qc_inspection_items"].includes(collection)) return json({ok:false,message:"QC Inspection wajib melalui alur QC khusus, bukan CRUD generik."},409);
        if (["qc_reports","ati_reports"].includes(collection)) return json({ok:false,message:"Laporan divisi wajib dibuat melalui tombol Buat & Kirim agar snapshot berasal dari data dashboard."},409);
        const body = await parseJson(request);
        if (!body) return json({ok:false,message:"JSON tidak valid."},400);
        let data={...(body.data || body)};
        try { data=await normalizeOperationalResponsibility(env,collection,data); } catch(e) { return json({ok:false,message:e.message},400); }
        if (PARTY_COLLECTIONS.has(collection)) { const dup=await partyDuplicate(env,collection,body.id||"",data); if(dup) return json({ok:false,message:dup},409); }
        if (collection === "procurement") data=normalizePrArrays(data);
        if (collection === "po" && data.prId) {
          if (!roleIn(auth.user,["admin_teknik","administrator","direktur","head_unit_bisnis"])) return json({ok:false,message:"PO/SPK dari PR hanya dapat dibuat oleh Admin Teknik."},403);
          const pr=await getRecord(env,"procurement",String(data.prId));
          if(!pr) return json({ok:false,message:"PR referensi tidak ditemukan."},400);
          if(String(pr.data.status||"").toUpperCase()!=="APPROVED") return json({ok:false,message:"Vendor PR harus disetujui Head of Operational/Head Unit Bisnis sebelum Admin Teknik membuat SPK/PO."},409);
          data.projectId=pr.data.projectId;
          data.vendor=pr.data.selectedVendorName||data.vendor||"";
          data.amount=num(pr.data.selectedOfferAmount)||num(data.amount);
          data.description=data.description||`SPK vendor PR ${pr.data.prNumber||pr.id}`;
        }
        if (collection === "as_built_progress") {
          const projectId=String(data.projectId||""); if(!projectId) return json({ok:false,message:"Proyek wajib dipilih."},400);
          const existing=await env.DB.prepare(`SELECT id FROM app_records WHERE collection='as_built_progress' AND json_extract(data_json,'$.projectId')=? LIMIT 1`).bind(projectId).first();
          if(existing) return json({ok:false,message:"Progress As-Built proyek ini sudah ada. Gunakan tombol Update."},409);
          const drafter=await projectAssignment(env,projectId,"drafter");
          if(!drafter) return json({ok:false,message:"Proyek belum memiliki Drafter/BIM. Tetapkan Drafter pada master proyek terlebih dahulu."},400);
          if(normalizeRole(auth.user)==="drafter" && String(drafter)!==String(auth.user.id||"")) return json({ok:false,message:"Anda bukan Drafter yang ditugaskan pada proyek ini."},403);
          data=normalizeAsBuiltProgress({...data,drafterUserId:drafter},"");
        }
        const targetProjectId = recordProjectId(collection,body.id || "",data);
        if (targetProjectId) { const denied = await requireProjectAccess(env,auth.user,targetProjectId); if (denied) return denied; }
        if (collection === "cco") data.status="DRAFT";
        if (["daily_progress","weekly_progress","opname","ati_work_requests"].includes(collection)) data.status="DRAFT";
        if (["issues","retention","closeout","ati_field_issues"].includes(collection)) data.status="OPEN";
        if (collection === "payment_requests") { data.status="DRAFT"; data.requesterUserId=auth.user.id; }
        if (collection === "procurement") { const assignedPm=await projectAssignment(env,data.projectId,"pm"); if(!assignedPm) return json({ok:false,message:"Proyek belum memiliki Site Manager. Tetapkan Site Manager sebelum membuat PR."},400); const rr=normalizeRole(auth.user); if(!["site_manager","manager_operasional","head_unit_bisnis","administrator","direktur"].includes(rr)) return json({ok:false,message:"Draft PR hanya dapat disiapkan oleh Site Manager proyek atau Head of Operational."},403); data.status="DRAFT"; data.preparedByUserId=auth.user.id; data.requesterUserId=assignedPm; data.projectManagerUserId=assignedPm; data.totalHpp=(data.items||[]).reduce((a,x)=>a+num(x.totalHpp),0); }
        if (collection === "defects") { data.status="OPEN"; data.picUserId=await projectAssignment(env,data.projectId,"pm"); if(!data.picUserId) return json({ok:false,message:"Proyek belum memiliki Site Manager. Tetapkan Site Manager sebelum membuat Temuan QC."},400); }
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
        if (["qc_inspections","qc_inspection_sessions","qc_inspection_items"].includes(collection)) return json({ok:false,message:"QC Inspection wajib diubah melalui alur QC khusus agar histori dan audit tetap utuh."},409);
        if (["qc_reports","ati_reports"].includes(collection)) return json({ok:false,message:"Snapshot laporan divisi tidak dapat diedit manual."},409);
        const body = await parseJson(request);
        if (!body) return json({ok:false,message:"JSON tidak valid."},400);
        let data={...(body.data || body)};
        const old=await getRecord(env,collection,id);
        if (!old) return json({ok:false,message:"Data tidak ditemukan."},404);
        if (!(await recordAllowedByProjectScope(env,auth.user,collection,id,old.data))) return json({ok:false,message:"Anda tidak ditugaskan pada proyek data ini."},403);
        const mergedProjectId = recordProjectId(collection,id,{...old.data,...data});
        if (mergedProjectId) { const denied = await requireProjectAccess(env,auth.user,mergedProjectId); if (denied) return denied; }
        if (collection === "as_built_progress") {
          const role=normalizeRole(auth.user); const oldStatus=String(old.data.status||"").toUpperCase();
          const projectId=String(old.data.projectId||data.projectId||""); const drafter=await projectAssignment(env,projectId,"drafter");
          if(role==="drafter" && String(drafter||old.data.drafterUserId||"")!==String(auth.user.id||"")) return json({ok:false,message:"Anda bukan Drafter yang ditugaskan pada proyek ini."},403);
          if(role==="drafter" && ["READY FOR APPROVAL","APPROVED"].includes(oldStatus)) return json({ok:false,message:"As-Built sedang/final direview. Tunggu Head of Engineering atau kembalikan ke Drafter."},409);
          data=normalizeAsBuiltProgress({...old.data,...data,projectId,drafterUserId:drafter||old.data.drafterUserId},oldStatus);
        }
        try { data=await normalizeOperationalResponsibility(env,collection,{...old.data,...data}); } catch(e) { return json({ok:false,message:e.message},400); }
        if (PARTY_COLLECTIONS.has(collection)) { const dup=await partyDuplicate(env,collection,id,data); if(dup) return json({ok:false,message:dup},409); }
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
        if (collection === "cco" && ["site_manager"].includes(roleKey)) {
          if (old.data.requestedByUserId && old.data.requestedByUserId !== auth.user.id) return json({ok:false,message:"Anda hanya dapat mengedit CCO yang Anda ajukan."},403);
          if (!["DRAFT","RETURNED_TO_FIELD"].includes(String(old.data.status||"DRAFT").toUpperCase())) return json({ok:false,message:"CCO yang sudah masuk proses Admin/QS tidak dapat diedit oleh lapangan."},409);
        }
        if (collection === "opname") {
          const st=String(old.data.status||"DRAFT").toUpperCase(); const rr=normalizeRole(auth.user);
          if(rr==="qs"&&!['DRAFT','RETURNED_TO_QS'].includes(st)) return json({ok:false,message:"Opname yang sudah dikirim ke Head of Engineering tidak dapat diedit QS kecuali dikembalikan."},409);
        }
        if (collection === "procurement") {
          const st=String(old.data.status||"DRAFT").toUpperCase();
          const assignedPm=await projectAssignment(env,data.projectId || old.data.projectId,"pm");
          if(!assignedPm) return json({ok:false,message:"Proyek belum memiliki Site Manager. Tetapkan Site Manager sebelum mengubah PR."},400);
          if (roleKey==="site_manager" && String(assignedPm)!==String(auth.user.id||"")) return json({ok:false,message:"Anda hanya dapat mengubah PR pada proyek yang Anda tangani."},403);
          if (roleKey==="site_manager" && !["DRAFT","REJECTED","SUBMITTED"].includes(st)) return json({ok:false,message:"PR yang sudah masuk approval Head tidak dapat diubah oleh Site Manager."},409);
          if (st==="SUBMITTED" && roleKey==="admin_teknik") return json({ok:false,message:"Admin Teknik baru menerima PR setelah vendor disetujui untuk pembuatan SPK/PO."},409);
          if (!["DRAFT","REJECTED","SUBMITTED"].includes(st) && !isManagementRole(auth.user)) return json({ok:false,message:"PR yang sudah dipilih vendornya tidak dapat diedit pada tahap ini."},409);
          data.preparedByUserId=old.data.preparedByUserId||auth.user.id; data.requesterUserId=assignedPm; data.projectManagerUserId=assignedPm;
        }
        // Critical workflow statuses cannot be edited manually; use the action endpoints above.
        if (["cco","payment_requests","procurement","daily_progress","weekly_progress","opname","issues","retention","closeout","ati_work_requests","ati_field_issues"].includes(collection)) data.status=old.data.status || data.status || (["issues","retention","closeout","ati_field_issues"].includes(collection)?"OPEN":"DRAFT");
        const rec = await upsertRecord(env,collection,id,{...old.data,...data},auth.user);
        await afterRecordUpsert(env,collection,rec,auth.user);
        return json({ok:true,row:rec});
      }
      if (request.method === "DELETE") {
        if (collectionDenied(auth.user,collection,"delete")) return json({ok:false,message:`Role ${auth.user.role || ""} tidak dapat menghapus ${collection}.`},403);
        const old = await getRecord(env,collection,id);
        if (old && !(await recordAllowedByProjectScope(env,auth.user,collection,id,old.data))) return json({ok:false,message:"Anda tidak ditugaskan pada proyek data ini."},403);
        if (PARTY_COLLECTIONS.has(collection)) { const used=await partyInUse(env,collection,id); if(used) return json({ok:false,message:used},409); }
        if(WORKFLOW_SOURCE_COLLECTIONS.has(collection)) await cancelWorkflowTasks(env,collection,id,auth.user);
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
          if (collection === "po" && payload.prId) {
            if (!roleIn(auth.user,["admin_teknik","administrator","direktur","head_unit_bisnis"])) return json({message:"PO/SPK dari PR hanya dapat dibuat oleh Admin Teknik."},403);
            const pr=await getRecord(env,"procurement",String(payload.prId));
            if(!pr) return json({message:"PR referensi tidak ditemukan."},400);
            if(String(pr.data.status||"").toUpperCase()!=="APPROVED") return json({message:"Vendor PR harus disetujui sebelum SPK/PO dibuat."},409);
            payload.projectId=pr.data.projectId; payload.vendor=pr.data.selectedVendorName||payload.vendor||""; payload.amount=num(pr.data.selectedOfferAmount)||num(payload.amount);
          }
          if (collection === "procurement") {
            payload=normalizePrArrays(payload);
            const assignedPm=await projectAssignment(env,payload.projectId,"pm");
            if(!assignedPm) return json({message:"Proyek belum memiliki Site Manager. Tetapkan Site Manager sebelum membuat PR."},400);
            const rr=normalizeRole(auth.user); if(!["site_manager","manager_operasional","head_unit_bisnis","administrator","direktur"].includes(rr)) return json({message:"Draft PR hanya dapat disiapkan oleh Site Manager."},403); payload.preparedByUserId=auth.user.id; payload.requesterUserId=assignedPm; payload.projectManagerUserId=assignedPm;
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
          if (PARTY_COLLECTIONS.has(collection)) { const used=await partyInUse(env,collection,m[1]); if(used) return json({message:used},409); }
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
    if (path.startsWith("/auth/v1/")) return json({message:"Authentication is handled by Nara System."},404);

    return serveAssets(request,env);
  }
};


/* ========================================================================== */
/* NARA SYSTEM V3.4.15 — PUBLIC INFORMATION WEBSITE                               */
/* ========================================================================== */
function clampPercent(v){ return Math.max(0,Math.min(100,num(v))); }
function normalizeAsBuiltProgress(data,oldStatus=""){
  const d={...data};
  d.architectureProgress=clampPercent(d.architectureProgress);
  d.structureProgress=clampPercent(d.structureProgress);
  d.mepProgress=clampPercent(d.mepProgress);
  d.overallProgress=Math.round((d.architectureProgress+d.structureProgress+d.mepProgress)/3);
  const old=String(oldStatus||d.status||"").toUpperCase();
  if(old==="APPROVED") d.status="APPROVED";
  else if(old==="READY FOR APPROVAL") d.status="READY FOR APPROVAL";
  else if(old==="REVISION REQUIRED") d.status="REVISION REQUIRED";
  else d.status=d.overallProgress<=0?"NOT STARTED":"IN PROGRESS";
  return d;
}
async function asBuiltActionHandler(request,env,user,id){
  const rec=await getRecord(env,"as_built_progress",id); if(!rec) return json({ok:false,message:"Progress As-Built tidak ditemukan."},404);
  const denied=await requireProjectAccess(env,user,rec.data.projectId); if(denied) return denied;
  const body=await parseJson(request)||{}; const action=String(body.action||"").toLowerCase(); const d={...rec.data}; const old=String(d.status||"NOT STARTED").toUpperCase();
  const role=normalizeRole(user); const assigned=await projectAssignment(env,d.projectId,"drafter"); const isAssigned=String(assigned||d.drafterUserId||"")===String(user.id||"");
  if(action==="submit"){
    if(!["drafter","koordinator_engineering","admin_teknik","manager_operasional","head_unit_bisnis","administrator","direktur"].includes(role)) return json({ok:false,message:"Hanya Drafter/Engineering/Manajemen yang dapat mengirim As-Built untuk approval."},403);
    if(role==="drafter"&&!isAssigned) return json({ok:false,message:"Anda bukan Drafter proyek ini."},403);
    if(!["NOT STARTED","IN PROGRESS","REVISION REQUIRED","DRAFT"].includes(old)) return json({ok:false,message:"Status As-Built tidak dapat disubmit pada tahap ini."},409);
    const n=normalizeAsBuiltProgress(d,"");
    if(n.architectureProgress<100||n.structureProgress<100||n.mepProgress<100) return json({ok:false,message:"Arsitektur, Struktur, dan MEP harus 100% sebelum dikirim ke Head of Engineering."},409);
    if(!d.architectureDocId||!d.structureDocId||!d.mepDocId) return json({ok:false,message:"File As-Built Arsitektur, Struktur, dan MEP wajib tersedia sebelum approval."},409);
    d.status="READY FOR APPROVAL"; d.submittedAt=new Date().toISOString(); d.submittedByUserId=user.id;
  } else if(action==="approve"){
    if(!roleIn(user,["administrator","direktur","head_unit_bisnis","koordinator_engineering"])) return json({ok:false,message:"Hanya Head of Engineering/Manajemen yang dapat approve As-Built."},403);
    if(old!=="READY FOR APPROVAL") return json({ok:false,message:"As-Built belum menunggu approval Engineering."},409);
    d.status="APPROVED"; d.approvedAt=new Date().toISOString(); d.approvedByUserId=user.id; d.approvedByName=user.name||user.username||"";
  } else if(action==="return"){
    if(!roleIn(user,["administrator","direktur","head_unit_bisnis","koordinator_engineering"])) return json({ok:false,message:"Hanya Head of Engineering/Manajemen yang dapat mengembalikan As-Built."},403);
    if(old!=="READY FOR APPROVAL") return json({ok:false,message:"As-Built belum menunggu approval Engineering."},409);
    d.status="REVISION REQUIRED"; d.returnReason=String(body.notes||"Perlu revisi As-Built"); d.returnedAt=new Date().toISOString(); d.returnedByUserId=user.id;
  } else return json({ok:false,message:"Action As-Built tidak dikenal."},400);
  const out=await upsertRecord(env,"as_built_progress",id,d,user); await syncWorkflowTask(env,"as_built_progress",id,d,user); await audit(env,user,"AS_BUILT_ACTION","as_built_progress",id,d.projectId||"",{action,from:old,to:d.status}); return json({ok:true,row:out});
}
