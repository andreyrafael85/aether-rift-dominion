/* Aether Rift: Dominion — service worker (4.0f): campanha e partidas solo funcionam offline depois da primeira visita.
   Build 202610181336Z. Página: rede primeiro (atualiza quando online). Three.js, PeerJS e fontes: cache primeiro (URLs versionadas). */
const CACHE = 'ard-202610181336Z';
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/hero-belt.webp', './assets/favicon-64.png', './assets/favicon-32.png', './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ard-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const IMMUTABLE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/(@[a-z0-9-]+\/)?[a-z0-9.-]+@\d[^/]*\/|cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.gstatic\.com\/)/; // 4.3b: qualquer pacote do jsDelivr com versão fixa (three, postprocessing, N8AO)
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = req.url;
  if (req.mode === 'navigate' || /\/(index\.html)?(\?.*)?$/.test(new URL(url).pathname) && new URL(url).origin === self.location.origin) {
    e.respondWith(fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); } return r; }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (IMMUTABLE.test(url) || url.startsWith('https://fonts.googleapis.com/') || new URL(url).origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});
