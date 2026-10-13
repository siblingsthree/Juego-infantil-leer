/* Service worker: primero la red (así las actualizaciones llegan en la siguiente carga);
   la caché solo se usa sin conexión. */
const CACHE = 'bosque-letras-v6';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/store.js', 'js/audio.js', 'js/strokes.js', 'js/tracing.js', 'js/icons.js', 'js/confetti.js', 'js/twotap.js', 'js/activities.js', 'js/app.js', 'icon.svg', 'manifest.webmanifest', 'fichas.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = e.request.url.startsWith(self.location.origin);
  const fonts = /fonts\.(googleapis|gstatic)\.com/.test(e.request.url);
  if (!sameOrigin && !fonts) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
