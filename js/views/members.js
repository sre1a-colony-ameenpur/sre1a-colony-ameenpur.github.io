// S6.1 Members: searchable list with role and active/removed filters; the President adds, edits and removes (sheets in members_sheets.js).
import { h, button, avatar, rolePill, plotChip, statusPill, emptyState, errorState, loadingRegion, icon, openSheet } from '../ui.js';
import { friendly } from '../api.js';
import { can } from '../store.js';
import { memberSheet } from './members_sheets.js';

// Roles a member can be given (not the President): Member plus the roles the President created. Filled from roles.list.
export let ROLES = ['Member'];
export async function loadRoles(api) {
  try { await api.swr('roles.list', {}, ({ items }) => { ROLES = items.map((r) => r.role).filter((r) => r !== 'President'); }); } catch { /* keep the last list */ }
  return ROLES;
}
// A member's avatar with their picture when they have one. Pictures are asked for only as the avatar scrolls into view, and the ones that came into view
// together go in one request (up to 20): members.pictures for the handle every member has (m.photo), members.photos by email for the committee's
// Members list (m.photo_file_id). Each answer is kept in memory under the key of its single request (api.media), so drawing the list again asks for nothing.
const BULK = 20;
const batch = { waiting: new Map(), timer: null };
function pictureOf(ctx, m, size) {
  const [action, payload, id] = m.photo ? ['members.picture', { photo: m.photo, size }, m.photo] : ['members.photo', { email: m.email, size }, m.email];
  const have = ctx.api.mediaPeek(action, payload);
  if (have) return have.then((d) => d.jpegBase64);
  return new Promise((resolve, reject) => {
    const k = `${action}|${size}|${id}`;
    if (!batch.waiting.has(k)) batch.waiting.set(k, { action, payload, id, size, bulk: m.photo ? 'members.pictures' : 'members.photos', field: m.photo ? 'photos' : 'emails', hands: [] });
    batch.waiting.get(k).hands.push({ resolve, reject });
    clearTimeout(batch.timer);
    batch.timer = setTimeout(() => flush(ctx), 40);
  });
}
function flush(ctx) {
  const wanted = [...batch.waiting.values()]; batch.waiting.clear();
  const groups = new Map();
  wanted.forEach((w) => { const g = `${w.bulk}|${w.size}`; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(w); });
  groups.forEach((list) => {
    for (let i = 0; i < list.length; i += BULK) {
      const chunk = list.slice(i, i + BULK);
      ctx.api.call(chunk[0].bulk, { [chunk[0].field]: chunk.map((w) => w.id), size: chunk[0].size }).then((r) => {
        chunk.forEach((w) => {
          const b64 = r.items?.[w.id];
          if (b64) { ctx.api.mediaPut(w.action, w.payload, { jpegBase64: b64 }); w.hands.forEach((hd) => hd.resolve(b64)); }
          else w.hands.forEach((hd) => hd.reject(new Error('no picture')));
        });
      }, (e) => chunk.forEach((w) => w.hands.forEach((hd) => hd.reject(e))));
    }
  });
}
// Paints a picture onto an avatar element (the initials are replaced).
export function paintPicture(el, b64) { el.style.backgroundImage = `url("data:image/jpeg;base64,${b64}")`; el.classList.add('has-photo'); el.textContent = ''; }
export function paintUrl(el, url) { el.style.backgroundImage = `url("${url}")`; el.classList.add('has-photo'); el.textContent = ''; }
// The API gives a direct picture link (m.photo_url, the Google thumbnail of a link-shared file): the browser loads it itself, with no call to the API. If the link
// does not load (a picture not shared yet), the batched API request below is the fallback.
export function memberAvatar(ctx, m, lg = false) {
  const el = avatar(m.name, lg);
  if (!m.photo_url && !m.photo && !m.photo_file_id) return el;
  const viaApi = () => pictureOf(ctx, m, lg ? 'thumb' : 'tiny').then((b64) => paintPicture(el, b64), () => { /* the initials stay */ });
  const fetchIt = () => {
    if (!m.photo_url) return viaApi();
    const url = lg ? m.photo_url.replace('sz=w200', 'sz=w600') : m.photo_url, probe = new Image();
    probe.onload = () => paintUrl(el, url);
    probe.onerror = viaApi;
    probe.src = url;
    return undefined;
  };
  if (!('IntersectionObserver' in window)) fetchIt();
  else { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fetchIt(); } }); io.observe(el); }
  return el;
}
// A member's card, like a phone contact: a big picture, name, role, plots and (when they chose to show it) their mobile number with a call button.
// The picture full screen, with a close icon at the top right. Taps outside the picture, the close icon and Esc close it.
// The big version of the picture is tried first; if Google does not give it, the smaller ones and then the API's copy are tried, so the viewer is never left black.
export async function openPhotoViewer(ctx, m) {
  const { t } = ctx;
  const img = h('img', { alt: m.name, class: 'lightbox-img' });
  const shut = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  const close = h('button', { type: 'button', class: 'icon-btn lightbox-close', 'aria-label': t('common.close'), title: t('common.close'), onClick: shut }, icon('close'));
  const dlg = h('dialog', { class: 'lightbox', 'aria-label': m.name }, img, close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target === img) shut(); });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
  const viaApi = async () => {
    try {
      const d = await (m.photo ? ctx.api.media('members.picture', { photo: m.photo, size: 'thumb' }) : ctx.api.media('members.photo', { email: m.email, size: 'thumb' }));      // the Members list has the email, not the handle
      img.onerror = shut; img.src = `data:image/jpeg;base64,${d.jpegBase64}`;
    } catch { shut(); }
  };
  if (!m.photo_url) { await viaApi(); return; }
  const sizes = ['w1000', 'w600', 'w200'];
  let at = 0;
  img.onerror = () => { at++; if (at < sizes.length) img.src = m.photo_url.replace('sz=w200', `sz=${sizes[at]}`); else if (m.photo || m.email) viaApi(); else shut(); };
  img.src = m.photo_url.replace('sz=w200', `sz=${sizes[0]}`);
}
// The big picture of a member (the card, the edit sheet): with a picture, tapping it opens it full screen; without one, the initials.
export function memberPicture(ctx, m) {
  const pic = memberAvatar(ctx, m, true);
  pic.classList.add('xl');
  if (!m.photo_url && !m.photo && !m.photo_file_id) return pic;
  return h('button', { type: 'button', class: 'avatar-open', 'aria-label': ctx.t('mem.viewPhoto'), title: ctx.t('mem.viewPhoto'), onClick: () => openPhotoViewer(ctx, m) }, pic);
}
export function memberDetailSheet(ctx, m, role = m.role) {
  const { t } = ctx;
  const picture = memberPicture(ctx, m);
  const line = (label, ...value) => h('div', { class: 'list-row' }, h('div', { class: 'muted small', style: 'flex:none;width:72px' }, label), h('div', { class: 'grow', style: 'overflow-wrap:anywhere' }, ...value));
  const plots = plotsOf({ plot_keys: Array.isArray(m.plot_keys) ? m.plot_keys.join(',') : m.plot_keys });
  openSheet({ title: m.name, wide: true, actions: [{ label: t('common.close') }], body: h('div', { class: 'stack' },
    h('div', { class: 'stack-sm', style: 'align-items:center;text-align:center' }, picture, role && role !== 'Member' ? rolePill(role) : null),
    h('div', { class: 'card' },
      line(t('mem.plots'), plots.length ? h('span', { class: 'row' }, plots.map((k) => plotChip(dashKey(k)))) : h('span', { class: 'muted' }, t('mem.noPlots'))),
      m.mobile ? line(t('profile.mobile'), h('span', { class: 'row-between' }, m.mobile,
        h('a', { class: 'icon-btn', href: `tel:${String(m.mobile).replace(/\s/g, '')}`, 'aria-label': `${t('map.call')} ${m.name}`, title: t('map.call') }, icon('call')))) : null)) });
}
export const dashKey = (k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2');
export const plotsOf = (m) => String(m.plot_keys || '').split(',').filter(Boolean);
const norm = (s) => String(s).toLowerCase().replace(/[\s-]/g, '');

export default function render(ctx) {
  const { t } = ctx;
  let items = [], q = '', roleF = 'all', stateF = 'active';
  const list = h('div', { class: 'card' });
  const count = h('p', { class: 'small muted', 'aria-live': 'polite' });
  const editable = can('members', 'u') || can('members', 'd');

  async function load() {
    if (!items.length) list.replaceChildren(loadingRegion(2));
    try {
      loadRoles(ctx.api).then(() => role.replaceChildren(h('option', { value: 'all' }, t('mem.allRoles')), ...ROLES.map((r) => h('option', { value: r, selected: r === roleF }, r))));
      await ctx.api.swr('members.list', {}, (r) => { items = r.items; draw(); });
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  function draw() {
    const shown = items.filter((m) => (stateF === 'active' ? m.active : !m.active) && (roleF === 'all' || m.role === roleF)
      && (!q || norm(`${m.name} ${m.email} ${m.plot_keys}`).includes(norm(q))));
    count.textContent = t('mem.count', { n: shown.length });
    list.replaceChildren(...(shown.length ? shown.map(row) : [emptyState(t('mem.none'), 'group')]));
  }
  function row(m) {
    const av = memberAvatar(ctx, m); av.classList.add('md');                          // 64 px, as in Community
    const body = [av,
      h('div', { class: 'grow' }, h('div', { style: 'font-weight:600' }, m.name), h('div', { class: 'small muted', style: 'overflow-wrap:anywhere' }, m.email),
        h('div', { class: 'row', style: 'margin-top:4px' }, plotsOf(m).map((k) => plotChip(dashKey(k))), m.active ? rolePill(m.role) : statusPill('closed', t('mem.removed'))))];
    return editable && m.active
      ? h('button', { type: 'button', class: 'list-row map-row', style: 'width:100%;text-align:start', onClick: () => memberSheet(ctx, { member: m, items, done: load }) }, ...body, icon('chevron_right'))
      : h('div', { class: 'list-row map-row', role: 'button', tabindex: '0', style: 'cursor:pointer', onClick: () => memberDetailSheet(ctx, m, m.active ? m.role : null),         // no edit right, or removed: the member's card
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); memberDetailSheet(ctx, m, m.active ? m.role : null); } } }, ...body);
  }

  const search = h('input', { id: 'mem-q', type: 'search', placeholder: t('mem.search'), 'aria-label': t('mem.search'), autocomplete: 'off',
    onInput: (e) => { q = e.target.value; draw(); } });
  const role = h('select', { id: 'mem-filter-role', 'aria-label': t('mem.filterRole'), onChange: (e) => { roleF = e.target.value; draw(); } },
    h('option', { value: 'all' }, t('mem.allRoles')), ROLES.map((r) => h('option', { value: r }, r)));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('mem.filterState') },
    [['active', t('mem.active')], ['removed', t('mem.removed')]].map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(v === stateF),
      onClick: (e) => { stateF = v; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw(); } }, label)));

  const root = h('div', { class: 'page stack' },
    h('div', { class: 'row-between' }, h('h1', { style: 'margin:0' }, t('menu.members')),
      can('members', 'c') ? h('div', { class: 'row' },
        h('a', { class: 'icon-btn', href: '#/members/import', 'aria-label': t('mem.import'), title: t('mem.import') }, icon('upload_file')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('mem.add'), title: t('mem.add'), onClick: () => memberSheet(ctx, { member: null, items, done: load }) }, icon('person_add'))) : null),
    !editable ? h('p', { class: 'small muted' }, t('mem.viewOnly')) : null,
    h('div', { class: 'field' }, h('label', { for: 'mem-q' }, t('mem.search')), search),
    h('div', { class: 'row' }, seg, h('div', { class: 'field' }, role)), count, list);
  load();
  return root;
}
