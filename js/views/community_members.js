// Community > Members: the committee, then every active member by name (30 a page, searched on the server).
// Shown from the stored answer first and refreshed in the background. Mobile numbers appear only where the member chose to show them.
import { h, button, avatar, plotChip, rolePill, emptyState, errorState, loadingRegion } from '../ui.js';
import { friendly } from '../api.js';

const label = (k) => String(k).replace(/^([A-Z])-?(\d+)$/, '$1-$2');

const norm = (v) => String(v).toLowerCase().replace(/[\s-]/g, '');

export default async function render(ctx) {
  const { t } = ctx;
  // The server sends every member in one answer. When all of them are here (nothing left to fetch) the search runs on this device;
  // only if the answer was cut short does a search go to the server.
  let all = [], committee = [], cursor = null, total = 0, shown = [], timer = null, serverQ = '';
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('com.membersSearch'), 'aria-label': t('com.membersSearch'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  const box = h('div', { class: 'stack-sm' }), more = h('div'), head = h('div', { class: 'stack-sm' });

  const call = (m) => (m?.mobile ? button('', { kind: 'text', icon: 'call', href: `tel:${String(m.mobile).replace(/\s/g, '')}`, 'aria-label': `${t('map.call')} ${m.name}` }) : null);
  const row = (m, extra) => h('div', { class: 'list-row' }, avatar(m.name),
    h('div', { class: 'grow' }, extra ? h('div', {}, rolePill(extra)) : null, h('div', {}, m.name),
      h('div', { class: 'row small' }, (m.plot_keys || []).map((k) => plotChip(label(k))), m.role && m.role !== 'Member' && !extra ? rolePill(m.role) : null)), call(m));

  const complete = () => !cursor && !serverQ;                    // everything is here: search locally
  function visible() {
    const f = norm(q.value.trim());
    if (!f || !complete()) return shown;
    return all.filter((m) => norm(`${m.name},${(m.plot_keys || []).join(',')}`).includes(f));
  }
  function draw() {
    const list = visible(), searching = !!q.value.trim();
    head.replaceChildren(...(committee.length && !searching ? [h('h2', {}, t('map.committee')), h('div', { class: 'card' }, committee.map((i) => (i.member ? row(i.member, i.role)
      : h('div', { class: 'list-row' }, h('span', { class: 'avatar off', 'aria-hidden': 'true' }, '–'), h('div', { class: 'grow' }, h('div', {}, rolePill(i.role)), h('div', { class: 'muted' }, t('map.vacant'))))))),
      h('h2', {}, `${t('map.members')} (${total})`)] : [h('h2', {}, `${t('map.members')} (${searching ? list.length : total})`)]));
    box.replaceChildren(...(list.length ? [h('div', { class: 'card' }, list.map((m) => row(m)))] : [emptyState(t('com.membersNone'), 'group')]));
    more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
  }
  async function load(older = false) {
    const payload = {};
    if (serverQ) payload.q = serverQ;
    if (older) payload.before = cursor;
    if (!older && !all.length) box.replaceChildren(loadingRegion(3));
    try {
      if (older) { const r = await ctx.api.call('members.directory', payload); all = all.concat(r.items); shown = all; cursor = r.next_cursor || null; draw(); return; }
      await ctx.api.swr('members.directory', payload, (r) => {
        all = r.items; shown = all; cursor = r.next_cursor || null; total = r.total;
        if (r.committee) committee = r.committee; else if (payload.q) committee = [];
        draw();
      });
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), load)); }
  }
  // Typing: filter here when we hold everyone; otherwise ask the server (after a short pause), and go back to the full list when cleared.
  q.addEventListener('input', () => {
    clearTimeout(timer);
    if (complete()) { draw(); return; }
    timer = setTimeout(() => { serverQ = q.value.trim(); all = []; load(); }, 350);
  });
  load();
  return h('div', { class: 'stack' }, q, head, box, more);
}
