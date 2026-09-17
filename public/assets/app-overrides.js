/**
 * KENDALI App V2.8 — extension layer.
 * Modul ini menambah pusat Departemen Operasional tanpa mengubah bundle UI utama.
 */
const cfg = window.KENDALI_CONFIG || {};
document.documentElement.dataset.kendaliApp = cfg.appVersion || "APP";

window.KENDALI_APP = Object.freeze({
  config: cfg,
  health: () => fetch("/api/health", { credentials: "same-origin" }).then(r => r.json()),
  diagnostics: () => fetch("/api/diagnostics", { credentials: "same-origin" }).then(r => r.json())
});

window.dispatchEvent(new CustomEvent("kendali:app-ready", { detail: cfg }));

window.addEventListener("error", (event) => {
  try {
    let box = document.getElementById("kendali-runtime-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "kendali-runtime-error";
      box.style.cssText = "position:fixed;z-index:999999;left:16px;right:16px;bottom:16px;padding:14px 16px;background:#fff1f0;border:1px solid #f2b8b5;border-radius:10px;color:#8a1c16;font:13px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.14)";
      document.body.appendChild(box);
    }
    box.textContent = "KENDALI mendeteksi error tampilan: " + (event.message || "Unknown error");
  } catch {}
});

/* ------------------------------------------------------------------ */
/* Session guard                                                      */
/* ------------------------------------------------------------------ */
(async () => {
  const KEY = "kendali_session_v1";
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch {}
  try {
    const r = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (r.status === 401) {
      try { sessionStorage.removeItem(KEY); } catch {}
      window.location.replace("/login");
      return;
    }
    const me = await r.json().catch(() => ({}));
    if (r.ok && me.ok && cached && cached.username && me.username &&
        String(cached.username).toLowerCase() !== String(me.username).toLowerCase()) {
      try { sessionStorage.removeItem(KEY); } catch {}
      window.location.reload();
    }
  } catch {}
})();

