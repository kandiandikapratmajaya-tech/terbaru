// Jaya Agrofarm Nusantara - Service Worker
// Cache policy: app code is network-first so Netlify deployments are picked up immediately.
const CACHE_NAME = 'jaya-agrofarm-static-v2.1.0';
const PRECACHE_ASSETS = [
  '/', '/index.html', '/css/style.css', '/logo.png', '/assets/logo.png',
  '/pwa-192x192.png', '/pwa-512x512.png', '/assets/pwa-192x192.png',
  '/assets/pwa-512x512.png', '/apple-touch-icon.png', '/assets/apple-touch-icon.png',
  '/manifest.json', '/manifest.webmanifest', '/js/pwa-android-install.js',
  '/js/app.js', '/js/data.js', '/js/auth.js', '/js/supabase.js',
  '/js/smart-crop-engine.js', '/js/crop-photo-exporter.js', '/js/farm-analytics-report.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS).catch(err => console.warn('[SW] Precache:', err)))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/') || req.method !== 'GET') return;

  const isAppCode = req.mode === 'navigate' || /\.(js|css|html)$/.test(url.pathname);
  if (isAppCode) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
