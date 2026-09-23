/* code-explorer-sw.js — optional service-worker upgrade for <code-explorer> previews.
Host this file NEXT TO code-explorer.js (same directory, https). The component detects it
automatically and serves previews as real URLs under <dir>/__ce/<session>/<path>, giving
full fidelity: ES modules, fetch, workers, CSS @import, multi-page navigation — no patching.
File payloads are stored in the Cache API, so they survive worker restarts. */
'use strict';
const CACHE = 'code-explorer-vfs';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.type !== 'ce-vfs') return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(Object.entries(d.files).map(([p, f]) =>
      cache.put(new Request(d.base + p), new Response(f.d, { headers: { 'Content-Type': f.m } }))));
    if (e.source) e.source.postMessage({ type: 'ce-vfs-ready', id: d.id });
  })());
});
self.addEventListener('fetch', e => {
  const url = e.request.url.split(/[?#]/)[0];
  if (url.includes('/__ce/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const direct = await cache.match(url);
      if (direct) return direct;
      const base = url.match(/^.*\/__ce\/[^/]+\//)[0];
      const segs = url.slice(base.length).split('/');
      for (let i = 1; i < segs.length; i++) {
        const hit = await cache.match(base + segs.slice(i).join('/'));
        if (hit) return hit;
      }
      return new Response('Not found in this share', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    })());
    return;
  }
  // requests made BY a preview page (absolute paths like /src/app.js) re-enter its VFS
  if (new URL(url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    let m = (e.request.referrer || '').match(/^.*\/__ce\/[^/]+\//);
    if (!m) { const c = e.clientId && await self.clients.get(e.clientId); m = c && c.url.match(/^.*\/__ce\/[^/]+\//); }
    const cache = await caches.open(CACHE);
    const segs = new URL(url).pathname.replace(/^\/+/, '').split('/');
    if (m) for (let i = 0; i < segs.length; i++) {
      const hit = await cache.match(m[0] + segs.slice(i).join('/'));
      if (hit) return hit;
    }
    if (!m) { // no session context (e.g. clientId missing): suffix-match across cached VFS keys
      const keys = await cache.keys();
      for (let i = 0; i < segs.length; i++) {
        const suffix = '/' + segs.slice(i).join('/');
        const k = keys.find(r => { const u = r.url.split(/[?#]/)[0]; return u.includes('/__ce/') && u.endsWith(suffix); });
        if (k) { const hit = await cache.match(k); if (hit) return hit; }
      }
    }
    return fetch(e.request);
  })());
});