/* ------------------------------------------------------------------ */
/* Departemen Operasional V2.8                                        */
/* ------------------------------------------------------------------ */
(() => {
  const state = {
    user: null,
    projects: [],
    records: [],
    tab: "progress",
    loaded: false,
    busy: false
  };

  const ROLES = {
    field: ["Pelaksana Lapangan"],
    super: ["Superintendent", "Project Manager", "Manager Konstruksi"],
    headOps: ["Head of Operational", "Head Operational"],
    headBU: ["Head Bisnis Unit", "Head Bisnis Unit Natara", "Manager Natara", "Manager Konstruksi"],
    adminTeknik: ["Admin Teknik"],
    qs: ["Quantity Surveyor", "Senior Estimator", "Estimator"],
    finance: ["Finance", "Finance Risk & Collection", "Admin Finance"],
    logistik: ["Admin Logistik", "Logistik"],
    admin: ["Admin", "Administrator", "Direktur"]
  };

  const hasRole = (roles) => {
    const r = String(state.user?.role || "").trim().toLowerCase();
    return roles.some(x => String(x).trim().toLowerCase() === r) || r === "admin" || r === "administrator" || r === "direktur";
  };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uid = (p="OP") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`.toUpperCase();
  const today = () => new Date().toISOString().slice(0,10);
  const monthYear = () => { const d = new Date(); return {m:String(d.getMonth()+1).padStart(2,"0"), y:d.getFullYear()}; };
  const money = (v) => Number(v||0).toLocaleString("id-ID", {style:"currency", currency:"IDR", maximumFractionDigits:0});
  const num = (v) => Number(v||0).toLocaleString("id-ID", {maximumFractionDigits:2});
  const dateId = (v) => v ? new Date(v).toLocaleDateString("id-ID", {day:"2-digit",month:"2-digit",year:"numeric"}) : "-";
  const role = () => String(state.user?.role || "");
  const projectName = (p) => p?.data?.nama || p?.data?.name || p?.data?.namaProyek || p?.id || "-";
  const projectData = (p) => p?.data || {};
  const projectOptions = () => state.projects.filter(p => {
    if (!hasRole(ROLES.field)) return true;
    const d = projectData(p), u = String(state.user?.username||"").toLowerCase();
    return [d.pengawasUsername,d.pelaksanaUsername,d.pelaksana,d.picLapangan].filter(Boolean).map(x=>String(x).toLowerCase()).includes(u);
  });

  async function apiList(collection) {
    const r = await fetch(`/rest/v1/${collection}`, {credentials:"same-origin", cache:"no-store"});
    if (!r.ok) throw new Error(`Gagal membaca ${collection} (${r.status})`);
    return await r.json();
  }
  async function apiUpsert(collection, id, data) {
    const r = await fetch(`/rest/v1/${collection}`, {
      method:"POST", credentials:"same-origin", headers:{"content-type":"application/json", "prefer":"resolution=merge-duplicates"},
      body:JSON.stringify({id, data, updated_at:new Date().toISOString()})
    });
    if (!r.ok) throw new Error(await r.text() || `Gagal menyimpan ${id}`);
    return true;
  }
  async function uploadFile(file, folder="operasional") {
    if (!file) return null;
    if (file.size > 25*1024*1024) throw new Error("Ukuran file maksimal 25 MB.");
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g,"-");
    const key = `${folder}/${new Date().toISOString().slice(0,10)}/${uid("FILE")}-${safe}`;
    const r = await fetch(`/storage/v1/object/kendali-files/${encodeURIComponent(key).replace(/%2F/g,"/")}`, {
      method:"PUT", credentials:"same-origin", headers:{"content-type":file.type||"application/octet-stream", "x-upsert":"true"}, body:file
    });
    if (!r.ok) throw new Error(await r.text() || "Upload file gagal");
    return {key, name:file.name, type:file.type||"application/octet-stream", size:file.size};
  }
  const fileUrl = (f, download=false) => f?.key ? `/storage/v1/object/kendali-files/${f.key}${download?`?download=${encodeURIComponent(f.name||"file")}`:""}` : "";

  async function load() {
    if (state.busy) return;
    state.busy = true;
    try {
      const [me, projects, records] = await Promise.all([
        fetch("/api/auth/me",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json()),
        apiList("projects"),
        apiList("operational_requests")
      ]);
      state.user = me.user || me;
      state.projects = projects || [];
      state.records = (records || []).map(x => ({id:x.id, ...(x.data||{}), updated_at:x.updated_at}));
      state.loaded = true;
    } finally { state.busy = false; }
  }

  function toast(msg, ok=true) {
    let t=document.getElementById("op-toast");
    if(!t){t=document.createElement("div");t.id="op-toast";document.body.appendChild(t);}
    t.textContent=msg; t.dataset.ok=ok?"1":"0"; t.classList.add("show");
    clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove("show"),2800);
  }

  function modal(title, body, onSave=null, saveLabel="Simpan") {
    const old=document.getElementById("op-modal"); if(old) old.remove();
    const el=document.createElement("div"); el.id="op-modal"; el.className="op-modal-backdrop";
    el.innerHTML=`<div class="op-modal"><div class="op-modal-head"><div><div class="op-modal-title">${esc(title)}</div></div><button class="op-x" data-close>×</button></div><div class="op-modal-body">${body}</div>${onSave?`<div class="op-modal-foot"><button class="op-btn ghost" data-close>Batal</button><button class="op-btn primary" data-save>${esc(saveLabel)}</button></div>`:""}</div>`;
    document.body.appendChild(el);
    el.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>el.remove());
    if(onSave) el.querySelector("[data-save]").onclick=async()=>{try{await onSave(el);el.remove();}catch(e){toast(e.message||"Gagal menyimpan",false);}};
    return el;
  }

  function selectProject(name="projectId", selected="") {
    return `<select name="${name}" required><option value="">Pilih proyek</option>${projectOptions().map(p=>`<option value="${esc(p.id)}" ${p.id===selected?"selected":""}>${esc(projectName(p))}</option>`).join("")}</select>`;
  }
  function field(label, input, cls="") { return `<label class="op-field ${cls}"><span>${esc(label)}</span>${input}</label>`; }
  function textarea(name, value="", placeholder="") { return `<textarea name="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`; }
  function input(name,type="text",value="",extra="") { return `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`; }

  function layout() {
    const root=document.getElementById("kendali-operasional-root");
    if(!root) return;
    root.innerHTML=`<div class="op-shell">
      <div class="op-top"><div><div class="op-title">Departemen Operasional</div><div class="op-sub">KENDALI · pusat kontrol pelaksanaan proyek</div></div><div class="op-top-actions"><span class="op-user">${esc(state.user?.name||state.user?.username||"")} · ${esc(role())}</span><button class="op-btn ghost" id="op-back">← Kembali</button><button class="op-btn" id="op-refresh">↻ Sinkron</button></div></div>
      <div class="op-tabs">${["progress","absensi","kendala","alat","material","cco","vendor","action","dana","stok"].map(t=>`<button data-tab="${t}" class="${state.tab===t?"active":""}">${({progress:"Laporan Progress",absensi:"Absensi Tukang",kendala:"Kendala",alat:"Kebutuhan Alat",material:"Kebutuhan Material",cco:"CCO / Addendum",vendor:"Pekerjaan Vendor",action:"Action Plan",dana:"Ajukan Dana",stok:"Material"}[t])}</button>`).join("")}</div>
      <div class="op-content" id="op-content">${renderTab()}</div>
    </div>`;
    root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;layout();});
    root.querySelector("#op-back").onclick=()=>{location.hash="#/";};
    root.querySelector("#op-refresh").onclick=async()=>{try{await load();layout();toast("Data tersinkronisasi");}catch(e){toast(e.message,false);}};
    bindTab();
  }

  function renderTab() {
    if(!state.loaded) return `<div class="op-loading">Memuat data operasional…</div>`;
    const views={progress:renderProgress,absensi:renderAbsensi,kendala:renderKendala,alat:renderAlat,material:renderMaterial,cco:renderCCO,vendor:renderVendor,action:renderAction,dana:renderDana,stok:renderStok};
    return views[state.tab]();
  }

  /* ------------------------- Progress ----------------------------- */
  function renderProgress() {
    const rs=state.records.filter(r=>r.type==="progress").sort((a,b)=>String(b.tanggal||b.startDate||"").localeCompare(String(a.tanggal||a.startDate||"")));
    const weekly=rs.filter(r=>r.subtype==="mingguan"), daily=rs.filter(r=>r.subtype==="harian"), monthly=rs.filter(r=>r.subtype==="bulanan"), pdfs=state.records.filter(r=>r.type==="progress_pdf");
    return `<div class="op-page-head"><div><h2>Laporan Progress</h2><p>Harian, mingguan, dan bulanan terhubung langsung dengan progres proyek.</p></div><div class="op-actions">${hasRole(ROLES.field)||hasRole(ROLES.super)?`<button class="op-btn primary" data-action="progress-daily">+ Harian</button>`:""}<button class="op-btn" data-action="progress-weekly">+ Mingguan / Upload PDF</button><button class="op-btn" data-action="progress-monthly">+ Bulanan</button><button class="op-btn" data-action="progress-print">Cetak / Simpan PDF</button><button class="op-btn" data-action="progress-upload-final">Upload PDF Final</button></div></div>
      <div class="op-cards"><div><b>${daily.length}</b><span>Harian</span></div><div><b>${weekly.length}</b><span>Mingguan</span></div><div><b>${monthly.length}</b><span>Bulanan</span></div><div><b>${num(Math.max(...weekly.map(x=>Number(x.realisasiKumulatif||0)),0))}%</b><span>Progress terakhir</span></div></div>
      <div class="op-table-card"><div class="op-card-title">Riwayat laporan</div><table class="op-table"><thead><tr><th>Jenis</th><th>Proyek</th><th>Periode/Tanggal</th><th>Rencana</th><th>Realisasi</th><th>Deviasi</th><th>Dokumen</th></tr></thead><tbody>${rs.slice(0,80).map(r=>`<tr><td><b>${esc(r.subtype||"-")}</b></td><td>${esc(r.projectName||findProjectName(r.projectId))}</td><td>${esc(r.subtype==="mingguan"?`${dateId(r.startDate)} – ${dateId(r.endDate)}`:dateId(r.tanggal||r.startDate))}</td><td>${r.bobotRencana!=null?num(r.bobotRencana)+"%":"-"}${r.bobotRencanaKumulatif!=null?` / ${num(r.bobotRencanaKumulatif)}%`:""}</td><td>${r.bobotRealisasi!=null?num(r.bobotRealisasi)+"%":"-"}${r.realisasiKumulatif!=null?` / ${num(r.realisasiKumulatif)}%`:""}</td><td>${r.deviasi!=null?`<span class="${Number(r.deviasi)<0?"bad":"good"}">${Number(r.deviasi)>=0?"+":""}${num(r.deviasi)}%</span>`:"-"}</td><td>${r.file?`<a class="op-link" href="${fileUrl(r.file,true)}">PDF</a>`:"-"}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">Belum ada laporan progress.</td></tr>`}</tbody></table></div><div class="op-table-card"><div class="op-card-title">PDF final tersimpan</div><table class="op-table"><thead><tr><th>Jenis</th><th>Proyek</th><th>Periode</th><th>File</th><th>Oleh</th></tr></thead><tbody>${pdfs.slice(0,40).map(r=>`<tr><td>${esc(r.subtype)}</td><td>${esc(r.projectName)}</td><td>${dateId(r.periode)}</td><td><a class="op-link" href="${fileUrl(r.file,true)}">${esc(r.file?.name||"PDF")}</a></td><td>${esc(r.oleh||"-")}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">Belum ada PDF final.</td></tr>`}</tbody></table></div>`;
  }

  function findProjectName(id){return projectName(state.projects.find(p=>p.id===id)||{});}
  function reportPdfHtml(records,title) {
    const rows=records.map(r=>`<tr><td>${esc(r.subtype||"")}</td><td>${esc(r.projectName||findProjectName(r.projectId))}</td><td>${esc(r.subtype==="mingguan"?`${dateId(r.startDate)} - ${dateId(r.endDate)}`:dateId(r.tanggal||r.startDate))}</td><td>${r.bobotRencanaKumulatif!=null?num(r.bobotRencanaKumulatif)+"%":"-"}</td><td>${r.realisasiKumulatif!=null?num(r.realisasiKumulatif)+"%":"-"}</td><td>${r.deviasi!=null?num(r.deviasi)+"%":"-"}</td></tr>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#162333}h1{font-size:22px}p{font-size:12px;color:#58697a}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccd5df;padding:8px;font-size:11px;text-align:left}th{background:#edf2f7}.foot{margin-top:24px;font-size:10px;color:#6b7785}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1><p>Dicetak dari KENDALI Natara · ${new Date().toLocaleString("id-ID")}</p><table><thead><tr><th>Jenis</th><th>Proyek</th><th>Periode</th><th>Rencana Kumulatif</th><th>Realisasi Kumulatif</th><th>Deviasi</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">Dokumen ini merupakan laporan kontrol proyek. Simpan sebagai PDF melalui dialog cetak.</div><script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`;
  }
  function printReports(records,title){const w=window.open("","_blank","width=1000,height=760");if(!w){toast("Popup diblokir browser",false);return;}w.document.write(reportPdfHtml(records,title));w.document.close();}

  /* ------------------------- Weekly/monthly forms ------------------ */
  function progressForm(subtype) {
    const weekly=subtype==="mingguan", monthly=subtype==="bulanan";
    const body=`<div class="op-grid two">${field("Proyek",selectProject())}${weekly?field("Minggu ke-",input("mingguKe","number","", "min=1 required")):field("Tanggal",input("tanggal","date",today(),"required"))}${field(weekly?"Mulai tanggal":"Periode mulai",input("startDate","date",today(),"required"))}${field(weekly?"Sampai tanggal":"Periode sampai",input("endDate","date",today(),"required"))}${field("Bobot rencana (%)",input("bobotRencana","number","0","step=0.01 min=0 max=100"))}${field("Bobot rencana kumulatif (%)",input("bobotRencanaKumulatif","number","0","step=0.01 min=0 max=100"))}${field("Bobot realisasi (%)",input("bobotRealisasi","number","0","step=0.01 min=0 max=100"))}${field("Bobot realisasi kumulatif (%)",input("realisasiKumulatif","number","0","step=0.01 min=0 max=100"))}${field("Deviasi (%)",input("deviasi","number","0","step=0.01"))}</div>${weekly?field("Upload PDF laporan progres",`<input name="file" type="file" accept="application/pdf" required>`):""}${field("Ringkasan",textarea("ringkasan","","Ringkasan progres periode ini"))}`;
    modal(`Input Laporan ${subtype}`,body,async el=>{
      const f=new FormData(el.querySelector("form")||el); // fallback replaced below
    });
    const m=document.getElementById("op-modal");
    m.querySelector(".op-modal-body").innerHTML=`<form id="progress-form">${body}</form>`;
    m.querySelector("[data-save]").onclick=async()=>{
      const form=m.querySelector("#progress-form"), fd=new FormData(form); const p=state.projects.find(x=>x.id===fd.get("projectId"));
      if(!p) throw new Error("Proyek wajib dipilih");
      let file=null; const inputFile=form.querySelector('[name="file"]'); if(inputFile?.files?.[0]) file=await uploadFile(inputFile.files[0],"laporan-progress");
      const rec={id:uid("PROG"),type:"progress",subtype,projectId:p.id,projectName:projectName(p),oleh:state.user?.username||state.user?.email||"",tanggal:fd.get("tanggal")||null,startDate:fd.get("startDate"),endDate:fd.get("endDate"),mingguKe:fd.get("mingguKe")||null,bobotRencana:Number(fd.get("bobotRencana")||0),bobotRencanaKumulatif:Number(fd.get("bobotRencanaKumulatif")||0),bobotRealisasi:Number(fd.get("bobotRealisasi")||0),realisasiKumulatif:Number(fd.get("realisasiKumulatif")||0),deviasi:Number(fd.get("deviasi")||0),ringkasan:fd.get("ringkasan")||"",file,status:"Tersimpan",createdAt:new Date().toISOString()};
      await apiUpsert("operational_requests",rec.id,rec);
      // Hubungkan progres laporan dengan field aktual proyek tanpa menghapus data proyek lain.
      const pd={...(p.data||{}),aktual:rec.realisasiKumulatif,progressTerakhir:{sumber:"Laporan Progress",tanggal:rec.endDate||rec.tanggal,actual:rec.realisasiKumulatif,deviasi:rec.deviasi,reportId:rec.id}};
      await apiUpsert("projects",p.id,pd);
      state.records.unshift(rec); Object.assign(p,{data:pd});
      m.remove(); toast(`Laporan ${subtype} tersimpan dan progres proyek diperbarui`); layout();
    };
  }

  function uploadFinalReportForm(){
    const body=`<form id="final-report-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Jenis laporan",`<select name="subtype"><option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option></select>`)}${field("Periode/tanggal",input("periode","date",today(),"required"))}</div>${field("PDF final",`<input name="file" type="file" accept="application/pdf" required>`)}${field("Keterangan",textarea("catatan","","Keterangan laporan untuk client"))}</form>`;
    modal("Simpan PDF Final ke KENDALI",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const f=m.querySelector("#final-report-form"),fd=new FormData(f),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const fi=f.querySelector('[name="file"]');if(!fi.files[0])throw new Error("PDF wajib dipilih");const file=await uploadFile(fi.files[0],"laporan-progress-final");const rec={id:uid("PDF"),type:"progress_pdf",subtype:fd.get("subtype"),projectId:p.id,projectName:projectName(p),periode:fd.get("periode"),file,catatan:fd.get("catatan"),oleh:state.user?.username||"",status:"Tersimpan",createdAt:new Date().toISOString()};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("PDF final tersimpan di KENDALI");layout();};
  }

  /* ------------------------- Daily -------------------------------- */
  function dailyForm(){
    const body=`<form id="daily-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Tanggal",input("tanggal","date",today(),"required"))}${field("Progress aktual proyek (%)",input("progress","number","0","step=0.01 min=0 max=100"))}${field("Cuaca",`<select name="cuaca"><option>Cerah</option><option>Berawan</option><option>Hujan</option><option>Hujan deras</option></select>`)}</div>${field("Pekerjaan hari ini",textarea("pekerjaan","","Pekerjaan yang dilaksanakan"))}${field("Tenaga kerja / tukang",textarea("tenaga","","Contoh: Tukang 4 · Buruh 3 · Kepala Tukang 1"))}${field("Kendala singkat",textarea("kendala","","Jika ada"))}${field("Catatan",textarea("catatan","","Catatan tambahan"))}</form>`;
    modal("Laporan Progress Harian",body,async()=>{});
    const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{
      const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");
      const rec={id:uid("HARI"),type:"progress",subtype:"harian",projectId:p.id,projectName:projectName(p),oleh:state.user?.username||"",tanggal:fd.get("tanggal"),progress:Number(fd.get("progress")||0),cuaca:fd.get("cuaca"),pekerjaan:fd.get("pekerjaan"),tenaga:fd.get("tenaga"),kendala:fd.get("kendala"),catatan:fd.get("catatan"),createdAt:new Date().toISOString()};
      await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Laporan harian tersimpan");layout();
    };
  }

  /* ------------------------- Absensi -------------------------------- */
  function renderAbsensi(){
    const rs=state.records.filter(r=>r.type==="absensi").sort((a,b)=>String(b.tanggal||"").localeCompare(String(a.tanggal||"")));
    const recaps=weeklyAbsenceRecaps(rs);
    return `<div class="op-page-head"><div><h2>Absensi Tukang</h2><p>Absensi harian direkap otomatis per minggu untuk kebutuhan gaji dan Finance.</p></div><div class="op-actions"><button class="op-btn primary" data-action="absensi-add">+ Catat Absensi</button></div></div><div class="op-table-card"><div class="op-card-title">Rekap mingguan</div><table class="op-table"><thead><tr><th>Minggu</th><th>Proyek</th><th>Tukang</th><th>Total Hari</th><th>Total Upah</th><th>Status Finance</th><th>Aksi</th></tr></thead><tbody>${recaps.map(r=>{const sent=state.records.find(x=>x.type==="finance_recap"&&x.source==="absensi"&&x.week===r.week&&x.projectId===r.projectId);return `<tr><td>${esc(r.week)}</td><td>${esc(r.projectName)}</td><td>${r.people}</td><td>${r.days}</td><td>${money(r.pay)}</td><td>${esc(sent?.status||"Belum dikirim")}</td><td>${hasRole(ROLES.finance)?(sent&&sent.status==="Menunggu Finance"?`<button class="op-mini primary" data-finance-action="pay" data-id="${esc(sent.id)}">Cairkan</button>`:`<button class="op-mini" data-finance-absence='${esc(JSON.stringify(r))}'>Kirim Finance</button>`):(sent?"Terkirim":`<button class="op-mini" data-finance-absence='${esc(JSON.stringify(r))}'>Kirim Finance</button>`)}</td></tr>`}).join("")||`<tr><td colspan="7" class="empty">Belum ada absensi.</td></tr>`}</tbody></table></div><div class="op-table-card"><div class="op-card-title">Absensi terbaru</div><table class="op-table"><thead><tr><th>Tanggal</th><th>Proyek</th><th>Data tukang</th><th>Total</th></tr></thead><tbody>${rs.slice(0,60).map(r=>`<tr><td>${dateId(r.tanggal)}</td><td>${esc(r.projectName)}</td><td>${esc((r.hadir||[]).map(x=>`${x.nama} (${x.faktor||1})`).join(", "))}</td><td>${money(r.totalUpah)}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">-</td></tr>`}</tbody></table></div>`;
  }
  function weekKey(d){const x=new Date(d);const jan=new Date(x.getFullYear(),0,1);return `${x.getFullYear()}-W${String(Math.ceil((((x-jan)/86400000)+jan.getDay()+1)/7)).padStart(2,"0")}`;}
  function weeklyAbsenceRecaps(rs){
    const map=new Map();rs.forEach(r=>{const key=`${weekKey(r.tanggal)}|${r.projectId}`;if(!map.has(key))map.set(key,{week:weekKey(r.tanggal),projectId:r.projectId,projectName:r.projectName,people:new Set(),days:0,pay:0,records:[]});const x=map.get(key);x.days++;(r.hadir||[]).forEach(h=>{if(h.nama&&Number(h.faktor||0)>0)x.people.add(h.nama);});x.pay+=Number(r.totalUpah||0);x.records.push(r);});return [...map.values()].map(x=>({...x,people:x.people.size}));
  }
  function absenceForm(){
    const body=`<form id="abs-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Tanggal",input("tanggal","date",today(),"required"))}</div><div id="worker-rows" class="op-repeat"></div><button type="button" class="op-btn" data-add-worker>+ Tambah Tukang</button>${field("Catat biaya upah ke pengajuan Finance",`<select name="sendFinance"><option value="ya">Ya</option><option value="tidak">Tidak</option></select>`)}</form>`;
    modal("Absensi Tukang Harian",body,async()=>{});const m=document.getElementById("op-modal");const rows=m.querySelector("#worker-rows");const add=()=>{const i=rows.children.length;const d=document.createElement("div");d.className="op-repeat-row";d.innerHTML=`${field("Nama",input("nama", "text","","required"))}${field("Faktor hadir",input("faktor","number","1","step=0.5 min=0"))}${field("Upah/hari",input("upah","number","0","min=0"))}${field("Lembur",input("lembur","number","0","min=0"))}<button type="button" class="op-mini danger">×</button>`;d.querySelector(".danger").onclick=()=>d.remove();rows.appendChild(d);};add();m.querySelector("[data-add-worker]").onclick=add;
    m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const names=[...rows.querySelectorAll('[name="nama"]')], factors=[...rows.querySelectorAll('[name="faktor"]')], wages=[...rows.querySelectorAll('[name="upah"]')], ots=[...rows.querySelectorAll('[name="lembur"]')];const hadir=names.map((n,i)=>({nama:n.value.trim(),faktor:Number(factors[i].value||0),upah:Number(wages[i].value||0),lembur:Number(ots[i].value||0)})).filter(x=>x.nama);const totalUpah=hadir.reduce((s,x)=>s+x.upah*x.faktor+x.lembur,0);const rec={id:uid("ABS"),type:"absensi",projectId:p.id,projectName:projectName(p),tanggal:fd.get("tanggal"),hadir,totalUpah,pemohon:state.user?.username||"",sendFinance:fd.get("sendFinance")==="ya",status:fd.get("sendFinance")==="ya"?"Menunggu Finance":"Tersimpan",createdAt:new Date().toISOString()};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Absensi tersimpan dan siap direkap Finance");layout();};
  }

  /* ------------------------- Kendala ------------------------------- */
  function renderKendala(){const rs=state.records.filter(r=>r.type==="kendala").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Kendala & Risiko</h2><p>Format kontrol: masalah → dampak → penyebab → pilihan → keputusan → PIC → deadline.</p></div><button class="op-btn primary" data-action="kendala-add">+ Catat Kendala</button></div><div class="op-table-card"><table class="op-table"><thead><tr><th>Level</th><th>Proyek</th><th>Masalah</th><th>Dampak</th><th>PIC</th><th>Deadline</th><th>Status</th></tr></thead><tbody>${rs.map(r=>`<tr><td><span class="badge ${r.level==='Kritis'?'bad':r.level==='Tinggi'?'warn':'good'}">${esc(r.level)}</span></td><td>${esc(r.projectName)}</td><td>${esc(r.masalah)}</td><td>${esc(r.dampak)}</td><td>${esc(r.pic)}</td><td>${dateId(r.deadline)}</td><td>${esc(r.status)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">Belum ada kendala.</td></tr>`}</tbody></table></div>`;}
  function kendalaForm(){const body=`<form id="kendala-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Level",`<select name="level"><option>Normal</option><option>Tinggi</option><option>Kritis</option></select>`)}${field("PIC",input("pic", "text",state.user?.name||"","required"))}${field("Deadline",input("deadline","date",today(),"required"))}${field("Status",`<select name="status"><option>Open</option><option>Monitoring</option><option>Resolved</option><option>Closed</option></select>`)}</div>${field("Masalah",textarea("masalah","","Apa yang terjadi?"))}${field("Dampak",textarea("dampak","","Dampak terhadap waktu, biaya, mutu, keselamatan"))}${field("Penyebab",textarea("penyebab","","Akar penyebab"))}${field("Pilihan / alternatif",textarea("pilihan","","Alternatif penyelesaian"))}${field("Keputusan",textarea("keputusan","","Keputusan yang diambil"))}${field("Tindakan",textarea("tindakan","","Langkah penyelesaian"))}</form>`;modal("Catat Kendala",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const rec={id:uid("KDL"),type:"kendala",projectId:p.id,projectName:projectName(p),level:fd.get("level"),pic:fd.get("pic"),deadline:fd.get("deadline"),status:fd.get("status"),masalah:fd.get("masalah"),dampak:fd.get("dampak"),penyebab:fd.get("penyebab"),pilihan:fd.get("pilihan"),keputusan:fd.get("keputusan"),tindakan:fd.get("tindakan"),oleh:state.user?.username||"",createdAt:new Date().toISOString()};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Kendala tersimpan");layout();};}

  /* ------------------------- Alat / Material ----------------------- */
  function renderAlat(){const rs=state.records.filter(r=>r.type==="alat").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Ajukan Kebutuhan Alat</h2><p>Pengajuan dari lapangan masuk ke jalur Superintendent → Admin Logistik → Head Operational.</p></div><button class="op-btn primary" data-action="alat-add">+ Ajukan Alat</button></div>${requestTable(rs,["jenisAlat","jumlah","satuan","durasi","status"])}`;}
  function renderMaterial(){const rs=state.records.filter(r=>r.type==="material_request").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Ajukan Kebutuhan Material</h2><p>Bisa menambahkan banyak item dalam satu pengajuan.</p></div><button class="op-btn primary" data-action="material-add">+ Ajukan Material</button></div>${requestTable(rs,["itemSummary","urgensi","status"])}`;}
  function requestTable(rs,cols){return `<div class="op-table-card"><table class="op-table"><thead><tr><th>Proyek</th>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}<th>Pengaju</th></tr></thead><tbody>${rs.map(r=>`<tr><td>${esc(r.projectName)}</td>${cols.map(c=>`<td>${esc(c==="itemSummary"?(r.items||[]).map(x=>`${x.material} ${x.jumlah}${x.satuan}`).join(", "):r[c]||"-")}</td>`).join("")}<td>${esc(r.pemohon||r.oleh||"-")}</td></tr>`).join("")||`<tr><td colspan="${cols.length+2}" class="empty">Belum ada pengajuan.</td></tr>`}</tbody></table></div>`;}
  function alatForm(){const body=`<form id="alat-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Jenis alat",input("jenisAlat","text","","required"))}${field("Jumlah",input("jumlah","number","1","min=1 required"))}${field("Satuan",input("satuan","text","unit","required"))}${field("Durasi",input("durasi","text","","placeholder=Contoh: 3 hari"))}</div>${field("Keterangan",textarea("keterangan","","Spesifikasi/kebutuhan"))}</form>`;modal("Ajukan Kebutuhan Alat",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const rec={id:uid("PA"),type:"alat",projectId:p.id,projectName:projectName(p),jenisAlat:fd.get("jenisAlat"),jumlah:Number(fd.get("jumlah")||0),satuan:fd.get("satuan"),durasi:fd.get("durasi"),keterangan:fd.get("keterangan"),pemohon:state.user?.username||"",status:"Menunggu Verifikasi Superintendent",createdAt:new Date().toISOString(),history:[{status:"Diajukan",oleh:state.user?.username||"",tanggal:new Date().toISOString()}]};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Kebutuhan alat diteruskan ke jalur operasional");layout();};}
  function materialForm(){const body=`<form id="mat-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Urgensi",`<select name="urgensi"><option>Normal</option><option>Penting</option><option>Mendesak</option></select>`)}</div><div id="mat-rows" class="op-repeat"></div><button type="button" class="op-btn" data-add-item>+ Tambah Item Material</button>${field("Catatan",textarea("catatan","","Keterangan tambahan"))}</form>`;modal("Ajukan Kebutuhan Material",body,async()=>{});const m=document.getElementById("op-modal"),rows=m.querySelector("#mat-rows");const add=()=>{const d=document.createElement("div");d.className="op-repeat-row material-row";d.innerHTML=`${field("Material",input("material","text","","required"))}${field("Jumlah",input("jumlah","number","1","min=0"))}${field("Satuan",input("satuan","text","unit"))}<button type="button" class="op-mini danger">×</button>`;d.querySelector(".danger").onclick=()=>d.remove();rows.appendChild(d);};add();m.querySelector("[data-add-item]").onclick=add;m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const ms=[...rows.querySelectorAll('[name="material"]')], js=[...rows.querySelectorAll('[name="jumlah"]')], ss=[...rows.querySelectorAll('[name="satuan"]')];const items=ms.map((x,i)=>({material:x.value,jumlah:Number(js[i].value||0),satuan:ss[i].value||"unit"})).filter(x=>x.material);const rec={id:uid("PM"),type:"material_request",projectId:p.id,projectName:projectName(p),items,urgensi:fd.get("urgensi"),catatan:fd.get("catatan"),pemohon:state.user?.username||"",status:"Menunggu Verifikasi Superintendent",createdAt:new Date().toISOString(),history:[{status:"Diajukan",oleh:state.user?.username||"",tanggal:new Date().toISOString()}]};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast(`${items.length} item material diajukan`);layout();};}

  /* ------------------------- CCO ----------------------------------- */
  function renderCCO(){const rs=state.records.filter(r=>r.type==="cco").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>CCO / Addendum</h2><p>Alur: Lapangan → Superintendent/PM → Admin Teknik → Client → QS → Client → Lapangan.</p></div>${hasRole(ROLES.field)||hasRole(ROLES.super)?`<button class="op-btn primary" data-action="cco-add">+ Ajukan CCO</button>`:""}</div><div class="op-table-card"><table class="op-table"><thead><tr><th>No</th><th>Proyek</th><th>Item</th><th>Status</th><th>Nilai RAB Addendum</th><th>Aksi</th></tr></thead><tbody>${rs.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.projectName)}</td><td>${esc((r.items||[]).length)} item</td><td><span class="badge ${r.status.includes("Ditolak")||r.status.includes("Tidak")?"bad":r.status.includes("Menunggu")?"warn":"good"}">${esc(r.status)}</span></td><td>${r.rabAddendum!=null?money(r.rabAddendum):"-"}</td><td>${ccoActions(r)}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">Belum ada CCO.</td></tr>`}</tbody></table></div>`;}
  function ccoActions(r){const btn=(action,label,cls="")=>`<button class="op-mini ${cls}" data-cco-action="${action}" data-id="${esc(r.id)}">${esc(label)}</button>`;let a="";if(["Superintendent","Project Manager","Manager Konstruksi"].some(x=>x.toLowerCase()===role().toLowerCase())||hasRole(ROLES.admin)){if(r.status==="Menunggu Persetujuan Superintendent/PM")a+=btn("approve-super","ACC Lapangan","primary");}if(hasRole(ROLES.adminTeknik)){if(r.status==="Menunggu Admin Teknik")a+=btn("send-client","Kirim Client");if(r.status==="Menunggu Persetujuan Client")a+=btn("client-approve","Client ACC");if(r.status==="Menunggu Persetujuan Client")a+=btn("client-reject-price","Tolak · Hitung Ulang");if(r.status==="Menunggu Persetujuan Client")a+=btn("client-reject-no","Tidak lanjut CCO");if(r.status==="Menunggu Persetujuan Client RAB")a+=btn("client-rab-approve","ACC RAB");}if(hasRole(ROLES.qs)){if(r.status==="Menunggu QS RAB")a+=btn("qs-rab","Buat/Kirim RAB");if(r.status==="Kembali ke QS untuk Hitung Ulang")a+=btn("qs-rab","Hitung Ulang");}if(r.status==="Menunggu Diteruskan ke Lapangan"&&(hasRole(ROLES.adminTeknik)||hasRole(ROLES.admin)))a+=btn("send-field","Kirim Lapangan");if(r.status==="Diteruskan ke Lapangan"&&(hasRole(ROLES.field)||hasRole(ROLES.super)))a+=btn("done","Tandai Dikerjakan");return a||"-";}
  function ccoForm(){const body=`<form id="cco-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Judul CCO",input("judul","text","","required"))}</div>${field("Alasan / latar belakang",textarea("alasan","","Kenapa item perlu tambah/kurang"))}<div class="op-section-label">Item perubahan</div><div id="cco-rows" class="op-repeat"></div><button type="button" class="op-btn" data-add-cco>+ Tambah Item</button>${field("Lampiran foto / dokumen",`<input type="file" name="file" accept="image/*,.pdf,.dwg,.xlsx,.docx">`)}${field("Catatan",textarea("catatan","","Informasi penting untuk Admin Teknik"))}</form>`;modal("Ajukan CCO / Pekerjaan Tambah-Kurang",body,async()=>{});const m=document.getElementById("op-modal"),rows=m.querySelector("#cco-rows");const add=()=>{const d=document.createElement("div");d.className="op-repeat-row cco-row";d.innerHTML=`${field("Jenis",`<select name="jenis"><option>Tambah</option><option>Kurang</option></select>`)}${field("Item",input("item","text","","required"))}${field("Volume",input("volume","number","0","step=0.01 min=0"))}${field("Satuan",input("satuan","text","unit"))}${field("Spesifikasi",input("spesifikasi","text",""))}<button type="button" class="op-mini danger">×</button>`;d.querySelector(".danger").onclick=()=>d.remove();rows.appendChild(d);};add();m.querySelector("[data-add-cco]").onclick=add;m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const its=[...rows.querySelectorAll(".cco-row")].map(row=>({jenis:row.querySelector('[name="jenis"]').value,item:row.querySelector('[name="item"]').value,volume:Number(row.querySelector('[name="volume"]').value||0),satuan:row.querySelector('[name="satuan"]').value,spesifikasi:row.querySelector('[name="spesifikasi"]').value}));if(!its.length)throw new Error("Minimal satu item CCO");let file=null;const fi=m.querySelector('[name="file"]');if(fi?.files?.[0])file=await uploadFile(fi.files[0],"cco");const rec={id:uid("CCO"),type:"cco",projectId:p.id,projectName:projectName(p),judul:fd.get("judul"),alasan:fd.get("alasan"),items:its,file,catatan:fd.get("catatan"),status:"Menunggu Persetujuan Superintendent/PM",oleh:state.user?.username||"",createdAt:new Date().toISOString(),history:[{status:"Diajukan",oleh:state.user?.username||"",tanggal:new Date().toISOString()}]};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("CCO dikirim ke Superintendent / Project Manager");layout();};}
  async function ccoTransition(id,action){const r=state.records.find(x=>x.id===id);if(!r)return;let next=r.status,extra={};if(action==="approve-super")next="Menunggu Admin Teknik";if(action==="send-client")next="Menunggu Persetujuan Client";if(action==="client-approve")next="Menunggu QS RAB";if(action==="client-reject-price")next="Kembali ke QS untuk Hitung Ulang";if(action==="client-reject-no")next="Tidak Dilanjutkan CCO";if(action==="client-rab-approve")next="Menunggu Diteruskan ke Lapangan";if(action==="send-field")next="Diteruskan ke Lapangan";if(action==="done")next="Dikerjakan / CCO Selesai";if(action==="qs-rab"){const v=prompt("Masukkan nilai RAB Addendum:",String(r.rabAddendum||0));if(v===null)return;const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error("Nilai RAB tidak valid");extra.rabAddendum=n;next="Menunggu Persetujuan Client RAB";}r.status=next;Object.assign(r,extra);r.history=[...(r.history||[]),{status:next,oleh:state.user?.username||"",tanggal:new Date().toISOString(),catatan:action}];await apiUpsert("operational_requests",r.id,r);toast(`CCO → ${next}`);layout();}

  /* ------------------------- Vendor -------------------------------- */
  function renderVendor(){const rs=state.records.filter(r=>r.type==="vendor_request").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Pekerjaan Vendor</h2><p>Pengajuan → Head Operational → Head BU/Manager Natara → Admin Teknik → PM upload surat → arsip proyek.</p></div>${hasRole(ROLES.field)||hasRole(ROLES.super)?`<button class="op-btn primary" data-action="vendor-add">+ Ajukan Pekerjaan Vendor</button>`:""}</div><div class="op-table-card"><table class="op-table"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Proyek</th><th>Durasi</th><th>Total HPP</th><th>Vendor</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rs.map(r=>`<tr><td>${esc(r.nomor)}</td><td>${dateId(r.tanggal)}</td><td>${esc(r.projectName)}</td><td>${esc(r.durasi)}</td><td>${money(r.totalHpp)}</td><td>${esc((r.vendors||[]).map(v=>v.nama).join(", "))}</td><td>${esc(r.status)}</td><td>${vendorActions(r)}</td></tr>`).join("")||`<tr><td colspan="8" class="empty">Belum ada pengajuan vendor.</td></tr>`}</tbody></table></div>`;}
  function vendorActions(r){const b=(a,l,c="")=>`<button class="op-mini ${c}" data-vendor-action="${a}" data-id="${esc(r.id)}">${esc(l)}</button>`;let s="";if(hasRole(ROLES.headOps)&&r.status==="Menunggu Head Operational")s+=b("headops","ACC Head Ops","primary");if(hasRole(ROLES.headBU)&&r.status==="Menunggu Head BU / Manager Natara")s+=b("headbu","APPROVE HBU","primary");if(hasRole(ROLES.adminTeknik)&&r.status==="Menunggu Admin Teknik")s+=b("admintek","Buat Surat");if(hasRole(ROLES.super)&&r.status==="Menunggu PM Upload Surat")s+=b("upload-surah","Upload Surat");return s||"-";}
  function vendorForm(){const body=`<form id="vendor-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Tanggal",input("tanggal","date",today(),"required"))}${field("Durasi pekerjaan",input("durasi","text","","required"))}${field("Lokasi",input("lokasi","text","","required"))}</div><div class="op-section-label">Daftar pekerjaan / HPP</div><div id="vendor-items" class="op-repeat"></div><button type="button" class="op-btn" data-add-vitem>+ Tambah Pekerjaan</button><div class="op-section-label">Pilihan vendor</div><div id="vendor-options" class="op-repeat"></div><button type="button" class="op-btn" data-add-vendor>+ Tambah Vendor</button>${field("Catatan",textarea("catatan","","Spesifikasi/ketentuan tambahan"))}</form>`;modal("Pengajuan Pekerjaan Vendor",body,async()=>{});const m=document.getElementById("op-modal"),items=m.querySelector("#vendor-items"),vendors=m.querySelector("#vendor-options");const addItem=()=>{const d=document.createElement("div");d.className="op-repeat-row vendor-item";d.innerHTML=`${field("Pekerjaan / spesifikasi",input("pekerjaan","text","","required"))}${field("Material/Jasa",input("spesifikasi","text",""))}${field("Volume",input("volume","number","0","step=0.01"))}${field("Satuan",input("satuan","text","unit"))}${field("HPP/unit",input("hpp","number","0","min=0"))}<button type="button" class="op-mini danger">×</button>`;d.querySelector(".danger").onclick=()=>d.remove();items.appendChild(d);};const addVendor=()=>{const d=document.createElement("div");d.className="op-repeat-row vendor-option";d.innerHTML=`${field("Nama vendor",input("vendorNama","text","","required"))}${field("Harga vendor",input("vendorHarga","number","0","min=0"))}${field("Rincian harga",textarea("vendorDetail","","Detail penawaran vendor"))}<button type="button" class="op-mini danger">×</button>`;d.querySelector(".danger").onclick=()=>d.remove();vendors.appendChild(d);};addItem();addVendor();m.querySelector("[data-add-vitem]").onclick=addItem;m.querySelector("[data-add-vendor]").onclick=addVendor;m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const its=[...items.querySelectorAll(".vendor-item")].map(x=>({pekerjaan:x.querySelector('[name="pekerjaan"]').value,spesifikasi:x.querySelector('[name="spesifikasi"]').value,volume:Number(x.querySelector('[name="volume"]').value||0),satuan:x.querySelector('[name="satuan"]').value,hppUnit:Number(x.querySelector('[name="hpp"]').value||0)}));its.forEach(x=>x.totalHpp=x.volume*x.hppUnit);const vs=[...vendors.querySelectorAll(".vendor-option")].map(x=>({nama:x.querySelector('[name="vendorNama"]').value,harga:Number(x.querySelector('[name="vendorHarga"]').value||0),detail:x.querySelector('[name="vendorDetail"]').value}));const {m:mo,y}=monthYear();const count=state.records.filter(x=>x.type==="vendor_request"&&String(x.tanggal||"").startsWith(`${y}-${mo}`)).length+1;const nomor=`${String(count).padStart(3,"0")}/FR-pR/${mo}/${y}`;const rec={id:uid("VDR"),type:"vendor_request",nomor,tanggal:fd.get("tanggal"),projectId:p.id,projectName:projectName(p),durasi:fd.get("durasi"),lokasi:fd.get("lokasi"),items:its,totalHpp:its.reduce((s,x)=>s+x.totalHpp,0),vendors:vs,catatan:fd.get("catatan"),pemohon:state.user?.username||"",status:"Menunggu Head Operational",createdAt:new Date().toISOString(),history:[{status:"Diajukan",oleh:state.user?.username||"",tanggal:new Date().toISOString()}]};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast(`Pengajuan ${nomor} dikirim ke Head Operational`);layout();};}
  async function vendorTransition(id,action){
    const r=state.records.find(x=>x.id===id);if(!r)return;let next=r.status;
    if(action==="headops")next="Menunggu Head BU / Manager Natara";
    if(action==="headbu"){const names=(r.vendors||[]).map(v=>v.nama);const chosen=prompt(`Pilih vendor yang disetujui:\n${names.map((n,i)=>`${i+1}. ${n}`).join("\n")}`,"1");if(chosen===null)return;const idx=Number(chosen)-1;if(!r.vendors[idx])throw new Error("Pilihan vendor tidak valid");r.vendorTerpilih=r.vendors[idx];next="Menunggu Admin Teknik";}
    if(action==="admintek"){r.surat={status:"Menunggu dibuat oleh Admin Teknik",dibuatAt:new Date().toISOString()};next="Menunggu PM Upload Surat";}
    if(action==="upload-surat"){
      const body=`<form id="vendor-upload-form">${field("File surat",`<input type="file" name="file" accept=".pdf,.doc,.docx" required>`)}${field("Catatan",textarea("catatan","","Nomor surat / keterangan"))}</form>`;
      modal("Upload Surat Pekerjaan Vendor",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const f=m.querySelector("#vendor-upload-form"),fi=f.querySelector('[name="file"]');if(!fi.files[0])throw new Error("File surat wajib dipilih");const file=await uploadFile(fi.files[0],"surat-vendor");r.surat={...r.surat,file,catatan:f.querySelector('[name="catatan"]').value,uploadedAt:new Date().toISOString()};r.status="Selesai · Surat terarsip";r.history=[...(r.history||[]),{status:r.status,oleh:state.user?.username||"",tanggal:new Date().toISOString()}];await apiUpsert("operational_requests",r.id,r);m.remove();toast("Surat vendor tersimpan dan terarsip berdasarkan proyek");layout();};return;
    }
    r.status=next;r.history=[...(r.history||[]),{status:next,oleh:state.user?.username||"",tanggal:new Date().toISOString()}];await apiUpsert("operational_requests",r.id,r);toast(`Vendor → ${next}`);layout();
  }

  /* ------------------------- Action Plan --------------------------- */
  function renderAction(){const rs=state.records.filter(r=>r.type==="action_plan").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Action Plan</h2><p>Target, PIC, deadline, status, dan tindak lanjut tetap terkontrol.</p></div><button class="op-btn primary" data-action="action-add">+ Action Plan</button></div>${requestTable(rs,["target","pic","deadline","status"])}`;}
  function actionForm(){const body=`<form id="action-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Target",input("target","text","","required"))}${field("PIC",input("pic","text",state.user?.name||""))}${field("Deadline",input("deadline","date",today()))}${field("Status",`<select name="status"><option>Belum</option><option>Berjalan</option><option>Selesai</option><option>Terlambat</option></select>`)}</div>${field("Catatan",textarea("catatan","","Rincian tindakan"))}</form>`;modal("Action Plan",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const rec={id:uid("ACT"),type:"action_plan",projectId:p.id,projectName:projectName(p),target:fd.get("target"),pic:fd.get("pic"),deadline:fd.get("deadline"),status:fd.get("status"),catatan:fd.get("catatan"),oleh:state.user?.username||"",createdAt:new Date().toISOString()};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Action plan tersimpan");layout();};}

  /* ------------------------- Dana ---------------------------------- */
  function renderDana(){const rs=state.records.filter(r=>r.type==="dana").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Ajukan Dana</h2><p>Pengajuan dana operasional proyek untuk diteruskan ke Finance.</p></div><button class="op-btn primary" data-action="dana-add">+ Ajukan Dana</button></div><div class="op-table-card"><table class="op-table"><thead><tr><th>Proyek</th><th>Kategori</th><th>Nominal</th><th>Urgensi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rs.map(r=>`<tr><td>${esc(r.projectName)}</td><td>${esc(r.kategori)}</td><td>${money(r.nominal)}</td><td>${esc(r.urgensi)}</td><td>${esc(r.status)}</td><td>${hasRole(ROLES.finance)&&r.status==="Menunggu Finance"?`<button class="op-mini primary" data-finance-action="pay" data-id="${esc(r.id)}">Cairkan</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">Belum ada pengajuan dana.</td></tr>`}</tbody></table></div>`;}
  function danaForm(){const body=`<form id="dana-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Kategori",`<select name="kategori"><option>Material</option><option>Tukang</option><option>Vendor</option><option>Operasional</option><option>Transportasi</option><option>Tools</option><option>Reimburse</option><option>Lain-lain</option></select>`)}${field("Nominal",input("nominal","number","0","min=0 required"))}${field("Urgensi",`<select name="urgensi"><option>Normal</option><option>Penting</option><option>Mendesak</option></select>`)}</div>${field("Keterangan",textarea("keterangan","","Keperluan dana"))}</form>`;modal("Ajukan Dana",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const rec={id:uid("DANA"),type:"dana",projectId:p.id,projectName:projectName(p),kategori:fd.get("kategori"),nominal:Number(fd.get("nominal")||0),urgensi:fd.get("urgensi"),keterangan:fd.get("keterangan"),pemohon:state.user?.username||"",status:"Menunggu Finance",createdAt:new Date().toISOString()};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Pengajuan dana dikirim ke Finance");layout();};}

  /* ------------------------- Material stock ------------------------- */
  function renderStok(){const rs=state.records.filter(r=>r.type==="material_stock").sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));return `<div class="op-page-head"><div><h2>Material</h2><p>Pencatatan material proyek tetap tersedia di pusat operasional.</p></div><button class="op-btn primary" data-action="stok-add">+ Catat Material</button></div>${requestTable(rs,["material","jumlah","satuan","pergerakan","status"])}`;}
  function stokForm(){const body=`<form id="stok-form"><div class="op-grid two">${field("Proyek",selectProject())}${field("Material",input("material","text","","required"))}${field("Jumlah",input("jumlah","number","0","min=0"))}${field("Satuan",input("satuan","text","unit"))}${field("Pergerakan",`<select name="pergerakan"><option>Masuk</option><option>Keluar</option></select>`)}</div>${field("Catatan",textarea("catatan","","Sumber / tujuan material"))}</form>`;modal("Material",body,async()=>{});const m=document.getElementById("op-modal");m.querySelector("[data-save]").onclick=async()=>{const fd=new FormData(m.querySelector("form")),p=state.projects.find(x=>x.id===fd.get("projectId"));if(!p)throw new Error("Proyek wajib dipilih");const rec={id:uid("MAT"),type:"material_stock",projectId:p.id,projectName:projectName(p),material:fd.get("material"),jumlah:Number(fd.get("jumlah")||0),satuan:fd.get("satuan"),pergerakan:fd.get("pergerakan"),catatan:fd.get("catatan"),oleh:state.user?.username||"",status:"Tersimpan",createdAt:new Date().toISOString()};await apiUpsert("operational_requests",rec.id,rec);state.records.unshift(rec);m.remove();toast("Material tersimpan");layout();};}

  function bindTab(){
    const root=document.getElementById("op-content"); if(!root)return;
    root.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
      const a=b.dataset.action;
      if(a==="progress-daily")dailyForm();
      else if(a==="progress-weekly")progressForm("mingguan");
      else if(a==="progress-monthly")progressForm("bulanan");
      else if(a==="absensi-add")absenceForm();
      else if(a==="kendala-add")kendalaForm();
      else if(a==="alat-add")alatForm();
      else if(a==="material-add")materialForm();
      else if(a==="cco-add")ccoForm();
      else if(a==="vendor-add")vendorForm();
      else if(a==="action-add")actionForm();
      else if(a==="dana-add")danaForm();
      else if(a==="stok-add")stokForm();
    });
    root.querySelectorAll("[data-cco-action]").forEach(b=>b.onclick=()=>ccoTransition(b.dataset.id,b.dataset.ccoAction).catch(e=>toast(e.message,false)));
    root.querySelectorAll("[data-vendor-action]").forEach(b=>b.onclick=()=>vendorTransition(b.dataset.id,b.dataset.vendorAction).catch(e=>toast(e.message,false)));
    root.querySelectorAll("[data-finance-absence]").forEach(b=>b.onclick=async()=>{const x=JSON.parse(b.dataset.financeAbsence);const rec={id:uid("FIN"),type:"finance_recap",source:"absensi",week:x.week,projectId:x.projectId,projectName:x.projectName,people:x.people,days:x.days,nominal:x.pay,status:"Menunggu Finance",createdAt:new Date().toISOString(),oleh:state.user?.username||""};await apiUpsert("operational_requests",rec.id,rec);toast("Rekap absensi dikirim ke Finance");});
    root.querySelectorAll("[data-finance-action=\"pay\"]").forEach(b=>b.onclick=async()=>{const r=state.records.find(x=>x.id===b.dataset.id);if(!r)return;r.status="Dicairkan";r.paidAt=new Date().toISOString();r.paidBy=state.user?.username||"";await apiUpsert("operational_requests",r.id,r);toast("Pencairan Finance dicatat");layout();});
  }

  function ensureCss(){
    if(document.getElementById("kendali-op-css"))return;
    const s=document.createElement("style");s.id="kendali-op-css";s.textContent=`
