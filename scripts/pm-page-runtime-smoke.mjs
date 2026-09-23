import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const mustApp=[
  "renderQc=async function(){await v33BaseRenderQc();if(!canCollection('qc_reports','read'))return;",
  "const poPromise=canCollection('po','read')?loadCollection('po',Boolean(state.selectedProjectId)):Promise.resolve([]);",
  "state.v31Vendors=[];"
];
for(const m of mustApp) if(!app.includes(m)) throw new Error(`PM page runtime guard missing: ${m}`);
const forbidden=[
  "renderQc=async function(){await v33BaseRenderQc();const reports=await loadCollection('qc_reports',false);",
  "state.v31Vendors=await loadCollection('vendor',false); const [prs,pos]=await Promise.all([loadCollection('procurement'"
];
for(const m of forbidden) if(app.includes(m)) throw new Error(`Legacy unconditional PM page load still present: ${m}`);
if(!worker.includes('project_manager: ["dashboard","tasks","projects","fund_requests","progress","opname","asbuilt","qc","cco","procurement","documents","flow","closeout"]')) throw new Error('PM menu access missing.');
if(!worker.includes('if (collection === "procurement") return allow(["manager_operasional","koordinator_engineering","admin_teknik","project_manager"')) throw new Error('PM procurement record read missing.');
if(!worker.includes('if (collection === "qc_inspection_sessions") return allow(["manager_operasional","koordinator_engineering","koordinator_supporting","admin_teknik","project_manager"')) throw new Error('PM QC session read missing.');
if(!app.includes("function v345CanVendorCompare(){return v34RoleCan('project_manager'")) throw new Error('PM vendor comparison frontend permission missing.');
if(app.includes("loadCollection('vendor',false)")) throw new Error('PR page masih bergantung pada master vendor.');
if(!app.includes('pv-vendor-name')) throw new Error('Input nama vendor bebas belum tersedia.');
console.log('PM page runtime smoke OK — QC access safe; PR vendor uses free-text names without vendor master dependency.');
