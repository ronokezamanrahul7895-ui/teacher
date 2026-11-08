/* Minimal offline cache for the static shell (HTML/CSS/JS). Firestore data
   itself is never cached here — that always comes live over the network. */
const CACHE_NAME = "teacher-portal-shell-v1";
const SHELL_FILES = [
  "login.html",
  "dashboard.html",
  "css/style.css",
  "js/firebase-config.js",
  "js/auth-guard.js",
  "js/layout.js",
  "js/session.js",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
