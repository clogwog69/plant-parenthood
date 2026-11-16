// Minimal offline shell: network first, fall back to cache.
const CACHE = 'sprout-v6';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match(self.registration.scope))),
  );
});

// Notifications: "Prescott Drive / Simone watered Basil" and the morning list of jobs.
// When someone does the same job to several plants, the phone shows one
// "Simone watered 6 plants: Basil, Mint…" instead of six separate notifications.
// Longest first, so "added a photo of" wins over "added".
const VERBS = ['added a photo of', 'picked from', 'checked on', 'repotted', 'watered', 'added', 'fed'];
const BUNDLE_FOR = 30 * 60 * 1000;

function listPlants(names) {
  if (names.length <= 3) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

async function show(data) {
  const title = data.title || 'Plant Parenthood';
  const body = data.body || '';
  const plain = { body, icon: './notify-icon.png', badge: './notify-badge.png', tag: data.tag };
  let who, verb, plant;
  for (const v of VERBS) {
    const at = body.indexOf(` ${v} `);
    if (at > 0) { who = body.slice(0, at); verb = v; plant = body.slice(at + v.length + 2); break; }
  }
  if (!verb) return self.registration.showNotification(title, plain);

  const tag = `did:${title}:${who}:${verb}`;
  const now = Date.now();
  const earlier = (await self.registration.getNotifications({ tag })).find((n) => n.data && now - n.data.at < BUNDLE_FOR);
  const plants = [...new Set([...(earlier ? earlier.data.plants : []), plant])];
  return self.registration.showNotification(title, {
    ...plain,
    body: plants.length === 1 ? body : `${who} ${verb} ${plants.length} plants: ${listPlants(plants)}`,
    tag,
    data: { at: earlier ? earlier.data.at : now, plants },
  });
}

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { /* not JSON */ }
  e.waitUntil(show(data));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
