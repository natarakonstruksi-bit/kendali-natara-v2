import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const must=[
  'site_manager: ["dashboard","tasks","projects","payments","directory","fund_requests","progress","opname","asbuilt","qc","cco","procurement","ati","documents","flow","closeout"]',
  'if (collection === "procurement") return allow(["manager_operasional","koordinator_engineering","admin_teknik","site_manager","procurement","finance"]',
  'if (collection === "qc_inspection_sessions") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager"',
  'if (collection === "defects") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","site_manager"',
  '["project manager / superintendent","site_manager"]',
  'input?.position, input?.jabatan, input?.role, input?.roleKey'
];
for(const x of must) if(!worker.includes(x)) throw new Error(`PM access marker missing: ${x}`);
console.log('PM access smoke OK — Procurement + QC visible/readable, role resolution hardened');
