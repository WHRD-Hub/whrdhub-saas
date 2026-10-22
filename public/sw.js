/* WHRD Hub service worker.
 *
 * Privacy note: this is a sensitive reporting app. We deliberately DO NOT
 * cache authenticated HTML documents or any API/report content. Only static,
 * non-sensitive assets (icons, immutable Next.js build assets) and a static
 * offline fallback page are persisted. Navigations use network-first and fall
 * back to the offline page only when the network is unavailable.
 */

const VERSION = "whrd-v4";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

// Minimal, non-sensitive app shell.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/main-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll fails the whole install if any request 404s; add individually.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname === "/main-logo.png" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/favicon.ico" ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // A link, screenshot or photo shared to the app from another app.
  if (request.method === "POST" && new URL(request.url).pathname === "/share-target") {
    event.respondWith(handleShare(request));
    return;
  }

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch cross-origin (e.g. Supabase) requests.
  if (url.origin !== self.location.origin) return;

  // Never cache API routes or auth flows.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigations: network-first, fall back to offline page. Do NOT persist
  // (may contain private report content).
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((resp) => {
            if (resp && resp.ok) cache.put(request, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});

// Background Sync: browser re-fires this when connectivity returns. We can't
// submit directly from the SW (submission needs the app's auth/session), so we
// ask any open client to flush its offline queue.
self.addEventListener("sync", (event) => {
  // "whrd-sync-reports" is the tag an older build registered; both are honoured
  // so a queue written before an update still drains.
  if (event.tag === "whrd-sync-outbox" || event.tag === "whrd-sync-reports") {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage({ type: "WHRD_FLUSH_QUEUE" });
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Urgent-case alerts. The payload never carries what a reporter wrote: only that
// a case needs attention, what kind, and where to open it.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "WHRD Hub";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "whrd-alert",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/hub/reporting" },
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/hub/reporting";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(url); } catch (e) { /* cross-origin */ } } return; }
      }
      await self.clients.openWindow(url);
    })()
  );
});

// ── Sharing to the app ────────────────────────────────────────────────────
// The shared files stay on this device (IndexedDB) until the report form takes
// them. Nothing is sent anywhere by the act of sharing.
function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("whrd-share", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("shared");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveShared(item) {
  const db = await openShareDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("shared", "readwrite");
    tx.objectStore("shared").put(item, "latest");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function handleShare(request) {
  const to = (path) => Response.redirect(new URL(path, self.location.origin).href, 303);
  try {
    const form = await request.formData();
    const files = form.getAll("media")
      .filter((f) => f && typeof f === "object" && f.size > 0)
      .slice(0, 10)
      .map((f) => ({ name: f.name || "shared", type: f.type || "application/octet-stream", blob: f }));
    await saveShared({
      title: String(form.get("title") || ""),
      text: String(form.get("text") || ""),
      url: String(form.get("url") || ""),
      files,
      at: Date.now(),
    });
    return to("/report?shared=1");
  } catch (e) {
    return to("/report");
  }
}
