// AGM Pro Service Worker — Cache-first for app shell, network-first for API
const CACHE_NAME = "agm-pro-v3";
const OFFLINE_URL = "/";

const APP_SHELL = [
  "/",
  "/index.html",
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Network-first for canister/API calls
  const isApiCall =
    url.pathname.startsWith("/api/") ||
    url.hostname.endsWith(".ic0.app") ||
    url.hostname.endsWith(".icp0.io") ||
    (url.hostname.includes("localhost") && url.pathname.includes("/api/"));

  if (isApiCall) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses for offline fallback
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    /\.(js|css|woff2?|ttf|png|jpg|svg|ico)$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Network-first with offline fallback for navigation (HTML)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL) ?? caches.match("/index.html")),
    );
    return;
  }
});

// Background sync: deferred registrations
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-registrations") {
    event.waitUntil(syncPendingActions());
  }
  if (event.tag === "sync-checkins") {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  // Notify the main thread to trigger a re-sync
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "SW_SYNC_REQUESTED" });
  }
}
