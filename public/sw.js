const CACHE_VERSION = "v4";
const CACHE_PREFIX = "ops-tasker";
const SHELL_CACHE_NAME = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `${CACHE_PREFIX}-data-${CACHE_VERSION}`;

const SHELL_ROUTES = ["/rounds", "/rounds/scan"];
const STATIC_ROUTES = ["/manifest.webmanifest", "/icon.svg"];
const OFFLINE_FALLBACK_ROUTE = "/rounds";
const OFFLINE_SCAN_ROUTE = "/rounds/scan";
const CRITICAL_DATA_PREFIXES = ["/api/", "/_next/data/"];

function isHttpRequest(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isHtmlNavigation(request) {
  const accept = request.headers.get("accept") || "";
  return request.mode === "navigate" || accept.includes("text/html");
}

function isStaticAssetRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === "/sw.js") return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (STATIC_ROUTES.includes(url.pathname)) return true;
  return ["script", "style", "font"].includes(request.destination);
}

function isDataRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("application/json");
}

function isCriticalDataRequest(url) {
  return CRITICAL_DATA_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isCacheableShellRoute(url) {
  return url.origin === self.location.origin && !url.search && SHELL_ROUTES.includes(url.pathname);
}

function getNavigationFallback(url) {
  return url.pathname.startsWith("/rounds/scan") ? OFFLINE_SCAN_ROUTE : OFFLINE_FALLBACK_ROUTE;
}

async function cacheResponse(cacheName, cacheKey, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(cacheKey, response.clone());
}

async function precache() {
  const shellCache = await caches.open(SHELL_CACHE_NAME);
  const staticCache = await caches.open(STATIC_CACHE_NAME);
  await Promise.all([
    shellCache.addAll(SHELL_ROUTES),
    staticCache.addAll(STATIC_ROUTES),
  ]);
}

async function cleanupCaches() {
  const validNames = new Set([SHELL_CACHE_NAME, STATIC_CACHE_NAME, DATA_CACHE_NAME]);
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !validNames.has(key))
      .map((key) => caches.delete(key))
  );
}

async function handleNavigationRequest(event) {
  const request = event.request;
  const url = new URL(request.url);

  try {
    const preloadResponse = event.preloadResponse ? await event.preloadResponse : null;
    const networkResponse = preloadResponse ?? (await fetch(request));

    if (isCacheableShellRoute(url)) {
      event.waitUntil(cacheResponse(SHELL_CACHE_NAME, url.pathname, networkResponse));
    }

    return networkResponse;
  } catch {
    const cache = await caches.open(SHELL_CACHE_NAME);
    const exactMatch = isCacheableShellRoute(url) ? await cache.match(url.pathname) : null;
    if (exactMatch) return exactMatch;

    const fallback = await cache.match(getNavigationFallback(url));
    return fallback ?? Response.error();
  }
}

async function handleStaticRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  const isImmutableNextStatic = url.pathname.startsWith("/_next/static/");

  if (cached) {
    if (!isImmutableNextStatic) {
      event.waitUntil(
        fetch(request)
          .then((response) => cacheResponse(STATIC_CACHE_NAME, request, response))
          .catch(() => undefined)
      );
    }
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    event.waitUntil(cacheResponse(STATIC_CACHE_NAME, request, response));
  }
  return response;
}

function offlineDataResponse() {
  return new Response(JSON.stringify({ error: "Offline", code: "SW_OFFLINE" }), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function handleDataRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  const isCritical = isCriticalDataRequest(url);
  const cache = await caches.open(DATA_CACHE_NAME);

  try {
    const response = await fetch(request);
    if (!isCritical && response && response.ok) {
      event.waitUntil(cacheResponse(DATA_CACHE_NAME, request, response));
    }
    return response;
  } catch {
    if (isCritical) return offlineDataResponse();

    const cached = await cache.match(request);
    return cached ?? offlineDataResponse();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    cleanupCaches()
      .then(async () => {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isHttpRequest(url)) return;

  if (request.headers.has("range")) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.searchParams.has("_rsc") || url.pathname.startsWith("/_next/webpack-hmr")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlNavigation(request)) {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(handleStaticRequest(event));
    return;
  }

  if (isDataRequest(request, url)) {
    event.respondWith(handleDataRequest(event));
    return;
  }

  event.respondWith(fetch(request));
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
