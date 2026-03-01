## API Caching Strategy Playground

A minimal React + Vite app that demonstrates **Service Worker API caching strategies** (`cache-first`, `network-first`, `stale-while-revalidate`) for a simple `/posts` endpoint backed by `https://jsonplaceholder.typicode.com/posts?_limit=5`.

### How to run

- **Install dependencies**

```bash
npm install
# or
pnpm install
# or
yarn
```

- **Start the dev server**

```bash
npm run dev
```

- Open the printed URL in a browser that supports Service Workers (Chrome, Edge, Firefox).

> For best results when testing Service Workers, use a non-incognito window and keep DevTools open.

---

### How the API and Service Worker interact

- The React app always calls a **same-origin** endpoint:

  - `/posts?strategy=cache-first`
  - `/posts?strategy=network-first`
  - `/posts?strategy=stale-while-revalidate`

- The **Service Worker**:

  - Intercepts only `fetch` events where the path is `/posts`.
  - Reads the `strategy` search param from the URL.
  - Applies the corresponding caching strategy.
  - Proxies the actual network request to:

    - `https://jsonplaceholder.typicode.com/posts?_limit=5`

---

### How to test offline mode

1. **Warm the cache**

   - Start the app and open it in the browser.
   - Open DevTools, go to the **Application** (or **Storage**) tab.
   - Under **Service Workers**, ensure the worker is installed and **controlling the page**.
   - In the UI, pick a strategy (e.g. **Cache First** or **Stale While Revalidate**) and click **Fetch Posts** once while online.
   - Verify posts are rendered in the UI.

2. **Go offline**

   - In DevTools, open the **Network** tab.
   - Check **Offline** (or use the throttling dropdown to simulate offline).
   - Keep the page open (do not hard reload).

3. **Trigger cached responses**

   - In the UI, click **Fetch Posts** again with the same strategy.
   - For `cache-first` and `stale-while-revalidate`, the Service Worker should serve data from **Cache Storage**, and the request should not hit the actual network.
   - For `network-first`, the Service Worker will attempt the network, then fall back to cache on failure.

4. **Observe behavior**

   - Watch the **Console** for the `[SW]` logs that describe which strategy was used and whether the cache or network was used.
   - Watch the **Network** tab to see whether the request is being fulfilled from the Service Worker.

---

### How to inspect Cache Storage

1. Open **DevTools**.
2. Go to **Application** (Chrome/Edge) or **Storage** (Firefox).
3. Under **Cache Storage**, look for a cache named:

   - `api-cache-v1`

4. Expand it to see entries:

   - You should see a key for `https://jsonplaceholder.typicode.com/posts?_limit=5`.
   - Clicking it will show the cached JSON response.

5. When the Service Worker is updated and activated, old caches (with previous versions) are deleted in the `activate` event, and the new `CACHE_NAME` is used.

---

### Service Worker lifecycle and patterns

- **Install**

  - Listens to the `install` event.
  - Calls `self.skipWaiting()` so the new worker moves to the `activating` state immediately.

- **Activate**

  - Listens to the `activate` event.
  - Deletes any caches whose names do not match the current `CACHE_NAME`.
  - Calls `self.clients.claim()` to start controlling all open clients without requiring a manual reload.

- **Fetch**

  - Listens to the `fetch` event.
  - Filters to only handle requests where `url.pathname === '/posts'`.
  - Reads `strategy` from `url.searchParams`.
  - Dispatches to one of:

    - `cacheFirst(cacheKey)`
    - `networkFirst(cacheKey)`
    - `staleWhileRevalidate(cacheKey)`

  - Each strategy uses the **Cache Storage API** without unnecessary `Response` cloning (only when storing into cache).

---

### Strategy explanations

- **Cache First**

  - `cache.match(cacheKey)`
  - If cached:

    - Return cached response immediately.

  - Else:

    - `fetch(cacheKey)` from network.
    - If successful, `cache.put(cacheKey, response.clone())`.
    - Return the network response.

  - Ideal for rarely changing data where speed and offline support are more important than strict freshness.

- **Network First**

  - Try `fetch(cacheKey)` from network first.
  - If network succeeds and response is OK:

    - Cache the response with `cache.put(cacheKey, response.clone())`.
    - Return the network response.

  - If network fails (error or offline):

    - `cache.match(cacheKey)` as a fallback.
    - If cached, return cached response.
    - Otherwise, return a 503 JSON error response.

  - Good for data that should be fresh when possible but can fall back to stale data when offline.

- **Stale While Revalidate**

  - `cache.match(cacheKey)` and `fetch(cacheKey)` run in parallel.
  - If cached data exists:

    - Immediately return cached response (**stale**).
    - When the network request finishes successfully, update the cache.

  - If there is no cached data:

    - Wait for the network response, cache it if OK, then return it.
    - If network fails and there is still no cache, return a 503 JSON error.

  - Great for UX where instant responses are important but you still want to keep data up to date in the background.

---

### Debugging tips

- Open the **Console**:

  - The app logs whether the Service Worker is controlling the page.
  - The Service Worker logs:

    - Which strategy is used.
    - Whether responses come from cache or network.
    - Cache versioning and deletions.

- If you change the Service Worker code:

  - Refresh the page.
  - In DevTools **Application → Service Workers**, check **Update on reload** (Chrome) when developing.
  - The app handles first-load behavior by reloading once on initial SW activation so the page is always controlled by the latest worker.

