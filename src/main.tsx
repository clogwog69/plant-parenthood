import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });

  // A phone can keep the app open for days. When it comes back to the app and
  // a newer version is out, reload once they are on the home screen, so
  // nobody loses something they were typing.
  const mine = document.querySelector<HTMLScriptElement>('script[src*="assets/index-"]')?.src.split('/').pop();
  let newer = false;
  const home = () => location.hash === '' || location.hash === '#/' || location.hash === '#';
  const check = async () => {
    if (!mine || document.visibilityState !== 'visible') return;
    try {
      const html = await (await fetch('./', { cache: 'no-store' })).text();
      const live = /assets\/(index-[\w-]+\.js)/.exec(html)?.[1];
      if (live && live !== mine) newer = true;
    } catch { /* offline */ }
    if (newer && home()) location.reload();
  };
  document.addEventListener('visibilitychange', () => void check());
  window.addEventListener('hashchange', () => { if (newer && home()) location.reload(); });
}

// Ask the phone not to clear our photos when it is short on space.
void navigator.storage?.persist?.();
