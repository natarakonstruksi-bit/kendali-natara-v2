import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
// Backend: Tugas Saya tidak lagi sinkron per-record di setiap request.
must(worker.includes('WORKFLOW_BACKFILL_INTERVAL_MS'),'Backfill Tugas Saya harus dibatasi frekuensinya');
must(worker.includes('await env.DB.batch(stmts.slice(k,k+100))'),'Backfill harus memakai batch write');
must(/ctx\?\.projects \? ctx\.projects\.get/.test(worker),'workflowTaskSpec harus memakai cache proyek saat backfill');
must(!/ORDER BY updated_at DESC LIMIT 2500/.test(worker),'Limit 2500 lama (tugas lama hilang) masih ada');
must(worker.includes('"/api/tasks/count"')&&worker.includes('async function countMyWorkflowTasks'),'Endpoint hitung badge ringan hilang');
must(worker.includes('function groupRowsByProject')&&worker.includes('const groups = groupRowsByProject(all);'),'Dashboard harus mengelompokkan data per proyek sekali');
must(worker.includes('const scopeIds=isProjectScopedRole(user)?await accessibleProjectIds(env,user):null;'),'Daftar sesi QC tidak boleh N+1 per baris');
// Frontend: perpindahan menu tidak menunggu badge; load aman & dedupe.
must(app.includes("refreshTaskBadge=function(){clearTimeout(v3418BadgeTimer)")&&app.includes("api('/api/tasks/count')"),'Badge Tugas Saya harus non-blocking memakai /api/tasks/count');
must(app.includes('const perm=state.access?.collections?.[c];if(perm&&!perm.read)return [];'),'loadCollection harus aman terhadap koleksi tanpa hak baca');
must(app.includes('v3418Inflight'),'Request identik bersamaan harus digabung');
must(app.includes('const V3418_MAX_ROWS=200;')&&app.includes('v3418Visible(daily)'),'Tabel besar harus dibatasi baris render');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
must(html.includes('/app.js?v=3.4.39')&&html.includes('/styles.css?v=3.4.39'),'Asset harus memakai versi (cache busting)');
console.log('Performance smoke OK — Tugas Saya bulk+throttled, badge non-blocking, dashboard O(n), safe/deduped loads, capped tables, versioned assets.');
