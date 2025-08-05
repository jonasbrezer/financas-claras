const CACHE_NAME = 'financas-claras-cache-v2';

// Lista de arquivos essenciais para o funcionamento offline do app.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
  // URLs do Firebase não são pré-carregadas para garantir que sejam sempre as versões mais recentes da rede.
];

// Evento 'install': Pré-cache dos assets essenciais.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_ASSETS);
  })());
});

// Evento 'activate': Limpa caches antigos e assume controle imediato.
self.addEventListener('activate', event => {
  // Remove caches antigos que não estão na whitelist.
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
  // Assume o controle de todos os clientes abertos imediatamente.
  event.waitUntil(self.clients.claim());
});

// Evento 'fetch': Intercepta requisições e serve do cache primeiro (Cache-First Strategy).
self.addEventListener('fetch', event => {
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);

    // Se a resposta estiver no cache, retorna ela.
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Se não, busca na rede.
    try {
      const networkResponse = await fetch(event.request);
      // Opcional: Você pode adicionar a nova resposta ao cache aqui se desejar.
      // await cache.put(event.request, networkResponse.clone());
      return networkResponse;
    } catch (error) {
      // Se a rede falhar, você pode retornar uma página de fallback offline aqui.
      console.error('Fetch failed:', error);
      // Para este caso, simplesmente deixamos o erro acontecer.
      throw error;
    }
  })());
});

// Evento 'push': Ouve notificações push do servidor.
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Finanças Claras', body: 'Você tem uma nova notificação.' };
  const options = {
    body: data.body,
    icon: 'https://placehold.co/192x192.png', // Ícone da notificação
    badge: 'https://placehold.co/96x96.png' // Ícone para a barra de status
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
