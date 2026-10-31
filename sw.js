// Service worker. scripts/publish.sh replaces BUILD and PRECACHE in the published copy, so every release has a new worker.
// A new worker waits until the page asks it to take over (the "Update" button), so a screen is never changed under a member.
const BUILD = '1dc3f445a12b';
const PRECACHE = '["css/app.css", "css/components.css", "css/driver.css", "css/legal.css", "css/shell.css", "css/tokens.css", "i18n/en.json", "i18n/te.json", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/logo.png", "index.html", "js/actions.js", "js/ai_helpers.js", "js/api.js", "js/app.js", "js/auth.js", "js/camera.js", "js/config.js", "js/devbar.js", "js/env.js", "js/fmt.js", "js/guide.js", "js/guide_content.js", "js/guide_image_ids.js", "js/guide_te.js", "js/i18n.js", "js/legal.js", "js/loader.js", "js/maint.js", "js/mock_api.js", "js/paging.js", "js/pending.js", "js/photo.js", "js/push.js", "js/pwa.js", "js/releases.js", "js/router.js", "js/share.js", "js/shell.js", "js/store.js", "js/swr.js", "js/tour.js", "js/tours/community.js", "js/tours/core.js", "js/tours/money_issues.js", "js/tours/people.js", "js/ui.js", "js/vendor/LICENSE-driver.txt", "js/vendor/driver.esm.js", "js/video.js", "js/views/accounts_monthly.js", "js/views/action_items.js", "js/views/ai.js", "js/views/audit.js", "js/views/community.js", "js/views/community_members.js", "js/views/complaint_detail.js", "js/views/complaints.js", "js/views/complaints_monthly.js", "js/views/complaints_pending.js", "js/views/documents.js", "js/views/down.js", "js/views/event_detail.js", "js/views/events.js", "js/views/expense_detail.js", "js/views/expenses.js", "js/views/fee_due.js", "js/views/fees.js", "js/views/fees_sheets.js", "js/views/gallery.js", "js/views/guide.js", "js/views/handover.js", "js/views/help.js", "js/views/home.js", "js/views/layout.js", "js/views/ledger.js", "js/views/maintenance.js", "js/views/maintenance_due.js", "js/views/maintenance_sheets.js", "js/views/map.js", "js/views/meeting_detail.js", "js/views/meetings.js", "js/views/members.js", "js/views/members_import.js", "js/views/members_sheets.js", "js/views/money.js", "js/views/money_soon.js", "js/views/noaccess.js", "js/views/opening_balance.js", "js/views/opening_balance_detail.js", "js/views/payments_all.js", "js/views/payments_common.js", "js/views/payments_mine.js", "js/views/placeholder.js", "js/views/plot_transfer.js", "js/views/plots.js", "js/views/poll_detail.js", "js/views/polls.js", "js/views/profile.js", "js/views/profile_contact.js", "js/views/reports.js", "js/views/roles.js", "js/views/settings.js", "js/views/signin.js", "js/views/whats_new.js", "js/write_map.js", "manifest.webmanifest", "map/plots.json"]';
const CACHE = `sre1a-${BUILD}`;

