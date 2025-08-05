// This is the "Offline page" service worker

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "pwabuilder-page";

// Define o nome correto da nossa página de fallback offline
const offlineFallbackPage = "offline.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;

        if (preloadResp) {
          return preloadResp;
        }

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {

        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  }
});

// Evento de push: escuta por notificações push do servidor
self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('Notificação push recebida:', data);

  const title = data.title || 'Finanças Claras';
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: 'https://github.com/jonasbrezer/financas-claras/blob/main/Icon192.png?raw=true',
    badge: 'https://github.com/jonasbrezer/financas-claras/blob/main/Icon192.png?raw=true'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Evento de clique na notificação
self.addEventListener('notificationclick', event => {
  console.log('Notificação clicada.');
  event.notification.close();

  // Abre o app ao clicar na notificação
  event.waitUntil(
    clients.openWindow('/')
  );
});
