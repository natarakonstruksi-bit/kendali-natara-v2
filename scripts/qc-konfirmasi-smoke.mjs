import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const tmp=path.join(os.tmpdir(),`nara-konf-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { normalizeContinuousQcResult };\n');
try{
  const m=await import(pathToFileURL(tmp).href+'?v=3420');
  for(const v of ['BUTUH KONFIRMASI','butuh konfirmasi','PERLU KONFIRMASI','HOLD']) must(m.normalizeContinuousQcResult(v)==='BUTUH KONFIRMASI',`${v} harus jadi BUTUH KONFIRMASI`);
  must(m.normalizeContinuousQcResult('SESUAI')==='SESUAI'&&m.normalizeContinuousQcResult('TIDAK SESUAI')==='TIDAK SESUAI','Hasil lama berubah');
  for(const mk of ['Tuliskan di Keterangan apa yang perlu dikonfirmasi','sub-pekerjaan Butuh konfirmasi. Putuskan dulu','confirmationResolution=r','const decided=sesuai+tidak','butuhKonfirmasi:konfirmasi']) must(worker.includes(mk),`Backend marker hilang: ${mk}`);
  for(const mk of ['data-qc-new-result="BUTUH KONFIRMASI"','data-result="BUTUH KONFIRMASI"','<option value="BUTUH KONFIRMASI"','qcConfirmListHtml','Menunggu Konfirmasi',"kpi('Butuh Konfirmasi'"]) must(app.includes(mk),`Frontend marker hilang: ${mk}`);
  // V3.4.21 alur jawab/putuskan/eskalasi
  for(const mk of ['"qc_inspection_items"','QC_CONFIRM_ANSWER','QC_CONFIRM_DECIDE','QC_CONFIRM_ESCALATED','async function qcConfirmAnswerHandler','async function qcConfirmReaskHandler','async function escalateOverdueQcConfirmations','await escalateOverdueQcConfirmations(env)','confirm-(answer|reask)','const QC_CONFIRM_DAYS = 3;','await cancelWorkflowTasks(env,"qc_inspection_items",id,user);']) must(worker.includes(mk),`Backend alur konfirmasi hilang: ${mk}`);
  for(const mk of ['function openQcConfirmAnswer','function openQcConfirmDecide','data-qc-confirm-answer','data-qc-confirm-decide','qc-new-target','state.pendingConfirmItem','confirm-reask']) must(app.includes(mk),`Frontend alur konfirmasi hilang: ${mk}`);
  console.log('QC konfirmasi smoke OK — tiga hasil (Sesuai/Tidak sesuai/Butuh konfirmasi), keterangan wajib, blok tutup catatan, daftar Menunggu Konfirmasi, alur Jawab → Putuskan, eskalasi ke Head of Operational.');
} finally { try{fs.unlinkSync(tmp)}catch{} }
