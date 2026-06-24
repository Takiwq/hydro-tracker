const CACHE_NAME = 'hydro-v6';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// Установка воркера и кэширование файлов
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // Принудительно активируем новый воркер
  );
});

// Активация и удаление старого кэша
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim()) // Берем управление вкладками сразу
  );
});

// ОБЯЗАТЕЛЬНЫЙ заголовок fetch для работы PWA
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    }).catch(() => {
      // Если сети нет и файла нет в кэше, просто фоллбэк
      if (e.request.mode === 'navigate') {
        return caches.match('index.html');
      }
    })
  );
});
