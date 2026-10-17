// Money > All payments (committee): everyone's payments with filters for month, type, status and plot. Thirty at a time.
import { h, button, errorState, loadingRegion, emptyState } from '../ui.js';
import { friendly } from '../api.js';
import { paymentRow } from './payments_common.js';

export default function render(ctx) {
  const { t } = ctx;
  let items = [], cursor = null, total = 0;
  const month = h('input', { type: 'month', id: 'pf-month', 'aria-label': t('pay.f.month') });
  const kind = h('select', { id: 'pf-kind', 'aria-label': t('pay.f.kind') }, [['', t('pay.f.all')], ['maintenance', t('pay.kind.maintenance')], ['membership', t('pay.kind.membership')], ['fee', t('pay.kind.fee')]].map(([v, l]) => h('option', { value: v }, l)));
  const status = h('select', { id: 'pf-status', 'aria-label': t('pay.f.status') }, [['', t('pay.f.all')], ['awaiting', t('pay.s.awaiting')], ['confirmed', t('pay.s.confirmed')]].map(([v, l]) => h('option', { value: v }, l)));
  const plot = h('input', { type: 'search', id: 'pf-plot', placeholder: t('pay.f.plot'), 'aria-label': t('pay.f.plot'), autocapitalize: 'characters' });
  const list = h('div', {}), more = h('div', {});
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('pay.allTitle')),
    h('div', { class: 'stack-sm' }, month, kind, status, plot), h('p', { class: 'small muted', role: 'status', id: 'pf-count' }), list, more);
  let timer = null;
  const filters = () => {
    const f = {};
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month.value)) f.month = month.value;
    if (kind.value) f.kind = kind.value;
    if (status.value) f.status = status.value;
    if (plot.value.trim()) f.plotKey = plot.value.trim().toUpperCase().replace(/\s/g, '');
    return f;
  };
  async function load(older = false) {
    if (!older) { items = []; cursor = null; list.replaceChildren(loadingRegion(2)); more.replaceChildren(); }
    try {
      const r = await ctx.api.call('payments.history', { ...filters(), ...(older && cursor ? { before: cursor } : {}) });
      items = items.concat(r.items); cursor = r.next_cursor; total = r.total;
      list.replaceChildren(...(items.length ? items.map((x) => paymentRow(t, x, { showMember: true })) : [emptyState(t('pay.none'), 'inbox')]));
      root.querySelector('#pf-count').textContent = t('pay.count', { n: total });
      more.replaceChildren(...(cursor ? [button(t('pay.more'), { block: true, onClick: () => load(true) })] : []));
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), () => load(older))); }
  }
  [month, kind, status].forEach((el) => el.addEventListener('change', () => load()));
  plot.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(), 350); });
  load();
  return root;
}
