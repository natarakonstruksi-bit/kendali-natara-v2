import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
function must(c,m){if(!c)throw new Error(m)}
for(const m of ['Before & After','qcEvidencePanel','Foto before belum tersedia','Foto after belum tersedia','qc-finding-detail-modal','lastFixDocumentId','beforeDocumentId']) must(app.includes(m),`Frontend marker hilang: ${m}`);
for(const m of ['.qc-ba-grid','.qc-ba-card.before','.qc-ba-card.after','.qc-ba-image-link']) must(css.includes(m),`CSS marker hilang: ${m}`);
must(worker.includes('Bukti hasil perbaikan harus berupa foto/gambar.'),'Backend belum memvalidasi foto after.');
must(app.includes('Foto Hasil Perbaikan / After<input type="file" name="file" accept="image/*" required>'),'Input after belum image-only.');
console.log('QC before/after smoke OK — dua panel foto, fallback, dan validasi after aktif');
