// Community > Members: the committee, then every active member by name (30 a page, searched on the server).
// Shown from the stored answer first and refreshed in the background. Mobile numbers appear only where the member chose to show them.
import { h, button, avatar, plotChip, rolePill, emptyState, errorState, loadingRegion } from '../ui.js';
import { friendly } from '../api.js';

const label = (k) => String(k).replace(/^([A-Z])-?(\d+)$/, '$1-$2');

export default async function render(ctx) {
  const { t } = ctx;
  let items = [], committee = [], cursor = null, total = 0, timer = null;
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('com.membersSearch'), 'aria-label': t('com.membersSearch'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  const box = h('div', { class: 'stack-sm' }), more = h('div'), head = h('div', { class: 'stack-sm' });

  const call = (m) => (m?.mobile ? button('', { kind: 'text', icon: 'call', href: `tel:${String(m.mobile).replace(/\s/g, '')}`, 'aria-label': `${t('map.call')} ${m.name}` }) : null);
  const row = (m, extra) => h('div', { class: 'list-row' }, avatar(m.name),
    h('div', { class: 'grow' }, extra ? h('div', { class: 'muted small' }, extra) : null, h('div', {}, m.name),
      h('div', { class: 'row small' }, (m.plot_keys || []).map((k) => plotChip(label(k))), m.role && m.role !== 'Member' && !extra ? rolePill(m.role) : null)), call(m));

  function draw() {
    head.replaceChildren(...(committee.length ? [h('h2', {}, t('map.committee')), h('div', { class: 'card' }, committee.map((i) => (i.member ? row(i.member, i.role)
      : h('div', { class: 'list-row' }, h('span', { class: 'avatar off', 'aria-hidden': 'true' }, '–'), h('div', { class: 'grow' }, h('div', { class: 'muted small' }, i.role), h('div', { class: 'muted' }, t('map.vacant'))))))),
      h('h2', {}, `${t('map.members')} (${total})`)] : [h('h2', {}, `${t('map.members')} (${total})`)]));
    box.replaceChildren(...(items.length ? [h('div', { class: 'card' }, items.map((m) => row(m)))] : [emptyState(t('com.membersNone'), 'group')]));
    more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
  }
  async function load(older = false) {
    const payload = {};
    if (q.value.trim()) payload.q = q.value.trim();
    if (older) payload.before = cursor;
    if (!older && !items.length) box.replaceChildren(loadingRegion(3));
    try {
      if (older) { const r = await ctx.api.call('members.directory', payload); items = items.concat(r.items); cursor = r.next_cursor || null; draw(); return; }
      await ctx.api.swr('members.directory', payload, (r) => { items = r.items; cursor = r.next_cursor || null; total = r.total; if (r.committee) committee = r.committee; else if (payload.q) committee = []; draw(); });
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), load)); }
  }
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { items = []; load(); }, 350); });
  load();
  return h('div', { class: 'stack' }, q, head, box, more);
}
