const CACHE_NAME = 'formigo-v2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/icons/favicon.ico',
  '/icons/favicon-96x96.png',
  '/icons/web-app-manifest-192x192.png',
  '/icons/web-app-manifest-512x512.png'
];

// Install event - Mejorado con manejo de errores
self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  // Evita esperar a que se completen todas las cachés para activarse
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        // Agregar recursos con manejo de errores individual
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.log(`Error al cachear ${url}:`, err);
            });
          })
        );
      })
  );
});

// Fetch event - Estrategia Cache First con actualización en background
self.addEventListener('fetch', event => {
  // Ignorar solicitudes que no son GET o de otro origen (como APIs)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve la respuesta en caché inmediatamente
        if (response) {
          // Actualiza la caché en segundo plano
          event.waitUntil(
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, networkResponse));
                }
              })
              .catch(() => { /* Ignorar errores de actualización */ })
          );
          return response;
        }
        
        // Si no está en caché, haz la solicitud de red
        return fetch(event.request)
          .then(networkResponse => {
            // Verifica si la respuesta es válida
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clona la respuesta para guardarla en caché
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.error('Error en fetch:', error);
            // Podrías devolver una página de error personalizada aquí
          });
      })
  );
});

// Activate event - Limpieza de cachés antiguas
self.addEventListener('activate', event => {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tomar control de todas las pestañas inmediatamente
      return self.clients.claim();
    })
  );
});

// Manejo de mensajes para actualizaciones
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
