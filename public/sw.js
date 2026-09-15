// Aely — service worker
// STALE-WHILE-REVALIDATE: sirve desde caché AL INSTANTE (arranque inmediato incluso con
// red lenta o sin conexión) y a la vez descarga la versión fresca en segundo plano.
// La versión nueva queda cacheada y se ve en el SIGUIENTE arranque — mismo comportamiento
// de actualización que antes (sin recargas a media sesión), pero sin esperar a la red.
const VERSION = "4.24.2-2026-09-15-sw-fix";
const CACHE = "micartera-" + VERSION;
const SHELL = [
  "./", "./index.html", "./manifest.json",
  "./release-notes.json",
  "./i18n/en.json", "./i18n/ca.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "./logos/sabadell.png", "./logos/revolut.png", "./logos/trade_republic.png",
  "./logos/myinvestor.png", "./logos/caixabank.png", "./logos/efectivo.svg",
  "./logos/inv/nvidia.svg", "./logos/inv/amd.svg", "./logos/inv/meta.svg",
  "./logos/inv/alphabet.svg", "./logos/inv/broadcom.svg",
  "./logos/inv/tsmc.svg", "./logos/inv/micron.svg",
  "./logos/inv/oro.svg", "./logos/inv/etf-mundo.svg", "./logos/inv/fondo-indice.svg",
  "./vendor/supabase.min.js",
  "./fonts/manrope-latin.woff2", "./fonts/manrope-latin-ext.woff2",
  "./fonts/fraunces-latin.woff2", "./fonts/fraunces-latin-ext.woff2",
];

self.addEventListener("install", (e) => {
  // Precachea el shell pero NO hace skipWaiting: el SW nuevo espera al siguiente
  // arranque en frío para activarse, así no provoca recargas a media sesión.
  //
  // ⚠ UNO A UNO, no `addAll`. `addAll` es todo-o-nada: si UNA sola ruta da 404, revienta la
  // instalación ENTERA del service worker y la app se queda sin caché offline — sin avisar, y
  // por un fichero que a lo mejor ni se usa. Aviso de Cursor al revisar la 4.19.52, cuando metí
  // los 5 logos de banco al shell (2026-09-11). Lo imprescindible es `index.html`; el resto es
  // mejora, así que el fallo de uno no puede tirar el conjunto.
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))
  ));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;  // API/nube: siempre red
  /* ignoreSearch (15/9, rechazo 4.24.0): el panel de beta pide release-notes.json; si la URL
     lleva ?v=/cache-bust (o el WebView normaliza distinto), match exacto fallaba offline.
     Clonar ANTES de devolver res (si no, body already used). Fallback encadenado: caches.match
     devuelve Promise (siempre truthy con ||) — review Claude 15/9. JSON sin caché → fallo de
     red (no index.html); navegación → index.html. */
  const bare = "./" + url.pathname.replace(/^\//, "");
  const isJson = url.pathname.endsWith(".json");
  const isNav = e.request.mode === "navigate";
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const forReq = res.clone();
            const forBare = res.clone();
            caches.open(CACHE).then((c) => {
              c.put(e.request, forReq);
              c.put(bare, forBare).catch(function () {});
            });
          }
          return res;
        })
        .catch(() =>
          caches.match(bare, { ignoreSearch: true }).then((r) => {
            if (r) return r;
            if (isJson) return Response.error();
            if (isNav || !cached) return caches.match("./index.html");
            return cached;
          })
        );
      // Con caché: respuesta instantánea (la red actualiza por detrás). Sin caché: espera la red.
      return cached || fresh;
    })
  );
});
