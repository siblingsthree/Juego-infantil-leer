/* Service worker: deja el juego disponible sin conexión tras la primera visita. */
const CACHE = 'bosque-letras-v2';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/store.js', 'js/audio.js', 'js/tracing.js', 'js/confetti.js', 'js/twotap.js', 'js/activities.js', 'js/app.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && (e.request.url.startsWith(self.location.origin) || /fonts\.(googleapis|gstatic)\.com/.test(e.request.url))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
