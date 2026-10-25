import { cp, mkdir, readFile } from 'node:fs/promises';
const catalog = JSON.parse(await readFile('public/data/catalog.json','utf8'));
if (!catalog.mountains.length || !catalog.routes.length) throw new Error('Catalog is empty');
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
console.log(`Built static site: ${catalog.mountains.length} peaks, ${catalog.routes.length} routes.`);
