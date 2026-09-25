const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let portfolio=[];

const DEFAULTS={
  title:'Natara Konstruksi',
  tagline:'Membangun dengan Arah.',
  about:'Natara Konstruksi adalah perusahaan jasa konstruksi yang berfokus pada pembangunan yang terencana, terarah, dan bertanggung jawab. Kami hadir sebagai mitra pembangunan bagi klien yang menghargai proses, kejelasan kerja, dan kualitas jangka panjang.',
  philosophy:'Menata pembangunan dengan arah yang jelas dan tanggung jawab penuh.',
  vision:'Menjadi perusahaan konstruksi yang terpercaya dan berkelanjutan melalui sistem kerja yang terarah, profesional, dan bertanggung jawab.',
  mission:['Menyediakan layanan konstruksi yang terencana, terukur, dan sesuai standar teknis.','Menjaga amanah klien melalui transparansi biaya, waktu, dan proses kerja.','Mengedepankan pengawasan dan pengendalian mutu di setiap proyek.','Membangun hubungan jangka panjang dengan klien dan mitra kerja.'],
  values:[
    {title:'Amanah',description:'Menjalankan setiap proyek dengan kejujuran dan tanggung jawab.'},
    {title:'Terstruktur',description:'Bekerja dengan sistem, perencanaan, dan alur kerja yang jelas.'},
    {title:'Profesional',description:'Didukung oleh tim dan proses yang rapi serta berorientasi pada kualitas.'},
    {title:'Berkelanjutan',description:'Fokus pada hasil jangka panjang, bukan sekadar penyelesaian cepat.'}
  ],
  serviceGroups:[
    {title:'Jasa Konstruksi',items:['Pembangunan rumah tinggal','Bangunan komersial & usaha','Bangunan pendukung lainnya']},
    {title:'Renovasi & Pengembangan',items:['Renovasi bangunan eksisting','Pengembangan fungsi dan kualitas bangunan']},
    {title:'Manajemen Proyek',items:['Perencanaan dan pengendalian proyek','Pengawasan pelaksanaan di lapangan','Koordinasi dengan konsultan dan klien']}
  ],
  approach:[
    {title:'Perencanaan',description:'Analisis kebutuhan, penyusunan konsep, dan perhitungan teknis.'},
    {title:'Penataan & Persiapan',description:'Penyusunan anggaran, timeline, dan metode kerja.'},
    {title:'Pelaksanaan & Pengawasan',description:'Pekerjaan lapangan dengan kontrol mutu dan progres yang ketat.'},
    {title:'Evaluasi & Serah Terima',description:'Pemeriksaan hasil akhir dan penyelesaian proyek secara bertanggung jawab.'}
  ],
  advantages:['Proses kerja jelas dan terstruktur','Fokus pada perencanaan dan pengawasan','Transparansi dalam komunikasi dan anggaran','Komitmen terhadap amanah dan kualitas'],
  audience:['Ingin membangun dengan tenang','Menghargai proses dan kejelasan kerja','Berorientasi pada kualitas jangka panjang'],
  closing:'Natara Konstruksi hadir untuk menjawab kebutuhan pembangunan yang tidak hanya kuat secara fisik, tetapi juga dapat dipertanggungjawabkan secara proses dan nilai.',
  portfolioIntro:'Portofolio karya Natara Konstruksi dari hunian, usaha, hingga proyek pengembangan bangunan.'
};

