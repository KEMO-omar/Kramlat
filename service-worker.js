--- /dev/null
const CACHE_NAME = 'galleria-cache-v1';
const STATIC_ASSETS = [
    './',
    './Eid.html',
    './style.css',
    './script.js',
    './logo8.png',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// تثبيت Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// تفعيل Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })
    );
});

// استراتيجية جلب البيانات (Fetch Strategy)
self.addEventListener('fetch', (evt) => {
    // 1. استراتيجية خاصة للصور: الكاش أولاً، ثم الشبكة (لضمان ظهور الصور بدون نت)
     if (evt.request.destination === 'image') {
        evt.respondWith(
            caches.match(evt.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(evt.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(evt.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
    } else {
        // 2. استراتيجية باقي الملفات: الكاش أولاً، ثم الشبكة
        evt.respondWith(
            caches.match(evt.request).then((cacheRes) => {
                return cacheRes || fetch(evt.request);
            })
        );
    }
});
