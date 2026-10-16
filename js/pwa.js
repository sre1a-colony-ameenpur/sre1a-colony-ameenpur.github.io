// Installable app: registers the service worker and shows "A new version is available" when a newer release is waiting.
import { h, button, icon } from './ui.js';
import { t } from './i18n.js';

let deferredInstall = null;
const installSubs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; installSubs.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; installSubs.forEach((f) => f()); });
}

// Install state for the Help card: { canPrompt, installed, ios }
export function installState() {
  const standalone = globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.navigator?.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(globalThis.navigator?.userAgent || '');
  return { canPrompt: !!deferredInstall, installed: standalone, ios };
}
export async function promptInstall() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installSubs.forEach((f) => f());
}
export const onInstallChange = (f) => { installSubs.add(f); return () => installSubs.delete(f); };

function showUpdateBanner(worker) {
  if (document.getElementById('update-banner')) return;
  const btn = button(t('pwa.update'), { kind: 'primary', icon: 'refresh', onClick: () => {
    btn.disabled = true;
    worker.postMessage('SKIP_WAITING');        // the page reloads when the new worker takes control
  } });
  document.body.append(h('div', { id: 'update-banner', class: 'update-banner', role: 'status' },
    icon('system_update'), h('span', { class: 'grow' }, t('pwa.updateReady')), btn));
}

export async function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  // The first install takes control of the open page without a reload; a later change of worker is an update, so reload into it.
  let controlled = !!navigator.serviceWorker.controller, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled && !reloading) { reloading = true; location.reload(); }
    controlled = true;
  });
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    const watch = (w) => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(w); });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    // Look for a new release when the app is opened and whenever it comes back to the front.
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    check();
  } catch { /* no service worker: the site still works in the browser */ }
}