#kendali-operasional-root{position:fixed;inset:0;z-index:9000;background:#f3f6f9;overflow:auto;color:#162333;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.op-shell{min-height:100vh}.op-top{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;gap:20px;align-items:center;padding:18px 26px;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-bottom:1px solid #dce3eb}.op-title{font-size:21px;font-weight:800}.op-sub{font-size:12px;color:#708093;margin-top:3px}.op-top-actions{display:flex;gap:8px;align-items:center}.op-user{font-size:12px;color:#5e6d7d;margin-right:6px}.op-tabs{display:flex;gap:6px;padding:12px 26px;overflow:auto;background:#fff;border-bottom:1px solid #e0e6ed}.op-tabs button{border:0;background:#f2f5f8;border-radius:8px;padding:9px 13px;color:#526274;white-space:nowrap;cursor:pointer}.op-tabs button.active{background:#163957;color:#fff}.op-content{padding:24px 26px 50px;max-width:1500px;margin:auto}.op-page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}.op-page-head h2{margin:0 0 5px;font-size:20px}.op-page-head p{margin:0;color:#718092;font-size:13px}.op-actions{display:flex;gap:8px;flex-wrap:wrap}.op-btn{border:1px solid #cbd5df;background:#fff;color:#1d3145;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer}.op-btn.primary{background:#163957;color:#fff;border-color:#163957}.op-btn.ghost{background:#f8fafc}.op-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.op-cards>div{background:#fff;border:1px solid #dde4eb;border-radius:12px;padding:16px;box-shadow:0 3px 12px rgba(20,45,70,.04)}.op-cards b{display:block;font-size:24px}.op-cards span{font-size:12px;color:#728093}.op-table-card{background:#fff;border:1px solid #dde4eb;border-radius:12px;overflow:auto;margin-bottom:16px;box-shadow:0 3px 12px rgba(20,45,70,.04)}.op-card-title{padding:15px 16px;border-bottom:1px solid #e4e9ef;font-weight:700}.op-table{width:100%;border-collapse:collapse;min-width:850px}.op-table th,.op-table td{padding:11px 12px;border-bottom:1px solid #edf1f5;text-align:left;font-size:12px;vertical-align:top}.op-table th{font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#6b7888;background:#f8fafc}.op-table tr:last-child td{border-bottom:0}.empty{text-align:center!important;color:#8492a2;padding:30px!important}.good{color:#16804a}.bad{color:#c43131}.warn{color:#a66a00}.badge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef2f6;font-size:11px}.badge.good{background:#e8f6ee}.badge.bad{background:#fdeaea}.badge.warn{background:#fff5dc}.op-mini{border:1px solid #cdd7e1;background:#fff;border-radius:6px;padding:6px 8px;font-size:11px;cursor:pointer}.op-mini.primary{background:#163957;color:#fff;border-color:#163957}.op-mini.danger{color:#b32929}.op-link{color:#185a92;text-decoration:none;font-weight:700}.op-loading{text-align:center;padding:80px;color:#6f7e8e}.op-modal-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(9,25,40,.45);display:flex;align-items:center;justify-content:center;padding:20px}.op-modal{background:#fff;border-radius:14px;max-width:1000px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 70px rgba(0,0,0,.25)}.op-modal-head{display:flex;justify-content:space-between;align-items:center;padding:17px 20px;border-bottom:1px solid #e2e7ed}.op-modal-title{font-size:17px;font-weight:800}.op-x{border:0;background:#f0f3f6;border-radius:50%;width:30px;height:30px;font-size:20px;cursor:pointer}.op-modal-body{padding:20px;overflow:auto}.op-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #e2e7ed}.op-field{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#5e6d7d}.op-field>span{font-weight:600}.op-field input,.op-field select,.op-field textarea{font:inherit;border:1px solid #ccd6e0;border-radius:8px;padding:9px 10px;color:#182b3d;background:#fff;box-sizing:border-box;width:100%}.op-field textarea{min-height:78px;resize:vertical}.op-grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-bottom:14px}.op-section-label{font-weight:800;font-size:13px;margin:18px 0 10px}.op-repeat{display:flex;flex-direction:column;gap:9px;margin-bottom:10px}.op-repeat-row{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr auto;gap:8px;padding:10px;background:#f7f9fb;border:1px solid #e2e8ee;border-radius:9px;align-items:end}.material-row{grid-template-columns:2fr 1fr 1fr auto}.cco-row{grid-template-columns:1fr 1.7fr .8fr .8fr 1.7fr auto}.vendor-item{grid-template-columns:1.5fr 1.3fr .7fr .7fr .9fr auto}.vendor-option{grid-template-columns:1fr .9fr 2fr auto}.op-modal .op-repeat-row .op-field{min-width:0}.op-modal .op-repeat-row .op-field textarea{min-height:58px}.op-toast{position:fixed;right:20px;bottom:20px;z-index:100000;background:#173957;color:#fff;padding:11px 15px;border-radius:9px;box-shadow:0 10px 35px rgba(0,0,0,.18);font-size:12px;opacity:0;transform:translateY(10px);transition:.2s}.op-toast.show{opacity:1;transform:none}.op-toast[data-ok="0"]{background:#a22b2b}
@media(max-width:900px){.op-top{align-items:flex-start}.op-top-actions .op-user{display:none}.op-content{padding:18px 12px 40px}.op-tabs{padding:10px 12px}.op-cards{grid-template-columns:repeat(2,1fr)}.op-grid.two{grid-template-columns:1fr}.op-repeat-row,.cco-row,.vendor-item,.vendor-option,.material-row{grid-template-columns:1fr}.op-page-head{flex-direction:column}.op-modal{max-height:94vh}}
`;
    document.head.appendChild(s);
  }

  function ensureRoot(){let root=document.getElementById("kendali-operasional-root");if(!root){root=document.createElement("div");root.id="kendali-operasional-root";document.body.appendChild(root);}return root;}

  function hideOldDailyDetail(){
    // Menghilangkan akses lama "Laporan Harian" dari detail proyek secara visual;
    // input laporan sekarang terpusat di Laporan Progress.
    document.querySelectorAll("button,a,[role=tab]").forEach(el=>{
      if(el.closest("#kendali-operasional-root"))return;
      const t=(el.textContent||"").trim();
      if(t==="Laporan Harian"||t==="Rincian & Bobot") el.style.display="none";
    });
  }

  function addNav(){
    const candidates=[...document.querySelectorAll("a,button")];
    let existing=candidates.find(x=>((x.textContent||"").trim()==="Departemen Operasional"));
    if(existing)return;
    const anchor=candidates.find(x=>(x.textContent||"").trim()==="Kerja Saya") || candidates.find(x=>(x.textContent||"").trim()==="Tugas Saya");
    if(!anchor)return;
    const nav=anchor.cloneNode(true);nav.textContent="⚙  Departemen Operasional";nav.removeAttribute("href");nav.style.cursor="pointer";nav.dataset.kendaliOperationalNav="1";nav.onclick=()=>{location.hash="#/operasional";};
    anchor.parentElement?.insertBefore(nav,anchor.nextSibling);
  }

  async function openOperational(){
    ensureCss();const root=ensureRoot();root.style.display="block";document.getElementById("root")?.style.setProperty("display","none");
    try{await load();layout();}catch(e){root.innerHTML=`<div class="op-loading">Gagal memuat Departemen Operasional.<br><small>${esc(e.message||e)}</small><br><br><button class="op-btn" id="op-retry">Coba lagi</button></div>`;root.querySelector("#op-retry").onclick=openOperational;}
  }
  function closeOperational(){const root=document.getElementById("kendali-operasional-root");if(root)root.style.display="none";document.getElementById("root")?.style.removeProperty("display");}

  function routeHash(){const h=location.hash.replace(/^#/,"")||"/";if(h==="/operasional"||h.startsWith("/operasional/"))openOperational();else closeOperational();}

  const observer=new MutationObserver(()=>{addNav();if(!location.hash.includes("/operasional"))hideOldDailyDetail();});
  function init(){ensureCss();addNav();hideOldDailyDetail();routeHash();observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("hashchange",routeHash);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else setTimeout(init,100);
})();
