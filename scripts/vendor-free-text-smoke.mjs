import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
for(const needle of ['Ketik nama vendor','pv-vendor-name',"vendorId:'',vendorName:$('.pv-vendor-name',r).value.trim()",'Quotation (Opsional)']){if(!app.includes(needle))throw new Error(`Vendor free-text marker missing: ${needle}`);}
if(app.includes('<select class="pv-vendor">'))throw new Error('Legacy vendor dropdown masih aktif.');
if(app.includes("loadCollection('vendor',false)"))throw new Error('Frontend PR masih memuat master vendor.');
if(!worker.includes('vendorName:String(x.vendorName||"")'))throw new Error('Backend tidak mempertahankan vendorName free text.');
console.log('Vendor free-text smoke OK — vendor name is typed directly; no vendor master preload required.');
