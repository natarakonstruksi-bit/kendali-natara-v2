import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const tmp=path.join(os.tmpdir(),`nara-qc-route-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { buildAccess, collectionPermission, normalizeQcVisitRoute };\n');
try{
  const m=await import(pathToFileURL(tmp).href+'?v=3416');
  for(const role of ['QC','Head of Supporting','Head of Operational']){
    const a=m.buildAccess({id:'x',role});const p=a.collections.qc_visit_routes;
    must(a.capabilities.qcRouteManage,`${role} harus dapat mengelola Rute Kunjungan QC`);
    must(p.read&&p.create&&p.update&&p.delete,`${role} harus CRUD qc_visit_routes`);
  }
  for(const role of ['Project Manager','Pelaksana Lapangan']){
    const a=m.buildAccess({id:'x',role});const p=a.collections.qc_visit_routes;
    must(!a.capabilities.qcRouteManage&&p.read&&!p.create&&!p.update&&!p.delete,`${role} hanya boleh melihat Rute Kunjungan QC`);
  }
  const projects={P1:{id:'P1',data_json:'{"name":"A"}'}};
  const users={Q1:{id:'Q1',data_json:'{"role":"QC"}'},PM:{id:'PM',data_json:'{"role":"Project Manager"}'}};
  const env={DB:{prepare:sql=>({bind:(...a)=>({first:async()=>{if(/collection='projects'|collection=\?/.test(sql)){const id=a.find(x=>projects[x]||users[x]);return projects[id]||users[id]||null;}return null;},all:async()=>({results:[]})}),first:async()=>null,all:async()=>({results:[]})})}};
  const ok=await m.normalizeQcVisitRoute(env,{projectId:'P1',days:'5,1,1,9',time:'08:30',order:0,status:'aktif'});
  must(JSON.stringify(ok.days)==='[1,5]','Hari harus unik, terurut, 1..7');
  must(ok.recurrence==='WEEKLY'&&ok.status==='ACTIVE'&&ok.order===1,'Default rute mingguan aktif');
  for(const bad of [{projectId:'',days:[1]},{projectId:'P1',days:[]},{projectId:'P1',days:[1],time:'7pm'},{projectId:'NOPE',days:[1]}]){
    let threw=false;try{await m.normalizeQcVisitRoute(env,bad);}catch{threw=true;} must(threw,`Input invalid harus ditolak: ${JSON.stringify(bad)}`);
  }
  for(const mk of ['"qc_visit_routes"','normalizeQcVisitRoute(env,d)','qcRouteManage']) must(worker.includes(mk),`Backend marker hilang: ${mk}`);
  for(const mk of ['Rute Kunjungan QC','openQcRouteForm','toggleQcRoute','deleteQcRoute','startQcFromRoute','data-qc-route-edit','data-qc-route-delete','data-qc-route-toggle','/api/records/qc_visit_routes']) must(app.includes(mk),`Frontend marker hilang: ${mk}`);
  must(css.includes('.qc-route-week'),'CSS rute hilang');
  must(fs.existsSync(path.join(root,'migrations/0022_qc_visit_routes.sql')),'Migration 0022 hilang');
  console.log('QC visit route smoke OK — weekly recurring route, CRUD for QC/Head of Supporting, read-only PM/Pelaksana, validation active.');
} finally { try{fs.unlinkSync(tmp)}catch{} }
