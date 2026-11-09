import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
must(fs.existsSync(path.join(root,'public/vendor/xlsx-0.18.5.full.min.js')),'Pembaca Excel lokal hilang');
for(const mk of ['importProjectsHandler','importTransactionsHandler','importBatchesHandler','importDeleteHandler','"/api/finance/import/projects"','"/api/finance/import/transactions"','IMP-CO-','IMP-PP-','financeImport:']) must(worker.includes(mk),`Backend marker hilang: ${mk}`);
for(const mk of ['openFinanceImport','impParse','impPreview','impRun','/vendor/xlsx-0.18.5.full.min.js','DATA BELANJA PROYEK','IMPOR BELANJA','REKAP DANA PROYEK']) must(app.includes(mk),`Frontend marker hilang: ${mk}`);
// uji fungsi parsing angka & tanggal
const grab=name=>{const i=app.indexOf(`function ${name}(`);const j=app.indexOf('\n',i);return app.slice(i,j);};
const IMP_MONTHS=eval('('+app.slice(app.indexOf('const IMP_MONTHS=')+17,app.indexOf(';',app.indexOf('const IMP_MONTHS=')))+')');
const impNum=eval('('+grab('impNum').replace('function impNum','function')+')');
const impDate=new Function('IMP_MONTHS',`return (${app.slice(app.indexOf('function impDate('),app.indexOf('const impKey=')).replace('function impDate','function')})`)(IMP_MONTHS);
const eq=(a,b,m)=>must(a===b,`${m}: ${a} ≠ ${b}`);
eq(impNum(' Rp 28.000,00 '),28000,'Rp desimal');eq(impNum('Rp 1.844.330.247'),1844330247,'Rp ribuan');eq(impNum('-Rp 4.463.572'),-4463572,'negatif');eq(impNum('-'),0,'strip');eq(impNum(12500),12500,'angka');
eq(impDate('11-Jan-2025'),'2025-01-11','tgl Jan');eq(impDate('06-Agu-2025'),'2025-08-06','tgl Agu');eq(impDate('13-Mei-2026'),'2026-05-13','tgl Mei');eq(impDate('1/7/2025'),'2025-07-01','tgl d/m/y');eq(impDate('20-10-2026'),'2026-10-20','tgl d-m-y');eq(impDate('2026-11-08'),'2026-11-08','ISO');
console.log('Finance import smoke OK — impor .xlsx Google Sheet, parsing Rp & tanggal Indonesia, ID deterministik, hapus batch.');
