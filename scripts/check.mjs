import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'src/worker.js','public/index.html','public/styles.css','public/app.js',
  'migrations/0011_project_control_end_to_end.sql','migrations/0012_full_workflow_roles_qc_cco.sql',
  'wrangler.jsonc','package.json','README.md','ROLE-MATRIX.md','ALUR-KENDALI.md'
];
for (const rel of required) if (!fs.existsSync(path.join(root,rel))) throw new Error(`File wajib tidak ditemukan: ${rel}`);
execFileSync(process.execPath,['--check',path.join(root,'src/worker.js')],{stdio:'inherit'});
execFileSync(process.execPath,['--check',path.join(root,'public/app.js')],{stdio:'inherit'});

const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const cfg=fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

const workerMarkers=[
  'APP-V3.0.1','ROLE_VIEWS','collectionPermission','/api/employees','/api/qc/inspect','syncQcFromRab',
  'ccoActionHandler','paymentRequestActionHandler','procurementActionHandler','afterRecordUpsert','progressSeriesFor','isProjectScopedRole','projectAssignedToUser','accessibleProjectIds','sanitizeMetricsForUser'
];
const appMarkers=[
  'Dashboard Proyek','progressChart','Pengajuan Dana Karyawan','QS = Quantity Surveyor','QC Dashboard',
  'Sinkron dari RAB','Ajukan ke Admin','Teruskan ke QS','Selesaikan RAB','PR / Purchase Request',
  'PO / SPK','Karyawan & Akses','openEmployeeForm','applyRoleNavigation'
];
for(const m of workerMarkers)if(!worker.includes(m))throw new Error(`Marker backend hilang: ${m}`);
for(const m of appMarkers)if(!app.includes(m))throw new Error(`Marker frontend hilang: ${m}`);
for(const m of ['fund_requests','employees','qc'])if(!html.includes(`data-view="${m}"`))throw new Error(`Menu hilang: ${m}`);
if(!pkg.scripts?.build)throw new Error('package.json wajib memiliki script build.');
for(const token of ['PASTE_EXISTING_KENDALI_D1','PASTE_','YOUR_DATABASE'])if(cfg.includes(token))throw new Error(`Placeholder konfigurasi masih ada: ${token}`);
for(const route of ['/api/*','/rest/*','/storage/*','/auth/*'])if(!cfg.includes(route))throw new Error(`run_worker_first belum mencakup ${route}`);
if(!cfg.includes('04849d77-cb23-4d50-9cfc-4e0d9c542d6b'))throw new Error('D1 database_id existing tidak terpasang.');
if(!cfg.includes('kendali-natara-files-v2'))throw new Error('R2 existing tidak terpasang.');
console.log('KENDALI V3.0.1 Role + Project Scope preflight OK');
