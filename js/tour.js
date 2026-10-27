// Guided tours: the real screen with one part lit at a time (Driver.js, vendored in js/vendor, loaded only when a tour starts).
// Every tour is { route, help?, needs?, label?, steps } in js/tours/*.js, found by the route it belongs to. A step is one of
//   { plain: true, title, text }          a centred note (welcome, end)
//   { sel | key, title, text }            a part of the screen: `sel` is a CSS selector, `key` is data-tour="key"
//   { ..., click: 'css' }                 first clicks that control (a tab) and waits for the screen to settle, so the part can be found
// title and text are i18n keys. A part that is not on the screen (a role without it, an empty list) is left out, except after a `click`.
// `help: true` puts the tour on the Help page (needs = [entity, verb] like the route; label = i18n key of the button). Every tour is also in
// the avatar menu as "Tour of this screen". Help sets a request; app.js starts it once the screen has drawn.
import { t } from './i18n.js';
import { can } from './store.js';
import core from './tours/core.js';
import community from './tours/community.js';
import moneyIssues from './tours/money_issues.js';
import people from './tours/people.js';

export const TOURS = { ...core, ...community, ...moneyIssues, ...people };

const KEY = 'sre.tour';
export const requestTour = (name) => { try { sessionStorage.setItem(KEY, name); } catch { /* private mode: no tour */ } };
const pending = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const clearRequest = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

const toRegex = (pattern) => new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
// The tour that belongs to a route pattern such as '/issues/:id', or null.
export const tourForRoute = (pattern) => Object.keys(TOURS).find((k) => TOURS[k].route === pattern) || null;
export const tourPath = (name) => '#' + TOURS[name].route;
// The tours for the Help page that this member may take: [name, label key].
export const helpTours = (state) => Object.keys(TOURS).filter((k) => TOURS[k].help && !/:/.test(TOURS[k].route)
  && (!TOURS[k].needs || can(TOURS[k].needs[0], TOURS[k].needs[1], state))).map((k) => [k, TOURS[k].label]);
export { toRegex };

const shown = (el) => !!el && el.getClientRects().length > 0;
const find = (s, root) => root.querySelector(s.sel || `[data-tour="${s.key}"]`);
const pop = (s) => ({ title: t(s.title), description: t(s.text) });

export function stepsFor(name, root = document) {
  return (TOURS[name]?.steps || []).map((s) => {
    if (s.plain) return { popover: pop(s) };
    if (s.click && !root.querySelector(s.click)) return null;                                                   // the tab is not there for this role
    if (s.click) return { element: () => find(s, root) || undefined, click: s.click, popover: pop(s) };       // found after the click
    return shown(find(s, root)) ? { element: find(s, root), popover: pop(s) } : null;
  }).filter(Boolean);
}

function loadCss() {
  if (document.getElementById('driver-css')) return;
  document.head.append(Object.assign(document.createElement('link'), { id: 'driver-css', rel: 'stylesheet', href: 'css/driver.css' }));
}

const settle = (root, ms = 3000) => new Promise((resolve) => {
  const t0 = Date.now();
  const tick = () => (Date.now() - t0 > ms || !root.querySelector('[aria-busy="true"], .skel') ? resolve() : setTimeout(tick, 120));
  setTimeout(tick, 350);
});

export async function runTour(name, root = document) {
  const steps = stepsFor(name, root);
  if (steps.length < 2) return;
  loadCss();
  const { driver } = await import('./vendor/driver.esm.js');
  let d;
  // Moves to step i: clicks its tab first when it has one.
  const enter = async (i) => {
    const c = steps[i]?.click, el = c && root.querySelector(c);
    if (!el || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true') return;       // already on that tab
    el.click(); await settle(root);
  };
  steps.forEach((s, i) => {
    if (steps[i + 1]?.click) s.popover.onNextClick = async () => { await enter(i + 1); d.moveNext(); };
    if (steps[i - 1]?.click) s.popover.onPrevClick = async () => { await enter(i - 1); d.movePrevious(); };
  });
  d = driver({
    steps: steps.map(({ click, ...s }) => s), showProgress: true, progressText: '{{current}} / {{total}}', allowClose: true, overlayOpacity: 0.55, stagePadding: 6, stageRadius: 12,
    animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, smoothScroll: true,
    nextBtnText: t('tour.next'), prevBtnText: t('tour.prev'), doneBtnText: t('tour.done'), popoverClass: 'sre-tour',
  });
  await enter(0);
  d.drive();
}

// Called by app.js after a screen has drawn: starts the tour Help asked for, if it belongs to this screen.
export function startPendingTour(routePattern, main) {
  const name = pending();
  if (!name || TOURS[name]?.route !== routePattern) return;
  clearRequest();
  const t0 = Date.now();
  const tick = () => {
    if (!main.isConnected) return;
    if (main.querySelector('[aria-busy="true"], .skel') && Date.now() - t0 < 6000) return void setTimeout(tick, 150);
    runTour(name, main);
  };
  setTimeout(tick, 300);
}
