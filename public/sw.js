// Offline support: the app works with no signal once it's been opened once.
// Pages: network first (so updates arrive), falling back to the cached copy.
// Built files (hashed names, never change): cache first.
const CACHE = "time-tracker-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      Promise.race([fetch(req), timeout(3000)])
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

// "Stop timer" button on the running-timer notification.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const at = Date.now();
  const stop = e.action === "stop";
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.length) {
        if (stop) wins[0].postMessage({ type: "stop", at });
        return wins[0].focus();
      }
      return self.clients.openWindow(stop ? `./?stop=${at}` : "./");
    })()
  );
});
