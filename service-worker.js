const CACHE_NAME = 'kramlat-eid-v2';
const ASSETS_TO_CACHE = [
    './Eid.html',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './logo.png',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'
];

// تثبيت ملفات الموقع في ذاكرة التخزين المؤقت
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// تفعيل وتحديث الكاش
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// استجابة الطلبات حتى في حالة عدم وجود إنترنت
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
