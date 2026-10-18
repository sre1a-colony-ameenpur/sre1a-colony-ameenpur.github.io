// App bootstrap: i18n, theme, auth, session, router and shell.
import { CONFIG, isMock, isDevHost } from './config.js';
import { store, can } from './store.js';
import { loadLang, t, getLang } from './i18n.js';
import { createClient, fetchTransport, ApiError, friendly } from './api.js';
import { createAuth, decodeJwt } from './auth.js';
import { createRouter } from './router.js';
import { h, icon, button, toast, busy, setMyPhoto } from './ui.js';
import { createSwr } from './swr.js';
import { registerPwa } from './pwa.js';
import { buildNav, buildTopbar } from './shell.js';
import { devbar } from './devbar.js';

const root = document.getElementById('app');
const mock = isMock();
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

// Routes. `needs` hides a route when caps lack it; the server still checks every call.
const lazy = (f) => () => import(f);
const stub = (path, title, needs) => ({ path, title, needs, load: lazy('./views/placeholder.js') });
const routes = [
  { path: '/signin', public: true, load: lazy('./views/signin.js'), bare: true },
  { path: '/no-access', public: true, load: lazy('./views/noaccess.js'), bare: true },
  { path: '/down', public: true, load: lazy('./views/down.js'), bare: true },
  { path: '/home', title: 'nav.home', load: lazy('./views/home.js') },
  { path: '/profile', back: '/home', title: 'menu.profile', load: lazy('./views/profile.js') },
  { path: '/whats-new', back: '/home', title: 'menu.whatsNew', load: lazy('./views/whats_new.js') },
  { path: '/help', back: '/home', title: 'menu.help', load: lazy('./views/help.js') },
  { path: '/issues', title: 'nav.issues', needs: ['complaints', 'r'], load: lazy('./views/complaints.js') }, { path: '/issues/pending', back: '/issues', title: 'nav.issues', needs: ['complaints', 'r'], load: lazy('./views/complaints_pending.js') }, { path: '/issues/monthly', back: '/issues', title: 'nav.issues', needs: ['complaints', 'r'], load: lazy('./views/complaints_monthly.js') }, { path: '/issues/:id', back: '/issues', title: 'nav.issues', needs: ['complaints', 'r'], load: lazy('./views/complaint_detail.js') },
  { path: '/money', title: 'nav.money', load: lazy('./views/money.js') }, { path: '/money/payments', back: '/money', title: 'nav.money', needs: ['maintenance_payments', 'r'], load: lazy('./views/payments_all.js') }, { path: '/profile/payments', back: '/profile', title: 'menu.profile', load: lazy('./views/payments_mine.js') }, { path: '/money/accounts', back: '/money', title: 'nav.money', needs: ['expenses', 'r'], load: lazy('./views/accounts_monthly.js') }, { path: '/money/expense/:id', back: '/money', title: 'nav.money', needs: ['expenses', 'r'], load: lazy('./views/expense_detail.js') }, { path: '/community', title: 'nav.community', load: lazy('./views/community.js') }, { path: '/community/polls/:id', back: '/community', title: 'nav.community', needs: ['polls', 'r'], load: lazy('./views/poll_detail.js') }, { path: '/community/events/:id', back: '/community', title: 'nav.community', needs: ['events', 'r'], load: lazy('./views/event_detail.js') }, { path: '/community/action-items', back: '/community', title: 'nav.community', needs: ['action_items', 'r'], load: lazy('./views/action_items.js') }, { path: '/community/meetings/:id', back: '/community', title: 'nav.community', needs: ['meetings', 'r'], load: lazy('./views/meeting_detail.js') },
  { path: '/map', title: 'nav.map', needs: ['map_profile', 'r'], load: lazy('./views/map.js') },
  { path: '/members', back: '/home', title: 'menu.members', needs: ['members', 'r'], load: lazy('./views/members.js') }, { path: '/members/import', back: '/members', title: 'imp.title', needs: ['members', 'c'], load: lazy('./views/members_import.js') }, { path: '/roles', back: '/home', title: 'menu.roles', needs: ['roles_config', 'r'], load: lazy('./views/roles.js') },
  { path: '/plots', back: '/home', title: 'menu.plots', needs: ['plots', 'r'], load: lazy('./views/plots.js') }, { path: '/plots/layout', back: '/plots', title: 'menu.plots', needs: ['plots', 'r'], load: lazy('./views/layout.js') }, { path: '/audit', back: '/home', title: 'menu.audit', needs: ['audit', 'r'], load: lazy('./views/audit.js') },
  { path: '/gallery', back: '/home', title: 'menu.gallery', load: lazy('./views/gallery.js') },
  { path: '/documents', back: '/home', title: 'menu.documents', load: lazy('./views/documents.js') },
  { path: '/settings', back: '/home', title: 'menu.settings', needs: ['handover', 'c'], load: lazy('./views/settings.js') },
  { path: '/handover', back: '/home', title: 'menu.handover', needs: ['handover', 'c'], load: lazy('./views/handover.js') },
];

