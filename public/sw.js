// Offline-Cache für die App-Dateien (die Daten selbst liegen im Browser bzw. auf dem Server)
const CACHE = 'kickerstars-v8';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'core.js', 'store.js', 'demo.js', 'manifest.webmanifest',
  'icons/icon.svg', 'img/table-portrait.svg', 'img/table-landscape.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Netz zuerst (damit Updates sofort ankommen), bei Offline aus dem Cache. API nie cachen.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  if (url.origin !== location.origin) return;
  e.respondWith(
    // cache: 'no-cache' = beim Server nachfragen, ob es eine neue Version gibt (sonst bis zu 10 Min. alte Dateien)
    fetch(e.request.url, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
