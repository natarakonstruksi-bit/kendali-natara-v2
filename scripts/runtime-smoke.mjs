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
  console.log('Frontend runtime smoke OK — scoped selectors OK');
} catch (e) {
  console.error(e?.stack||e);
  process.exit(1);
}
