import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const src=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const tmp=path.join(os.tmpdir(),`kendali-worker-role-${process.pid}.mjs`);
fs.writeFileSync(tmp,src+'\nexport { normalizeRole, buildAccess, collectionPermission, ROLE_VIEWS, ROLE_LABELS };\n');
try{
  const m=await import(pathToFileURL(tmp).href+'?t=1');
  const cases=[
    ['Head Operational','manager_operasional'],['Head of Operational','manager_operasional'],
    ['Koordinator Engineering','koordinator_engineering'],['Head of Engineering','koordinator_engineering'],
    ['Koordinator Supporting','koordinator_supporting'],['Head of Supporting','koordinator_supporting'],
    ['Senior QC','qc'],['QC Interior','qc'],['Site Manager','site_manager'],['Project Manager','site_manager'],['Pelaksana Lapangan','site_manager'],['Superintendent','site_manager'],['Pengawas Lapangan','site_manager'],['Site Supervisor','site_manager'],['Manager Logistik','procurement'],['Admin Logistik','procurement'],['Procurement / Purchasing','procurement']
  ];
  for(const [label,want] of cases){const got=m.normalizeRole(label);if(got!==want)throw new Error(`${label} => ${got}; expected ${want}`);}
  const hu=m.buildAccess({id:'hu',role:'Head Unit Bisnis'});
  if(!hu.capabilities.workflowOversight||!hu.capabilities.divisionReportReview||!hu.views.includes('tasks'))throw new Error('Head Unit Bisnis access mismatch');
  const op=m.buildAccess({id:'op',role:'Head of Operational'});
  if(!op.capabilities.workflowOversight||!op.views.includes('procurement')||!op.views.includes('progress'))throw new Error('Head of Operational access mismatch');
  const eng=m.buildAccess({id:'eng',role:'Head of Engineering'});
  if(!eng.views.includes('opname')||!eng.views.includes('cco'))throw new Error('Head of Engineering access mismatch');
  const sup=m.buildAccess({id:'sup',role:'Head of Supporting'});
  if(!sup.views.includes('qc')||!sup.capabilities.qcCloseSession||!sup.capabilities.qcDeleteSession||!sup.capabilities.qcDeleteFinding||!sup.capabilities.qcInspect||!sup.capabilities.qcVerify)throw new Error('Head of Supporting access mismatch');
  const supDef=m.collectionPermission({id:'sup',role:'Head of Supporting'},'defects'); if(!supDef.read||!supDef.create||!supDef.update||!supDef.delete)throw new Error('Head of Supporting QC CRUD mismatch');
  const qc=m.buildAccess({id:'qc',role:'QC'}); if(!qc.capabilities.qcInspect||!qc.capabilities.qcVerify||!qc.capabilities.qcDeleteSession||!qc.capabilities.qcDeleteFinding)throw new Error('QC full control mismatch');
  if(m.ROLE_LABELS.project_manager||m.ROLE_LABELS.pelaksana_lapangan||m.ROLE_VIEWS.project_manager||m.ROLE_VIEWS.pelaksana_lapangan)throw new Error('Role PM/Pelaksana lama masih aktif.');
  const sm=m.buildAccess({id:'sm',role:'Site Manager'});
  if(!sm.views.includes('tasks')||!sm.views.includes('progress')||!sm.views.includes('procurement')||!sm.views.includes('qc')||sm.views.includes('finance')||sm.views.includes('employees'))throw new Error('Site Manager view mismatch');
  const smPr=m.collectionPermission({id:'sm',role:'Site Manager'},'procurement');
  const smQc=m.collectionPermission({id:'sm',role:'Site Manager'},'defects');
  const smDaily=m.collectionPermission({id:'sm',role:'Site Manager'},'daily_progress');
  if(!smPr.read||!smPr.create||!smPr.update)throw new Error('Site Manager harus dapat membuat/mengubah Purchase Request.');
  if(!smQc.read||smQc.create||smQc.update||smQc.delete)throw new Error('V3.4.26: Site Manager PIC temuan QC hanya membaca & kirim foto perbaikan.');
  if(!smDaily.read||!smDaily.create||!smDaily.update)throw new Error('Site Manager membuat laporan harian.');
  if(m.ROLE_LABELS.procurement!=='Admin Logistik')throw new Error('Label Admin Logistik belum aktif.');
  console.log('Worker RBAC smoke OK — role aliases, hierarchy, permissions');
} finally {
  try{fs.unlinkSync(tmp);}catch{}
}
