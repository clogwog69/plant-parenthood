// Minimal offline shell: network first, fall back to cache.
const CACHE = 'sprout-v5';
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

// Notifications: "Watered Basil" and the morning list of jobs.
// When someone does the same job to several plants, the phone shows one "Watered 6 plants"
// instead of six separate notifications.
const ACTIONS = ['Watered', 'Fed', 'Repotted', 'Picked from', 'Checked on', 'New photo of', 'Added'];
const PLURAL = { 'New photo of': 'New photos of' };
const BUNDLE_FOR = 30 * 60 * 1000;

function listPlants(names) {
  const uniq = [...new Set(names)];
  if (uniq.length <= 3) return uniq.length === 1 ? uniq[0] : `${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]}`;
  return `${uniq.slice(0, 3).join(', ')} and ${uniq.length - 3} more`;
}

async function show(data) {
  const title = data.title || 'Plant Parenthood';
  const body = data.body || '';
  const action = ACTIONS.find((a) => title.startsWith(a + ' '));
  if (!action) {
    return self.registration.showNotification(title, { body, icon: './notify-icon.png', badge: './notify-badge.png', tag: data.tag });
  }
  const plant = title.slice(action.length + 1);
  const tag = `did:${action}:${body}`;
  const now = Date.now();
  const earlier = (await self.registration.getNotifications({ tag }))
    .find((n) => n.data && now - n.data.at < BUNDLE_FOR);
  const plants = [...(earlier ? earlier.data.plants : []), plant];
  const count = new Set(plants).size;
  const words = count === 1 ? title : `${PLURAL[action] || action} ${count} plants`;
  const by = body.replace(/ · .*$/, '');
  return self.registration.showNotification(words, {
    body: count === 1 ? body : `${listPlants(plants)}. ${by}.`,
    icon: './notify-icon.png',
    badge: './notify-badge.png',
    tag,
    renotify: false,
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
