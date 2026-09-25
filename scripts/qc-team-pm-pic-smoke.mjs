import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const tmp=path.join(os.tmpdir(),`nara-qc-team-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { buildAccess, collectionPermission, normalizeRole };\n');
try{
  const m=await import(pathToFileURL(tmp).href+'?v=3414');
  for(const role of ['QC','Head of Supporting']){
    const a=m.buildAccess({id:'x',role});
    must(a.capabilities.qcInspect,`${role} harus tetap dapat melakukan inspeksi QC`);
    must(a.capabilities.qcVerify,`${role} harus tetap dapat verifikasi QC`);
  }
  const pm=m.buildAccess({id:'pm',role:'Project Manager'});
  must(pm.views.includes('qc'),'Project Manager harus melihat QC Dashboard');
  must(!pm.capabilities.qcInspect,'Project Manager bukan inspector QC');
  must(pm.capabilities.qcFindingManage,'Project Manager harus dapat mengisi/edit Temuan QC');
  const pmDef=m.collectionPermission({id:'pm',role:'Project Manager'},'defects');
  must(pmDef.read&&pmDef.create&&pmDef.update&&pmDef.delete,'Project Manager harus CRUD Temuan QC pada proyeknya');
  const pelDef=m.collectionPermission({id:'pel',role:'Pelaksana Lapangan'},'defects');
  must(pelDef.read&&!pelDef.create&&!pelDef.update&&!pelDef.delete,'Pelaksana hanya boleh melihat Temuan QC');
  must(!app.includes("employeeField('qcUserId','QC',['qc'],false)"),'Master Proyek tidak boleh meminta satu QC per proyek');
  must(!app.includes('<th>QS</th><th>QC</th><th>Kontrak</th>'),'Kolom QC assignment harus hilang dari daftar proyek');
  for(const marker of ['PIC Temuan — Project Manager','PIC otomatis Project Manager proyek','Pelaksana Lapangan tetap dapat melihat seluruh temuan','qcFindingManage']) must(app.includes(marker)||worker.includes(marker),`Marker hilang: ${marker}`);
  for(const marker of ['QC_PM_FOLLOWUP','Tindak Lanjut Temuan QC','projectAssignment(env,session.data.projectId,"pm")','const assigned=await projectAssignment(env,d.projectId,"pm")']) must(worker.includes(marker),`Backend PIC PM hilang: ${marker}`);
  console.log('QC team + PM PIC smoke OK — QC is team-wide, PM owns findings, Pelaksana read-only.');
} finally { try{fs.unlinkSync(tmp)}catch{} }