// Each file is fetched past the browser's own HTTP cache (GitHub Pages lets it keep files for 10 minutes). With addAll a worker installed soon after
// a release could store an older i18n/en.json next to newer scripts, and the screens then showed their text keys instead of words.
self.addEventListener('install', (e) => {
  const urls = PRECACHE === '["css/app.css", "css/components.css", "css/driver.css", "css/legal.css", "css/shell.css", "css/tokens.css", "i18n/en.json", "i18n/te.json", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/logo.png", "index.html", "js/actions.js", "js/ai_helpers.js", "js/api.js", "js/app.js", "js/auth.js", "js/camera.js", "js/config.js", "js/devbar.js", "js/env.js", "js/fmt.js", "js/guide.js", "js/guide_content.js", "js/guide_image_ids.js", "js/guide_te.js", "js/i18n.js", "js/legal.js", "js/loader.js", "js/maint.js", "js/mock_api.js", "js/paging.js", "js/pending.js", "js/photo.js", "js/push.js", "js/pwa.js", "js/releases.js", "js/router.js", "js/share.js", "js/shell.js", "js/store.js", "js/swr.js", "js/tour.js", "js/tours/community.js", "js/tours/core.js", "js/tours/money_issues.js", "js/tours/people.js", "js/ui.js", "js/vendor/LICENSE-driver.txt", "js/vendor/driver.esm.js", "js/video.js", "js/views/accounts_monthly.js", "js/views/action_items.js", "js/views/ai.js", "js/views/audit.js", "js/views/community.js", "js/views/community_members.js", "js/views/complaint_detail.js", "js/views/complaints.js", "js/views/complaints_monthly.js", "js/views/complaints_pending.js", "js/views/documents.js", "js/views/down.js", "js/views/event_detail.js", "js/views/events.js", "js/views/expense_detail.js", "js/views/expenses.js", "js/views/fee_due.js", "js/views/fees.js", "js/views/fees_sheets.js", "js/views/gallery.js", "js/views/guide.js", "js/views/handover.js", "js/views/help.js", "js/views/home.js", "js/views/layout.js", "js/views/ledger.js", "js/views/maintenance.js", "js/views/maintenance_due.js", "js/views/maintenance_sheets.js", "js/views/map.js", "js/views/meeting_detail.js", "js/views/meetings.js", "js/views/members.js", "js/views/members_import.js", "js/views/members_sheets.js", "js/views/money.js", "js/views/money_soon.js", "js/views/noaccess.js", "js/views/opening_balance.js", "js/views/opening_balance_detail.js", "js/views/payments_all.js", "js/views/payments_common.js", "js/views/payments_mine.js", "js/views/placeholder.js", "js/views/plot_transfer.js", "js/views/plots.js", "js/views/poll_detail.js", "js/views/polls.js", "js/views/profile.js", "js/views/profile_contact.js", "js/views/reports.js", "js/views/roles.js", "js/views/settings.js", "js/views/signin.js", "js/views/whats_new.js", "js/write_map.js", "manifest.webmanifest", "map/plots.json"]' ? [] : JSON.parse(PRECACHE);
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map(async (u) => {
    const res = await fetch(new Request(u, { cache: 'reload' }));
    if (!res.ok) throw new Error(`precache ${u}: ${res.status}`);
    await c.put(u, res);
  }))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('sre1a-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  else if (e.data === 'BUILD') e.ports[0]?.postMessage(BUILD);
});

// Google Fonts: the style sheet (fixed address, may change) is shown from the stored copy and refreshed behind it; the font files (addresses carry a version)
// never change, so they are kept for good. Own cache name, so a new release does not delete them. Without this every launch waits on two Google requests.
const FONT_CACHE = 'fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
async function fontFile(req, host) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  const load = () => fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (!hit) return load();
  if (host === 'fonts.googleapis.com') load().catch(() => {});
  return hit;
}

// Same-origin files: pages come from the cached shell, other files from the cache first (map tiles are added as they are viewed).
// Calls to the Apps Script API and other Google services are cross-origin and never touched.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(fontFile(req, url.hostname)); return; }
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate' && !/^\/(privacy|tnc)(\/|$)/.test(url.pathname)) {   // the public privacy and terms pages are plain pages, not the app
      // The page of this worker's release, from its own cache: it matches the scripts and strings stored with it, and opens without waiting for the network.
      // A newer release is found by the worker update check (js/pwa.js) and offered with the Update bar. With nothing stored (first visit, dev) it comes from the network.
      return (await cache.match('index.html')) || fetch(req.url, { cache: 'no-cache' });
    }
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});

// ---- Phone notifications (US21). The push has no content: ask the server what this device has not shown yet, and show it. ----
// The page leaves the API address, the sign-in and this device's address in IndexedDB (js/push.js); a worker cannot read localStorage.
function readKv() {
  return new Promise((res) => {
    const r = indexedDB.open('sre1a-push', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => res({});
    r.onsuccess = () => {
      const db = r.result, st = db.transaction('kv').objectStore('kv'), out = {};
      let left = 3;
      for (const k of ['api', 'token', 'endpoint']) { const g = st.get(k); g.onsuccess = () => { out[k] = g.result; if (!--left) { db.close(); res(out); } }; g.onerror = () => { if (!--left) { db.close(); res(out); } }; }
    };
  });
}
async function showPending() {
  let items = null;
  try {
    const k = await readKv();
    if (k.api && k.token && k.endpoint) {
      const res = await fetch(k.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'notifications.pending', idToken: k.token, payload: { endpoint: k.endpoint }, reqId: crypto.randomUUID() }) });
      const j = await res.json();
      if (j.ok) items = j.data.items || [];
    }
  } catch { items = null; }
  // A push must end in something visible; with no answer (offline, signed out) a plain line stands in.
  if (!items) items = [{ kind: 'open', at: '', title: 'Sai Ram Enclave', body: 'Open the app to see what is new.', screen: '/home' }];
  for (const it of items) {
    await self.registration.showNotification(it.title, { body: it.body, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: `${it.kind}:${it.at}`, data: { screen: it.screen } });
  }
}
self.addEventListener('push', (e) => e.waitUntil(showPending()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL('./#' + (e.notification.data?.screen || '/home'), self.registration.scope).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      await c.focus();
      try { await c.navigate(url); } catch { /* it stays where it is */ }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
