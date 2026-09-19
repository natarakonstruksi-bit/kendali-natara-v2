import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const required = [
  'src/worker.js', 'public/index.html', 'public/styles.css', 'public/app.js',
  'migrations/0011_project_control_end_to_end.sql', 'wrangler.jsonc'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`File wajib tidak ditemukan: ${rel}`);
}
execFileSync(process.execPath, ['--check', path.join(root, 'src/worker.js')], {stdio:'inherit'});
execFileSync(process.execPath, ['--check', path.join(root, 'public/app.js')], {stdio:'inherit'});

const worker = fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app = fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const mustWorker = ['/api/dashboard','/api/documents','sync-status','project_documents','FINAL_RECONCILIATION'];
const mustApp = ['Pemasukan / Cash In','Pengeluaran / Cash Out','Upload Dokumen','Edit / Ganti Dokumen','Close-Out Readiness','Schedule / Kurva-S'];
for (const m of mustWorker) if (!worker.includes(m)) throw new Error(`Marker backend hilang: ${m}`);
for (const m of mustApp) if (!app.includes(m)) throw new Error(`Marker frontend hilang: ${m}`);

const cfg = fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8');
if (cfg.includes('PASTE_EXISTING_KENDALI_D1')) {
  console.warn('PERINGATAN: isi database_name dan database_id D1 KENDALI lama di wrangler.jsonc sebelum deploy.');
}
console.log('KENDALI V2.8 preflight OK');
