// Installable app: registers the service worker and shows "A new version is available" when a newer web release is waiting or the backend version changed.
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

// `apply` runs when the member taps Update. The close icon hides the bar for this visit (a member in the middle of something can carry on);
// it stays hidden for the same update, and comes back on the next visit or when a newer update appears. `key` names the update.
const dismissed = new Set();
function showUpdateBanner(apply, key = 'web') {
  if (document.getElementById('update-banner') || dismissed.has(key)) return;
  const btn = button(t('pwa.update'), { kind: 'primary', icon: 'refresh', onClick: async () => { btn.disabled = true; try { await apply(); } finally { setTimeout(() => { btn.disabled = false; }, 6000); } } });   // enabled again if nothing happened
  const bar = h('div', { id: 'update-banner', class: 'update-banner', role: 'status' },
    icon('system_update'), h('span', { class: 'grow' }, t('pwa.updateReady')), btn,
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), title: t('common.close'), onClick: () => { dismissed.add(key); bar.remove(); } }, icon('close')));
  document.body.append(bar);
}
const workerIds = new WeakMap();
const workerKey = (w) => { if (!workerIds.has(w)) workerIds.set(w, 'web:' + (workerIds.size + Math.random().toString(36).slice(2, 6))); return workerIds.get(w); };
// What Update does. It does not use the worker the bar was made for: a newer release may have replaced that one (it is then redundant and ignores the message),
// while the bar from the older release is still showing. So it asks the registration for the worker that is waiting NOW. With none waiting (it already took over, or
// the bar is stale) it reloads. If the page is still here a few seconds after the message (the worker did not answer), it reloads anyway.
let reloading = false;
const reloadOnce = () => { if (!reloading) { reloading = true; location.reload(); } };
export async function applyUpdate() {
  let waiting = null;
  try { waiting = (registration || await navigator.serviceWorker?.getRegistration?.())?.waiting || null; } catch { waiting = null; }
  if (!waiting) { reloadOnce(); return; }
  waiting.postMessage('SKIP_WAITING');                         // the page reloads when the new worker takes control (controllerchange)
  setTimeout(reloadOnce, 4000);
}
const applyWorker = () => applyUpdate;

// The backend puts its version on every answer. The first one is remembered; a different one later means the backend was released,
// so offer the update. The remembered version moves on only when the member taps Update, so an ignored bar comes back next time.
const BE_KEY = 'sre.beVersion';
export function noteBackendVersion(v) {
  let seen = null;
  try { seen = localStorage.getItem(BE_KEY); if (!seen) localStorage.setItem(BE_KEY, v); } catch { return; }
  if (!seen || seen === v) return;
  showUpdateBanner(async () => {
    try { localStorage.setItem(BE_KEY, v); } catch { /* the bar may return once */ }
    await applyUpdate();
  }, 'be:' + v);
}

const CHECK_MS = 30000;
let registration = null;

// Ask for the newest release now. Resolves 'ready' (bar shown), 'latest' or 'unsupported'.
export async function checkForUpdates() {
  const reg = registration;
  if (!reg) return 'unsupported';
  try { await reg.update(); } catch { return 'latest'; }
  if (reg.installing) {
    const w = reg.installing;
    await new Promise((done) => { const f = () => { if (w.state === 'installed' || w.state === 'redundant') { w.removeEventListener('statechange', f); done(); } }; w.addEventListener('statechange', f); f(); });
  }
  if (reg.waiting && navigator.serviceWorker.controller) { dismissed.delete(workerKey(reg.waiting)); showUpdateBanner(applyWorker(), workerKey(reg.waiting)); return 'ready'; }
  return 'latest';
}

// The build of the worker running this page, for the Help screen.
export async function currentBuild() {
  const w = navigator.serviceWorker?.controller;
  if (!w) return '';
  return new Promise((res) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => res(e.data || '');
    w.postMessage('BUILD', [ch.port2]);
    setTimeout(() => res(''), 1500);
  });
}

export async function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  // The first install takes control of the open page without a reload; a later change of worker is an update, so reload into it.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) reloadOnce();
    controlled = true;
  });
  try {
    const reg = registration = await navigator.serviceWorker.register('sw.js');
    // A worker that fails to install (a file did not download) is dropped by the browser; look again soon.
    let retries = 0;
    const watch = (w) => w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) { retries = 0; showUpdateBanner(applyWorker(), workerKey(w)); }
      else if (w.state === 'redundant' && !reg.waiting && retries < 5) setTimeout(() => { retries++; reg.update().catch(() => {}); }, 3000 * 2 ** retries);
    });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(applyWorker(), workerKey(reg.waiting));
    reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    // Look for a new release when the app is opened, whenever it comes back to the front, and every 30 seconds while it is in front.
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(() => { if (document.visibilityState === 'visible') check(); }, CHECK_MS);
    check();
  } catch { /* no service worker: the site still works in the browser */ }
}
