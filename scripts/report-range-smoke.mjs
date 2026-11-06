import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const tmp=path.join(os.tmpdir(),`nara-range-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { reportPeriod };\n');
try{
  const {reportPeriod}=await import(pathToFileURL(tmp).href+'?v=3423');
  let r=reportPeriod('CUSTOM','', '2026-10-15','2026-11-05'); must(r.periodType==='CUSTOM'&&r.start==='2026-10-15'&&r.end==='2026-11-05'&&r.days===22,'Rentang khusus salah');
  r=reportPeriod('WEEKLY','', '2026-11-02','2026-11-08'); must(r.periodType==='WEEKLY','Rentang Senin–Minggu harus tetap Mingguan');
  r=reportPeriod('WEEKLY','', '2026-11-03','2026-11-06'); must(r.periodType==='CUSTOM','Rentang bukan Senin–Minggu harus jadi Periode Khusus');
  r=reportPeriod('MONTHLY','2026-10-10'); must(r.start==='2026-10-01'&&r.end==='2026-10-31','Bulanan dari tanggal acuan salah (kompatibilitas lama)');
  let threw=false;try{reportPeriod('CUSTOM','','2026-11-06','2026-11-01')}catch{threw=true} must(threw,'Akhir sebelum awal harus ditolak');
  threw=false;try{reportPeriod('CUSTOM','','2025-01-01','2026-11-01')}catch{threw=true} must(threw,'Rentang > 366 hari harus ditolak');
  for(const mk of ['name="startDate"','name="endDate"',"data-range=\"lastmonth\"","opt('CUSTOM'",'Periode Khusus']) must(app.includes(mk),`Frontend marker hilang: ${mk}`);
  console.log('Report range smoke OK — periode dari–sampai, deteksi Mingguan/Bulanan/Periode Khusus, validasi rentang.');
} finally { try{fs.unlinkSync(tmp)}catch{} }
