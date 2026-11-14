// Web push: "Simone watered Basil" and the morning list of jobs.
import { SetupError, pushFn } from './sync';

const K = 'sprout.pushEndpoint';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushBlocked = () => pushSupported() && Notification.permission === 'denied';

/** iPhones only allow notifications for apps opened from the Home Screen. */
export const needsHomeScreen = () =>
  !pushSupported() && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches;

function registration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, no) => setTimeout(() => no(new Error('no service worker')), 4000)),
  ]);
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function pushIsOn(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) localStorage.setItem(K, sub.endpoint);
    return !!sub;
  } catch { return false; }
}

/** Must be called from a tap. Throws an Error with a message fit to show. */
export async function enablePush(code: string, name: string): Promise<void> {
  if (!pushSupported()) throw new Error('This browser cannot show notifications.');
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications are blocked for this app. Allow them in your phone settings, then try again.');
  }
  try {
    const reg = await registration();
    const { key } = await pushFn<{ key: string }>({ action: 'key' });
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
    await pushFn({ action: 'subscribe', code, name, sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    localStorage.setItem(K, sub.endpoint);
  } catch (e) {
    throw new Error(e instanceof SetupError ? 'Notifications are not set up yet.' : 'Could not turn notifications on. Check your connection and try again.');
  }
}

export async function disablePush(): Promise<void> {
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) {
      await pushFn({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* nothing to turn off */ }
  localStorage.removeItem(K);
}

/** Tell everyone else in the household. Never blocks or fails the action. */
export function notifyHouse(code: string, title: string, body: string) {
  let from: string | null = null;
  try { from = localStorage.getItem(K); } catch { /* private mode */ }
  void pushFn({ action: 'notify', code, title, body, from }).catch(() => {});
}
