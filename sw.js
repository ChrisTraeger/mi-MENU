// ── VERSIÓN DEL CACHÉ ──
const CACHE_NAME = 'antojo-express-v3';

const PRECACHE = [
  './index.html',
  './menu_antojo_express.pdf',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
];

// ── INSTALL: cachear todo de una, incluyendo el PDF ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE.map(url =>
          fetch(url, { cache: 'no-store' })
            .then(res => {
              if (res && res.status === 200) return cache.put(url, res);
            })
            .catch(() => console.warn('[SW] No cacheable:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés viejos ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache first para PDF e imágenes, Network first para el resto ──
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // No interceptar Firebase
  if (url.includes('firebaseio.com') || url.includes('identitytoolkit')) return;

  // PDF e imágenes: Cache first
  if (url.endsWith('.pdf') || e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => new Response('Sin conexión', { status: 503 }));
      })
    );
    return;
  }

  // Todo lo demás: Network first, Cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') return caches.match('./index.html');
          return new Response('Sin conexión', { status: 503 });
        })
      )
  );
});
