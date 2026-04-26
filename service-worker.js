// service-worker.js
// PWA Service Worker для Cube Cubic
// Кеширует статику + треки для офлайн работы

const CACHE_VERSION = 'cubic-v1.2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const AUDIO_CACHE = CACHE_VERSION + '-audio';
const IMAGE_CACHE = CACHE_VERSION + '-images';

// Статические файлы — кешируются при установке
const STATIC_ASSETS = [
  '/mp/',
  '/mp/index.html',
  '/mp/admin.html',
  '/mp/styles.css',
  '/mp/app.js',
  '/mp/admin.js',
  '/mp/manifest.json',
  '/mp/images/smallcube.png',
  '/mp/images/midcube.png'
];

// ══════════════════════════════════
//  INSTALL — кешируем статику
// ══════════════════════════════════
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('[SW] Some assets failed to cache:', err);
          // Не блокируем установку если какой-то файл не загрузился
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ══════════════════════════════════
//  ACTIVATE — удаляем старые кеши
// ══════════════════════════════════
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (!key.startsWith(CACHE_VERSION)) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ══════════════════════════════════
//  FETCH — умная стратегия кеширования
// ══════════════════════════════════
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Пропускаем Firebase, сторонние API, chrome-extension
  if (
    url.origin.includes('firebase') ||
    url.origin.includes('gstatic') ||
    url.origin.includes('googleapis') ||
    url.protocol === 'chrome-extension:' ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // ── Аудио файлы (MP3 с R2 или archive.org) ──
  if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.m4a') || url.pathname.endsWith('.ogg')) {
    event.respondWith(cacheFirstAudio(event.request));
    return;
  }

  // ── Обложки/картинки ─
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(cacheFirstImage(event.request));
    return;
  }

  // ── Статика (HTML, CSS, JS) ──
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(networkFirstStatic(event.request));
    return;
  }

  // ── Всё остальное — network first ──
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ──────────────────────────────────
//  СТРАТЕГИЯ: Cache First (аудио)
//  Сначала кеш → если нет, качаем
// ──────────────────────────────────
async function cacheFirstAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    console.log('[SW] Audio from cache:', request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    // Кешируем только успешные ответы
    if (response.ok) {
      // Клонируем response т.к. его можно прочитать только 1 раз
      cache.put(request, response.clone());
      console.log('[SW] Audio cached:', request.url);
    }
    return response;
  } catch (err) {
    console.error('[SW] Audio fetch failed:', err);
    throw err;
  }
}

// ──────────────────────────────────
//  СТРАТЕГИЯ: Cache First (картинки)
// ──────────────────────────────────
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Возвращаем placeholder если offline
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect fill="#0f2b45" width="300" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="#fff" font-size="14">Offline</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// ──────────────────────────────────
//  СТРАТЕГИЯ: Network First (статика)
//  Пытаемся загрузить → fallback к кешу
// ──────────────────────────────────
async function networkFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      console.log('[SW] Static from cache (offline):', request.url);
      return cached;
    }
    throw err;
  }
}

// ══════════════════════════════════
//  BACKGROUND SYNC (опционально)
//  Отложенная синхронизация лайков
// ══════════════════════════════════
self.addEventListener('sync', event => {
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  }
});

async function syncLikes() {
  // Здесь можно синхронизировать лайки с Firebase
  // когда вернулась сеть
  console.log('[SW] Background sync: likes');
}

// ══════════════════════════════════
//  PUSH NOTIFICATIONS (опционально)
// ══════════════════════════════════
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Cubic';
  const options = {
    body: data.body || 'Новый трек добавлен!',
    icon: '/mp/images/midcube.png',
    badge: '/mp/images/smallcube.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/mp/')
  );
});
