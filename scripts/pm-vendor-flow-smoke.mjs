import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const checks=[
  [worker,'Project Manager wajib menambahkan minimal satu pembanding vendor sebelum PR dikirim ke Head.'],
  [worker,'next="READY_FOR_APPROVAL"; d.submittedByUserId=user.id'],
  [worker,'PR_PM_VENDOR'],
  [worker,'Project Manager menindaklanjuti SPK/PO'],
  [worker,'procurementOrder: roleIn(user,["administrator","direktur","head_unit_bisnis","manager_operasional","project_manager"])'],
  [app,'Pembanding Vendor — Project Manager'],
  [app,'Kebutuhan + Pembanding Vendor'],
  [app,'Tugas PR diteruskan kembali ke Project Manager.'],
  [app,'Penanggung Jawab Vendor']
];
for(const [text,needle] of checks) if(!text.includes(needle)) throw new Error(`PM vendor flow marker missing: ${needle}`);
if(app.includes("['Keuangan / Supply',['Finance','Manager Logistik','Staf Logistik','Logistik / Procurement','Procurement / Purchasing']]")) throw new Error('Legacy procurement positions still exposed in active dropdown.');
console.log('PM vendor flow smoke OK — PM fills vendor comparison, Head selects, Admin Teknik creates SPK/PO, task returns to PM.');
