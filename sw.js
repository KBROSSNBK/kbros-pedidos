/**
 * Service worker de KBROS: convierte la web en una app instalable con carga
 * instantánea en visitas repetidas y soporte offline básico (app shell).
 * Sube el número de CACHE_VERSION cuando cambien los archivos precacheados
 * para forzar a los clientes a bajar la versión nueva.
 */
const CACHE_VERSION = "kbros-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/logo.png",
  "./assets/logo-512.png",
  "./assets/logo-192.png",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./js/main.js",
  "./js/config.js",
  "./js/data/dataAdapter.js",
  "./js/data/menuData.js",
  "./js/data/mockAdapter.js",
  "./js/data/firebaseAdapter.js",
  "./js/state/store.js",
  "./js/state/cart.js",
  "./js/state/session.js",
  "./js/state/rank.js",
  "./js/ui/nav.js",
  "./js/ui/menu.js",
  "./js/ui/cartUI.js",
  "./js/ui/profile.js",
  "./js/ui/kpoints.js",
  "./js/ui/admin.js",
  "./js/ui/modal.js",
  "./js/ui/toast.js",
  "./js/ui/productCard.js",
  "./js/ui/dragScroll.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navegación (recarga / abrir la app): red primero, así el contenido no queda viejo;
  // si no hay red, se sirve el shell cacheado para que la app igual abra.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Resto de assets: cache primero (rápido), y de paso se refresca en segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
