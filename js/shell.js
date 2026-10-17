// App shell: top bar, role-aware nav (tab bar / rail / sidebar), avatar menu (S7.0).
import { h, icon, avatar, rolePill, crest } from './ui.js';
import { t } from './i18n.js';
import { can } from './store.js';
import { CONFIG } from './config.js';
import { latestRelease } from './releases.js';

// Nav items are shown only if `caps` allows reading something in that area.
export function navItems(s) {
  const r = (e) => can(e, 'r', s);
  return [
    { path: '/home', icon: 'home', label: 'nav.home', show: true },
    { path: '/issues', icon: 'report', label: 'nav.issues', show: r('complaints') },
    { path: '/money', icon: 'payments', label: 'nav.money', show: r('expenses') || r('maintenance_payments') || r('dues') },
    { path: '/community', icon: 'groups', label: 'nav.community', show: r('events') || r('meetings') || r('polls') },
    { path: '/map', icon: 'map', label: 'nav.map', show: r('map_profile') },
  ].filter((i) => i.show);
}

// True until the member opens What's new after the newest release.
function unseenRelease() {
  try { return localStorage.getItem('sre.whatsNewSeen') !== latestRelease(); } catch { return false; }
}

// Avatar menu items by caps, in the S7.0 order. Items a role cannot use are absent.
export function menuItems(s) {
  const view = (e) => (can(e, 'c', s) || can(e, 'u', s) || can(e, 'd', s) ? '' : t('menu.viewOnly'));
  return [
    { path: '/profile', icon: 'person', label: 'menu.profile', show: true },
    { path: '/members', icon: 'group', label: 'menu.members', hint: view('members'), show: can('members', 'r', s) },
    { path: '/roles', icon: 'admin_panel_settings', label: 'menu.roles', hint: view('roles_config'), show: can('roles_config', 'r', s) },
    { path: '/plots', icon: 'grid_view', label: 'menu.plots', hint: view('plots'), show: can('plots', 'r', s) },
    { path: '/audit', icon: 'history', label: 'menu.audit', show: can('audit', 'r', s) },
    { path: '/settings', icon: 'settings', label: 'menu.settings', show: can('handover', 'c', s) },      // the President's
    { path: '/handover', icon: 'swap_horiz', label: 'menu.handover', show: can('handover', 'c', s) },
    { path: '/whats-new', icon: 'new_releases', label: 'menu.whatsNew', hint: unseenRelease() ? t('menu.new') : '', show: true },
    { path: '/help', icon: 'help', label: 'menu.help', show: true },
  ].filter((i) => i.show);
}

export function buildNav(s, current) {
  const nav = h('nav', { class: 'nav', 'aria-label': t('nav.label') },
    h('div', { class: 'brand' }, crest(true), h('span', { class: 'name' }, CONFIG.appName)),
    navItems(s).map((i) => h('a', { href: '#' + i.path, 'aria-current': current === i.path || current.startsWith(i.path + '/') ? 'page' : null },
      icon(i.icon), h('span', {}, t(i.label)))));
  return nav;
}

export function langToggle(lang, setLang) {
  const b = (code, label, name) => h('button', { type: 'button', lang: code, 'aria-label': name, title: name, 'aria-pressed': String(lang === code), onClick: () => setLang(code) }, label);
  return h('div', { class: 'lang', role: 'group', 'aria-label': t('lang.label') }, b('en', 'EN', 'English'), b('te', 'తె', 'తెలుగు'));
}

export function buildTopbar(s, { title, back, lang, setLang, onSignOut }) {
  const session = s.session;
  const btn = h('button', { class: 'avatar-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    'aria-label': t('menu.open', { name: session.name }), onClick: () => toggle() }, avatar(session.name));
  let menu = null, scrim = null;
  function close() { menu?.remove(); scrim?.remove(); menu = scrim = null; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  function toggle() {
    if (menu) return close();
    scrim = h('div', { class: 'menu-scrim', onClick: close });
    menu = h('div', { class: 'menu', role: 'menu', onKeydown: (e) => { if (e.key === 'Escape') close(); } },
      h('header', {}, avatar(session.name, true), h('div', { class: 'grow' },
        h('div', { style: 'font-weight:600' }, session.name), h('div', { class: 'small muted', style: 'overflow-wrap:anywhere' }, session.email),
        h('div', { style: 'margin-top:4px' }, rolePill(session.role)))),
      menuItems(s).map((i) => h('a', { href: '#' + i.path, role: 'menuitem', onClick: close }, icon(i.icon),
        h('span', { class: 'grow' }, t(i.label)), i.hint ? h('span', { class: 'small muted' }, i.hint) : null)),
      h('button', { class: 'item danger', type: 'button', role: 'menuitem', onClick: () => { close(); onSignOut(); } }, icon('logout'), t('menu.signOut')));
    document.body.append(scrim, menu);
    btn.setAttribute('aria-expanded', 'true');
    menu.querySelector('a')?.focus();
  }
  return h('header', { class: 'topbar' },
    back ? h('a', { class: 'icon-btn back-btn', href: '#' + back, 'aria-label': t('common.back'), title: t('common.back') }, icon('arrow_back'))
      : h('span', { class: 'brand-sm' }, crest(true)),
    h('div', { class: 'title', id: 'page-title' }, title),
    langToggle(lang, setLang), btn);
}
