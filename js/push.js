// Phone notifications for this device (US21, FR-138). The push carries no content: the service worker (sw.js) asks the server what to show.
// This file asks for permission, subscribes, tells the server, and leaves the worker what it needs to reach the server (it cannot read localStorage).
import { CONFIG } from './config.js';
import { SESSION_KEY } from './auth.js';

// 'ok' | 'ios-home' (an iPhone gets push only for the app added to the Home Screen) | 'unsupported'
export function pushSupport(env = globalThis) {
  const ua = env.navigator?.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua);
  const standalone = env.matchMedia?.('(display-mode: standalone)')?.matches || env.navigator?.standalone === true;
  if (ios && !standalone) return 'ios-home';
  return env.navigator && 'serviceWorker' in env.navigator && 'PushManager' in env && 'Notification' in env ? 'ok' : 'unsupported';
}

export function keyBytes(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// What the worker needs: where the API is, the 30-day sign-in, and this device's address.
const DB = 'sre1a-push';
function openKv() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvWrite(entries) {
  const db = await openKv();
  await new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    const st = tx.objectStore('kv');
    for (const [k, v] of Object.entries(entries)) (v == null ? st.delete(k) : st.put(v, k));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}

const registration = () => navigator.serviceWorker.ready;
const subscription = async () => (await registration()).pushManager.getSubscription();

export async function isOn() {
  try { return Notification.permission === 'granted' && !!(await subscription()); } catch { return false; }
}

// Copies the sign-in and address for the worker. Called when notifications are turned on and each time the app opens signed in.
export async function shareWithWorker() {
  try {
    const sub = await subscription();
    let token = null; try { token = localStorage.getItem(SESSION_KEY); } catch { /* private mode */ }
    if (sub) await kvWrite({ api: CONFIG.apiUrl, token, endpoint: sub.endpoint });
  } catch { /* the worker then shows a plain "open the app" line */ }
}

// 'on' | 'denied'. Permission is asked only here, from the member's tap (FR-138).
export async function turnOn(api, publicKey) {
  if (await Notification.requestPermission() !== 'granted') return 'denied';
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api.call('notifications.subscribe', { endpoint: sub.endpoint });
  await shareWithWorker();
  return 'on';
}
export async function turnOff(api) {
  const sub = await subscription();
  if (!sub) return;
  try { await api.call('notifications.unsubscribe', { endpoint: sub.endpoint }); } catch { /* the push service drops the dead address later */ }
  await sub.unsubscribe();
  await kvWrite({ api: null, token: null, endpoint: null });
}
// On sign-out: this phone stops receiving for the person who leaves. The server drops the dead address when its push service says it is gone.
export async function forgetDevice() {
  try { const sub = await subscription(); if (sub) await sub.unsubscribe(); await kvWrite({ api: null, token: null, endpoint: null }); } catch { /* nothing to forget */ }
}
