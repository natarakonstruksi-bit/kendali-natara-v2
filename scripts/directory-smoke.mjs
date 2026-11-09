import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const tmp=path.join(os.tmpdir(),`nara-dir-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { buildAccess, collectionPermission, normalizePartner, partyInUse, partyDuplicate };\n');
try{
  const m=await import(pathToFileURL(tmp).href+'?v=3425');
  const U=r=>({id:'U-'+r,roleKey:r,role:r});
  must(m.buildAccess(U('site_manager')).views.includes('directory'),'Site Manager harus bisa membuka Database Mitra');
  must(m.buildAccess(U('finance')).capabilities.directoryMerge&&m.buildAccess(U('manager_operasional')).capabilities.directoryMerge,'Finance & Head of Operational menggabungkan duplikat');
  must(!m.buildAccess(U('site_manager')).capabilities.directoryMerge,'Site Manager tidak boleh menggabungkan data');
  const t=m.collectionPermission(U('site_manager'),'tukang'); must(t.read&&t.create&&t.update&&!t.delete,'Site Manager boleh tambah/edit tukang, tidak menghapus');
  const p=m.normalizePartner({partnerType:'SUPPLIER',name:' TB Sinar ',aliases:['Toko Sinar'],notes:'x'}); must(p.name==='TB Sinar'&&p.aliases[0]==='Toko Sinar'&&p.notes==='x','Alias/catatan pihak harus tersimpan');
  const env=used=>({DB:{prepare:()=>({bind:()=>({first:async()=>({n:used?2:0}),all:async()=>({results:[{id:'TK-1',data_json:JSON.stringify({name:'Udin Saputra',phone:'0812'})}]})})})}});
  must(/Nonaktif/.test(await m.partyInUse(env(true),'partners','PTN-1')),'Pihak yang sudah dipakai tidak boleh dihapus');
  must(await m.partyInUse(env(false),'partners','PTN-1')==='','Pihak tanpa transaksi boleh dihapus');
  must(/sudah terdaftar/.test(await m.partyDuplicate(env(false),'tukang','',{name:'udin  saputra',phone:'0812'})),'Tukang dobel harus ditolak');
  must(await m.partyDuplicate(env(false),'tukang','',{name:'Udin Saputra',phone:'0899'})==='','Nama sama dengan HP berbeda boleh (orang berbeda)');
  for(const mk of ['/api/finance/directory/merge','partyHistoryHandler','PARTY_COLLECTIONS.has(collection)','unlinked:!master']) must(worker.includes(mk),`Backend marker hilang: ${mk}`);
  for(const mk of ['renderDirectory','openTukangForm','openPartnerForm','openMergeForm','openPartyDetail','v31NewWorker','directory:renderDirectory']) must(app.includes(mk),`Frontend marker hilang: ${mk}`);
  must(html.includes('data-view="directory"'),'Menu Database Mitra hilang');
  console.log('Directory smoke OK — Database Mitra, hak akses, cegah duplikat & hapus data terpakai, gabung, tukang baru dari absensi.');
} finally { try{fs.unlinkSync(tmp)}catch{} }
