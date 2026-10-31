// タイピングスタジアムのサービスワーカー（PWA）
// 役目：一度開いたページを手元にとっておき、ネットが無くても起動できるようにする
// 方針：
//   ・同じ場所のファイルは「まずネット → だめならとっておいた物」。開くたびに新しい物を取りに行くので、
//     ネットがある時はいつも最新。ネットが無い時だけ とっておいた物で動く
//   ・Google Fonts は「とっておいた物をすぐ出し、裏で取り直す」（無くても ふつうの書体で動く）
//   ・VERSION は build.py --site が作る時に日時に置き換える。版が変わると新しい入れ物を使い、古い入れ物は消す
const VERSION = "2026-11-01_02:16";
const PREFIX = "typing-stadium-";
const CACHE = PREFIX + VERSION;
const FONT_CACHE = PREFIX + "fonts";
const PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") {
      const index = await cache.match("./index.html");
      if (index) return index;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}
