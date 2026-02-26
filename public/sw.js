const CACHE_NAME = "ops-tasker-v2";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const accept = event.request.headers.get("accept") || "";
  const isHtmlNavigation = event.request.mode === "navigate" || accept.includes("text/html");
  if (isHtmlNavigation) {
    event.respondWith(fetch(event.request));
    return;
  }

  const url = new URL(event.request.url);
  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const isManifest = url.pathname === "/manifest.webmanifest";
  const isIcon = url.pathname === "/icon.svg";

  if (isNextStatic || isManifest || isIcon) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "Задачник эксплуатации";
  const options = {
    body: data.body || "Новое событие",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/my" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/my";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
