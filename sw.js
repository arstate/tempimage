
const CACHE_NAME = 'cloud-os-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  // Claim clients immediately so the page is controlled by the SW on first load
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Navigation requests (HTML pages) -> Cache First falling back to Network (Stale-While-Revalidate for instant load)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        // If cache hit, return it immediately (instant resume feel)
        // But also fetch network to update cache in background for next time
        const fetchPromise = fetch(event.request).then((networkResponse) => {
           if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
               const clone = networkResponse.clone();
               caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
           }
           return networkResponse;
        });
        
        return response || fetchPromise;
      })
    );
    return;
  }

  // Asset requests -> Stale While Revalidate (Try cache, update in background) or Network First
  // Using Network First here to ensure latest code is loaded to prevent black screen from old JS
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone valid responses to cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