// ---- mock / real wiring ----
let mockCtl = null;
let auth;
// DEV ONLY (remove before go-live): ?api=http://127.0.0.1:8787 sends the same persona picker to the local real backend
// (sre-1a-colony-app-backend/scripts/dev-server.js) with a fake token instead of using the in-browser mock.
const devApi = mock && isDevHost() ? new URLSearchParams(location.search).get('api') || ss.get('sre.devApi') : null;
if (devApi) ss.set('sre.devApi', devApi);
if (mock) {
  const { createMock, MOCK_USERS } = await import('./mock_api.js');
  mockCtl = createMock();
  const key = () => ss.get('sre.mockRole');
  const token = () => (devApi ? 'tok:' + (MOCK_USERS[key()]?.email || mockEmail()) : 'mock:' + key());
  auth = {
    init: async () => true, renderButton() {}, refresh: async () => token(),
    getToken: async () => token(),
    signOut() { ss.set('sre.mockRole', null); },
    claims: () => null,
  };
} else {
  auth = createAuth({ clientId: CONFIG.clientId, onToken: () => { if (store.get().status !== 'in') boot(); }, onSignedOut: () => {} });
}

// All views call the API through here: it flags offline/expired states globally.
const client = createClient({ transport: devApi ? fetchTransport(devApi) : mock ? mockCtl.transport : fetchTransport(CONFIG.apiUrl), getIdToken: () => auth.getToken() });
const READ_ACTION = /\.(list|get|mine|status|totals|lookup|holders|history|forMember|removedBalances|plots|profile|committee|proof|photo|summary|directory|importSheet|monthly|pending|results|video|check|[pP]review)$/;      // reads: no blocking overlay, and the stored answers are kept
// A floating "Loading" bar just under the header while data is fetched in the background (stored answers are shown first, see swr.js).
const syncText = h('span', {});
const syncDot = h('div', { class: 'sync-bar', role: 'status', hidden: true }, syncText, h('span', { class: 'spinner', 'aria-hidden': 'true' }));
document.body.append(syncDot);
const lsOrNull = (() => { try { return globalThis.localStorage || null; } catch { return null; } })();
const swrCache = createSwr({ call: (a, p) => api.call(a, p), storage: lsOrNull, userKey: () => store.get().session?.email,
  onSync: (n) => { syncDot.hidden = n <= 0; if (n > 0) syncText.textContent = t('common.loadingBar'); } });
const api = {
  swr: (action, payload, cb) => swrCache.swr(action, payload || {}, cb),
  swrMany: (specs, cb) => swrCache.many(specs, cb),
  async call(action, payload) {
    const block = !READ_ACTION.test(action);
    if (block) busy.start();
    try {
      const out = await client.call(action, payload);
      if (!store.get().online) store.set({ online: true });
      if (block) swrCache.clear();                                    // a write may change anything we stored
      return out;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NETWORK') store.set({ online: false });
      else if (e instanceof ApiError && e.code === 'BAD_TOKEN' && store.get().status === 'in') {
        auth.signOut(); store.set({ status: 'out', session: null, notice: 'signin.expired' }); router.refresh();
      }
      throw e;
    } finally {
      if (block) busy.end();
    }
  },
};

// ---- preferences ----
function applyTheme(theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}
// Changing the language only re-draws: stored answers are reused, so no data requests are sent.
async function setLang(l) { ls.set('sre.lang', l); await loadLang(l); await swrCache.withoutRefresh(renderAll); }
function setTheme(th) { ls.set('sre.theme', th); store.set({ theme: th }); applyTheme(th); }

