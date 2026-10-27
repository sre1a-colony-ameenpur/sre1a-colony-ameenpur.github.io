// Guided tours: the real screen with one part lit at a time (Driver.js, vendored in js/vendor, loaded only when a tour starts).
// A tour is a list of { key, title, text } looked up by [data-tour="key"]; parts that are not on the screen (a hidden card, a nav item
// the role does not have) are left out. Help sets a request, the screen starts the tour once it has drawn.
import { t } from './i18n.js';

const KEY = 'sre.tour';
export const requestTour = (name) => { try { sessionStorage.setItem(KEY, name); } catch { /* private mode: no tour */ } };
export function takeTour(name) {
  try { if (sessionStorage.getItem(KEY) !== name) return false; sessionStorage.removeItem(KEY); return true; } catch { return false; }
}

const shown = (el) => !!el && el.getClientRects().length > 0;

// A step is { key, title, text } for a part marked data-tour="key", or { plain: true, title, text } for a centred note (welcome, end).
const plain = (title, text) => ({ plain: true, title, text });
const END = plain('tour.end.title', 'tour.end');
const HOME = [
  plain('tour.welcome.title', 'tour.welcome.text'),
  { key: 'action', title: 'home.action.title', text: 'tour.action' },
  { key: 'maint', title: 'home.maint.title', text: 'tour.maint' },
  { key: 'fees', title: 'home.fees.title', text: 'tour.fees' },
  { key: 'polls', title: 'home.polls.title', text: 'tour.polls' },
  { key: 'meeting', title: 'home.meeting.title', text: 'tour.meeting' },
  { key: 'complaints', title: 'home.complaints.title', text: 'tour.complaints' },
  { key: 'event', title: 'home.event.title', text: 'tour.event' },
  { key: 'money', title: 'home.money.title', text: 'tour.money' },
  { key: 'balance', title: 'acc.balance', text: 'tour.balance' },
  { key: 'nav', title: 'tour.nav.title', text: 'tour.nav' },
  { key: 'menu', title: 'tour.menu.title', text: 'tour.menu' },
  END,
];
const MONEY = [
  plain('tour.money.welcome.title', 'tour.money.welcome.text'),
  { key: 'm-tabs', title: 'tour.money.tabs.title', text: 'tour.money.tabs' },
  { key: 'm-payments', title: 'pay.allTitle', text: 'tour.money.payments' },
  { key: 'm-ledger', title: 'ledger.title', text: 'tour.money.ledger' },
  { key: 'm-opening', title: 'ob.title', text: 'tour.money.opening' },
  { key: 'm-accounts', title: 'acc.title', text: 'tour.money.accounts' },
  { key: 'm-body', title: 'tour.money.body.title', text: 'tour.money.body' },
  END,
];
const ISSUES = [
  plain('tour.issues.welcome.title', 'tour.issues.welcome.text'),
  { key: 'i-pending', title: 'pend.title', text: 'tour.issues.pending' },
  { key: 'i-monthly', title: 'cmp.monthly', text: 'tour.issues.monthly' },
  { key: 'i-filter', title: 'tour.issues.filter.title', text: 'tour.issues.filter' },
  { key: 'i-search', title: 'tour.issues.search.title', text: 'tour.issues.search' },
  { key: 'i-list', title: 'tour.issues.list.title', text: 'tour.issues.list' },
  { key: 'i-raise', title: 'cmp.raise', text: 'tour.issues.raise' },
  END,
];
const TOURS = { home: HOME, money: MONEY, issues: ISSUES };
export const TOUR_PAGE = { home: '#/home', money: '#/money', issues: '#/issues' };
const SELECT = { nav: 'nav.nav', menu: '.avatar-btn' };

export function stepsFor(name, root = document) {
  return (TOURS[name] || []).map((s) => {
    if (s.plain) return { popover: { title: t(s.title), description: t(s.text) } };
    const el = root.querySelector(SELECT[s.key] || `[data-tour="${s.key}"]`);
    return shown(el) ? { element: el, popover: { title: t(s.title), description: t(s.text) } } : null;
  }).filter(Boolean);
}

function loadCss() {
  if (document.getElementById('driver-css')) return;
  document.head.append(Object.assign(document.createElement('link'), { id: 'driver-css', rel: 'stylesheet', href: 'css/driver.css' }));
}

export async function runTour(name, root = document) {
  const steps = stepsFor(name, root);
  if (steps.length < 2) return;
  loadCss();
  const { driver } = await import('./vendor/driver.esm.js');
  driver({
    steps, showProgress: true, progressText: '{{current}} / {{total}}', allowClose: true, overlayOpacity: 0.55, stagePadding: 6, stageRadius: 12,
    animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, smoothScroll: true,
    nextBtnText: t('tour.next'), prevBtnText: t('tour.prev'), doneBtnText: t('tour.done'), popoverClass: 'sre-tour',
  }).drive();
}

// Waits until the screen has stopped loading (or 6 s), then runs the tour. Gives up if the screen is left meanwhile.
export function runTourWhenReady(name, grid) {
  const t0 = Date.now();
  const tick = () => {
    if (!grid.isConnected) return;
    if (grid.querySelector('[aria-busy="true"], .skel') && Date.now() - t0 < 6000) return void setTimeout(tick, 150);
    runTour(name);
  };
  setTimeout(tick, 300);
}
