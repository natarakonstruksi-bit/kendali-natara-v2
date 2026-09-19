import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'src/worker.js', 'public/index.html', 'public/styles.css', 'public/app.js',
  'migrations/0011_project_control_end_to_end.sql', 'wrangler.jsonc', 'package.json'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`File wajib tidak ditemukan: ${rel}`);
}
execFileSync(process.execPath, ['--check', path.join(root, 'src/worker.js')], {stdio:'inherit'});
execFileSync(process.execPath, ['--check', path.join(root, 'public/app.js')], {stdio:'inherit'});

const worker = fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app = fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const mustWorker = ['/api/dashboard','/api/documents','sync-status','project_documents','FINAL_RECONCILIATION','legacyStorageHandler','/api/access/session'];
const mustApp = ['Pemasukan / Cash In','Pengeluaran / Cash Out','Upload Dokumen','Edit / Ganti Dokumen','Close-Out Readiness','Schedule / Kurva-S'];
for (const m of mustWorker) if (!worker.includes(m)) throw new Error(`Marker backend hilang: ${m}`);
for (const m of mustApp) if (!app.includes(m)) throw new Error(`Marker frontend hilang: ${m}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (!pkg.scripts?.build) throw new Error('package.json wajib memiliki script build.');

const cfg = fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
for (const token of ['PASTE_EXISTING_KENDALI_D1','PASTE_','YOUR_DATABASE']) {
  if (cfg.includes(token)) throw new Error(`Placeholder konfigurasi masih ada: ${token}`);
}
for (const route of ['/api/*','/rest/*','/storage/*','/auth/*']) {
  if (!cfg.includes(route)) throw new Error(`run_worker_first belum mencakup ${route}`);
}
if (!cfg.includes('04849d77-cb23-4d50-9cfc-4e0d9c542d6b')) throw new Error('D1 database_id KENDALI lama tidak terpasang.');
if (!cfg.includes('kendali-natara-files-v2')) throw new Error('R2 bucket KENDALI lama tidak terpasang.');

console.log('KENDALI V2.8.1 preflight OK');
