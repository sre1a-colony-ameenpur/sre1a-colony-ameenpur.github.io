// S6.4 Plots: list of every plot with its owner, category (President changes it), history and Transfer; plus the President's queue of plot change requests.
import { h, button, statusPill, plotChip, emptyState, errorState, loadingRegion, openSheet, confirmSheet, toast, icon, segmented, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can } from '../store.js';
import { transferSheet } from './plot_transfer.js';

export const dashKey = (k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2');
const norm = (s) => String(s).toLowerCase().replace(/[\s-]/g, '');
const CATS = ['house', 'open'];

export default function render(ctx) {
  const { t } = ctx;
  const canQueue = can('plot_change_requests', 'u');   // listing is President-only
  let tab = 'plots', q = '', filter = 'all', plots = [], pending = 0;
  const body = h('div', { class: 'stack' });
  const tabs = h('div');

  async function loadPlots() {
    if (!plots.length) body.replaceChildren(loadingRegion(2));
    try { await ctx.api.swr('plots.list', {}, (r) => { plots = r.items; drawPlots(); }); } catch (e) { body.replaceChildren(errorState(friendly(e, t), loadPlots)); }
  }
  async function countPending() {
    if (!canQueue) return;
    try { await ctx.api.swr('plotRequests.list', { status: 'Pending' }, (r) => { pending = r.items.length; drawTabs(); }); } catch { /* the queue tab reports its own errors */ }
  }
  function drawTabs() {
    if (!canQueue) { tabs.replaceChildren(); return; }
    tabs.replaceChildren(segmented([['plots', t('plots.tab.plots')], ['requests', t('plots.tab.requests', { n: pending })]], tab, (v) => { tab = v; show(); }, t('menu.plots')));
  }
  function show() { tab === 'plots' ? loadPlots() : loadRequests(); }

  function drawPlots() {
    const search = h('input', { id: 'plots-q', type: 'search', value: q, placeholder: t('plots.search'), 'aria-label': t('plots.search'), autocomplete: 'off' });
    search.addEventListener('input', (e) => { q = e.target.value; drawList(); });
    const list = h('div', { class: 'card' });
    const count = h('p', { class: 'small muted', 'aria-live': 'polite' });
    const drawList = () => {
      const s = plots.filter((p) => (filter === 'all' || (filter === 'free' ? !p.owner : !!p.owner)) && (!q || norm(`${p.plot_label} ${p.owner?.name || ''}`).includes(norm(q))));
      count.textContent = t('plots.count', { n: s.length });
      list.replaceChildren(...(s.length ? s.map(row) : [emptyState(t('plots.none'), 'grid_view')]));
    };
    body.replaceChildren(h('div', { class: 'field' }, h('label', { for: 'plots-q' }, t('plots.search')), search),
      segmented([['all', t('plots.f.all')], ['owned', t('plots.f.owned')], ['free', t('plots.f.free')]], filter, (v) => { filter = v; drawList(); }, t('plots.filter')),
      count, list, can('plots', 'r') ? button(t('plots.layoutLink'), { kind: 'text', icon: 'map', href: '#/plots/layout' }) : null);
    drawList();
  }
  const row = (p) => h('button', { type: 'button', class: 'list-row map-row', style: 'width:100%;text-align:start', onClick: () => plotSheet(ctx, p, loadPlots) },
    plotChip(p.plot_label),
    h('div', { class: 'grow' }, p.owner ? h('div', {}, p.owner.name) : h('div', { class: 'muted' }, t('plots.noMember')),
      h('div', { class: 'small muted' }, p.category ? t(`plots.cat.${p.category}`) : t('plots.cat.none'), p.located ? '' : ` · ${t('plots.notLocated')}`)), icon('chevron_right'));

  let reqItems = [], reqCursor = null;
  async function loadRequests(older = false) {
    if (!reqItems.length) body.replaceChildren(loadingRegion(2));
    countPending();
    try {
      if (older) { const r = await ctx.api.call('plotRequests.list', { before: reqCursor }); reqItems = reqItems.concat(r.items); reqCursor = r.next_cursor || null; paintRequests(); return; }
      await ctx.api.swr('plotRequests.list', {}, (r) => { reqItems = r.items; reqCursor = r.next_cursor || null; paintRequests(); });
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), loadRequests)); }
  }
  function paintRequests() {
    body.replaceChildren(h('p', { class: 'small muted' }, t('plots.req.help')), h('div', { class: 'card' },
      ...(reqItems.length ? reqItems.map((r) => reqRow(r)) : [emptyState(t('plots.req.none'), 'inbox')])),
      ...(reqCursor ? [button(t('audit.more'), { block: true, onClick: () => loadRequests(true) })] : []));
  }
  function reqRow(r) {
    const kind = { Pending: 'pending', Approved: 'approved', Rejected: 'rejected' }[r.status] || 'closed';
    return h('div', { class: 'stack-sm queue-item' },
      h('div', { class: 'row-between' }, h('div', {}, h('strong', {}, r.member_name || t('plots.unknown')), ' ', t(r.action === 'add' ? 'req.add' : 'req.remove'), ' ', plotChip(dashKey(r.plot_key))),
        statusPill(kind, t(`req.status.${r.status}`))),
      h('div', { class: 'small muted' }, dateShort(r.requested_at), r.reason ? ` · ${r.reason}` : ''),
      r.status === 'Pending' && can('plot_change_requests', 'u') ? h('div', { class: 'row' },
        button(t('plots.req.approve'), { kind: 'primary', onClick: () => approve(r) }), button(t('plots.req.reject'), { kind: 'danger', onClick: () => rejectSheet(r) })) : null);
  }
  async function approve(r) {
    if (!(await confirmSheet(t('plots.req.approveTitle'), t('plots.req.approveText', { name: r.member_name, plot: dashKey(r.plot_key) }), { confirmLabel: t('plots.req.approve') }))) return;
    try { await ctx.api.call('plotRequests.approve', { id: r.id }); toast(t('common.saved')); loadRequests(); } catch (e) { toastError(friendly(e, t)); loadRequests(); }
  }
  function rejectSheet(r) {
    const reason = h('textarea', { id: 'rej-reason', maxlength: 200, rows: 3 });
    openSheet({ title: t('plots.req.rejectTitle'), body: h('div', { class: 'field' }, h('label', { for: 'rej-reason' }, t('plots.req.reason')), reason),
      actions: [{ label: t('plots.req.reject'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
        if (!reason.value.trim()) { reason.focus(); return toast(t('plots.req.reasonNeeded')); }
        try { await ctx.api.call('plotRequests.reject', { id: r.id, reason: reason.value.trim() }); close(); toast(t('common.saved')); } catch (e) { toastError(friendly(e, t)); }
        loadRequests();
      } }, { label: t('common.cancel') }] });
  }

  drawTabs(); countPending(); loadPlots();
  return h('div', { class: 'page stack' }, h('h1', {}, t('menu.plots')), tabs, body);
}

