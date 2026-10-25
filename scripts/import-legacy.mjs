import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/import-legacy.mjs /path/to/legacy');
// Parse INSERT VALUES as data. Never evaluate or execute legacy SQL.
export function parseTuples(input) {
  const rows = []; let row = null, token = '', quoted = false, wasQuoted = false;
  const push = () => { row.push(wasQuoted ? token : token === 'NULL' ? null : Number.isFinite(Number(token)) ? Number(token) : token); token = ''; wasQuoted = false; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '\\') { const next = input[++i]; token += ({n:'\n',r:'\r',t:'\t','0':'\0'})[next] ?? next; }
      else if (c === "'") { if (input[i+1] === "'") {token += "'"; i++;} else quoted = false; }
      else token += c;
    } else if (c === "'") { quoted = true; wasQuoted = true; }
    else if (c === '(') { row = []; token = ''; }
    else if (c === ',' && row) push();
    else if (c === ')' && row) { push(); rows.push(row); row = null; }
    else if (row && (!/\s/.test(c) || wasQuoted)) token += c;
  }
  if (quoted || row) throw new Error('Incomplete SQL tuple');
  return rows;
}
async function table(name) {
  const sql = await readFile(path.join(root,'SYM.WebApp/dumps/Dump20150731',`sym.core_${name}.sql`),'utf8');
  const schema = sql.match(new RegExp('CREATE TABLE `'+name+'` \\(([\\s\\S]*?)\\) ENGINE'))?.[1];
  if (!schema) throw new Error(`Missing schema: ${name}`);
  const columns = [...schema.matchAll(/^\s*`([^`]+)`/gm)].map(m=>m[1]);
  return [...sql.matchAll(new RegExp('INSERT INTO `'+name+'` VALUES ([\\s\\S]*?);\\r?\\n','g'))].flatMap(m=>parseTuples(m[1])).map(row=>{
    if (row.length !== columns.length) throw new Error(`${name}: column mismatch ${row.length}/${columns.length}`);
    return Object.fromEntries(columns.map((c,i)=>[c,row[i]]));
  });
}
const names = ['mountain','route','mntn_mountainrange','geo_region','act_activity','route_webinfo','ass_mountaincountry','source'];
const values = await Promise.all(names.map(table));
const [mountains,routes,ranges,regions,activities,links,countries,sources] = values;
function sourceUrl(link) {
  try {
    const source = sources.find(s=>s.id===link.source_id);
    const url = new URL(link.wi_url, source?.source_url);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch { return null; }
}
const lookup = (items,id,key) => items.find(x=>x.id===id)?.[key] ?? '';
const coords = (lat,lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat!==0 && lng!==0 && Math.abs(lat)<=90 && Math.abs(lng)<=180 ? [lat,lng] : null;
const catalog = {
  provenance: {repository:'https://gitlab.com/campagna.marcello/shareyourmountain', commit:'f71f235228f015e20fd0e1487ce597b3de5cab9c',snapshot:'2015-07-31',note:'Historical public catalog. Not current route or safety information.'},
  mountains: mountains.map(m=>({id:`m-${m.id}`,legacyId:m.id,type:'mountain',name:m.mntn_name,altitude:m.mntn_altitude,coordinates:coords(m.mntn_latitude,m.mntn_longitude),range:lookup(ranges,m.mntnRange_id,'mntnRange_name'),countries:countries.filter(c=>c.mntn_id===m.id).map(c=>c.country_code),routeCount:routes.filter(r=>r.mountain_id===m.id).length})),
  routes: routes.map(r=>({id:`r-${r.id}`,legacyId:r.id,type:'route',name:r.route_title||[lookup(mountains,r.mountain_id,'mntn_name'),r.route_name].filter(Boolean).join(' · '),mountainId:r.mountain_id?`m-${r.mountain_id}`:null,activityId:r.activity_id,activity:lookup(activities,r.activity_id,'activity_name'),region:lookup(regions,r.region_id,'region_name'),range:lookup(ranges,r.mntnRange_id,'mntnRange_name'),altitude:r.route_altitude,length:r.route_length,height:r.route_altitudeDiff,difficulty:r.difficulty_grade,coordinates:coords(r.route_latitude,r.route_longitude),sources:links.filter(l=>l.route_id===r.id).map(sourceUrl).filter(Boolean)}))
};
await mkdir('public/data',{recursive:true});
await writeFile('public/data/catalog.json',JSON.stringify(catalog));
console.log(`Imported ${catalog.mountains.length} peaks and ${catalog.routes.length} routes. No accounts or private data imported.`);
