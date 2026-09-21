const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let portfolio=[];

async function get(url){
  const r=await fetch(url,{headers:{accept:'application/json'}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.message||'Informasi tidak dapat dimuat.');
  return j;
}
function setLink(el,url,label){if(!el)return;if(!url){el.classList.add('hidden');return;}el.href=url;el.classList.remove('hidden');if(label)el.textContent=label;}
function card(p){return `<article class="portfolio-card" data-slug="${esc(p.slug)}">
  <div class="portfolio-cover ${p.coverUrl?'':'no-image'}">${p.coverUrl?`<img loading="lazy" src="${esc(p.coverUrl)}" alt="${esc(p.title)}">`:'<div class="cover-mark">N</div>'}${p.featured?'<span class="featured">Pilihan</span>':''}</div>
  <div class="portfolio-body">
    <div class="portfolio-meta"><span>${esc(p.category||'Konstruksi')}</span>${p.year?`<span>${esc(p.year)}</span>`:''}</div>
    <h3>${esc(p.title)}</h3>
    ${p.location?`<div class="portfolio-location">${esc(p.location)}</div>`:''}
    <p>${esc(p.summary||'')}</p>
    <div class="portfolio-foot"><span>${(p.galleryCount||0)+1} foto</span><strong>Lihat proyek <span>↗</span></strong></div>
  </div>
</article>`;}
function populateCategories(){
  const select=$('#categoryFilter');
  const current=select.value;
  const cats=[...new Set(portfolio.map(p=>String(p.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  select.innerHTML='<option value="">Semua kategori</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cats.includes(current))select.value=current;
}
function render(){
  const q=$('#searchInput').value.toLowerCase().trim();
  const cat=$('#categoryFilter').value;
  const rows=portfolio.filter(p=>(!q||[p.title,p.category,p.location,p.year,p.summary].join(' ').toLowerCase().includes(q))&&(!cat||p.category===cat));
  $('#portfolioGrid').innerHTML=rows.map(card).join('');
  $('#emptyState').classList.toggle('hidden',rows.length>0);
  $$('[data-slug]').forEach(el=>el.onclick=()=>openDetail(el.dataset.slug));
}
async function openDetail(slug){
  try{
    const {portfolio:p}=await get('/api/public/portfolio/'+encodeURIComponent(slug));
    const gallery=(p.galleryUrls||[]);
    const thumbs=gallery.map((url,i)=>`<button class="gallery-thumb" data-img="${esc(url)}"><img loading="lazy" src="${esc(url)}" alt="${esc(p.title)} foto ${i+2}"></button>`).join('');
    $('#detailBody').innerHTML=`
      <div class="detail-hero">${p.coverUrl?`<img id="detailMainImage" src="${esc(p.coverUrl)}" alt="${esc(p.title)}">`:'<div class="detail-placeholder">N</div>'}</div>
      ${thumbs?`<div class="detail-gallery">${p.coverUrl?`<button class="gallery-thumb active" data-img="${esc(p.coverUrl)}"><img src="${esc(p.coverUrl)}" alt="Cover"></button>`:''}${thumbs}</div>`:''}
      <div class="detail-content">
        <div class="detail-meta"><span>${esc(p.category||'Konstruksi')}</span>${p.location?`<span>${esc(p.location)}</span>`:''}${p.year?`<span>${esc(p.year)}</span>`:''}</div>
        <h2 id="detailTitle">${esc(p.title)}</h2>
        <p class="detail-lead">${esc(p.summary||'')}</p>
        ${p.description?`<div class="detail-description">${esc(p.description).replace(/\n/g,'<br>')}</div>`:''}
      </div>`;
    $('#detailBackdrop').classList.remove('hidden');
    $('#detailBackdrop').setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    $$('.gallery-thumb').forEach(btn=>btn.onclick=()=>{const img=$('#detailMainImage');if(img)img.src=btn.dataset.img;$$('.gallery-thumb').forEach(x=>x.classList.remove('active'));btn.classList.add('active');});
    history.replaceState(null,'',`?portfolio=${encodeURIComponent(slug)}#portofolio`);
  }catch(e){alert(e.message)}
}
function closeDetail(){
  $('#detailBackdrop').classList.add('hidden');
  $('#detailBackdrop').setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  history.replaceState(null,'',location.pathname+'#portofolio');
}
async function boot(){
  try{
    const [{site},pr]=await Promise.all([get('/api/public/site'),get('/api/public/portfolio')]);
    portfolio=pr.portfolio||[];
    $('#siteTitle').textContent=site.title||'Natara Konstruksi';
    $('#siteTagline').textContent=site.tagline||'';
    $('#siteAbout').textContent=site.about||'';
    $('#siteAddress').textContent=site.address||'-';
    $('#siteContactText').textContent=site.contactLabel||'Natara Konstruksi';
    $('#portfolioIntro').textContent=site.portfolioIntro||'Pilihan proyek Natara Konstruksi.';
    $('#portfolioCount').textContent=portfolio.length;
    $('#footerYear').textContent='© '+new Date().getFullYear();
    const services=Array.isArray(site.services)?site.services:String(site.services||'').split(',').map(x=>x.trim()).filter(Boolean);
    $('#serviceTags').innerHTML=services.map(s=>`<span>${esc(s)}</span>`).join('');
    setLink($('#navContact'),site.contactUrl,site.contactLabel||'Hubungi Kami');
    setLink($('#heroContact'),site.contactUrl,site.contactLabel||'Hubungi Natara');
    setLink($('#aboutContact'),site.contactUrl,site.contactLabel||'Hubungi Natara');
    setLink($('#instagramLink'),site.instagramUrl,'Instagram');
    populateCategories();render();
    const slug=new URLSearchParams(location.search).get('portfolio');if(slug)openDetail(slug);
  }catch(e){$('#portfolioGrid').innerHTML=`<div class="empty">${esc(e.message)}</div>`;}
}
$('#searchInput').addEventListener('input',render);
$('#categoryFilter').addEventListener('change',render);
$('#detailClose').onclick=closeDetail;
$('#detailBackdrop').onclick=e=>{if(e.target.id==='detailBackdrop')closeDetail();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#detailBackdrop').classList.contains('hidden'))closeDetail();});
boot();