async function get(url){
  const r=await fetch(url,{headers:{accept:'application/json'}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'Informasi tidak dapat dimuat.');
  return j;
}
function arr(v,fallback=[]){return Array.isArray(v)?v:fallback;}
function setLink(el,url,label){if(!el)return;if(!url){el.classList.add('hidden');return;}el.href=url;el.classList.remove('hidden');if(label)el.textContent=label;}
function imageCount(p){return (p.coverUrl?1:0)+(p.galleryUrls?.length||0);}
function card(p){return `<article class="portfolio-card" data-slug="${esc(p.slug)}" tabindex="0" role="button" aria-label="Lihat ${esc(p.title)}">
  <div class="portfolio-cover ${p.coverUrl?'':'no-image'}">${p.coverUrl?`<img loading="lazy" src="${esc(p.coverUrl)}" alt="${esc(p.title)}">`:'<div class="cover-mark">N</div>'}${p.featured?'<span class="featured">Pilihan</span>':''}</div>
  <div class="portfolio-body">
    <div class="portfolio-meta"><span>${esc(p.category||'Konstruksi')}</span>${p.year?`<span>${esc(p.year)}</span>`:''}</div>
    <h3>${esc(p.title)}</h3>
    ${p.location?`<div class="portfolio-location">${esc(p.location)}</div>`:''}
    <p>${esc(p.summary||'')}</p>
    <div class="portfolio-foot"><span>${imageCount(p)} foto</span><strong>Lihat proyek <span>↗</span></strong></div>
  </div>
</article>`;}
function populateCategories(){
  const select=$('#categoryFilter'); const current=select.value;
  const cats=[...new Set(portfolio.map(p=>String(p.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  select.innerHTML='<option value="">Semua kategori</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cats.includes(current))select.value=current;
}
function render(){
  const q=$('#searchInput').value.toLowerCase().trim(); const cat=$('#categoryFilter').value;
  const rows=portfolio.filter(p=>(!q||[p.title,p.category,p.location,p.year,p.summary].join(' ').toLowerCase().includes(q))&&(!cat||p.category===cat));
  $('#portfolioGrid').innerHTML=rows.map(card).join(''); $('#emptyState').classList.toggle('hidden',rows.length>0);
  $$('[data-slug]').forEach(el=>{el.onclick=()=>openDetail(el.dataset.slug);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(el.dataset.slug);}};});
}
function renderProfile(site){
  const s={...DEFAULTS,...site};
  $('#siteTitle').textContent=s.title||DEFAULTS.title;
  $('#siteTagline').textContent=s.tagline||DEFAULTS.tagline;
  $('#siteAbout').textContent=s.about||DEFAULTS.about;
  $('#sitePhilosophy').textContent=s.philosophy||DEFAULTS.philosophy;
  $('#siteVision').textContent=s.vision||DEFAULTS.vision;
  $('#siteClosing').textContent=s.closing||DEFAULTS.closing;
  $('#closingTitle').textContent=s.tagline||DEFAULTS.tagline;
  $('#siteAddress').textContent=s.address||'-';
  $('#siteContactText').textContent=s.contactLabel||'Natara Konstruksi';
  $('#portfolioIntro').textContent=s.portfolioIntro||DEFAULTS.portfolioIntro;
  const mission=arr(s.mission,DEFAULTS.mission); $('#missionList').innerHTML=mission.map(x=>`<li>${esc(x)}</li>`).join('');
  const values=arr(s.values,DEFAULTS.values); $('#valueGrid').innerHTML=values.map((v,i)=>`<article class="value-card"><span class="num">0${i+1}</span><h3>${esc(v.title||'Nilai Natara')}</h3><p>${esc(v.description||'')}</p></article>`).join('');
  const groups=arr(s.serviceGroups,DEFAULTS.serviceGroups); $('#serviceGrid').innerHTML=groups.map((g,i)=>`<article class="service-card"><div class="icon">0${i+1}</div><h3>${esc(g.title||'Layanan')}</h3><ul>${arr(g.items).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></article>`).join('');
  const approach=arr(s.approach,DEFAULTS.approach); $('#approachList').innerHTML=approach.map((a,i)=>`<article class="approach-item"><span class="step">0${i+1}</span><div><h3>${esc(a.title||'Tahap')}</h3><p>${esc(a.description||'')}</p></div></article>`).join('');
  $('#advantageList').innerHTML=arr(s.advantages,DEFAULTS.advantages).map(x=>`<li>${esc(x)}</li>`).join('');
  $('#audienceList').innerHTML=arr(s.audience,DEFAULTS.audience).map(x=>`<li>${esc(x)}</li>`).join('');
  setLink($('#navContact'),s.contactUrl,s.contactLabel||'Hubungi Kami');
  setLink($('#heroContact'),s.contactUrl,s.contactLabel||'Hubungi Natara');
  setLink($('#aboutContact'),s.contactUrl,s.contactLabel||'Hubungi Natara');
  setLink($('#closingContact'),s.contactUrl,s.contactLabel||'Hubungi Natara');
  setLink($('#instagramLink'),s.instagramUrl,'Instagram');
}
function specsHtml(specs){
  const entries=[['Luas Tanah',specs?.landArea],['Luas Bangunan',specs?.buildingArea],['Lantai',specs?.floors],['Kamar',specs?.bedrooms],['Kamar Mandi',specs?.bathrooms],['Carport',specs?.carport]].filter(([,v])=>v!==undefined&&v!==null&&String(v)!=='');
  if(!entries.length)return '';
  return `<div class="detail-specs">${entries.map(([k,v])=>`<div class="spec-card"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
}
async function openDetail(slug){
  try{
    const {portfolio:p}=await get('/api/public/portfolio/'+encodeURIComponent(slug));
    const gallery=(p.galleryUrls||[]).filter(Boolean);
    const all=[p.coverUrl,...gallery].filter(Boolean);
    const thumbs=all.map((url,i)=>`<button class="gallery-thumb ${i===0?'active':''}" data-img="${esc(url)}"><img loading="lazy" src="${esc(url)}" alt="${esc(p.title)} foto ${i+1}"></button>`).join('');
    $('#detailBody').innerHTML=`
      <div class="detail-hero">${p.coverUrl?`<img id="detailMainImage" src="${esc(p.coverUrl)}" alt="${esc(p.title)}">`:'<div class="detail-placeholder">N</div>'}</div>
      ${thumbs?`<div class="detail-gallery">${thumbs}</div>`:''}
      <div class="detail-content">
        <div class="detail-meta"><span>${esc(p.category||'Konstruksi')}</span>${p.location?`<span>${esc(p.location)}</span>`:''}${p.year?`<span>${esc(p.year)}</span>`:''}</div>
        <h2 id="detailTitle">${esc(p.title)}</h2>
        <p class="detail-lead">${esc(p.summary||'')}</p>
        ${specsHtml(p.specs)}
        ${p.description?`<div class="detail-description">${esc(p.description).replace(/\n/g,'<br>')}</div>`:''}
      </div>`;
    $('#detailBackdrop').classList.remove('hidden'); $('#detailBackdrop').setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
    $$('.gallery-thumb').forEach(btn=>btn.onclick=()=>{const img=$('#detailMainImage');if(img)img.src=btn.dataset.img;$$('.gallery-thumb').forEach(x=>x.classList.remove('active'));btn.classList.add('active');});
    history.replaceState(null,'',`?portfolio=${encodeURIComponent(slug)}#portofolio`);
  }catch(e){alert(e.message)}
}
function closeDetail(){
  $('#detailBackdrop').classList.add('hidden'); $('#detailBackdrop').setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); history.replaceState(null,'',location.pathname+'#portofolio');
}
async function boot(){
  try{
    const [{site},pr]=await Promise.all([get('/api/public/site'),get('/api/public/portfolio')]);
    portfolio=pr.portfolio||[]; renderProfile(site||{}); $('#portfolioCount').textContent=portfolio.length; $('#footerYear').textContent='© '+new Date().getFullYear(); populateCategories(); render();
    const slug=new URLSearchParams(location.search).get('portfolio'); if(slug)openDetail(slug);
  }catch(e){
    renderProfile(DEFAULTS); $('#portfolioGrid').innerHTML=`<div class="empty">${esc(e.message)}</div>`; $('#footerYear').textContent='© '+new Date().getFullYear();
  }
}
$('#searchInput').addEventListener('input',render); $('#categoryFilter').addEventListener('change',render); $('#detailClose').onclick=closeDetail; $('#detailBackdrop').onclick=e=>{if(e.target.id==='detailBackdrop')closeDetail();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#detailBackdrop').classList.contains('hidden'))closeDetail();});
$('#menuToggle').onclick=()=>{const nav=$('#mainNav');const open=nav.classList.toggle('open');$('#menuToggle').setAttribute('aria-expanded',String(open));};
$$('#mainNav a').forEach(a=>a.addEventListener('click',()=>$('#mainNav').classList.remove('open')));
boot();
