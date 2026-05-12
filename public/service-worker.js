// Service Worker for The Park
// Caches the app shell for fast loads and offline support.
// IMPORTANT: bump CACHE_VERSION whenever the app changes meaningfully to force users onto fresh code.

const CACHE_VERSION = 'thepark-v1';
const CACHE_NAME = `thepark-${CACHE_VERSION}`;

// Files to precache (the app shell).
// Vite-built JS/CSS bundles are hashed per build, so we let them cache themselves at runtime.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
  '/favicon.svg'
];

// Install: pre-cache the shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('thepark-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - Supabase / external API calls: always go to network (no caching)
//   - Same-origin static assets (JS, CSS, fonts, images): cache-first
//   - HTML navigations: network-first, fall back to cache (so users get fresh app when online,
//     but still see something if offline)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // Skip cross-origin requests (Supabase API, fonts, etc.) — let the network handle them.
  if (url.origin !== self.location.origin) return;

  // HTML navigation: network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Update cache with the latest HTML
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first, update in background
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Allow page to ask SW to skip waiting (for instant updates after deploy)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
