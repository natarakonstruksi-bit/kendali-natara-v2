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
try {
  await import(new URL('../public/app.js?runtime-smoke=1',import.meta.url));
  await new Promise(r=>setTimeout(r,50));
  console.log('Frontend runtime smoke OK');
} catch (e) {
  console.error(e?.stack||e);
  process.exit(1);
}
