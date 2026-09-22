import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

function must(cond,msg){ if(!cond) throw new Error(msg); }
function has(text,needle,msg=needle){ must(text.includes(needle),`QA marker hilang: ${msg}`); }

must(pkg.version==='3.4.1','Versi package harus 3.4.1');
has(worker,'APP-V3.4.1','APP version 3.4.1');
has(html,'Natara Konstruksi • V3.4.1','label frontend 3.4.1');

// Dropdown posisi baru: legacy tidak boleh ditambahkan sebagai pilihan baru.
must(!app.includes("ROLES.push('Head Operational')"),'Legacy `Head Operational` masih dipaksa masuk dropdown.');
has(app,"'Head Unit Bisnis','Head of Operational','Head of Engineering','Head of Supporting'",'empat posisi puncak');
has(app,"'head operational':'Head of Operational'",'normalisasi legacy display');
has(worker,'["head operational","manager_operasional"]','backend alias legacy role');

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
  ['data-qc-session','[data-qc-session]'],
  ['data-ati-flow','[data-ati-flow]'],
  ['data-employee-edit','[data-employee-edit]'],
  ['data-employee-delete','[data-employee-delete]'],
  ['data-report-detail','data-report-detail'],
  ['data-report-review','data-report-review'],
  ['data-report-create','data-report-create']
];
for(const [producer,binder] of wiring){
  must(app.includes(producer),`Producer tombol ${producer} tidak ditemukan.`);
  must(app.includes(binder),`Binder tombol ${producer} tidak ditemukan.`);
}

// Endpoints utama workflow harus ada di frontend dan backend router/action.
const endpointMarkers=[
  '/api/tasks/my','/api/tasks/','/api/progress/','/api/opname/','/api/issues/',
  '/api/procurement/','/api/cco/','/api/payment-requests/','/api/ati/','/api/qc/sessions','/api/qc/session-items/'
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

// Tugas Saya harus punya assignment, menunggu, deadline dan aksi.
for(const m of ['Tugas Saya','Menunggu Tindakan Anda','waitingFor','dueDate','data-task-action="claim"','data-task-action="start"','Buka & Proses']) has(app,m,m);

console.log('QA static wiring OK — roles, buttons, workflow endpoints, QC controls');
