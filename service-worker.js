// ═══════════════════════════════════════════════════════════════════════════
// 🔧 SERVICE WORKER - Tecnomania! Inventario v4.0
// ═══════════════════════════════════════════════════════════════════════════
// Cache strategy:
//   - Estáticos (HTML/CSS/JS/iconos): cache-first
//   - API Google Apps Script: network-only (no cachear datos dinámicos)
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'tecnomania-v4.0';
const STATIC_ASSETS = [
    './',
    'index.html',
    'estilo.css',
    'script.js',
    'manifest.json',
    'icon-192.svg',
    'icon-512.svg',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('SW cache add failed:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // NUNCA cachear requests al Apps Script de Google (datos dinámicos)
    if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
        return; // network only
    }

    // Cache-first para estáticos
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    // Solo cachear respuestas exitosas
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => {
                    // Si falla red y no hay cache, devolver el HTML para SPA fallback
                    if (event.request.mode === 'navigate') {
                        return caches.match('index.html');
                    }
                });
            })
        );
    }
});
