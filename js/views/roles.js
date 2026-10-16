// S6.3 Roles and permissions: pick a role, see who holds it, toggle Create / Read / Update / Delete per record type.
// Phone-first: one role at a time. From 960 px wide, all roles side by side in one table. The server enforces the locked rights too.
import { h, card, button, field, plotChip, avatar, openSheet, toast, errorState, loadingRegion, icon, statusPill } from '../ui.js';
import { friendly } from '../api.js';
import { can } from '../store.js';
import { dashKey } from './members.js';

const VERBS = ['c', 'r', 'u', 'd'];
// Rights only the President can hold (mirrors the backend); the President column is always full.
const PRESIDENT_ONLY = { roles_config: 'cud', plot_change_requests: 'ud' };
const ORDER = ['members', 'plots', 'plot_transfer', 'plot_change_requests', 'expenses', 'expense_approval', 'maintenance_rates', 'maintenance_payments',
  'payment_confirmation', 'membership_rates', 'fee_requests', 'maintenance_dues', 'complaints', 'complaint_stage', 'comments', 'events', 'media',
  'meetings', 'attendance', 'notes', 'action_items', 'polls', 'poll_results_early', 'map_profile', 'roles_config'];
// Records where only Read applies.
const READ_ONLY = { poll_results_early: true };
const WIDE = '(min-width: 960px)';

