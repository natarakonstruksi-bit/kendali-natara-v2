import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

function must(cond,msg){ if(!cond) throw new Error(msg); }
function has(text,needle,msg=needle){ must(text.includes(needle),`QA marker hilang: ${msg}`); }

must(pkg.version==='3.4.12','Versi package harus 3.4.12');
has(worker,'APP-V3.4.12','APP version 3.4.12');
has(html,'Natara Konstruksi • V3.4.12','label frontend 3.4.12');
has(html,'NARA SYSTEM','branding Nara System');
has(html,'Masuk ke Nara System','login branding Nara System');
has(worker,'const SERVICE_NAME = "Nara System";','service branding Nara System');

// Dropdown posisi baru: legacy tidak boleh ditambahkan sebagai pilihan baru.
must(!app.includes("ROLES.push('Head Operational')"),'Legacy `Head Operational` masih dipaksa masuk dropdown.');
has(app,"'Head Unit Bisnis','Head of Operational','Head of Engineering','Head of Supporting'",'empat posisi puncak');
has(app,"'head operational':'Head of Operational'",'normalisasi legacy display');
has(worker,'["head operational","manager_operasional"]','backend alias legacy role');


// Field role merge: Superintendent/Site Manager => Project Manager; Pengawas => Pelaksana Lapangan.
must(!app.includes("'Project Manager','Site Manager','Pelaksana Lapangan','Pengawas Lapangan'"),'Role lapangan lama masih muncul sebagai pilihan aktif.');
has(app,"['Operasional Proyek',['Project Manager','Pelaksana Lapangan']]",'role operasional proyek sudah digabung');
has(app,"'site manager':'Project Manager'",'display alias Site Manager => Project Manager');
has(app,"'pengawas lapangan':'Pelaksana Lapangan'",'display alias Pengawas => Pelaksana');
has(worker,'["site manager","project_manager"]','backend alias Site Manager => Project Manager');
has(worker,'["superintendent","project_manager"]','backend alias Superintendent => Project Manager');
has(worker,'["pengawas lapangan","pelaksana_lapangan"]','backend alias Pengawas => Pelaksana');
has(app,'Pengaju PR','PR menampilkan pengaju');
has(worker,'PR hanya dapat disubmit oleh Project Manager proyek','Project Manager adalah pengaju formal PR');

// Role QC aktif disederhanakan menjadi satu posisi: QC.
has(app,"['Supporting / QC',['QC']]",'kelompok Supporting hanya memakai role QC');
must(app.includes(`'QC',\n  'Finance'`),'QC harus tersedia sebagai pilihan posisi aktif.');
must(!app.includes("'Senior QC','QC / Quality Control','QC Arsitektur','QC Interior','QC MEP'"),'Role QC terpisah masih muncul di pilihan aktif.');
has(worker,'qc: "QC"','label akses QC canonical');

// Button generation -> event binder. Ini menangkap class tombol yang dibuat tetapi tidak pernah diikat.
const wiring=[
  ['data-task-action','[data-task-action]'],
  ['data-task-open','[data-task-open]'],
  ['data-v34-action','[data-v34-action]'],
  ['data-fund-action','[data-fund-action]'],
  ['data-cco-action','[data-cco-action]'],
  ['data-cco-price','[data-cco-price]'],
  ['data-cco-doc','[data-cco-doc]'],
  ['data-pr-action','[data-pr-action]'],
  ['data-pr-select','[data-pr-select]'],
  ['data-create-po','[data-create-po]'],
  ['data-qc-new-photo','[data-qc-new-photo]'],
  ['data-qc-add-sub','[data-qc-add-sub]'],
  ['data-qc-item-photo','[data-qc-item-photo]'],
  ['data-qc-item-result','[data-qc-item-result]'],
  ['data-qc-item-delete','[data-qc-item-delete]'],
  ['data-qc-action','[data-qc-action]'],
  ['data-qc-session-open','[data-qc-session-open]'],
  ['data-qc-session-edit','[data-qc-session-edit]'],
  ['data-qc-session-delete','[data-qc-session-delete]'],
  ['data-qc-item-edit','[data-qc-item-edit]'],
  ['data-qc-finding-edit','[data-qc-finding-edit]'],
  ['data-qc-finding-delete','[data-qc-finding-delete]'],
  ['data-ati-flow','[data-ati-flow]'],
  ['data-employee-edit','[data-employee-edit]'],
  ['data-employee-delete','[data-employee-delete]'],
  ['data-report-detail','data-report-detail'],
  ['data-report-edit','data-report-edit'],
  ['data-report-delete','data-report-delete'],
  ['data-report-review','data-report-review'],
  ['data-report-create','data-report-create'],
  ['data-asbuilt-edit','[data-asbuilt-edit]'],['data-asbuilt-detail','[data-asbuilt-detail]'],['data-asbuilt-action','[data-asbuilt-action]']
];
for(const [producer,binder] of wiring){
  must(app.includes(producer),`Producer tombol ${producer} tidak ditemukan.`);
  must(app.includes(binder),`Binder tombol ${producer} tidak ditemukan.`);
}

