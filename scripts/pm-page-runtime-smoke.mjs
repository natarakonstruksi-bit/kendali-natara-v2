import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const mustApp=[
  "renderQc=async function(){await v33BaseRenderQc();if(!canCollection('qc_reports','read'))return;",
  "const vendorPromise=canCollection('vendor','read')?loadCollection('vendor',false):Promise.resolve([]);",
  "const poPromise=canCollection('po','read')?loadCollection('po',Boolean(state.selectedProjectId)):Promise.resolve([]);",
  "state.v31Vendors=(v345CanVendorCompare()&&canCollection('vendor','read'))?await loadCollection('vendor',false):[];"
];
for(const m of mustApp) if(!app.includes(m)) throw new Error(`PM page runtime guard missing: ${m}`);
const forbidden=[
  "renderQc=async function(){await v33BaseRenderQc();const reports=await loadCollection('qc_reports',false);",
  "state.v31Vendors=await loadCollection('vendor',false); const [prs,pos]=await Promise.all([loadCollection('procurement'"
];
for(const m of forbidden) if(app.includes(m)) throw new Error(`Legacy unconditional PM page load still present: ${m}`);
if(!worker.includes('project_manager: ["dashboard","tasks","projects","fund_requests","progress","opname","qc","cco","procurement","documents","flow","closeout"]')) throw new Error('PM menu access missing.');
if(!worker.includes('if (collection === "procurement") return allow(["manager_operasional","koordinator_engineering","admin_teknik","project_manager"')) throw new Error('PM procurement record read missing.');
if(!worker.includes('if (collection === "qc_inspection_sessions") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","project_manager"')) throw new Error('PM QC session read missing.');
console.log('PM page runtime smoke OK — QC skips restricted report archive; Procurement skips restricted vendor/PO dependencies.');
