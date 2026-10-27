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

// Home: the cards that are on the screen, then the nav and the avatar menu.
const HOME = [
  { key: 'welcome', title: 'tour.welcome.title', text: 'tour.welcome.text' },
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
  { key: 'end', title: 'tour.end.title', text: 'tour.end' },
];
const TOURS = { home: HOME };
const SELECT = { nav: 'nav.nav', menu: '.avatar-btn' };

export function stepsFor(name, root = document) {
  return (TOURS[name] || []).map((s) => {
    const sel = SELECT[s.key] || `[data-tour="${s.key}"]`;
    const el = s.key === 'welcome' || s.key === 'end' ? null : root.querySelector(sel);
    if (s.key !== 'welcome' && s.key !== 'end' && !shown(el)) return null;
    return { ...(el ? { element: el } : {}), popover: { title: t(s.title), description: t(s.text) } };
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

// Waits until the cards have stopped loading (or 6 s), then runs the tour. Gives up if the screen is left meanwhile.
export function runTourWhenReady(name, grid) {
  const t0 = Date.now();
  const tick = () => {
    if (!grid.isConnected) return;
    if (grid.querySelector('[aria-busy="true"]') && Date.now() - t0 < 6000) return void setTimeout(tick, 150);
    runTour(name);
  };
  setTimeout(tick, 300);
}
