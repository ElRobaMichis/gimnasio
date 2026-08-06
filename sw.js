/* Hierro — service worker: la app funciona 100 % sin conexión.

   Estrategia mixta, elegida por lo que falla si te equivocas:
   · el documento va a RED PRIMERO (con 3 s de paciencia). Si hay
     internet ves la versión nueva en cuanto recargas; si no la hay,
     entra la copia guardada y la app abre igual.
   · los iconos, el manifiesto y las tipografías van a CACHÉ PRIMERO:
     no cambian casi nunca y así el arranque es instantáneo.

   Antes todo era caché primero, y eso hacía que una versión nueva
   tardara dos arranques en verse: el primero servía la vieja y dejaba
   la nueva lista para el siguiente. */
const CACHE = 'hierro-v11';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];
const RED_MS = 3000;   /* lo que se espera a la red antes de tirar de copia */

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for(const c of list){ if('focus' in c) return c.focus(); }
      return clients.openWindow('./');
    })
  );
});

function guardar(req, res){
  if (res && res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
  }
  return res;
}
/* la red, pero sin quedarse colgado: si tarda demasiado se da por perdida */
function redConPrisa(req, ms){
  return new Promise(resolve => {
    let resuelto = false;
    const fin = v => { if (!resuelto) { resuelto = true; resolve(v); } };
    const t = setTimeout(() => fin(null), ms);
    fetch(req).then(res => { clearTimeout(t); fin(res); })
              .catch(() => { clearTimeout(t); fin(null); });
  });
}
function deLaCopia(req){
  return caches.match(req, { ignoreSearch: true })
    .then(hit => hit || caches.match('./index.html', { ignoreSearch: true }));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  /* tipografías (otro origen): caché primero */
  if (url.origin !== location.origin) {
    if (!FONT_HOSTS.includes(url.hostname)) return;
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  /* el documento de la app: red primero */
  const esDocumento = e.request.mode === 'navigate' ||
                      url.pathname.endsWith('/') ||
                      url.pathname.endsWith('index.html');
  if (esDocumento) {
    e.respondWith(
      redConPrisa(e.request, RED_MS)
        .then(res => res ? guardar(e.request, res) : deLaCopia(e.request))
        .catch(() => deLaCopia(e.request))
    );
    return;
  }

  /* lo demás (iconos, manifiesto): caché primero con refresco de fondo */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const refresco = fetch(e.request).then(res => guardar(e.request, res)).catch(() => hit);
      return hit || refresco;
    })
  );
});
