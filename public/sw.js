/*
  Onitsha Way service worker: lets the game load fast and play offline after the first visit.
  - /assets/* files have content hashes in their names: cached forever (cache-first).
  - The map data and icons: served from cache, refreshed in the background.
  - The page itself: network first, falling back to the cached copy when offline.
  Bump CACHE when the caching rules change; old caches are removed on activate.
*/
const CACHE = 'onitsha-way-v0543'; // bumped each release so phones drop the old copy

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './data/onitsha_core.json', './audio/afrobeat/iweka-afterglow.mp3', './audio/afrobeat/niger-breeze.mp3', './audio/afrobeat/market-lights.mp3']).catch(() => {}))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('onitsha-way-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/socket')) return;
  if (url.origin !== self.location.origin) return; // fonts etc. go straight to the network
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; }).catch(() => caches.match('./')));
    return;
  }
  if ((url.pathname.includes('/assets/') || url.pathname.includes('/models/v24/') || url.pathname.includes('/audio/afrobeat/'))) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
    return;
  }
  if (url.pathname.includes('/data/') || url.pathname.includes('/icons/')) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
