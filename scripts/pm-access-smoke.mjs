import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const must=[
  'project_manager: ["dashboard","tasks","projects","fund_requests","progress","opname","asbuilt","qc","cco","procurement","documents","flow","closeout"]',
  'if (collection === "procurement") return allow(["manager_operasional","koordinator_engineering","admin_teknik","project_manager","pelaksana_lapangan","procurement","finance"]',
  'if (collection === "qc_inspection_sessions") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","project_manager"',
  'if (collection === "defects") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","project_manager"',
  '["project manager / superintendent","project_manager"]',
  'input?.position, input?.jabatan, input?.role, input?.roleKey'
];
for(const x of must) if(!worker.includes(x)) throw new Error(`PM access marker missing: ${x}`);
console.log('PM access smoke OK — Procurement + QC visible/readable, role resolution hardened');
