import { selectItems, normalize, readSaved, writeSaved, escapeHTML as e } from './catalog.js';
const $=selector=>document.querySelector(selector);
const number=value=>Number(value).toLocaleString('it-IT');
const state={catalog:null,filter:'featured',query:'',activity:'',range:'',altitude:0,sort:'default',page:1};
let storage;try{storage=window.localStorage;}catch{storage=null;}
let saved=readSaved(storage), toastTimer, detailId;
const pageSize=12;
const all=()=>[...state.catalog.mountains,...state.catalog.routes];
const find=id=>all().find(x=>x.id===id);
const isSaved=id=>saved.some(x=>x.id===id);
const photo=item=>item.id==='m-10'||item.id==='m-77'?{file:'cervino.jpg',label:'Cervino'}:item.range?.includes('Dolomiti')?{file:'dolomites.jpg',label:'Paesaggio delle Dolomiti · foto illustrativa'}:item.type==='route'?{file:'climbing.jpg',label:'Foto illustrativa · archivio Share Your Mountain'}:item.id==='m-1330'?{file:'hiking.jpg',label:'Foto illustrativa · archivio Share Your Mountain'}:{file:'alps.jpg',label:'Paesaggio alpino · foto illustrativa'};
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
function persist(next){if(!writeSaved(storage,next)){toast('Salvataggio non disponibile. Consenti i dati locali nel browser.');return false;}saved=next;updateSavedCount();return true;}
function updateSavedCount(){$('#saved-count').textContent=saved.length;}
function toggleSave(id){const exists=isSaved(id);const next=exists?saved.filter(x=>x.id!==id):[...saved,{id,done:false}];if(!persist(next))return;toast(exists?'Avventura rimossa dalla tua lista.':'La tua prossima avventura è nella lista.');render();if($('#saved-dialog').open)renderSaved();if($('#detail-dialog').open && detailId===id)renderDetail(id);}
function card(item){const image=photo(item);return `<article class="card ${item.type==='route'?'route':''}"><button class="save-card" data-save="${item.id}" aria-label="${isSaved(item.id)?'Rimuovi':'Salva'} ${e(item.name)}" aria-pressed="${isSaved(item.id)}">${isSaved(item.id)?'♥':'♡'}</button><button class="card-open" data-detail="${item.id}" aria-label="Scopri ${e(item.name)}"><div class="card-image"><img src="assets/${image.file}" alt="${e(image.label)}" loading="lazy"><span class="card-badge">${e(item.activity||'CIME E MONTAGNE')}</span>${image.label.includes('illustrativa')?'<span class="card-alt">Foto illustrativa</span>':''}</div><div class="card-body"><p class="card-place">${e(item.region||item.range||'Archivio alpino')}</p><h3>${e(item.name)}</h3><div class="card-meta"><span>△ ${item.altitude?number(item.altitude)+' m':'Quota non disponibile'}</span><span>${item.type==='mountain'?(item.routeCount?item.routeCount+' itinerari in archivio':e((item.countries||[]).join(' · ')||'Cima alpina')):e(item.difficulty||'Difficoltà non indicata')}</span></div><div class="card-foot"><span>${item.type==='route'?'Scopri l’itinerario':'Scopri la montagna'}</span><span aria-hidden="true">↗</span></div></div></button></article>`;}
function render(){
  if(!state.catalog)return;
  const items=selectItems(state.catalog,{...state,saved:saved.map(x=>x.id)}), totalPages=Math.max(1,Math.ceil(items.length/pageSize));
  state.page=Math.max(1,Math.min(state.page,totalPages));
  const start=(state.page-1)*pageSize, featured=state.filter==='featured' && !state.query && !state.activity && !state.range && !Number(state.altitude);
  $('#cards').innerHTML=items.length?items.slice(start,start+pageSize).map(card).join(''):`<div class="empty-state"><h3>Un nuovo orizzonte ti aspetta.</h3><p>Nessun risultato con questi filtri nell’archivio storico.<br>Prova un’altra zona o esplora tutte le cime e gli itinerari.</p><button class="button" data-reset>Esplora l’archivio ↗</button></div>`;
  $('#cards').setAttribute('aria-busy','false');
  $('#results-info').textContent=featured?'':`${number(items.length)} risultati${state.query?' per “'+state.query+'”':''} · archivio storico 2015`;
  $('#pagination').hidden=totalPages<2;
  $('#page-label').textContent=`${state.page} / ${totalPages}`;
  $('#prev-page').disabled=state.page===1;$('#next-page').disabled=state.page===totalPages;
  document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===state.filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  const params=new URLSearchParams();for(const key of ['query','filter','activity','range','altitude','sort']){if(state[key] && state[key]!==({filter:'featured',sort:'default',altitude:0})[key])params.set(key,state[key]);}
  history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);
}
function search(query){state.query=query;state.activity=$('#activity').value;state.filter='all';state.page=1;$('#search').value=query;render();$('#explore').scrollIntoView({behavior:'smooth'});}
function reset(){Object.assign(state,{filter:'all',query:'',activity:'',range:'',altitude:0,sort:'default',page:1});$('#search').value='';$('#activity').value='';$('#range-filter').value='';$('#altitude-filter').value='0';$('#sort').value='default';render();}
function renderDetail(id){
  const item=find(id);if(!item)return;
  detailId=id;const image=photo(item), related=state.catalog.routes.filter(r=>r.mountainId===id), coords=item.coordinates||find(item.mountainId)?.coordinates;
  $('#detail-content').innerHTML=`<img class="detail-image" src="assets/${image.file}" alt="${e(image.label)}"><div class="detail-body"><p class="eyebrow">${e(item.activity||'CIME E MONTAGNE')} · ARCHIVIO STORICO</p><h2 id="detail-title">${e(item.name)}</h2><dl class="detail-facts"><div><dt>Quota</dt><dd>${item.altitude?number(item.altitude)+' m':'Non indicata'}</dd></div><div><dt>${item.type==='route'?'Regione':'Gruppo montuoso'}</dt><dd>${e(item.region||item.range||'Non indicato')}</dd></div><div><dt>${item.type==='route'?'Difficoltà':'Paesi'}</dt><dd>${e(item.difficulty||(item.countries||[]).join(' · ')||'Non indicata')}</dd></div>${item.type==='route'?`<div><dt>Sviluppo</dt><dd>${Number(item.length)>0?e(item.length)+' m':'Non indicato'}</dd></div><div><dt>Dislivello</dt><dd>${item.height?e(item.height)+' m':'Non indicato'}</dd></div>`:''}</dl><p>${e(image.label)}</p><p>Informazioni importate dall’archivio originale del 31 luglio 2015. I dati possono essere incompleti o superati. Verifica condizioni, accessibilità e relazione aggiornata prima di partire.</p><div class="detail-actions"><button class="button" data-save="${id}">${isSaved(id)?'♥ Salvata · Rimuovi':'♡ Salva avventura'}</button>${coords?`<a class="secondary-button" href="https://www.openstreetmap.org/?mlat=${coords[0]}&mlon=${coords[1]}#map=13/${coords[0]}/${coords[1]}" target="_blank" rel="noopener noreferrer">Apri la mappa ↗</a>`:''}<button class="secondary-button" data-share="${id}">Copia link ↗</button></div>${!coords?'<p>Coordinate non disponibili nell’archivio per questa scheda.</p>':''}${related.length?`<h3>Itinerari su questa montagna</h3>${related.map(r=>`<button class="related-route" data-detail="${r.id}">${e(r.name)} ↗</button>`).join('')}`:''}${item.type==='route'?`<h3>Relazioni e fonti originali</h3>${item.sources?.length?item.sources.map(url=>`<a class="source-link" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(new URL(url).hostname)} · Apri relazione ↗</a>`).join(''):'<p>Nessuna relazione esterna disponibile per questa scheda.</p>'}<p>I link appartengono all’archivio storico; la loro disponibilità attuale non è verificata.</p>`:''}<p class="archive-note">Fonte: Share Your Mountain · ID storico ${item.legacyId} · <a href="https://gitlab.com/campagna.marcello/shareyourmountain/-/tree/master" target="_blank" rel="noopener noreferrer">Progetto originale ↗</a></p></div>`;
}
function openDetail(id){renderDetail(id);if(!$('#detail-dialog').open)$('#detail-dialog').showModal();$('#detail-dialog').scrollTop=0;}
function renderSaved(){
  $('#saved-list').innerHTML=saved.length?saved.map(entry=>{const item=find(entry.id);if(!item)return '';return `<div class="saved-row"><button class="saved-name" data-detail="${entry.id}">${e(item.name)}<small>${entry.done?'✓ Avventura completata':'Da raggiungere'} · ${e(item.range||item.region||'Archivio')}</small></button><button class="secondary-button ${entry.done?'completed':''}" data-done="${entry.id}">${entry.done?'✓ Completata':'Segna completata'}</button><button class="secondary-button" data-save="${entry.id}" aria-label="Rimuovi ${e(item.name)}">×</button></div>`;}).join(''):'<div class="empty-state"><h3>Ogni avventura comincia con un’idea.</h3><p>Tocca il cuore su una cima o un itinerario.<br>Ritroverai qui tutte le tue prossime mete.</p><button class="button" data-browse>Trova la tua montagna ↗</button></div>';
}
document.addEventListener('click',async event=>{
  const save=event.target.closest('[data-save]');if(save){toggleSave(save.dataset.save);return;}
  const detail=event.target.closest('[data-detail]');if(detail){if($('#saved-dialog').open)$('#saved-dialog').close();openDetail(detail.dataset.detail);return;}
  const done=event.target.closest('[data-done]');if(done){if(persist(saved.map(x=>x.id===done.dataset.done?{...x,done:!x.done}:x)))renderSaved();return;}
  const inspiration=event.target.closest('[data-search]');if(inspiration){search(inspiration.dataset.search);return;}
  const tab=event.target.closest('[data-filter]');if(tab){state.filter=tab.dataset.filter;state.activity='';$('#activity').value='';state.page=1;render();return;}
  if(event.target.closest('[data-reset]')){reset();return;}
  if(event.target.closest('[data-browse]')){$('#saved-dialog').close();$('#explore').scrollIntoView();return;}
  const share=event.target.closest('[data-share]');if(share){const url=new URL(location.href);url.hash=`detail=${share.dataset.share}`;try{await navigator.clipboard.writeText(url.href);toast('Link copiato. La montagna è più bella, condivisa.');}catch{toast('Copia il link dalla barra degli indirizzi.');location.hash=url.hash;}return;}
  if(event.target.closest('.dialog-close'))event.target.closest('dialog').close();
});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}}));
$('#search-form').addEventListener('submit',event=>{event.preventDefault();search($('#search').value.trim());});
$('#search').addEventListener('input',()=>{if(!state.catalog)return;const q=normalize($('#search').value);$('#search-suggestions').innerHTML=q.length>1?all().filter(x=>normalize(x.name).includes(q)).slice(0,7).map(x=>`<option value="${e(x.name)}"></option>`).join(''):'';});
$('#filter-toggle').addEventListener('click',()=>{const show=$('#filters').hidden;$('#filters').hidden=!show;$('#filter-toggle').setAttribute('aria-expanded',show);});
$('#filters').addEventListener('submit',event=>event.preventDefault());
$('#filters').addEventListener('change',()=>{state.range=$('#range-filter').value;state.altitude=Number($('#altitude-filter').value);state.sort=$('#sort').value;state.filter=state.filter==='featured'?'all':state.filter;state.page=1;render();});
$('#reset').addEventListener('click',reset);$('#show-all').addEventListener('click',reset);
for(const [id,delta] of [['prev-page',-1],['next-page',1]])$('#'+id).addEventListener('click',()=>{state.page+=delta;render();$('#explore').scrollIntoView();});
$('#open-saved').addEventListener('click',()=>{if(!state.catalog){toast('L’archivio è ancora in caricamento.');return;}renderSaved();$('#saved-dialog').showModal();});
$('.menu-toggle').addEventListener('click',()=>{const open=$('#navigation').classList.toggle('open');$('.menu-toggle').setAttribute('aria-expanded',open);});
$('#navigation').addEventListener('click',()=>{$('#navigation').classList.remove('open');$('.menu-toggle').setAttribute('aria-expanded','false');});
function info(title,body){$('#info-content').innerHTML=`<p class="eyebrow">SHARE YOUR MOUNTAIN</p><h2 id="info-title">${title}</h2>${body}`;$('#info-dialog').showModal();}
$('#about-data').addEventListener('click',()=>info('Un archivio, tante storie.',`<p>Questo sito esplora ${state.catalog?number(state.catalog.mountains.length):'1.337'} cime e ${state.catalog?number(state.catalog.routes.length):'381'} itinerari dal dump pubblico del 31 luglio 2015 del progetto Share Your Mountain. Non è collegato al database di produzione.</p><p>Le informazioni non costituiscono una relazione aggiornata. Le foto originali illustrano il paesaggio alpino; la foto del Cervino è usata per il Cervino, le altre sono indicate come illustrative nelle schede.</p><p>Il progetto legacy descrive i dati condivisi con licenza CC BY-SA 3.0; il suo codice è distribuito sotto Apache 2.0. Consulta le fonti per i rispettivi diritti e attribuzioni.</p><div class="info-links"><a href="https://gitlab.com/campagna.marcello/shareyourmountain" target="_blank" rel="noopener noreferrer">Repository e fonti originali ↗</a><a href="https://github.com/mcAmpAgn/shareyourmountain-web-frontend" target="_blank" rel="noopener noreferrer">Il nuovo frontend su GitHub ↗</a></div>`));
$('#privacy').addEventListener('click',()=>info('La tua lista rimane tua.','<p>Le avventure salvate e lo stato di completamento sono conservati nel localStorage di questo browser. Non vengono inviati a un server, né condivisi tra dispositivi.</p><p>Non usiamo analisi di navigazione, tracciatori o cookie di marketing. Aprire una mappa o una fonte esterna porta su un altro sito con le proprie condizioni.</p><p>Puoi eliminare tutti i salvataggi da questo dispositivo usando il pulsante qui sotto.</p><button class="secondary-button" id="clear-local">Elimina tutte le avventure locali</button>'));
$('#info-content').addEventListener('click',event=>{if(event.target.id==='clear-local'){if(persist([])){render();toast('Avventure locali eliminate.');$('#info-dialog').close();}}});
$('#year').textContent=new Date().getFullYear();updateSavedCount();
function fromURL(){const params=new URLSearchParams(location.search);for(const key of ['query','filter','activity','range','altitude','sort']){if(params.has(key))state[key]=params.get(key);}$('#search').value=state.query;$('#activity').value=state.activity;$('#range-filter').value=state.range;$('#altitude-filter').value=state.altitude;$('#sort').value=state.sort;}
function hashDetail(){const match=location.hash.match(/^#detail=([mr]-\d+)$/);if(match&&find(match[1]))openDetail(match[1]);}
window.addEventListener('hashchange',()=>{if(state.catalog)hashDetail();});
window.addEventListener('storage',event=>{if(event.key==='sym-adventures-v1'){saved=readSaved(storage);updateSavedCount();render();if($('#saved-dialog').open)renderSaved();if($('#detail-dialog').open)renderDetail(detailId);}});
try{
  const response=await fetch('data/catalog.json');if(!response.ok)throw new Error('Catalog response '+response.status);state.catalog=await response.json();
  const ids=new Set(all().map(x=>x.id));saved=saved.filter(x=>ids.has(x.id));updateSavedCount();
  $('#peak-total').textContent=number(state.catalog.mountains.length);$('#route-total').textContent=number(state.catalog.routes.length);
  $('#range-filter').innerHTML+=[...new Set(all().map(x=>x.range).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')).map(range=>`<option value="${e(range)}">${e(range)}</option>`).join('');
  fromURL();render();hashDetail();
}catch(error){$('#cards').setAttribute('aria-busy','false');$('#cards').innerHTML='<div class="empty-state"><h3>L’archivio non è disponibile.</h3><p>Controlla la connessione e ricarica la pagina per riprovare.</p><button class="button" id="retry">Riprova ↻</button></div>';$('#retry').addEventListener('click',()=>location.reload());console.error('Unable to load mountain catalog:',error);}
