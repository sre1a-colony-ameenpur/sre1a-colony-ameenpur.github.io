// S6.1 Members: searchable list with role and active/removed filters; the President adds, edits and removes (sheets in members_sheets.js).
import { h, button, avatar, rolePill, plotChip, statusPill, emptyState, errorState, loadingRegion, icon } from '../ui.js';
import { friendly } from '../api.js';
import { can } from '../store.js';
import { memberSheet } from './members_sheets.js';

// Roles a member can be given (not the President): Member plus the roles the President created. Filled from roles.list.
export let ROLES = ['Member'];
export async function loadRoles(api) {
  try { const { items } = await api.call('roles.list'); ROLES = items.map((r) => r.role).filter((r) => r !== 'President'); } catch { /* keep the last list */ }
  return ROLES;
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
    list.replaceChildren(loadingRegion(2));
    try {
      [{ items }] = await Promise.all([ctx.api.call('members.list'), loadRoles(ctx.api)]);
      role.replaceChildren(h('option', { value: 'all' }, t('mem.allRoles')), ...ROLES.map((r) => h('option', { value: r }, r)));
      draw();
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  function draw() {
    const shown = items.filter((m) => (stateF === 'active' ? m.active : !m.active) && (roleF === 'all' || m.role === roleF)
      && (!q || norm(`${m.name} ${m.email} ${m.plot_keys}`).includes(norm(q))));
    count.textContent = t('mem.count', { n: shown.length });
    list.replaceChildren(...(shown.length ? shown.map(row) : [emptyState(t('mem.none'), 'group')]));
  }
  function row(m) {
    const body = [avatar(m.name),
      h('div', { class: 'grow' }, h('div', { style: 'font-weight:600' }, m.name), h('div', { class: 'small muted', style: 'overflow-wrap:anywhere' }, m.email),
        h('div', { class: 'row', style: 'margin-top:4px' }, plotsOf(m).map((k) => plotChip(dashKey(k))), m.active ? rolePill(m.role) : statusPill('closed', t('mem.removed'))))];
    return editable && m.active
      ? h('button', { type: 'button', class: 'list-row map-row', style: 'width:100%;text-align:start', onClick: () => memberSheet(ctx, { member: m, items, done: load }) }, ...body, icon('chevron_right'))
      : h('div', { class: 'list-row' }, ...body);
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
      can('members', 'c') ? h('div', { class: 'row' }, button(t('mem.import'), { icon: 'upload_file', href: '#/members/import' }),
        button(t('mem.add'), { kind: 'primary', icon: 'person_add', onClick: () => memberSheet(ctx, { member: null, items, done: load }) })) : null),
    !editable ? h('p', { class: 'small muted' }, t('mem.viewOnly')) : null,
    h('div', { class: 'field' }, h('label', { for: 'mem-q' }, t('mem.search')), search),
    h('div', { class: 'row' }, seg, h('div', { class: 'field' }, role)), count, list);
  load();
  return root;
}
