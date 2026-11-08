// Guarda o app no aparelho para abrir sem internet. A versão muda a cada build.
const VERSAO = "cf-6b72093d18";
const ARQUIVOS = ["./", "index.html", "manifest.webmanifest", "local-store.js", "pwa.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Abre na hora com o que está guardado e atualiza em segundo plano (vale também para as fontes)
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !/^https?:/.test(req.url)) return;
  e.respondWith(caches.open(VERSAO).then(async c => {
    const guardado = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("index.html") : undefined);
    const rede = fetch(req).then(r => {
      if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
      return r;
    }).catch(() => guardado);
    if (guardado) { e.waitUntil(rede.catch(() => {})); return guardado; }
    return rede;
  }));
});
