import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
for(const x of ['data-view="asbuilt"','QS / Volume'])must(html.includes(x),`Menu hilang: ${x}`);
for(const x of ['Volume RAB','Volume Realisasi','Progress As-Built','Arsitektur %','Struktur %','MEP %','Overall Progress','data-asbuilt-edit','data-asbuilt-action','saveAsBuiltFile'])must(app.includes(x),`Frontend QS/AsBuilt hilang: ${x}`);
for(const x of ['"as_built_progress"','asBuiltActionHandler','READY FOR APPROVAL','ASBUILT_DRAFTER','ASBUILT_ENGINEERING','Drafter hanya dapat upload dokumen kategori AS_BUILT','Proyek belum memiliki QS'])must(worker.includes(x),`Backend QS/AsBuilt hilang: ${x}`);
// Overall harus rata-rata 3 disiplin, contoh screenshot 60+80+0 = 46.67 => 47.
must(app.includes('Math.round((asBuiltPct(d.architectureProgress)+asBuiltPct(d.structureProgress)+asBuiltPct(d.mepProgress))/3)'), 'Formula overall As-Built bukan rata-rata 3 disiplin.');
console.log('QS + As-Built smoke OK — simplified QS volumes, 3-discipline progress, uploads and approval workflow wired');
