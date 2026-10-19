// Dial service worker: keeps the app shell available offline.
// If you ever change index.html and want phones to pick it up faster, bump the version below.
const CACHE = 'dial-shell-v6';
const INDEX = new URL('index.html', self.registration.scope).href;
const SHELL = [
  INDEX,
  new URL('manifest.json', self.registration.scope).href,
  new URL('icon-192.png', self.registration.scope).href,
  new URL('icon-512.png', self.registration.scope).href,
  new URL('icon-maskable-512.png', self.registration.scope).href
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  if (url.origin !== location.origin) return; // never touch links to other sites

  // Opening the app (including from the Share menu, which adds ?url=... to the address):
  // show the saved copy straight away, refresh it in the background.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(INDEX);
      const refresh = fetch(INDEX)
        .then(r => { if (r.ok) cache.put(INDEX, r.clone()); return r; })
        .catch(() => null);
      e.waitUntil(refresh);
      return cached || (await refresh) || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // Icons, manifest: saved copy first, otherwise fetch and save.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
