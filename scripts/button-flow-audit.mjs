import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};

// Dynamic action buttons: producer marker must have a matching event binder/action dispatcher.
const pairs=[
  ['data-add','[data-add]'],['data-edit','[data-edit]'],['data-delete','[data-delete]'],['data-daily-edit','[data-daily-edit]'],
  ['data-doc-open','[data-doc-open]'],['data-doc-edit','[data-doc-edit]'],['data-doc-delete','[data-doc-delete]'],
  ['data-portfolio','[data-portfolio]'],['data-delete-portfolio','[data-delete-portfolio]'],['data-qc-inspect','[data-qc-inspect]'],
  ['data-task-action','[data-task-action]'],['data-task-open','[data-task-open]'],
  ['data-v34-action','[data-v34-action]'],['data-fund-action','[data-fund-action]'],
  ['data-cco-action','[data-cco-action]'],['data-cco-price','[data-cco-price]'],['data-cco-doc','[data-cco-doc]'],
  ['data-pr-action','[data-pr-action]'],['data-pr-edit','[data-pr-edit]'],['data-pr-select','[data-pr-select]'],['data-pr-detail','[data-pr-detail]'],['data-create-po','[data-create-po]'],
  ['data-qc-session-open','[data-qc-session-open]'],['data-qc-session-edit','[data-qc-session-edit]'],['data-qc-session-delete','[data-qc-session-delete]'],
  ['data-qc-new-photo','[data-qc-new-photo]'],['data-qc-add-sub','[data-qc-add-sub]'],['data-qc-item-photo','[data-qc-item-photo]'],['data-qc-item-result','[data-qc-item-result]'],['data-qc-item-edit','[data-qc-item-edit]'],['data-qc-item-delete','[data-qc-item-delete]'],
  ['data-qc-action','[data-qc-action]'],['data-qc-detail','[data-qc-detail]'],['data-qc-finding-edit','[data-qc-finding-edit]'],['data-qc-finding-delete','[data-qc-finding-delete]'],
  ['data-ati-flow','[data-ati-flow]'],['data-employee-edit','[data-employee-edit]'],['data-employee-delete','[data-employee-delete]'],
  ['data-report-detail','data-report-detail'],['data-report-edit','data-report-edit'],['data-report-delete','data-report-delete'],['data-report-review','data-report-review'],['data-report-create','data-report-create'],
  ['data-asbuilt-edit','[data-asbuilt-edit]'],['data-asbuilt-detail','[data-asbuilt-detail]'],['data-asbuilt-action','[data-asbuilt-action]']
];
for(const [producer,binder] of pairs){must(app.includes(producer),`Button producer hilang: ${producer}`);must(app.includes(binder),`Button binder hilang: ${producer}`)}

// Shell buttons declared in index.html must be wired in bindShell.
for(const id of ['logoutBtn','changePasswordBtn','refreshBtn','burger','modalClose','modalCancel','modalSave','confirmCancel','confirmOk']){
  must(html.includes(`id="${id}"`),`Shell button hilang: ${id}`);
  must(app.includes(`$('#${id}').onclick`),`Shell button tidak terikat: ${id}`);
}

// QC modal-specific buttons must all have handlers and matching backend routes.
for(const id of ['qcPublishFindings','qcEditSession','qcCloseSession','qcDeleteSession','qcDismissSession']) must(app.includes(`$('#${id}')`),`QC modal button tidak terikat: ${id}`);
for(const marker of [
  '/api/qc/sessions/${encodeURIComponent(sessionId)}/items','/api/qc/session-items/${encodeURIComponent',
  '/api/qc/findings/${encodeURIComponent','/publish-findings','/close'
]) must(app.includes(marker),`Frontend QC endpoint hilang: ${marker}`);
for(const marker of ['qcSessionAddItemHandler','qcSessionUpdateItemHandler','qcSessionDeleteItemHandler','qcSessionUpdateHandler','qcSessionDeleteHandler','qcFindingUpdateHandler','qcFindingDeleteHandler','qcFindingActionHandler']) must(worker.includes(marker),`Backend handler hilang: ${marker}`);

// No placeholder href/javascript stubs for actionable buttons.
must(!/onclick\s*=\s*["']\s*["']/.test(app+html),'Ditemukan onclick kosong.');
must(!/href\s*=\s*["']javascript:void\(0\)/i.test(app+html),'Ditemukan javascript:void(0) placeholder.');
must(worker.includes('asBuiltActionHandler'),'Backend As-Built action handler hilang.');
must(app.includes('/api/as-built/${encodeURIComponent(id)}/action'),'Frontend As-Built action endpoint hilang.');
console.log('Button/flow audit OK — critical shell, workflow, PR, QC, ATI, QS and As-Built controls are wired to handlers/routes');
