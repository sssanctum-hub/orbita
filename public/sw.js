const CACHE = 'orbita-web-v1';
self.addEventListener('install', event => event.waitUntil((async () => {
 const cache = await caches.open(CACHE);
 const response = await fetch('./index.html', {cache:'reload'});
 if (!response.ok) throw Error('Offline install failed');
 const html = await response.clone().text();
 const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map(match => match[1]);
 await cache.addAll([...assets, './manifest.webmanifest', './icons/apple-touch-icon.png',
 './fonts/inter-tight/InterTight-Regular.ttf','./fonts/inter-tight/InterTight-SemiBold.ttf',
 './fonts/news-cycle/NewsCycle-Regular.ttf','./fonts/news-cycle/NewsCycle-Bold.ttf']);
 await cache.put('./index.html', response);
})()));
self.addEventListener('fetch', event => {
 if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
 event.respondWith((async () => {
  const cache = await caches.open(CACHE);
  if(event.request.mode === 'navigate') {
   try { return await fetch(event.request); } catch { return await cache.match('./index.html'); }
  }
  const hit = await cache.match(event.request);
  if(hit) return hit;
  const response = await fetch(event.request);
  if(response.ok) await cache.put(event.request,response.clone());
  return response;
 })());
});

self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('orbita-web-') && key !== CACHE).map(key => caches.delete(key))))));
