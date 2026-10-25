import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {selectItems,readSaved,writeSaved,escapeHTML} from '../public/catalog.js';
const catalog=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
test('catalog reconciles the historical import and preserves known peak data',()=>{
  assert.equal(catalog.mountains.length,1337);assert.equal(catalog.routes.length,381);
  const items=[...catalog.mountains,...catalog.routes];assert.equal(new Set(items.map(x=>x.id)).size,1718);
  assert.equal(catalog.mountains.find(x=>x.id==='m-10').altitude,4478);
  assert.deepEqual(catalog.mountains.find(x=>x.id==='m-10').countries,['IT','CH']);
  assert.equal(catalog.routes.find(x=>x.id==='r-2').sources[0],'http://scuolaguidodellatorre.it/relazioni/roccia/AiguilleCroux-viaOttozHurzeler.html');
});
test('search is accent insensitive and matches multiple words across metadata',()=>{
  assert.ok(selectItems(catalog,{query:'Taschhorn'}).some(x=>x.name==='Täschhorn'));
  assert.ok(selectItems(catalog,{query:'Cervino Pennine'}).some(x=>x.id==='m-10'));
  assert.equal(selectItems(catalog,{query:'no-mountain-xyz'}).length,0);
});
test('combined activity, range, and altitude filters only return eligible records',()=>{
  const results=selectItems(catalog,{filter:'route',activity:'7'});
  assert.ok(results.length>0);assert.ok(results.every(x=>x.type==='route'&&x.activityId===7));
  const peaks=selectItems(catalog,{filter:'mountain',range:'Alpi Pennine',altitude:3500,sort:'altitude'});
  assert.ok(peaks.length>0);assert.ok(peaks.every(x=>x.type==='mountain'&&x.range==='Alpi Pennine'&&x.altitude>=3500));
  assert.ok(peaks.every((x,i)=>i===0||peaks[i-1].altitude>=x.altitude));
});
test('missing coordinates and unavailable route metrics are not invented',()=>{
  assert.equal(catalog.mountains.find(x=>x.id==='m-1').coordinates,null);
  assert.equal(catalog.routes.find(x=>x.id==='r-1').length,null);
  for(const item of [...catalog.mountains,...catalog.routes])if(item.coordinates){assert.ok(item.coordinates.every(Number.isFinite));assert.notEqual(item.coordinates[0],0);}
});
test('only public allowlisted fields are shipped',()=>{
  const allowed=new Set(['id','legacyId','type','name','altitude','coordinates','range','countries','routeCount','mountainId','activityId','activity','region','length','height','difficulty','sources']);
  for(const item of [...catalog.mountains,...catalog.routes])for(const key of Object.keys(item))assert.ok(allowed.has(key),key);
  for(const item of catalog.routes)for(const source of item.sources)assert.match(source,/^https?:\/\//);
});
test('saved lists tolerate blocked storage, malformed values and duplicates',()=>{
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.deepEqual(readSaved(blocked),[]);assert.equal(writeSaved(blocked,[]),false);
  assert.deepEqual(readSaved({getItem:()=>'{broken'}),[]);
  assert.deepEqual(readSaved({getItem:()=>'{}'}),[]);
  assert.deepEqual(readSaved({getItem:()=>JSON.stringify([{id:'m-10',done:true},{id:'m-10'},{id:'invalid'},null])}),[{id:'m-10',done:true}]);
  const storage={data:null,setItem(key,value){this.data=value},getItem(){return this.data}};
  assert.equal(writeSaved(storage,[{id:'r-2',done:false}]),true);assert.deepEqual(readSaved(storage),[{id:'r-2',done:false}]);
});
test('legacy strings are escaped before rendering HTML',()=>{assert.equal(escapeHTML('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;');});
