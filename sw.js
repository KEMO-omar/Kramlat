const CACHE_NAME = 'kramlat-v1';
const assets = [
  './',
  './index.html',
  './logo.png',
  './13.png'
];

// تثبيت السيرفس وركر
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// تشغيل الطلبات حتى لو مفيش إنترنت
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
