const CACHE_NAME = 'streamrent-cache-v1';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=> k!==CACHE_NAME ? caches.delete(k):null))));
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(r=>{
      const copy = r.clone();
      caches.open(CACHE_NAME).then(c=> c.put(e.request, copy));
      return r;
    }).catch(()=> caches.match('./index.html')))
  );
});
