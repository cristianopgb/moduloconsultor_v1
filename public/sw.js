/* Service Worker completo para proceda.ia */

const APP_VERSION = "v3-2025-09-18";
const STATIC_CACHE = `proceda-static-${APP_VERSION}`;
const RUNTIME_CACHE = `proceda-runtime-${APP_VERSION}`;

/* Liste aqui o que PRECISA estar disponível offline no primeiro load */
const PRECACHE_URLS = [
  "/",                 // SPA
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png"
];

/* HTML offline embutido (usado se /index.html não estiver em cache) */
const OFFLINE_HTML = `
<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline • proceda.ia</title>
<style>body{margin:0;font:15px system-ui,Segoe UI,Roboto,sans-serif;background:#0b1220;color:#e5e7eb;display:grid;place-items:center;height:100vh}
.card{max-width:520px;padding:28px;border:1px solid #1f2937;border-radius:16px;background:#111827}
h1{margin:0 0 8px;font-weight:800;font-size:22px}
p{margin:0 0 14px;opacity:.9}
small{opacity:.6}</style>
<div class="card">
<h1>Sem conexão</h1>
<p>Você está offline. Assim que a conexão voltar, recarregue a página.</p>
<small>proceda.ia</small>
</div></html>`;

/* INSTALAÇÃO: pré-cache do básico */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ATIVAÇÃO: remove caches antigos */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Estratégias:
   - Navegação (SPA): network-first → cache → offline embutido
   - Assets estáticos locais (/assets/*, .css, .js, fontes, imagens): cache-first (stale-while-revalidate simples)
   - Demais GET do mesmo domínio: network-first com fallback ao cache
*/
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navegações (SPA)
  if (req.mode === "navigate") {
    event.respondWith(handleNavigationRequest(req));
    return;
  }

  // Não cachear chamadas de analytics e afins
  if (/\/(analytics|collect|stats)\b/i.test(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Não cachear requisições ao Supabase (auth, REST API, storage)
  if (url.hostname.includes('supabase.co')) {
    return; // Deixa o browser fazer a requisição normal
  }

  // Assets estáticos locais
  if (
    sameOrigin &&
    (url.pathname.startsWith("/assets/") ||
      /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(
        url.pathname
      ))
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Tudo mais do mesmo domínio: network-first com fallback
  if (sameOrigin) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Requests de outros domínios: só proxy (sem cache agressivo)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* Mensagem para ativar imediatamente a nova versão do SW */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- Estratégias ---------- */

async function handleNavigationRequest(req) {
  // Network-first
  try {
    const res = await fetch(req);
    // Se veio HTML válido, atualiza o cache do index para fallback futuro
    if (isHtml(res)) {
      const cache = await caches.open(STATIC_CACHE);
      // Sempre servir /index.html para SPA (ignora querystring)
      const indexReq = new Request("/index.html", { cache: "reload" });
      cache.put(indexReq, res.clone());
    }
    return res;
  } catch (err) {
    // Falhou a rede → tenta cache do index
    const cache = await caches.open(STATIC_CACHE);
    const cachedIndex =
      (await cache.match("/index.html")) || (await caches.match("/index.html"));
    if (cachedIndex) return cachedIndex;
    // Último recurso: HTML offline embutido
    return new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 200,
    });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    // SWR simples: atualiza em background
    revalidate(req).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (shouldCacheResponse(res)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return cached || Promise.reject(err);
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (shouldCacheResponse(res)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function revalidate(req) {
  try {
    const res = await fetch(req);
    if (shouldCacheResponse(res)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(req, res.clone());
    }
  } catch {}
}

function shouldCacheResponse(res) {
  if (!res || res.status !== 200) return false;
  const ct = res.headers.get("Content-Type") || "";
  // Cacheia só recursos estáticos/HTML do app
  return (
    /text\/html|application\/javascript|text\/javascript|text\/css|font\/|image\//i.test(
      ct
    ) || ct === ""
  );
}

function isHtml(res) {
  const ct = res.headers.get("Content-Type") || "";
  return /text\/html/i.test(ct);
}
