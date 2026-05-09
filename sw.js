const CACHE_NAME = 'ko95fit-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json',
  '/firebase-config.js',
  '/css/variables.css',
  '/css/base.css',
  '/css/splash.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/auth.css',
  '/css/dashboard.css',
  '/css/plan.css',
  '/css/live.css',
  '/css/progress.css',
  '/css/history.css',
  '/css/awards.css',
  '/css/profile.css',
  '/css/overlays.css',
  '/css/ai-coach.css',
  '/css/onboarding.css',
  '/css/summary.css',
  '/css/polish.css',
  '/css/pro.css',
  '/js/store.js',
  '/js/constants.js',
  '/js/state.js',
  '/js/utils.js',
  '/js/pro.js',
  '/js/xp.js',
  '/js/rest.js',
  '/js/helpers.js',
  '/js/nav.js',
  '/js/plan.js',
  '/js/live.js',
  '/js/dashboard.js',
  '/js/awards.js',
  '/js/progress.js',
  '/js/history.js',
  '/js/profile.js',
  '/js/data.js',
  '/js/ai-coach.js',
  '/js/ai-rutina.js',
  '/js/rpe.js',
  '/js/summary.js',
  '/js/effects.js',
  '/js/onboarding.js',
  '/js/firebase-sync.js',
  '/js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Skip non-GET and Firebase/external requests
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network-first for HTML, cache-first for assets
      if (e.request.destination === 'document') {
        return fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        }).catch(() => cached);
      }
      return cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return resp;
      });
    })
  );
});
