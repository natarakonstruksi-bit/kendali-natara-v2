import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const tmp=path.join(os.tmpdir(),`nara-qc-control-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { normalizeRole, buildAccess, collectionPermission };\n');
const must=(c,m)=>{if(!c)throw new Error(m)};
try{
  const m=await import(pathToFileURL(tmp).href+'?qc=1');
  for(const role of ['Head of Supporting','QC']){
    const a=m.buildAccess({id:'x',role});
    must(a.views.includes('qc'),`${role} harus melihat QC Dashboard`);
    must(a.capabilities.qcInspect,`${role} harus dapat input/edit inspeksi QC`);
    must(a.capabilities.qcVerify,`${role} harus dapat verifikasi QC`);
    must(a.capabilities.qcDeleteSession,`${role} harus dapat menghapus catatan inspeksi QC`);
    must(a.capabilities.qcDeleteFinding,`${role} harus dapat menghapus temuan QC`);
    const defects=m.collectionPermission({id:'x',role},'defects');
    must(defects.read&&defects.create&&defects.update&&defects.delete,`${role} harus CRUD temuan QC`);
    const docs=m.collectionPermission({id:'x',role},'project_documents');
    must(docs.read&&docs.create&&docs.update,`${role} harus dapat menyimpan bukti/foto QC`);
    const actions=m.collectionPermission({id:'x',role},'qc_actions');
    const ver=m.collectionPermission({id:'x',role},'qc_verifications');
    must(actions.read&&ver.read,`${role} harus dapat membaca riwayat perbaikan/verifikasi QC`);
  }
  const pm=m.buildAccess({id:'pm',role:'Project Manager'});
  must(pm.views.includes('qc')&&!pm.capabilities.qcInspect,'PM harus bisa membaca QC tetapi tidak menjadi inspector QC.');
  for(const marker of [
    'async function qcSessionUpdateHandler','async function qcFindingUpdateHandler','async function qcFindingDeleteHandler',
    'async function deleteQcFindingData','QC_SESSION_EDIT','QC_FINDING_EDIT','QC_FINDING_DELETE',
    'request.method === "PATCH") return qcSessionUpdateHandler','request.method === "DELETE") return qcFindingDeleteHandler'
  ]) must(worker.includes(marker),`Backend QC marker hilang: ${marker}`);
  for(const marker of [
    'openQcSessionEdit','deleteQcSessionFromList','openQcItemEdit','deleteQcFinding',
    'data-qc-session-edit','data-qc-session-delete','data-qc-item-edit','data-qc-item-delete',
    'data-qc-finding-edit','data-qc-finding-delete','qcEditSession'
  ]) must(app.includes(marker),`Frontend QC marker hilang: ${marker}`);
  console.log('QC control smoke OK — Head of Supporting/QC full input, edit/delete, evidence access, PM read-only QC');
} finally { try{fs.unlinkSync(tmp)}catch{} }
