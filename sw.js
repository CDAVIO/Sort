/* SORT service worker — keeps the app usable with the network off.
   Bump CACHE whenever index.html changes so installed copies refresh. */
const CACHE = 'sort-2026-10-31d';
const SHELL = [
  './',
  './index.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a missing optional asset must not block install
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // what changes with each release always comes from the network
  if (url.pathname === '/latest.json' || url.pathname.startsWith('/download/') ||
      url.pathname === '/install.sh' || url.pathname === '/install.ps1') return;

  // The page itself: take the fresh copy when there is a network, fall back to the cache.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then(res => {
          // Only the page itself is worth keeping. Caching any navigation here
          // meant one visit to a 404 replaced the app with "page not found"
          // for anyone offline afterwards.
          const path = new URL(req.url).pathname;
          if (res.ok && (path === '/' || path.endsWith('/index.html'))) {
            const cp = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', cp));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Everything else is static: cache first.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }))
  );
});
