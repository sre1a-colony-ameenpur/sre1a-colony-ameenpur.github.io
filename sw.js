// Service worker. scripts/publish.sh replaces BUILD and PRECACHE in the published copy, so every release has a new worker.
// A new worker waits until the page asks it to take over (the "Update" button), so a screen is never changed under a member.
const BUILD = '315540052ba7';
const PRECACHE = '["css/app.css", "css/components.css", "css/shell.css", "css/tokens.css", "i18n/en.json", "i18n/te.json", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/logo.png", "index.html", "js/actions.js", "js/api.js", "js/app.js", "js/auth.js", "js/config.js", "js/devbar.js", "js/env.js", "js/fmt.js", "js/i18n.js", "js/loader.js", "js/maint.js", "js/mock_api.js", "js/photo.js", "js/pwa.js", "js/releases.js", "js/router.js", "js/shell.js", "js/store.js", "js/swr.js", "js/ui.js", "js/video.js", "js/views/action_items.js", "js/views/audit.js", "js/views/community.js", "js/views/community_members.js", "js/views/complaint_detail.js", "js/views/complaints.js", "js/views/down.js", "js/views/event_detail.js", "js/views/events.js", "js/views/expense_detail.js", "js/views/expenses.js", "js/views/fees.js", "js/views/fees_sheets.js", "js/views/handover.js", "js/views/help.js", "js/views/home.js", "js/views/layout.js", "js/views/maintenance.js", "js/views/maintenance_sheets.js", "js/views/map.js", "js/views/meeting_detail.js", "js/views/meetings.js", "js/views/members.js", "js/views/members_import.js", "js/views/members_sheets.js", "js/views/money.js", "js/views/money_soon.js", "js/views/noaccess.js", "js/views/placeholder.js", "js/views/plot_transfer.js", "js/views/plots.js", "js/views/poll_detail.js", "js/views/polls.js", "js/views/profile.js", "js/views/roles.js", "js/views/signin.js", "js/views/whats_new.js", "manifest.webmanifest", "map/plots.json"]';
const CACHE = `sre1a-${BUILD}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE === '["css/app.css", "css/components.css", "css/shell.css", "css/tokens.css", "i18n/en.json", "i18n/te.json", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/logo.png", "index.html", "js/actions.js", "js/api.js", "js/app.js", "js/auth.js", "js/config.js", "js/devbar.js", "js/env.js", "js/fmt.js", "js/i18n.js", "js/loader.js", "js/maint.js", "js/mock_api.js", "js/photo.js", "js/pwa.js", "js/releases.js", "js/router.js", "js/shell.js", "js/store.js", "js/swr.js", "js/ui.js", "js/video.js", "js/views/action_items.js", "js/views/audit.js", "js/views/community.js", "js/views/community_members.js", "js/views/complaint_detail.js", "js/views/complaints.js", "js/views/down.js", "js/views/event_detail.js", "js/views/events.js", "js/views/expense_detail.js", "js/views/expenses.js", "js/views/fees.js", "js/views/fees_sheets.js", "js/views/handover.js", "js/views/help.js", "js/views/home.js", "js/views/layout.js", "js/views/maintenance.js", "js/views/maintenance_sheets.js", "js/views/map.js", "js/views/meeting_detail.js", "js/views/meetings.js", "js/views/members.js", "js/views/members_import.js", "js/views/members_sheets.js", "js/views/money.js", "js/views/money_soon.js", "js/views/noaccess.js", "js/views/placeholder.js", "js/views/plot_transfer.js", "js/views/plots.js", "js/views/poll_detail.js", "js/views/polls.js", "js/views/profile.js", "js/views/roles.js", "js/views/signin.js", "js/views/whats_new.js", "manifest.webmanifest", "map/plots.json"]' ? [] : JSON.parse(PRECACHE))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('sre1a-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// Same-origin files only: pages fall back to the cached shell, other files come from the cache first (map tiles are added as they are viewed).
// Calls to the Apps Script API and Google are cross-origin and never touched.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try { return await fetch(req); } catch { return (await cache.match('index.html')) || Response.error(); }
    }
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
