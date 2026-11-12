/* Nara System — Service Worker (V3.4.39)
 * - Menyimpan tampilan aplikasi (HTML/CSS/JS/ikon) agar dibuka cepat dari ikon HP.
 * - Data (/api, /rest, /storage, /auth) SELALU dari server, tidak pernah di-cache.
 * - Versi baru: aplikasi menampilkan tombol "Perbarui"; cache lama dihapus otomatis.
 */
const APP_VERSION = '3.4.39';
const CACHE = `nara-shell-${APP_VERSION}`;
const SHELL = [
  '/', `/styles.css?v=${APP_VERSION}`, `/app.js?v=${APP_VERSION}`, '/offline', '/manifest.webmanifest',
  '/assets/natara-logo.jpeg', '/assets/natara-mark.png', '/assets/favicon.png',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'
];
const NETWORK_ONLY = [/^\/api\//, /^\/rest\//, /^\/storage\//, /^\/auth\//, /^\/app-build\.json/, /^\/info(\/|$)/, /^\/public(\/|$)/, /^\/informasi(\/|$)/, /^\/__/];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => null));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('nara-shell-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.some(rx => rx.test(url.pathname))) return; // data selalu langsung ke server

  // Halaman (navigasi): coba server dulu; offline → tampilan tersimpan, atau halaman offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const c = await caches.open(CACHE);
      const net = fetch(req).then(res => { if (res.ok && url.pathname === '/') c.put('/', res.clone()); return res; });
      // Sinyal lapangan lemah: bila server belum menjawab dalam 4 detik, pakai tampilan tersimpan (data tetap diambil dari server).
      const timeout = new Promise(r => setTimeout(() => r(null), 4000));
      try {
        const first = await Promise.race([net, timeout]);
        if (first) return first;
        const shell = url.pathname === '/' ? await c.match('/') : null;
        return shell || await net;
      } catch (_) {
        return (await c.match('/offline')) || Response.error();
      }
    })());
    return;
  }

  // Aset statis: ambil dari cache (cepat), sambil memperbarui di latar belakang.
  event.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(req);
    const network = fetch(req).then(res => { if (res.ok && res.type === 'basic') c.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});
