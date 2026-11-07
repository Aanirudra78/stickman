/* Stickman Studio shell cache - API and videos always go to the network. */
const CACHE = "stickman-studio-v2";
const SHELL = ["/", "/index.html", "/style.css", "/app.js", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const cachePut = (request, response) => {
  if (!response.ok) return response;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/jobs/")) return;

  // App shell: always try the network first so a code update is picked up,
  // fall back to the cached copy when offline.
  event.respondWith(
    fetch(request)
      .then((response) => cachePut(request, response))
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/"))),
  );
});
