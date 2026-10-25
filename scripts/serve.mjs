import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const base = path.resolve('public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if (!file.startsWith(base+path.sep)) {res.writeHead(403).end(); return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'}).end(body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port));
