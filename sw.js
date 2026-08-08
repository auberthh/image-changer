/* ============================================================
   sw.js — service worker: permite instalar image-changer
   como app en Windows y Android, y usarla sin internet.
   ============================================================ */

const CACHE = 'image-changer-v2';

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/theme-98.css',
  './css/theme-modern.css',
  './js/settings.js',
  './js/viewer.js',
  './js/gestures.js',
  './js/presentations.js',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Red primero (para ver siempre la última versión); caché como
// respaldo cuando no hay internet.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