// Endpoints utama workflow harus ada di frontend dan backend router/action.
const endpointMarkers=[
  '/api/tasks/my','/api/tasks/','/api/progress/','/api/opname/','/api/issues/',
  '/api/procurement/','as-built','/api/cco/','/api/payment-requests/','/api/ati/','/api/qc/sessions','/api/qc/session-items/','/api/qc/findings/'
];
for(const m of endpointMarkers){
  must(app.includes(m)||worker.includes(m),`Endpoint marker hilang: ${m}`);
}
has(worker,'closeoutActionMatch=path.match(','router retention/closeout');
has(worker,'retention|closeout','router retention/closeout group');
for(const m of [
  'progressWorkflowAction','opnameWorkflowAction','atiWorkflowAction','syncWorkflowTask','listWorkflowTasks',
  'publish-findings','select-vendor','operational-review','pm-approve','return-field','return-qs'
]) has(worker,m,`backend workflow ${m}`);

// Continuous QC: regression khusus bug tombol foto/tambah item.
for(const m of [
  "$('[data-qc-new-photo]',box).onclick",
  "$('[data-qc-add-sub]',box).onclick",
  "$$('[data-qc-item-photo]','#modalForm')",
  "$$('[data-qc-item-result]','#modalForm')",
  "$$('[data-qc-item-delete]','#modalForm')"
]) has(app,m,m);

// QC V3.4.11: Head of Supporting/QC manage full QC records with edit/delete and audit-safe cascades.
for(const m of ['qcDeleteFinding','QC_FINDING_EDIT','QC_FINDING_DELETE','QC_SESSION_EDIT','deleteQcFindingData','deleteRelatedDocuments','DIVISION_REPORT_EDIT','DIVISION_REPORT_DELETE']) has(worker,m,`QC control backend ${m}`);
for(const m of ['Edit Catatan Inspeksi QC','data-qc-item-edit','data-qc-finding-edit','data-qc-finding-delete','data-qc-session-delete','openQcItemEdit']) has(app,m,`QC control frontend ${m}`);

// Tugas Saya harus punya assignment, menunggu, deadline dan aksi.
for(const m of ['Tugas Saya','Menunggu Tindakan Anda','waitingFor','dueDate','data-task-action="claim"','data-task-action="start"','Buka & Proses']) has(app,m,m);


// PR vendor workflow V3.4.8.
for(const m of [
  'PR_SPK_ADMIN','SPK_CREATED','PO/SPK dari PR hanya dapat dibuat oleh Admin Teknik',
  'SPK/PO harus dibuat Admin Teknik sebelum PR dapat ditandai ORDERED',
  'procurementSpkCreate'
]) has(worker,m,`PR-SPK backend ${m}`);
for(const m of [
  'PR digunakan jika pekerjaan membutuhkan vendor','pengaju formal dan pihak yang submit adalah Project Manager',
  'Kebutuhan + Pembanding Vendor','Buat SPK / PO','SPK/PO dibuat dan masuk register PO/SPK'
]) has(app,m,`PR-SPK frontend ${m}`);

for(const m of ['Project Manager wajib menambahkan minimal satu pembanding vendor','PR dan pembanding vendor harus dikirim Project Manager ke Head','PR_PM_VENDOR']) has(worker,m,`PM vendor backend ${m}`);
for(const m of ['Pembanding Vendor — Project Manager','Project Manager mengisi kebutuhan, HPP, dan pembanding/quotation vendor sekaligus','Tugas PR diteruskan kembali ke Project Manager']) has(app,m,`PM vendor frontend ${m}`);
for(const m of ['as_built_progress','ASBUILT_DRAFTER','ASBUILT_ENGINEERING','READY FOR APPROVAL','asBuiltActionHandler']) has(worker,m,`As-Built backend ${m}`);
for(const m of ['QS / Volume','Volume RAB','Volume Realisasi','As-Built / Drafter','Overall Progress','Kirim Approval']) has(app,m,`QS/As-Built frontend ${m}`);
console.log('QA static wiring OK — roles, buttons, workflow endpoints, QC controls, QS volume, As-Built Drafter');
