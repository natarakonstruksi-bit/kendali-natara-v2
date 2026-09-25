import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const required=[
  'src/worker.js','public/index.html','public/styles.css','public/app.js','public/public.html','public/public.css','public/public.js',
  'migrations/0011_project_control_end_to_end.sql','migrations/0012_full_workflow_roles_qc_cco.sql','migrations/0013_field_pr_qc_ati.sql','migrations/0014_qc_continuous_inspection.sql','migrations/0015_public_information_portal.sql','migrations/0016_public_company_portfolio.sql','migrations/0017_roles_qc_ati_reports.sql','migrations/0018_org_hierarchy.sql','migrations/0019_workflow_inbox.sql','migrations/0020_qc_pm_pic.sql',
  'wrangler.jsonc','package.json','README.md','ROLE-MATRIX.md','ALUR-NARA-SYSTEM.md','DEPLOY-CHECKLIST.md','QA-MATRIX.md','scripts/qa-final.mjs','scripts/worker-role-smoke.mjs','scripts/qc-control-smoke.mjs','scripts/button-flow-audit.mjs',
  'public/assets/natara-logo.jpeg','public/assets/natara-mark.png','public/assets/favicon.png','scripts/qc-before-after-smoke.mjs'
];
for(const rel of required)if(!fs.existsSync(path.join(root,rel)))throw new Error(`File wajib tidak ditemukan: ${rel}`);
for(const rel of ['src/worker.js','public/app.js','public/public.js'])execFileSync(process.execPath,['--check',path.join(root,rel)],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(root,'scripts/runtime-smoke.mjs')],{stdio:'inherit'});

const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const pub=fs.readFileSync(path.join(root,'public/public.js'),'utf8');
const pubHtml=fs.readFileSync(path.join(root,'public/public.html'),'utf8');
const cfg=fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for(const m of ['APP-V3.4.14','public_portfolio','public_site_settings','/api/public/site','/api/public/portfolio','publicMediaHandler','servePublicPortal'])if(!worker.includes(m))throw new Error(`Marker public backend hilang: ${m}`);
for(const m of ['Profil & Portofolio','renderPublicInfo','openPublicPortfolio','Apa itu Natara?','Portofolio publik berdiri sendiri'])if(!app.includes(m))throw new Error(`Marker public admin hilang: ${m}`);
for(const m of ['/api/public/site','/api/public/portfolio','portfolioGrid','openDetail'])if(!pub.includes(m))throw new Error(`Marker public frontend hilang: ${m}`);
for(const m of ['APA ITU NATARA?','Karya yang Telah Kami Kerjakan','portfolioGrid','natara-logo.jpeg'])if(!pubHtml.includes(m))throw new Error(`Marker public HTML hilang: ${m}`);
if(!html.includes('data-view="public_info"'))throw new Error('Menu Informasi Publik hilang.');
if(!html.includes('href="/info"'))throw new Error('Link portal publik di login hilang.');
if(pkg.version!=='3.4.14')throw new Error('package version bukan 3.4.14');
if(!pkg.scripts?.build)throw new Error('package.json wajib memiliki script build.');
for(const token of ['PASTE_EXISTING_KENDALI_D1','PASTE_','YOUR_DATABASE'])if(cfg.includes(token))throw new Error(`Placeholder konfigurasi masih ada: ${token}`);
if(!cfg.includes('04849d77-cb23-4d50-9cfc-4e0d9c542d6b'))throw new Error('D1 existing tidak terpasang.');
if(!cfg.includes('kendali-natara-files-v2'))throw new Error('R2 existing tidak terpasang.');
for(const marker of ['PIC laporan progress wajib Pelaksana Lapangan','PIC Opname wajib QS / Quantity Surveyor','Hanya Head of Operational atau Head Unit Bisnis yang dapat memilih vendor PR','PO/SPK dari PR hanya dapat dibuat oleh Admin Teknik','SPK/PO harus dibuat Admin Teknik sebelum PR dapat ditandai ORDERED'])if(!worker.includes(marker))throw new Error(`Workflow guard backend hilang: ${marker}`);
for(const marker of ['QC Management System','Alur QC:','Rekap Kehadiran & Gaji Tukang','Akademi Tukang Indonesia (ATI)','Halo, ${esc(full)}'])if(!app.includes(marker))throw new Error(`Workflow frontend hilang: ${marker}`);
for(const m of ['qc_reports','ati_reports','workflow_tasks','listWorkflowTasks','syncWorkflowTask','progressWorkflowAction','opnameWorkflowAction','generateDivisionReport','DIVISION_REPORT_SUBMIT','koordinator_engineering','koordinator_supporting',])if(!worker.includes(m))throw new Error(`Marker V3.3.1 backend hilang: ${m}`);
for(const m of ['Tugas Saya','renderTasks','WORKFLOW INBOX','Posisi / Jabatan — sekaligus Role Akses','LAPORAN ${type} KE HEAD UNIT BISNIS','Buat & Kirim Laporan','v33OpenReportDetail'])if(!app.includes(m))throw new Error(`Marker V3.3.1 frontend hilang: ${m}`);