// One plot: owner, category (President can change), history, Transfer plot.
function plotSheet(ctx, p, done) {
  const { t } = ctx;
  const hist = h('div', { class: 'stack-sm' });
  const cat = h('div');
  const drawCat = (cur) => cat.replaceChildren(can('plots', 'u') && ctx.store.get().session.role === 'President'
    ? segmented(CATS.map((c) => [c, t(`plots.cat.${c}`)]), cur, async (v) => {
      try { await ctx.api.call('plots.update', { plotKey: p.plot_key, category: v }); p.category = v; toast(t('common.saved')); done(); } catch (e) { toastError(friendly(e, t)); drawCat(p.category); }
    }, t('plots.category')) : h('span', {}, p.category ? t(`plots.cat.${p.category}`) : t('plots.cat.none')));
  drawCat(p.category);
  if (can('plot_transfer', 'r')) {
    hist.replaceChildren(loadingRegion(1));
    ctx.api.call('plots.history', { plotKey: p.plot_key }).then(({ items }) => {
      const cur = p.owner ? [h('div', { class: 'list-row' }, h('div', { class: 'grow' }, p.owner.name), h('span', { class: 'small muted' }, t('plots.now')))] : [];
      hist.replaceChildren(h('h3', {}, t('plots.history')), ...(items.length ? [...items].reverse().map((r) => h('div', { class: 'list-row' },
        h('div', { class: 'grow' }, r.to_name ? t('plots.hist.to', { name: r.to_name }) : t('plots.hist.none'), r.from_name ? ` · ${t('plots.hist.from', { name: r.from_name })}` : '',
          r.note ? h('div', { class: 'small muted' }, r.note) : null), h('span', { class: 'small muted' }, dateShort(r.effective_date)))) : []), ...cur);
    }).catch((e) => hist.replaceChildren(errorState(friendly(e, t))));
  }
  openSheet({ title: t('plots.plot', { plot: p.plot_label }), wide: true, actions: [
    can('plot_transfer', 'c') ? { label: t('plots.transfer'), kind: 'primary', keepOpen: true, onClick: (close) => { close(); transferSheet(ctx, { plot: p, done }); } } : null,
    { label: t('common.close') }].filter(Boolean),
  body: h('div', { class: 'stack' },
    h('div', { class: 'list-row' }, h('div', { class: 'grow muted' }, t('plots.owner')), p.owner ? h('strong', {}, p.owner.name) : h('span', { class: 'muted' }, t('plots.noMember'))),
    h('div', { class: 'stack-sm' }, h('div', { class: 'small muted' }, t('plots.category')), cat), hist) });
}
