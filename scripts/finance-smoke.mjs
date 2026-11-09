import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const tmp=path.join(os.tmpdir(),`nara-fin-${process.pid}.mjs`);
fs.writeFileSync(tmp,worker+'\nexport { normalizeContractFields, collectionPermission, buildAccess, workflowTaskSpec, PAYMENT_CATEGORIES };\n');
try{
  const m=await import(pathToFileURL(tmp).href+'?v=3424');
  const d={partnerType:'subkon',retentionPct:30,terms:[{label:'DP',percent:30},{label:'Progres 70%',percent:40},{label:'Kosong',percent:0},{label:'Akhir',percent:30}]};
  m.normalizeContractFields(d); must(d.partnerType==='SUBKON'&&d.retentionPct===20&&d.terms.length===3&&d.terms[2].no===3,'Normalisasi kontrak SPK salah');
  let threw=false;try{m.normalizeContractFields({terms:[{percent:60},{percent:50}]})}catch{threw=true} must(threw,'Termin > 100% harus ditolak');
  must(m.PAYMENT_CATEGORIES.join()==='VENDOR,SUBKON,TUKANG,MATERIAL','Kategori pembayaran salah');
  const env={DB:{prepare:()=>({bind:()=>({first:async()=>null,all:async()=>({results:[]}),run:async()=>({})}),first:async()=>null,all:async()=>({results:[]})})}};
  const U=r=>({id:'U-'+r,roleKey:r,role:r});
  const sm=m.buildAccess(U('site_manager')).capabilities, ops=m.buildAccess(U('manager_operasional')).capabilities, fin=m.buildAccess(U('finance')).capabilities, hub=m.buildAccess(U('head_unit_bisnis')).capabilities, at=m.buildAccess(U('admin_teknik')).capabilities;
  must(sm.partnerPaymentCreate&&!sm.partnerPaymentOpsApprove&&!sm.financePay,'Site Manager hanya boleh mengajukan');
  must(ops.partnerPaymentOpsApprove&&!ops.partnerPaymentHubApprove&&!ops.financePay,'Head of Operational ACC tahap 1 saja');
  must(hub.partnerPaymentHubApprove,'Head Unit Bisnis wajib bisa ACC material besar');
  must(fin.financePay&&!fin.partnerPaymentOpsApprove&&!fin.partnerPaymentCreate,'Finance hanya verifikasi & bayar');
  must(at.termBill&&at.contractManage&&!at.financePay,'Admin Teknik menagih termin & atur SPK, bukan membayar');
  const pp=m.collectionPermission(U('site_manager'),'partner_payments'); must(pp.read&&!pp.create&&!pp.update&&!pp.delete,'partner_payments hanya boleh lewat endpoint alur, bukan CRUD generik');
  const pt=m.collectionPermission(U('finance'),'project_terms'); must(pt.read&&!pt.create,'Finance tidak menyusun termin (Admin Teknik)');
  for(const [st,stage,role] of [['SUBMITTED','PAY_OPS_APPROVE','manager_operasional'],['OPS_APPROVED','PAY_HUB_APPROVE','head_unit_bisnis'],['APPROVED','PAY_FINANCE','finance']]){
    const spec=await m.workflowTaskSpec(env,'partner_payments','X',{status:st,projectId:'P1',category:'MATERIAL',partnerName:'TB',netAmount:1,requesterUserId:'U1'});
    const s=Array.isArray(spec)?spec[0]:spec; must(s&&s.stage===stage&&s.assigneeRole===role,`Tugas ${st} harus ke ${role}`);
  }
  const t=await m.workflowTaskSpec(env,'project_terms','T',{status:'BILLED',projectId:'P1',label:'Termin 1',netAmount:1}); must((Array.isArray(t)?t[0]:t)?.stage==='TERM_RECEIVE','Termin ditagih harus jadi tugas Finance');
  for(const mk of ['/api/finance/summary','/api/finance/payments','finTermMatch','/api/finance/contracts','/api/finance/payroll-preview','PP-${id}','TERM-${id}','materialHubThreshold']) must(worker.includes(mk),`Backend marker hilang: ${mk}`);
  for(const mk of ['renderPayments','openFinPayroll','openFinMaterial','openFinContractPayment','openFinContractForm','openFinPay','openTermBill','openTermReceive','payments:renderPayments']) must(app.includes(mk),`Frontend marker hilang: ${mk}`);
  must(html.includes('data-view="payments"'),'Menu Pembayaran Proyek hilang');
  console.log('Finance smoke OK — kontrak SPK & termin, hak akses per role, alur tugas Ops → HUB → Finance, termin client.');
} finally { try{fs.unlinkSync(tmp)}catch{} }
