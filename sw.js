/* ============================================================
   SLIME BY — service worker (progressive enhancement).
   Caches the app shell for instant repeat loads + offline
   resilience. Bumps with VERSION; old caches are purged on
   activate. Deliberately NOT cached: the admin, the editor
   preview, cross-origin requests (Supabase / YouTube / Spotify),
   range requests, and the large MP3s (served immutable over HTTP
   already — caching them here would just bloat storage).
   ============================================================ */
const VERSION = 'sb-cache-v4';   // bumped: js/css now network-first (no one-deploy-stale scripts under fresh html)
const CORE = [
  '/', '/index.html',
  '/assets/styles.css', '/assets/app.js', '/cms.js', '/assets/analytics.js',
  '/assets/icon.svg', '/manifest.webmanifest',
  '/assets/fonts/oswald-latin.woff2', '/assets/fonts/pirata-one-latin.woff2',
];

self.addEventListener('install', (e) => {
  // resilient precache — a single missing asset must not fail the whole install
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== location.origin) return;        // Supabase / YouTube / Spotify → straight to network
  if (url.pathname === '/admin.html') return;        // never cache the admin
  if (/[?&]preview\b/.test(url.search)) return;      // editor preview
  if (/\.mp3$/i.test(url.pathname) || req.headers.has('range')) return;  // skip big audio + range requests

  const isHTML = req.mode === 'navigate' || url.pathname === '/' || /\.html$/i.test(url.pathname);
  // scripts + styles ride with the html: a fresh shell must never run against a
  // stale-while-revalidate copy of app.js/cms.js/styles.css from the previous deploy
  // (that pairing is one deploy behind on every returning visitor's first load).
  const isCode = /\.(?:js|css)$/i.test(url.pathname);
  if (isHTML || isCode) {
    // network-first: fresh shell when online (so a redeploy / CMS shell change lands),
    // cached fallback when offline.
    e.respondWith(
      fetch(req)
        .then((r) => {
          // only cache good responses: a 404 (e.g. the clean-URL smart-link route is
          // SERVED as a 404 by GitHub Pages) or a transient 500 must never become the
          // offline copy — and skipping them also stops every visited /slug from
          // piling its own entry into the cache.
          if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); }
          return r;
        })
        .catch(() => caches.match(req).then((m) => m || (isHTML ? caches.match('/index.html') : undefined)))
    );
    return;
  }

  // static assets (css / js / fonts / images / svg): stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((r) => { if (r && r.status === 200) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; })
        .catch(() => cached);
      return cached || net;
    })
  );
});
