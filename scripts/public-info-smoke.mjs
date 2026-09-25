import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const worker=fs.readFileSync(path.join(root,'src/worker.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/public.html'),'utf8');
const js=fs.readFileSync(path.join(root,'public/public.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/public.css'),'utf8');
const migration=fs.readFileSync(path.join(root,'migrations/0021_public_company_profile_seed.sql'),'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const has=(t,n,m=n)=>must(t.includes(n),`Public info marker hilang: ${m}`);

for(const m of ['TENTANG NATARA','NILAI-NILAI PERUSAHAAN','LAYANAN KAMI','PENDEKATAN KERJA','SEGMENTASI KLIEN','PORTOFOLIO'])has(html,m);
for(const m of ['DEFAULTS','Membangun dengan Arah.','valueGrid','serviceGrid','approachList','specsHtml','openDetail'])has(js,m);
for(const m of ['galleryUrls:[...documentGallery,...staticGallery]','specs:(d.specs','serviceGroups:asList(d.serviceGroups','advantages:asList(d.advantages'])has(worker,m);
for(const m of ['CP-LOSARI','CP-ESPANA','CP-KOST-SAMATA','CP-YD-CAFE','CP-NORDIC','CP-AMIRULLAH','CP-RD-HOUSE'])has(migration,m);
for(const rel of ['losari-cover.webp','espana-cover.webp','kost-samata-cover.webp','yd-cafe-cover.webp','nordic-cover.webp','amirullah-cover.webp','rd-house-cover.webp'])must(fs.existsSync(path.join(root,'public/assets/company-profile',rel)),`Asset portofolio hilang: ${rel}`);
has(css,'.portfolio-grid');has(css,'.value-grid');has(css,'.detail-specs');
console.log('Public information website smoke OK — company profile sections, portfolio seed, static media, and detail UI wired.');
