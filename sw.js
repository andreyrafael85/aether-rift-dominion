/* Aether Rift: Dominion — service worker (4.0f): campanha e partidas solo funcionam offline depois da primeira visita.
   Build 202611052046Z. Página: rede primeiro (atualiza quando online). Three.js, PeerJS e fontes: cache primeiro (URLs versionadas). */
const CACHE = 'ard-202611052046Z';
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/hero-belt.webp', './assets/favicon-64.png', './assets/favicon-32.png', './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png', './src/i18n/en.js?v=202611052046Z', './src/i18n/es.js?v=202611052046Z']; /* 5.0c: dicionários do inglês e do espanhol (a troca de idioma vale sem internet) */
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
/* 5.0c.1: vozes gravadas (assets/vozes/) numa cache à parte, que passa de uma versão para a outra: a página guarda nela cada fala que já tocou
   (src/vozes.js) e aqui ela é servida sem internet; o manifesto vem da rede primeiro (e fica guardado para a próxima vez sem rede) */
const VOZES = 'ard-vozes';
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ard-') && k !== CACHE && k !== VOZES /* 5.0c.1 */).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const IMMUTABLE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/(@[a-z0-9-]+\/)?[a-z0-9.-]+@\d[^/]*\/|cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.gstatic\.com\/)/; // 4.3b: qualquer pacote do jsDelivr com versão fixa (three, postprocessing, N8AO)
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = req.url;
  if (new URL(url).origin === self.location.origin && /\/assets\/vozes\//.test(new URL(url).pathname)) { /* 5.0c.1 */
    if (/manifesto\.json$/.test(new URL(url).pathname)) { e.respondWith(fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(VOZES).then(c => c.put(new URL(url).pathname, cp)); } return r; }).catch(() => caches.open(VOZES).then(c => c.match(new URL(url).pathname)).then(r => r || Response.error()))); return; }
    e.respondWith(caches.open(VOZES).then(c => c.match(req)).then(hit => hit || fetch(req))); return; }
  if (req.mode === 'navigate' || /\/(index\.html)?(\?.*)?$/.test(new URL(url).pathname) && new URL(url).origin === self.location.origin) {
    const pth = new URL(url).pathname, raiz = new URL('./', self.location).pathname, inicio = pth === raiz || pth === raiz + 'index.html'; /* 5.0c.1: só a tela do jogo vira a cópia de index.html para jogar sem internet (antes, abrir outra página do site, como lab/som-iphone.html, gravava essa página no lugar da tela inicial) */
    e.respondWith(fetch(req).then(r => { if (inicio && r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); } return r; }).catch(() => inicio ? caches.match('./index.html').then(r => r || caches.match('./')) : caches.match(req).then(r => r || Response.error())));
    return;
  }
  if (IMMUTABLE.test(url) || url.startsWith('https://fonts.googleapis.com/') || new URL(url).origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});
