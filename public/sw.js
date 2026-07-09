// 愛工大交通情報システム Service Worker
// 方針: キャッシュ優先はコンテンツハッシュ付きの /_next/static と画像のみ。
// それ以外（ページ・API・その他）はネットワーク優先＋オフライン時キャッシュ。
const CACHE = "ait-transit-v4";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const cacheFirst =
    url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|jpg|webp|woff2?)$/.test(url.pathname);
  if (!cacheFirst) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