for(const marker of ['project_manager: ["dashboard","tasks","projects","fund_requests","progress","opname","asbuilt","qc","cco","procurement","documents","flow","closeout"]','projectManagerProcurementAccess','projectManagerQcReadAccess','input?.position, input?.jabatan, input?.role, input?.roleKey'])if(!worker.includes(marker))throw new Error(`PM access fix hilang: ${marker}`);
for(const marker of ["if(!canCollection('qc_reports','read'))return","const poPromise=canCollection('po','read')?loadCollection('po',Boolean(state.selectedProjectId)):Promise.resolve([])","Ketik nama vendor","state.v31Vendors=[];"])if(!app.includes(marker))throw new Error(`PM runtime/free-text guard hilang: ${marker}`);
if(app.includes("loadCollection('vendor',false)"))throw new Error('PR masih bergantung pada Master Vendor.');
for(const marker of ['Project Manager wajib menambahkan minimal satu pembanding vendor','PR dan pembanding vendor harus dikirim Project Manager ke Head','Hanya Project Manager proyek atau Manajemen yang dapat menindaklanjuti vendor'])if(!worker.includes(marker))throw new Error(`PM vendor workflow guard hilang: ${marker}`);
for(const marker of ['Pembanding Vendor — Project Manager','Kebutuhan + Pembanding Vendor','Tugas PR diteruskan kembali ke Project Manager'])if(!app.includes(marker))throw new Error(`PM vendor workflow frontend hilang: ${marker}`);
for(const marker of ['Before & After','qcEvidencePanel','qc-finding-detail-modal','Foto before belum tersedia','Foto after belum tersedia'])if(!app.includes(marker))throw new Error(`QC Before/After marker hilang: ${marker}`);
for(const m of ['as_built_progress','as-built','READY FOR APPROVAL','Drafter hanya dapat upload dokumen kategori AS_BUILT'])if(!worker.includes(m))throw new Error(`Marker As-Built backend hilang: ${m}`);
for(const m of ['As-Built / Drafter','Progress As-Built','Volume RAB','Volume Realisasi','data-asbuilt-action'])if(!app.includes(m))throw new Error(`Marker QS/As-Built frontend hilang: ${m}`);

for(const marker of ['qcFindingManage','QC_PM_FOLLOWUP','Tindak Lanjut Temuan QC','Proyek belum memiliki Project Manager. Tetapkan Project Manager sebelum menerbitkan temuan.'])if(!worker.includes(marker))throw new Error(`QC team/PM PIC backend hilang: ${marker}`);
for(const marker of ['PIC Temuan — Project Manager','QC bekerja sebagai tim dan tidak ditetapkan satu orang per proyek','Pelaksana Lapangan tetap dapat melihat seluruh temuan'])if(!app.includes(marker))throw new Error(`QC team/PM PIC frontend hilang: ${marker}`);
if(app.includes("employeeField('qcUserId','QC',['qc'],false)"))throw new Error('Master proyek masih meminta satu QC per proyek.');

console.log('Nara System V3.4.14 QC Team + PM Finding PIC preflight OK');
