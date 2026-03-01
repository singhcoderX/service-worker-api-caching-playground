/* global self, clients */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `api-cache-${CACHE_VERSION}`;
const POSTS_API_URL = 'https://jsonplaceholder.typicode.com/posts?_limit=5';

console.log('[SW] Script loaded with cache name:', CACHE_NAME);

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  // We don't pre-cache API responses here; everything is cached on demand.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
      await self.clients.claim();
      console.log('[SW] Clients claimed');
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Intercept only /posts requests
  if (url.pathname !== '/posts') {
    return;
  }

  const rawStrategy = url.searchParams.get('strategy') || 'network-first';
  const strategy = rawStrategy.toLowerCase();

  console.log('[SW] Fetch event for /posts with strategy:', strategy);

  event.respondWith(handlePostsRequest(strategy));
});

/**
 * Dispatch to the correct strategy for the /posts API.
 * The cache key and network request are always the external API URL.
 */
async function handlePostsRequest(strategy) {
  const cacheKey = new Request(POSTS_API_URL, { method: 'GET' });

  switch (strategy) {
    case 'cache-first':
      console.log('[SW] Using Cache First strategy');
      return cacheFirst(cacheKey);
    case 'stale-while-revalidate':
    case 'stale-while-revalidate/':
      console.log('[SW] Using Stale While Revalidate strategy');
      return staleWhileRevalidate(cacheKey);
    case 'network-first':
    default:
      console.log('[SW] Using Network First strategy (default)');
      return networkFirst(cacheKey);
  }
}

/**
 * Cache First strategy:
 * - Return cached response if present
 * - Otherwise fetch from network, cache it, then return it
 */
async function cacheFirst(cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey);

  if (cached) {
    console.log('[SW][CacheFirst] Serving from cache');
    return cached; // No extra cloning needed
  }

  console.log('[SW][CacheFirst] Cache miss, fetching from network');
  const networkResponse = await fetch(cacheKey);

  if (networkResponse && networkResponse.ok) {
    const toCache = networkResponse.clone();
    await cache.put(cacheKey, toCache);
    console.log('[SW][CacheFirst] Cached network response');
  } else {
    console.warn('[SW][CacheFirst] Network response not OK:', networkResponse && networkResponse.status);
  }

  return networkResponse;
}

/**
 * Network First strategy:
 * - Try network first
 * - Cache successful response
 * - On network failure, fall back to cache
 */
async function networkFirst(cacheKey) {
  const cache = await caches.open(CACHE_NAME);

  try {
    console.log('[SW][NetworkFirst] Trying network');
    const networkResponse = await fetch(cacheKey);

    if (networkResponse && networkResponse.ok) {
      await cache.put(cacheKey, networkResponse.clone());
      console.log('[SW][NetworkFirst] Cached fresh network response');
      return networkResponse;
    }

    console.warn(
      '[SW][NetworkFirst] Network response not OK, trying cache. Status:',
      networkResponse && networkResponse.status
    );
  } catch (error) {
    console.warn('[SW][NetworkFirst] Network error, trying cache fallback:', error);
  }

  const cached = await cache.match(cacheKey);
  if (cached) {
    console.log('[SW][NetworkFirst] Serving fallback from cache');
    return cached;
  }

  console.error('[SW][NetworkFirst] No cache available and network failed');

  return new Response(
    JSON.stringify({ error: 'Network error and no cached data available.' }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'X-Fallback-Source': 'service-worker-network-first'
      }
    }
  );
}

/**
 * Stale While Revalidate strategy:
 * - Respond with cache immediately if present (stale)
 * - Always trigger a network request in the background to update cache
 * - If no cache, wait for network
 */
async function staleWhileRevalidate(cacheKey) {
  const cache = await caches.open(CACHE_NAME);

  const cachedPromise = cache.match(cacheKey);
  const networkPromise = (async () => {
    try {
      console.log('[SW][SWR] Fetching from network to revalidate');
      const networkResponse = await fetch(cacheKey);

      if (networkResponse && networkResponse.ok) {
        await cache.put(cacheKey, networkResponse.clone());
        console.log('[SW][SWR] Cache updated with fresh response');
      } else {
        console.warn(
          '[SW][SWR] Network response not OK during revalidation:',
          networkResponse && networkResponse.status
        );
      }

      return networkResponse;
    } catch (error) {
      console.warn('[SW][SWR] Network error during revalidation:', error);
      return null;
    }
  })();

  const cached = await cachedPromise;

  if (cached) {
    console.log('[SW][SWR] Serving stale cache immediately and revalidating in background');
    // NetworkPromise is already running in background
    return cached;
  }

  console.log('[SW][SWR] No cached data, waiting for network response');
  const networkResponse = await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  console.error('[SW][SWR] No cache and network failed');

  return new Response(
    JSON.stringify({ error: 'No cached data and network failed.' }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'X-Fallback-Source': 'service-worker-stale-while-revalidate'
      }
    }
  );
}

