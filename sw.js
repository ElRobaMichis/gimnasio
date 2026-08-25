/* Hierro — service worker: la app funciona 100 % sin conexión.

   Estrategia mixta, elegida por lo que falla si te equivocas:
   · el documento va a RED PRIMERO (con 3 s de paciencia). Si hay
     internet ves la versión nueva en cuanto recargas; si no la hay,
     entra la copia guardada y la app abre igual — pero la descarga
     NO se abandona: sigue en segundo plano, se guarda al llegar y
     se le avisa a la app para que busque la versión nueva ya mismo.
     Sin esto, con la red lenta del gimnasio la actualización nunca
     llegaba ahí: aparecía hasta llegar a casa con buen wifi.
   · los iconos, el manifiesto y las tipografías van a CACHÉ PRIMERO:
     no cambian casi nunca y así el arranque es instantáneo.

   Antes todo era caché primero, y eso hacía que una versión nueva
   tardara dos arranques en verse: el primero servía la vieja y dejaba
   la nueva lista para el siguiente. */
/* va siempre igual que APP_VERSION en index.html — hay un test que lo verifica */
const CACHE = 'hierro-2.1.0';
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
/* cuando el documento fresco llega tarde (ya se sirvió la copia), avisar a
   las pestañas: la red ya respira, es buen momento de buscar versión nueva */
function avisarDocumentoFresco(){
  self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) c.postMessage({ tipo: 'documento-fresco' });
  }).catch(() => {});
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
    /* responder YA (la copia local si la red tarda más de RED_MS), pero sin
       rendirse: la descarga sigue por detrás y, si llega, queda guardada
       para el próximo arranque y se le avisa a la app */
    let servidoDeCopia = false;
    const red = fetch(e.request)
      .then(res => guardar(e.request, res))
      .then(res => {
        if (res && res.ok && servidoDeCopia) avisarDocumentoFresco();
        return res;
      })
      .catch(() => null);
    const prisa = new Promise(resolve => setTimeout(() => resolve(null), RED_MS));
    e.respondWith(
      Promise.race([red, prisa]).then(res => {
        if (res) return res;
        servidoDeCopia = true;
        return deLaCopia(e.request);
      })
    );
    e.waitUntil(red);   /* que el navegador no mate al SW con la descarga a medias */
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
