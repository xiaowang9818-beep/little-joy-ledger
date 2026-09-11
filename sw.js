const CACHE='little-joy-v16-diary-studio-20260823';
const ASSETS=['./','./index.html','./cute-themes.css','./payment.css','./growth.css','./ui-icons.css','./enhancements.js','./ui-icons.js','./manifest.webmanifest','./app-icon.svg','./admin/','./admin/index.html','./admin/admin.css','./admin/admin.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/health')return;
  if(url.pathname.startsWith('/assets/payment/')){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match(url.pathname.startsWith('/admin/')?'./admin/index.html':'./index.html'))));
});
self.addEventListener('push',event=>{
  let data={title:'个人计划提醒',body:'有一项计划到时间了',url:'/index.html'};
  try{if(event.data)data=Object.assign(data,event.data.json());}catch(_){if(event.data)data.body=event.data.text();}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag||'planner-reminder',renotify:false,icon:'./app-icon.svg',badge:'./app-icon.svg',data:{url:data.url||'/index.html'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL((event.notification.data&&event.notification.data.url)||'/index.html',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate(target);return client.focus();}}return clients.openWindow?clients.openWindow(target):undefined;}));
});