// ---- session ----
async function boot(render = true) {
  store.set({ status: 'boot' });
  try {
    const hasToken = mock ? ss.get('sre.mockRole') : auth.current();
    if (!hasToken || ss.get('sre.mockRole') === 'out') store.set({ status: 'out' });
    else await loadSession();
  } catch { store.set({ status: 'down' }); }
  if (render) router.refresh();
}
async function loadSession() {
  try {
    const session = await api.call('session.get');
    session.plotKeys = (session.plotKeys || []).map((k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2'));   // screens show A-12; the API takes either
    store.set({ status: 'in', session, user: { email: session.email, name: session.name }, online: true, notice: null });
    if (!mock) auth.keepSession((a, p) => client.call(a, p));   // not awaited: a 30-day sign-in for the phone
    loadMyPhoto(session);       // not awaited: the photo never holds up sign-in
    if (!ls.get('sre.lang') && session.language && session.language !== getLang()) await loadLang(session.language);
  } catch (e) {
    if (e.code === 'NO_ACCESS') {
      const c = mock ? { email: mockEmail() } : (auth.claims() || {});
      store.set({ status: 'noaccess', session: null, user: { email: c.email } });
    } else if (e.code === 'BAD_TOKEN') store.set({ status: 'out', notice: 'signin.expired' });
    else store.set({ status: 'down' });
  }
}
// First sign-in without a photo: the server takes the Google picture (if any). Then the photo is fetched once for the avatar.
async function loadMyPhoto(session) {
  try {
    if (!session.hasPhoto && !(await api.call('profile.syncGooglePhoto')).saved) return;
    setMyPhoto(`data:image/jpeg;base64,${(await api.call('profile.photo')).jpegBase64}`);
  } catch { /* initials stay */ }
}
const mockEmail = () => ({ unlisted: 'someone.else@example.com', removed: 'former.member@example.com' })[ss.get('sre.mockRole')] || '';

function signOut() {
  swrCache.clear(); setMyPhoto('');
  auth.signOut();
  store.set({ status: 'out', session: null, user: null, notice: null });
  location.hash = '#/signin'; router.refresh();
}
async function mockSignIn(key) { ss.set('sre.mockRole', key); await boot(); }
async function pickMock(v) { // dev switcher
  if (v === 'out') { signOut(); return; }
  if (v === 'down') { mockCtl.setDown(true); store.set({ online: false }); renderAll(); return; }
  mockCtl.setDown(false); store.set({ online: true });
  ss.set('sre.mockRole', v); ss.set('sre.devPick', v);
  await boot();
  if (store.get().status === 'in') location.hash = '#/home';
}

// ---- rendering ----
let current = null; // current resolved route
const ctx = () => ({
  api, t, store, can, mock, auth, lang: getLang(), setLang, setTheme, signOut, mockSignIn, toast,
  route: current?.route, params: current?.params || {}, query: current?.query || {},
  retryBoot: () => boot(), navigate: (p) => { location.hash = p; },
});

async function renderAll() { await renderRoute(current); }

async function renderRoute(r) {
  current = r;
  const s = store.get();
  if (r?.denied) toast(t('common.notAvailable'));
  if (!r?.route) return;
  const route = r.route;
  const mod = await route.load();
  if (current !== r) return;                    // a newer navigation started while this view was loading: drawing now would put an old screen over the new one
  const c = ctx();
  const view = await mod.default(c);
  if (current !== r) return;
  const dev = mock ? devbar(ss.get('sre.devPick') || (s.status === 'in' ? 'member' : 'member'), pickMock) : null;
  if (route.bare) {
    root.replaceChildren(dev, view);
    document.title = CONFIG.appName;
    return;
  }
  const title = t(route.title);
  const main = h('main', { class: 'content', id: 'main', tabindex: '-1' }, banners(), view);
  root.replaceChildren(
    dev, h('a', { class: 'skip', href: '#main', onClick: (e) => { e.preventDefault(); main.focus(); } }, t('common.skip')),
    h('div', { class: 'app' }, buildNav(s, r.path), buildTopbar(s, { title: r.path === '/home' ? CONFIG.appName : title, back: route.back, lang: getLang(), setLang, onSignOut: signOut }), main));
  document.title = `${title} · ${CONFIG.appName}`;
  main.focus({ preventScroll: true });
}

// Offline / error banner with Try again.
function banners() {
  const box = h('div', { 'aria-live': 'polite' });
  if (!store.get().online) {
    box.append(h('div', { class: 'banner bad', role: 'alert', style: 'margin:-16px calc(var(--gutter) * -1) 16px' }, icon('cloud_off'),
      h('div', { class: 'grow' }, t('offline.text')),
      button(t('common.retry'), { onClick: () => { if (mockCtl?.isDown()) mockCtl.setDown(false); store.set({ online: true }); renderAll(); } })));
  }
  return box;
}

const router = createRouter({
  routes, getState: () => store.get(), canFn: (e, v) => can(e, v),
  onRoute: (r) => renderRoute(r).catch((e) => { root.replaceChildren(h('p', { class: 'page' }, friendly(e, t))); console.error(e); }),
});

// ---- start ----
// Mock-only shortcuts for the smoke script: ?mock=1&as=president&theme=dark
if (mock && isDevHost()) {
  const q = new URLSearchParams(location.search);
  if (q.get('as')) { ss.set('sre.mockRole', q.get('as')); ss.set('sre.devPick', q.get('as')); }
  if (q.get('theme')) ls.set('sre.theme', q.get('theme'));
  if (q.get('lang')) ls.set('sre.lang', q.get('lang'));
}
const savedTheme = ls.get('sre.theme') || 'auto';
store.set({ theme: savedTheme });
applyTheme(savedTheme);
await loadLang(ls.get('sre.lang') || 'en');
window.addEventListener('offline', () => { store.set({ online: false }); renderAll(); });
window.addEventListener('online', () => { store.set({ online: true }); renderAll(); });
if (!mock) await auth.init();
await boot(false);
router.start();
if (!mock && !isDevHost()) registerPwa();      // installable app + update banner; not on localhost, so dev edits are never cached
