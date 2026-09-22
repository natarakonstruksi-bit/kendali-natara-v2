const classList={add(){},remove(){},toggle(){},contains(){return false}};
const make=()=>({
  classList,style:{},dataset:{},value:'',checked:false,textContent:'',innerHTML:'',
  append(){},appendChild(){},remove(){},addEventListener(){},requestSubmit(){},focus(){},
  setAttribute(){},getAttribute(){return null},files:[],elements:{},querySelector(){return make()}
});
const map=new Map();
const get=sel=>{if(!map.has(sel))map.set(sel,make());return map.get(sel);};
globalThis.document={
  querySelector:get,querySelectorAll(){return [];},createElement(){return make();},
  addEventListener(){},getElementById:id=>get('#'+id)
};
globalThis.location={reload(){}};
globalThis.window=globalThis;
globalThis.KENDALI_TEST_MODE=true;
try {
  await import(new URL('../public/app.js?runtime-smoke=1',import.meta.url));
  await new Promise(r=>setTimeout(r,50));
  const scoped=make();
  const child=make();
  scoped.querySelector=(sel)=>child;
  scoped.querySelectorAll=(sel)=>[child];
  map.set('#modalForm',scoped);
  if(!globalThis.__kendaliDom) throw new Error('DOM helper test hook tidak tersedia.');
  if(globalThis.__kendaliDom.$('.x','#modalForm')!==child) throw new Error('Scoped $ selector gagal untuk root string.');
  if(globalThis.__kendaliDom.$$('.x','#modalForm').length!==1) throw new Error('Scoped $$ selector gagal untuk root string.');
  if(!globalThis.__kendaliQa) throw new Error('QA hook frontend tidak tersedia.');
  const q=globalThis.__kendaliQa;
  if(q.ROLES.includes('Head Operational')) throw new Error('Role legacy masih muncul di dropdown baru.');
  if(q.normalizePositionLabel('Head Operational')!=='Head of Operational') throw new Error('Normalisasi role legacy gagal.');
  if(q.V33_POSITION_GROUPS?.[0]?.[1]?.[0]!=='Head Unit Bisnis') throw new Error('Urutan Head Unit Bisnis tidak paling atas.');
  q.state.user={id:'u-field',name:'Tester'};
  q.state.projects=[{id:'p1',data:{name:'Proyek QA',pmUserId:'u-pm'}}];
  q.state.employees=[{id:'u-pm',name:'PM QA',roleKey:'project_manager'}];
  q.state.access={roleKey:'pelaksana_lapangan',capabilities:{},collections:{procurement:{read:true,create:true,update:true,delete:false}},views:['tasks']};
  if(!q.v34WorkflowButtons('daily_progress',{id:'r1',data:{status:'DRAFT',projectId:'p1'}}).includes('data-v34-action="submit"')) throw new Error('Tombol progress submit tidak dihasilkan.');
  if(!q.v34WorkflowButtons('opname',{id:'o1',data:{status:'DRAFT',projectId:'p1'}}).includes('Kirim Engineering')) throw new Error('Tombol opname submit tidak dihasilkan.');
  if(!q.v34AtiRequestButtons({id:'a1',data:{status:'DRAFT'}}).includes('Ajukan ke ATI')) throw new Error('Tombol workflow ATI tidak dihasilkan.');
  const qcg=q.qcGroupHtml({id:'g1',name:'Pekerjaan Struktur Bawah'},[],true,'p1');
  if(!qcg.includes('data-qc-new-photo')||!qcg.includes('data-qc-add-sub')) throw new Error('Kontrol Tambah Foto / Tambah Item QC tidak dihasilkan.');
  q.state.access={roleKey:'manager_operasional',capabilities:{workflowOversight:true},collections:{procurement:{read:true,create:true,update:true,delete:false},po:{read:true,create:true,update:true,delete:false}},views:['tasks']};
  if(!q.v34WorkflowButtons('daily_progress',{id:'r2',data:{status:'PM_APPROVED',projectId:'p1'}}).includes('operational-review')) throw new Error('Tombol review Head of Operational tidak dihasilkan.');
  q.state.access={roleKey:'head_unit_bisnis',capabilities:{financeApprove:true,financePay:true,ccoFieldSubmit:true,ccoAdmin:true,ccoQs:true,ccoEscalation:true,procurementVendorSelect:true,procurementOrder:true,workflowOversight:true},collections:{payment_requests:{read:true,create:true,update:true,delete:true},cco:{read:true,create:true,update:true,delete:true},procurement:{read:true,create:true,update:true,delete:true},po:{read:true,create:true,update:true,delete:true}},views:['tasks','cco','fund_requests','procurement']};
  if(!q.fundButtons({id:'f1',data:{status:'PENDING'}}).includes('data-fund-action="approve"')) throw new Error('Tombol approval pengajuan dana tidak dihasilkan.');
  if(!q.ccoButtons({id:'c1',data:{status:'SUBMITTED_TO_ADMIN'}}).includes('send-qs')) throw new Error('Tombol CCO Admin → QS tidak dihasilkan.');
  if(!q.v31PrActions({id:'pr1',data:{status:'READY_FOR_APPROVAL',requesterUserId:'u-pm'}}).includes('data-pr-select')) throw new Error('Tombol pemilihan vendor PR tidak dihasilkan.');
  console.log('Frontend runtime smoke OK — selectors, role normalization, workflow button generators OK');
} catch (e) {
  console.error(e?.stack||e);
  process.exit(1);
}
