// ── VERSIÓN DEL CACHÉ — cambia este número para forzar actualización ──
const CACHE_NAME = 'antojo-express-v1';

// Recursos que se guardan en el primer install (shell de la app)
const PRECACHE = [
  './index.html',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
];

// ── INSTALL: pre-cachear el shell ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(err => console.warn('[SW] No cacheable:', url))
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

// ── FETCH: Network first, Cache fallback ──
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // No interceptar Firebase Realtime Database (tiene offline propio)
  if (url.includes('firebaseio.com') || url.includes('identitytoolkit')) return;

  // Imágenes: Cache first, luego red
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 200 }));
      })
    );
    return;
  }

  // Todo lo demás: red primero, caché de respaldo
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
