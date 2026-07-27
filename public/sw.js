// Minimal no-op service worker — present only so the app is installable as a
// PWA (a requirement for appearing in the Android share sheet). It caches
// nothing and lets every request pass straight through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);
self.addEventListener("fetch", () => {
  // Intentionally empty: no interception, no offline caching.
});
