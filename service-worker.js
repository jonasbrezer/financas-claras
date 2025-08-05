// Nome do cache
const CACHE_NAME = 'financas-claras-cache-v1';

// Arquivos a serem cacheados
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://github.com/jonasbrezer/financas-claras/blob/main/Icon192.png?raw=true',
  'https://github.com/jonasbrezer/financas-claras/blob/main/Icon512.png?raw=true'
];

// Evento de instalação: abre o cache e adiciona os arquivos da lista
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de ativação: limpa caches antigos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento de fetch: responde com o cache ou busca na rede (Cache-First)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se encontrar no cache, retorna a resposta do cache
        if (response) {
          return response;
        }
        // Se não, busca na rede
        return fetch(event.request);
      }
    )
  );
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
