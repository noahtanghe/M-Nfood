// Service worker: de app opent ook zonder bereik, en nieuwe versies komen binnen zodra je online bent.
// Verhoog VERSION bij elke release zodat oude bestanden opgeruimd worden.

const VERSION = '2026-10-23.4';
const CACHE = `mn-shell-${VERSION}`;

// Google-foto's blijven over versies heen bewaard: elke foto komt maar één keer binnen.
const PHOTOS = 'mn-photos-v1';
const PHOTO_LIMIT = 400;

const CODE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/app.js',
  './js/config.js',
  './js/util.js',
  './js/icons.js',
  './js/hours.js',
  './js/state.js',
  './js/data.js',
  './js/sheets.js',
  './js/ui.js',
  './js/mapview.js',
  './js/search.js',
  './js/visit.js',
  './js/filters.js',
  './js/add.js',
  './js/edit.js',
  './js/detail.js',
  './js/stats.js',
  './js/surprise.js',
];

const STATIC = [
  './vendor/leaflet-1.9.4.js',
  './vendor/leaflet-1.9.4.css',
  './vendor/supabase-2.118.0.js',
  './fonts/bricolage.woff2',
  './fonts/pinyon-script.woff2',
  './fonts/plex-mono-medium.woff2',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...CODE, ...STATIC]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mn-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isPhoto = (url) => url.pathname.endsWith('/functions/v1/search-place') && url.searchParams.get('action') === 'photo';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isPhoto(url)) {
    event.respondWith(photoFirst(req));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase, kaarttegels: altijd via het netwerk
  const isStatic = /\/(vendor|fonts|icons)\//.test(url.pathname);
  event.respondWith(isStatic ? cacheFirst(req) : networkFirst(req));
});

async function photoFirst(req) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // alleen echte afbeeldingen bewaren (zolang de functie nog niet gedeployed is, antwoordt ze met tekst)
  if (res.ok && res.type !== 'opaque' && (res.headers.get('Content-Type') || '').startsWith('image/')) {
    cache
      .put(req, res.clone())
      .then(() => trimPhotos(cache))
      .catch(() => {});
  }
  return res;
}

async function trimPhotos(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - PHOTO_LIMIT))) await cache.delete(key);
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    return Response.error();
  }
}
