/* ============================================
   Service Worker — Hizb Al-A'zham PWA
   Cache-first strategy for 100% offline reading
   ============================================ */

const CACHE_NAME = 'hizb-azam-v10';

const PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-512.png',
    './lib/pdf.min.mjs',
    './lib/pdf.worker.min.mjs',
    './Sholawat 40.pdf',
    './Jumat.pdf',
    './Sabtu.pdf',
    './Ahad.pdf',
    './Senin.pdf',
    './Selasa.pdf',
    './Rabu.pdf',
    './Kamis.pdf',
];

// Install: precache all local files (app shell, PDF.js library, and all PDF files)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('[SW] Precaching app shell, PDF.js, and PDF books');
                // Use Promise.allSettled so if one file fails, the rest are still cached
                return Promise.allSettled(
                    PRECACHE_URLS.map(url => 
                        cache.add(url).catch(err => {
                            console.warn(`[SW] Precache failed for ${url}:`, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: clean up old caches immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: cache-first for everything local, stale-while-revalidate for fonts
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Google Fonts: Stale-while-revalidate (cache first, update in background if online)
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchPromise = fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || fetchPromise;
            })
        );
        return;
    }

    // All local assets & PDFs: Cache-first (instant offline load)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then(response => {
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        })
    );
});
