const CACHE = 'apphub-404-v2.7.2';
const CACHE_PREFIX = 'apphub-404-';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/apps-data.js',
  './assets/js/app.js',
  './assets/js/system-tools.js',
  './tools/apphub-404-scan.ps1',
  './examples/inventory-example.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldAppHubCaches = keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE);
    await Promise.all(oldAppHubCaches.map(key => caches.delete(key)));
    await self.clients.claim();

    // Si esta activación sustituye una versión anterior, recarga una vez las
    // ventanas controladas para evitar que permanezcan ejecutando JS antiguo.
    if (oldAppHubCaches.length) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map(async client => {
        try { await client.navigate(client.url); } catch {}
      }));
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const critical = /\/(?:index\.html|manifest\.webmanifest|assets\/js\/(?:config|app|apps-data|system-tools)\.js|assets\/css\/styles\.css)$/.test(url.pathname);
  event.respondWith(critical ? networkFirstAsset(request) : cacheFirst(request, event));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (isCacheable(response)) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
  }
}

async function networkFirstAsset(request) {
  try {
    return await fetchAndCache(request, { cache: 'no-store' });
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirst(request, event) {
  const cached = await caches.match(request);
  if (cached) {
    event.waitUntil(fetchAndCache(request).catch(() => undefined));
    return cached;
  }
  return fetchAndCache(request);
}

async function fetchAndCache(request, init) {
  const response = await fetch(request, init);
  if (isCacheable(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

function isCacheable(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default');
}
