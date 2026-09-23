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
    ['Senior QC','qc'],['QC Interior','qc'],['Site Manager','project_manager'],['Superintendent','project_manager'],['Pengawas Lapangan','pelaksana_lapangan'],['Site Supervisor','pelaksana_lapangan'],['Manager Logistik','procurement'],['Procurement / Purchasing','procurement']
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
  const pm=m.buildAccess({id:'pm',role:'Project Manager'});
  if(!pm.views.includes('tasks')||pm.views.includes('finance'))throw new Error('Project Manager view mismatch');
  const pel=m.buildAccess({id:'pel',role:'Pelaksana Lapangan'});
  if(!pel.views.includes('progress')||!pel.views.includes('procurement')||!pel.views.includes('qc')||pel.views.includes('employees'))throw new Error('Pelaksana Lapangan view mismatch');
  const pelPr=m.collectionPermission({id:'pel',role:'Pelaksana Lapangan'},'procurement');
  const pelQc=m.collectionPermission({id:'pel',role:'Pelaksana Lapangan'},'defects');
  if(!pelPr.read||!pelPr.create||!pelPr.update)throw new Error('Pelaksana harus dapat membuat/mengubah Purchase Request.');
  if(!pelQc.read||!pelQc.update)throw new Error('Pelaksana harus dapat melihat dan memproses temuan QC.');
  console.log('Worker RBAC smoke OK — role aliases, hierarchy, permissions');
} finally {
  try{fs.unlinkSync(tmp);}catch{}
}
