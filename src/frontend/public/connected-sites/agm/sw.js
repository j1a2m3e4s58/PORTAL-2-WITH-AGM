// AGM Pro Service Worker - Cache-first for app shell, network-first for API.
const CACHE_NAME = "agm-pro-v4";
const BASE_PATH = "/connected-sites/agm";
const OFFLINE_URL = `${BASE_PATH}/index.html`;

const APP_SHELL = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  const isApiCall =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/agm-runtime/") ||
    url.hostname.endsWith(".ic0.app") ||
    url.hostname.endsWith(".icp0.io") ||
    (url.hostname.includes("localhost") && url.pathname.includes("/api/"));

  if (isApiCall) {
    event.respondWith(
      fetch(request)
        .then((response) => {
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

  const isStaticAsset =
    url.pathname.startsWith(`${BASE_PATH}/assets/`) ||
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
        .catch(() => caches.match(OFFLINE_URL) ?? caches.match(`${BASE_PATH}/index.html`)),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-registrations") {
    event.waitUntil(syncPendingActions());
  }
  if (event.tag === "sync-checkins") {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "SW_SYNC_REQUESTED" });
  }
}
