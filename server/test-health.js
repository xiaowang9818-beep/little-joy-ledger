const http=require('http');
const url=process.argv[2]||'http://127.0.0.1:3000/health';
console.log('GET',url);
const req=http.get(url,r=>{
  let d='';
  r.on('data',c=>d+=c);
  r.on('end',()=>console.log('status',r.statusCode,d));
});
req.on('error',e=>console.error('ERR',e.message));
req.on('timeout',()=>{console.error('TIMEOUT');req.destroy();});
req.setTimeout(3000);
