// Getting the app onto someone's Home Screen. Phones only send notifications
// to the installed app, so anyone still in a browser tab gets reminded.

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
// Android Chrome offers its own "Install" box. Keep hold of it for our button.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; listeners.forEach((f) => f()); });
window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });

export const onInstallChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const canPrompt = () => !!deferred;
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const p = deferred;
  await p.prompt();
  const { outcome } = await p.userChoice;
  deferred = null;
  return outcome === 'accepted';
}

/** Opened from the Home Screen, not in a browser tab. */
export const installed = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type Device = 'iphone-safari' | 'iphone-other' | 'android' | 'computer';
export function device(): Device {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /crios|fxios|edgios|opios/i.test(ua) ? 'iphone-other' : 'iphone-safari';
  if (/android/i.test(ua)) return 'android';
  return 'computer';
}

const LATER = 'sprout.installLater';
/** Show the reminder unless they said "later" in the last 3 days. */
export function remindInstall(): boolean {
  if (installed()) return false;
  try { return Date.now() - Number(localStorage.getItem(LATER) ?? 0) > 3 * 86400000; } catch { return true; }
}
export function installLater() { try { localStorage.setItem(LATER, String(Date.now())); } catch { /* private mode */ } }
