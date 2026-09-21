import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'src/worker.js','public/index.html','public/styles.css','public/app.js',
  'migrations/0011_project_control_end_to_end.sql','migrations/0012_full_workflow_roles_qc_cco.sql','migrations/0013_field_pr_qc_ati.sql','migrations/0014_qc_continuous_inspection.sql',
  'wrangler.jsonc','package.json','README.md','ROLE-MATRIX.md','ALUR-KENDALI.md',
  'public/assets/natara-logo.jpeg','public/assets/natara-mark.png','public/assets/favicon.png'
];
for (const rel of required) if (!fs.existsSync(path.join(root,rel))) throw new Error(`File wajib tidak ditemukan: ${rel}`);
execFileSync(process.execPath,['--check',path.join(root,'src/worker.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',path.join(root,'public/app.js')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(root,'scripts/runtime-smoke.mjs')],{stdio:'inherit'});

const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const cfg=fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

const workerMarkers=[
  'APP-V3.1','ROLE_VIEWS','collectionPermission','/api/employees','/api/qc/inspect','syncQcFromRab',
  'ccoActionHandler','paymentRequestActionHandler','procurementActionHandler','qcFindingActionHandler','qcSessionStartHandler','qcSessionAddItemHandler','qcSessionPublishHandler','qcSessionCloseHandler','qc_inspection_sessions','qc_inspection_items','daily_workers','ati_assessments','procurementVendorSelect','afterRecordUpsert','progressSeriesFor','isProjectScopedRole','projectAssignedToUser','accessibleProjectIds','sanitizeMetricsForUser'
];
const appMarkers=[
  'Dashboard Proyek','progressChart','Pengajuan Dana Karyawan','QS = Quantity Surveyor','QC Dashboard',
  'Sinkron dari RAB','Ajukan ke Admin','Teruskan ke QS','Selesaikan RAB','PR / Purchase Request',
  'PO / SPK','Karyawan & Akses','Laporan Harian Lapangan','Rekap Kehadiran & Gaji Tukang','Evaluasi Vendor','Akademi Tukang Indonesia (ATI)','openEmployeeForm','applyRoleNavigation'
];
for(const m of workerMarkers)if(!worker.includes(m))throw new Error(`Marker backend hilang: ${m}`);
for(const m of appMarkers)if(!app.includes(m))throw new Error(`Marker frontend hilang: ${m}`);
for(const m of ['fund_requests','employees','qc','ati'])if(!html.includes(`data-view="${m}"`))throw new Error(`Menu hilang: ${m}`);
if(!pkg.scripts?.build)throw new Error('package.json wajib memiliki script build.');
for(const token of ['PASTE_EXISTING_KENDALI_D1','PASTE_','YOUR_DATABASE'])if(cfg.includes(token))throw new Error(`Placeholder konfigurasi masih ada: ${token}`);
for(const route of ['/api/*','/rest/*','/storage/*','/auth/*'])if(!cfg.includes(route))throw new Error(`run_worker_first belum mencakup ${route}`);
if(!cfg.includes('04849d77-cb23-4d50-9cfc-4e0d9c542d6b'))throw new Error('D1 database_id existing tidak terpasang.');
if(!cfg.includes('kendali-natara-files-v2'))throw new Error('R2 existing tidak terpasang.');

// Critical V3.1 workflow guards.
for (const marker of [
  'PIC laporan progress wajib Pelaksana Lapangan',
  'PIC Opname wajib QS / Quantity Surveyor',
  'PIC PO/SPK wajib Logistik / Procurement',
  'Hanya Head Operational atau Head Unit Bisnis yang dapat memilih vendor PR',
  'Proyek belum memiliki Project Manager. Tetapkan PM sebelum membuat PR',
  'data.requesterUserId=auth.user.id'
]) if(!worker.includes(marker)) throw new Error(`Workflow guard backend hilang: ${marker}`);
for (const marker of [
  'PIC Laporan — Pelaksana Lapangan',
  'Rekap Kehadiran & Gaji Tukang',
  'Daftar Material / Jasa — HPP Detail',
  'Head Operational/Head Unit Bisnis memilih vendor',
  'Pengajuan Pekerjaan ATI',
  'Masalah Lapangan ATI',
  'Evaluasi Masalah ATI',
  'QC Management System','Inspeksi QC berkelanjutan','Catatan ini <b>berkelanjutan</b>','qcGroupHtml','Terbitkan ${unpublished} temuan'
]) if(!app.includes(marker)) throw new Error(`Workflow marker frontend hilang: ${marker}`);
for (const forbidden of ["f('code','Kode Proyek'",'>Kode Proyek<','<label>Kode Proyek']) if(app.includes(forbidden)) throw new Error(`Kode proyek kembali muncul pada form proyek operasional: ${forbidden}`);
if(!app.includes('function resolveDomRoot(root=document)')) throw new Error('Scoped DOM root resolver hilang.');
if(!app.includes('globalThis.__kendaliDom={resolveDomRoot,$,$$}')) throw new Error('Runtime DOM helper test hook hilang.');
if(!app.includes('Ambil / pilih foto')) throw new Error('Tombol file picker QC hilang.');

for(const marker of ['dashboardWelcome','Halo, ${esc(full)}','topbarGreeting','/assets/natara-mark.png']) if(!app.includes(marker)) throw new Error(`Branding/greeting marker hilang: ${marker}`);
for(const marker of ['/assets/natara-logo.jpeg','Natara Konstruksi • V3.1.6','topbarGreeting']) if(!html.includes(marker)) throw new Error(`Branding HTML marker hilang: ${marker}`);

console.log('KENDALI V3.1.6 Branding & Greeting UI preflight OK');
