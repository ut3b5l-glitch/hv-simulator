// HV Simulator service worker — offline support for the installed PWA.
// Strategy:
//   • navigations → network-first (always prefer fresh server-rendered data),
//     falling back to the last cached page, then to a cached "/" shell offline.
//   • build assets + icons → cache-first with background refresh (fast, immutable).
// Bump CACHE to invalidate everything on the next activation.
const CACHE = "hv-sim-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Server-rendered pages: prefer the network so data is never stale; cache each
  // successful response so the route still opens with no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/"))),
    );
    return;
  }

  // Everything else same-origin (build chunks, icons, manifest): serve from cache
  // immediately, revalidate in the background.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});
