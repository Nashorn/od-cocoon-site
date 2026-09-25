// Serve immutable editor runs only. Ordinary site and hero requests are untouched.
const CACHE = 'cocoon-showcase-runs-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/showcase\/runs\/([a-zA-Z0-9-]+)\/(.*)$/);
  if (!match || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const path = match[2];
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url.origin + url.pathname);
    if (hit) return hit;
    // Shell files are fixed; only the example namespace comes from the editor.
    if (path === 'index.html' || path === '.importmap' || path.startsWith('src/lab/')) {
      return fetch(new URL('/showcase/' + path, url.origin));
    }
    return new Response('File missing from this example run', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  })());
});
