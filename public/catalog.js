export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function selectItems(catalog, { query='', filter='all', activity='', range='', altitude=0, sort='default', saved=[] }={}) {
  let items = [...catalog.mountains,...catalog.routes];
  const words=normalize(query).split(/\s+/).filter(Boolean);
  if(filter==='featured' && !query && !activity && !range && !Number(altitude)) {
    return ['m-10','m-1240','m-1330'].map(id=>items.find(x=>x.id===id)).filter(Boolean);
  }
  items=items.filter(item=>{
    if(filter==='saved' && !saved.includes(item.id)) return false;
    if(filter==='mountain' && item.type!=='mountain') return false;
    if(filter==='route' && item.type!=='route') return false;
    if(/^\d+$/.test(filter) && item.activityId!==Number(filter)) return false;
    if(activity==='mountain' && item.type!=='mountain') return false;
    if(activity && activity!=='mountain' && item.activityId!==Number(activity)) return false;
    if(range && item.range!==range) return false;
    if(Number(altitude)>0 && !(Number(item.altitude)>=Number(altitude))) return false;
    const text=normalize([item.name,item.range,item.region,item.activity,...(item.countries||[])].join(' '));
    return words.every(word=>text.includes(word));
  });
  if(sort==='name') items.sort((a,b)=>a.name.localeCompare(b.name,'it'));
  if(sort==='altitude') items.sort((a,b)=>(b.altitude||0)-(a.altitude||0));
  return items;
}
export function readSaved(storage) {
  try {
    const data=JSON.parse(storage.getItem('sym-adventures-v1')||'[]');
    if(!Array.isArray(data)) return [];
    const seen=new Set();
    return data.filter(item=>item && /^[mr]-\d+$/.test(item.id) && !seen.has(item.id) && seen.add(item.id)).map(item=>({id:item.id,done:item.done===true}));
  } catch {return [];}
}
export function writeSaved(storage,items) {try {storage.setItem('sym-adventures-v1',JSON.stringify(items));return true;} catch {return false;}}
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