export default function render(ctx) {
  const { t } = ctx;
  const editable = can('roles_config', 'u');
  let data = null, saved = null, working = null, role = 'Member', holders = [], defs = { items: [], presets: [] };
  const box = h('div', { class: 'stack' });

  async function load() {
    box.replaceChildren(loadingRegion(2));
    try {
      const [g, hs, ds] = await Promise.all([ctx.api.call('roles.get'), ctx.api.call('roles.holders'), ctx.api.call('roles.list')]);
      data = g; holders = hs.items; defs = ds;
      if (!g.roles.includes(role)) role = 'Member';
      saved = JSON.parse(JSON.stringify(g.matrix)); working = JSON.parse(JSON.stringify(g.matrix));
      draw();
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), load)); }
  }

  const changes = () => {
    const out = [];
    for (const r of Object.keys(working)) for (const e of Object.keys(working[r])) if (working[r][e] !== saved[r][e]) out.push({ role: r, entity: e });
    return out;
  };
  const lockedVerb = (e, v) => (PRESIDENT_ONLY[e] || '').includes(v);

  function holderStrip() {
    const hd = holders.filter((x) => x.role === role && x.member);
    if (role === 'Member') return h('p', { class: 'small muted' }, t('roles.everyone'));
    return h('div', { class: 'stack-sm', style: 'padding-bottom:12px' },
      h('div', { class: 'muted small' }, t('roles.holds')),
      ...(hd.length ? hd.map((x) => h('div', { class: 'row' }, avatar(x.member.name), h('strong', {}, x.member.name), x.member.plot_keys.map((k) => plotChip(dashKey(k)))))
        : [h('div', { class: 'row' }, statusPill('closed', t('roles.vacant')), h('span', { class: 'small muted' }, t('roles.nobody')))]),
      role === 'President' ? null : h('a', { class: 'small', href: '#/members' }, t('roles.change')),
      role !== 'President' && can('roles_config', 'd') ? deleteButton() : null);
  }

  // The President creates every role except Member and President, and may delete one nobody holds.
  function deleteButton() {
    const d = defs.items.find((x) => x.role === role);
    if (!d || d.builtin) return null;
    return d.holder_count ? h('p', { class: 'small muted' }, icon('info', 'sm'), ' ', t('roles.deleteBlocked', { n: d.holder_count }))
      : button(t('roles.delete'), { kind: 'danger', icon: 'delete', onClick: () => confirmDelete(d.role) });
  }
  function confirmDelete(name) {
    openSheet({ title: t('roles.deleteTitle', { role: name }), body: h('p', {}, t('roles.deleteBody')), actions: [
      { label: t('roles.delete'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
        try { await ctx.api.call('roles.delete', { name }); close(); toast(t('roles.deleted')); role = 'Member'; load(); } catch (e) { close(); toast(friendly(e, t)); }
      } }, { label: t('common.cancel') }] });
  }
  function newRoleSheet() {
    let one = true;
    const name = field({ id: 'nr-name', label: t('roles.newName'), maxlength: 40, help: t('roles.newNameHelp') });
    const preset = h('div', { class: 'field' }, h('label', { for: 'nr-preset' }, t('roles.preset')),
      h('select', { id: 'nr-preset' }, h('option', { value: '' }, t('roles.presetNone')), (defs.presets || []).map((p) => h('option', { value: p }, p))),
      h('div', { class: 'help' }, t('roles.presetHelp')));
    const holdSeg = h('div', { class: 'seg', role: 'group', 'aria-label': t('roles.holderMode') }, [[true, t('roles.oneHolder')], [false, t('roles.manyHolders')]].map(([v, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(v === one), onClick: (e) => { one = v; holdSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, label)));
    const note = h('div', { role: 'alert' });
    openSheet({ title: t('roles.new'), body: h('div', { class: 'stack' }, name, holdSeg, preset, note), actions: [
      { label: t('roles.create'), kind: 'primary', keepOpen: true, onClick: async (close) => {
        const v = name.querySelector('input').value.trim();
        if (!v) { note.replaceChildren(h('div', { class: 'banner warn' }, t('roles.nameNeeded'))); return; }
        try {
          const r = await ctx.api.call('roles.create', { name: v, singleHolder: one, preset: preset.querySelector('select').value || undefined });
          close(); toast(t('roles.created')); role = r.role; load();
        } catch (e) { note.replaceChildren(h('div', { class: 'banner warn' }, e.code === 'CONFLICT' ? t('roles.nameTaken') : e.code === 'INVALID' ? t('roles.nameBad') : friendly(e, t))); }
      } }, { label: t('common.cancel') }] });
  }

  function toggleRow(e) {
    const have = working[role][e];
    return h('div', { class: 'list-row', style: 'align-items:flex-start' },
      h('div', { class: 'grow' }, h('div', {}, t(`roles.e.${e}`)),
        PRESIDENT_ONLY[e] ? h('div', { class: 'small muted' }, icon('lock', 'sm'), ' ', t('roles.presidentOnly')) : null),
      h('div', { class: 'row', style: 'gap:4px;flex:none' }, VERBS.map((v) => {
        if (READ_ONLY[e] && v !== 'r') return h('span', { style: 'width:44px' });
        const locked = !editable || lockedVerb(e, v);
        const id = `rt-${e}-${v}`;
        const cb = h('input', { type: 'checkbox', id, checked: have.includes(v), disabled: locked, 'aria-label': `${t(`roles.e.${e}`)}: ${t(`roles.vf.${v}`)}`, style: 'width:24px;height:24px',
          onChange: (ev) => { working[role][e] = VERBS.filter((x) => (x === v ? ev.target.checked : working[role][e].includes(x))).join(''); drawFoot(); } });
        return h('label', { for: id, class: 'col', style: 'display:flex;flex-direction:column;align-items:center;gap:2px;min-width:44px;min-height:44px;justify-content:center' },
          h('span', { class: 'small muted', 'aria-hidden': 'true' }, t(`roles.v.${v}`)), cb);
      })));
  }

  // Wide screens: every role in one table (rows are record types, columns are roles, four small boxes per cell). Same state and save as the one-role view.
  function matrixTable(roles) {
    const cols = [...roles, 'President'];
    const holderOf = (r) => (r === 'Member' ? t('roles.everyoneShort') : (holders.find((x) => x.role === r)?.member?.name || t('roles.vacant')));
    const cell = (r, e) => {
      const full = r === 'President';
      const have = full ? VERBS.join('') : working[r][e];
      return h('td', { class: 'rm-cell' }, h('div', { class: 'row', style: 'gap:2px;justify-content:center' }, VERBS.map((v) => {
        if (READ_ONLY[e] && v !== 'r') return h('span', { style: 'width:28px' });
        const locked = full || !editable || lockedVerb(e, v);
        const cb = h('input', { type: 'checkbox', checked: have.includes(v), disabled: locked, 'data-role': r, 'data-entity': e, 'data-verb': v,
          'aria-label': `${r}: ${t(`roles.e.${e}`)}: ${t(`roles.vf.${v}`)}`, style: 'width:20px;height:20px',
          onChange: (ev) => { working[r][e] = VERBS.filter((x) => (x === v ? ev.target.checked : working[r][e].includes(x))).join(''); drawFoot(); } });
        return h('label', { class: 'col', style: 'display:flex;flex-direction:column;align-items:center;gap:1px;width:28px' }, h('span', { class: 'small muted', 'aria-hidden': 'true' }, t(`roles.v.${v}`)), cb);
      })));
    };
    return h('div', { style: 'overflow-x:auto', class: 'card' }, h('table', { class: 'roles-matrix', style: 'border-collapse:collapse;width:100%' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', style: 'text-align:start;min-width:220px' }, t('roles.record')),
        cols.map((r) => h('th', { scope: 'col', style: 'text-align:center;min-width:120px;vertical-align:bottom' }, h('div', {}, r), h('div', { class: 'small muted', style: 'font-weight:normal' }, holderOf(r)))))),
      h('tbody', {}, ORDER.filter((e) => data.entities.includes(e)).map((e) => h('tr', { style: 'border-top:1px solid var(--c-border)' },
        h('th', { scope: 'row', style: 'text-align:start;font-weight:normal;padding:6px 8px 6px 0' }, t(`roles.e.${e}`), PRESIDENT_ONLY[e] ? h('div', { class: 'small muted' }, icon('lock', 'sm'), ' ', t('roles.presidentOnly')) : null),
        cols.map((r) => cell(r, e)))))));
  }

  const foot = h('div', { class: 'stack-sm' });
  function drawFoot() {
    const n = changes().length;
    foot.replaceChildren(editable ? button(t('roles.save'), { kind: 'primary', block: true, disabled: !n, icon: 'save', onClick: confirmSave }) : h('p', { class: 'small muted' }, icon('lock', 'sm'), ' ', t('roles.viewOnly')));
  }

  function confirmSave() {
    const cs = changes();
    const lines = cs.map((c) => {
      const a = saved[c.role][c.entity], b = working[c.role][c.entity];
      const on = VERBS.filter((v) => b.includes(v) && !a.includes(v)).map((v) => `+${t(`roles.vf.${v}`)}`), off = VERBS.filter((v) => a.includes(v) && !b.includes(v)).map((v) => `−${t(`roles.vf.${v}`)}`);
      return h('li', {}, h('strong', {}, `${c.role} · ${t(`roles.e.${c.entity}`)}`), ': ', [...on, ...off].join(', '));
    });
    openSheet({ title: t('roles.confirmTitle', { n: cs.length }), body: h('ul', { class: 'stack-sm', style: 'padding-inline-start:20px' }, lines), actions: [
      { label: t('roles.apply'), kind: 'primary', keepOpen: true, onClick: async (close) => {
        try {
          for (const c of cs) {
            const g = working[c.role][c.entity];
            await ctx.api.call('roles.set', { role: c.role, entity: c.entity, c: g.includes('c'), r: g.includes('r'), u: g.includes('u'), d: g.includes('d') });
          }
          close(); toast(t('common.saved')); load();
        } catch (e) { close(); toast(friendly(e, t)); load(); }
      } },
      { label: t('common.cancel') }] });
  }

  function draw() {
    const roles = data.roles.filter((r) => r !== 'President');
    if (matchMedia(WIDE).matches) {
      box.replaceChildren(h('div', { class: 'banner info', style: 'border-radius:12px;border:1px solid var(--c-border)' }, icon('info'), h('div', { class: 'grow' }, t('roles.rules'))), can('roles_config', 'c') ? button(t('roles.new'), { icon: 'add', onClick: newRoleSheet }) : null, matrixTable(roles), foot);
      drawFoot();
      return;
    }
    box.replaceChildren(
      h('div', { class: 'banner info', style: 'border-radius:12px;border:1px solid var(--c-border)' }, icon('info'), h('div', { class: 'grow' }, t('roles.rules'))),
      can('roles_config', 'c') ? button(t('roles.new'), { icon: 'add', onClick: newRoleSheet }) : null,
      h('div', { class: 'field' }, h('label', { for: 'roles-pick' }, t('roles.pick')),
        h('select', { id: 'roles-pick', onChange: (ev) => { role = ev.target.value; draw(); } }, [...roles, 'President'].map((r) => h('option', { value: r, selected: r === role }, r)))),
      role === 'President'
        ? card(t('roles.president'), 'lock', h('p', {}, t('roles.alwaysFull')), holderStrip())
        : card(null, null, holderStrip(), ...ORDER.filter((e) => data.entities.includes(e)).map(toggleRow)),
      role === 'President' ? null : foot);
    drawFoot();
  }

  let wasWide = matchMedia(WIDE).matches;
  const onResize = () => { if (!page.isConnected) { removeEventListener('resize', onResize); return; } const w = matchMedia(WIDE).matches; if (w !== wasWide && data) { wasWide = w; draw(); } };   // unsaved ticks are kept: both views edit `working`
  addEventListener('resize', onResize);
  load();
  const page = h('div', { class: 'page stack' }, h('h1', {}, t('menu.roles')), box);
  return page;
}
