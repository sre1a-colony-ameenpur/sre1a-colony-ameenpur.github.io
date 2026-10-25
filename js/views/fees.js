// Money > Fees. S3.9 my dues (everyone); committee: fee requests (S3.11), membership fees, fee payments to confirm; President: membership fee amounts (S3.8).
import { h, card, button, statusPill, plotChip, emptyState, errorState, loadingRegion, openSheet, toast, icon, segmented, toastError } from '../ui.js';
import { appendPage } from '../paging.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can } from '../store.js';
import { recentPaymentsCard } from './maintenance_sheets.js';
import { raiseRequestSheet, requestDetailSheet, membershipRateSheet, recordFeePaymentSheet, feeProofSheet } from './fees_sheets.js';

const plot = (k) => plotChip(k.replace(/^([A-Z])(\d+)$/, '$1-$2'));
export const dueKind = (d) => (d.overdue ? 'overdue' : d.status === 'partly_paid' ? 'partly' : d.status === 'paid' ? 'paid' : 'due');
export const dueLabel = (t, d) => t(`fee.status.${d.overdue ? 'overdue' : d.status}`);

let nextTab = 'requests';   // set by setFeesTab() so a link can open the Membership fees tab
export const setFeesTab = (tab) => { nextTab = tab; };

export default async function render(ctx) {
  const root = h('div', { class: 'stack' });
  root.append(myDues(ctx));
  if (can('fee_requests', 'r')) root.append(committee(ctx));
  if (can('membership_rates', 'c')) root.append(rateCard(ctx));
  return root;
}

function myDues(ctx) {
  const { t } = ctx;
  const body = h('div', { class: 'stack-sm' });
  async function load() {
    if (!body.childElementCount) body.replaceChildren(loadingRegion(1));
    try {
      await ctx.api.swr('dues.mine', {}, ({ items }) => body.replaceChildren(...(items.length ? items.map((d) => h('button', { type: 'button', class: 'list-row map-row', onClick: () => dueSheet(ctx, d) },
        h('div', { class: 'grow' }, h('div', {}, d.title), h('div', { class: 'small muted' }, t('home.fees.payBy', { date: dateShort(d.due_date) }))),
        h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(d.amount_paise)), statusPill(dueKind(d), dueLabel(t, d))))) : [emptyState(t('fee.nothing'), 'task_alt')])));
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return card(t('fee.mine'), 'request_quote', body);
}

function dueSheet(ctx, d) {
  const { t } = ctx;
  openSheet({ title: d.title, actions: [{ label: t('common.close') }], body: h('div', { class: 'stack-sm' },
    h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('mt.amount')), h('strong', {}, money(d.amount_paise))),
    h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('fee.paidSoFar')), h('strong', {}, money(d.paid_paise))),
    h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('fee.deadline')), h('span', {}, dateShort(d.due_date))),
    statusPill(dueKind(d), dueLabel(t, d)),
    d.payments.length ? h('h3', {}, t('mt.payments')) : null,
    ...d.payments.map((p) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, dateShort(p.at)), h('div', {}, money(p.amount_paise), ' ', p.status === 'awaiting' ? statusPill('pending', t('mt.awaiting')) : null)))) });
}

function committee(ctx) {
  const { t } = ctx;
  let tab = nextTab, filter = 'all';
  nextTab = 'requests';
  const box = h('div', { class: 'stack' });
  const queue = h('div', { class: 'stack' });
  const list = h('div', { class: 'stack-sm' });
  const filters = h('div');
  async function loadQueue() {
    if (!can('maintenance_payments', 'r')) return;
    try {
      await ctx.api.swr('dues.payments.list', { status: 'awaiting' }, ({ items }) => queue.replaceChildren(items.length ? card(t('fee.queue', { n: items.length }), 'pending_actions', ...items.map((p) => h('div', { class: 'stack-sm queue-item' },
        h('div', {}, h('strong', {}, p.member), ' ', p.plot_key ? plot(p.plot_key) : null),
        h('div', { class: 'small muted' }, `${p.title} · ${money(p.amount_paise)} · ${t('exp.addedBy', { name: p.recorded_by_name })}`),
        h('div', { class: 'row' }, p.has_proof ? button(t('mt.proof'), { kind: 'text', icon: 'image', onClick: () => feeProofSheet(ctx, p.id) }) : null,
          can('payment_confirmation', 'u') && !p.mine ? button(t('mt.confirm'), { kind: 'primary', onClick: async () => {
            try { await ctx.api.call('dues.payments.confirm', { id: p.id }); toast(t('mt.confirmed')); load(); } catch (e) { toastError(friendly(e, t)); }
          } }) : (p.mine ? h('span', { class: 'small muted' }, t('exp.someoneElse')) : null))))) : h('div')));
    } catch (e) { queue.replaceChildren(errorState(friendly(e, t), loadQueue)); }
  }
  // 30 a page: the first page shows from the stored answer and refreshes in the background; "Show more" fetches older ones.
  let reqItems = [], memItems = [], reqCursor = null, memCursor = null;
  const more = h('div');
  function draw() {
    if (tab === 'requests') {
      const shown = reqItems.filter((r) => filter === 'all' || (filter === 'open' && r.status === 'active') || (filter === 'overdue' && r.overdue > 0) || (filter === 'closed' && r.status !== 'active'));
      list.replaceChildren(...(shown.length ? shown.map((r) => h('button', { type: 'button', class: 'card map-row', style: 'text-align:start', onClick: () => requestDetailSheet(ctx, r.id, load) },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, r.title), h('span', { class: 'amount' }, money(r.amount_paise))),
        h('div', { class: 'small muted' }, `${(r.audience === 'all' ? t('fee.audience.all') : t('fee.audience.selected', { n: r.recipients }))} · ${t('home.fees.payBy', { date: dateShort(r.deadline) })}`),
        h('div', { class: 'progress', role: 'img', 'aria-label': t('fee.progress', { paid: r.paid, total: r.recipients }) }, h('i', { style: `width:${r.recipients ? Math.round(r.paid / r.recipients * 100) : 0}%` })),
        h('div', { class: 'small' }, t('fee.counts', { paid: r.paid, due: r.unpaid, overdue: r.overdue }), r.status !== 'active' ? ` · ${t('fee.cancelled')}` : ''))) : [emptyState(t('fee.noRequests'), 'request_quote')]));
    } else {
      list.replaceChildren(...(memItems.length ? memItems.map((d) => h('div', { class: 'list-row' },
        h('div', { class: 'grow' }, h('div', {}, d.member), h('div', { class: 'row small' }, d.plot_key ? plot(d.plot_key) : null, h('span', { class: 'muted' }, t('home.fees.payBy', { date: dateShort(d.due_date) })))),
        h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(d.amount_paise)), statusPill(dueKind(d), dueLabel(t, d)),
          can('maintenance_payments', 'c') && d.status !== 'paid' ? button(t('fee.record'), { kind: 'text', onClick: () => recordFeePaymentSheet(ctx, d, load) }) : null))) : [emptyState(t('fee.noMembership'), 'badge')]));
    }
    const cur = tab === 'requests' ? reqCursor : memCursor;
    more.replaceChildren(...(cur ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
  }
  async function load(older = false) {
    if (!older) loadQueue();
    const requests = tab === 'requests', action = requests ? 'feeRequests.list' : 'membership.fees.list';
    if (!older && !(requests ? reqItems : memItems).length) list.replaceChildren(loadingRegion(2));
    try {
      const apply = (r, add) => {
        if (requests) { if (add) ({ items: reqItems, cursor: reqCursor } = appendPage(reqItems, r)); else { reqItems = r.items; reqCursor = r.next_cursor || null; } } else if (add) ({ items: memItems, cursor: memCursor } = appendPage(memItems, r)); else { memItems = r.items; memCursor = r.next_cursor || null; }
        draw();
      };
      if (older) apply(await ctx.api.call(action, { before: requests ? reqCursor : memCursor }), true);
      else await ctx.api.swr(action, {}, (r) => apply(r, false));
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  function drawFilters() {
    filters.replaceChildren(tab === 'requests' ? segmented([['all', t('exp.f.all')], ['open', t('fee.f.open')], ['overdue', t('fee.f.overdue')], ['closed', t('fee.f.closed')]], filter, (v) => { filter = v; draw(); }, t('exp.filter')) : h('span'));
  }
  drawFilters();
  box.append(h('h2', {}, t('fee.committee')),
    can('fee_requests', 'c') ? h('button', { type: 'button', class: 'fab', 'aria-label': t('fee.raise'), title: t('fee.raise'), onClick: () => raiseRequestSheet(ctx, load) }, icon('add')) : null,
    queue, segmented([['requests', t('fee.requests')], ['membership', t('fee.membership')]], tab, (v) => { tab = v; drawFilters(); load(); }, t('fee.committee')), filters, list, more,
    can('maintenance_payments', 'r') ? recentPaymentsCard(ctx, 'fee', load) : null);
  load();
  return box;
}

function rateCard(ctx) {
  const { t } = ctx;
  const body = h('div', { class: 'stack-sm' });
  async function load() {
    body.replaceChildren(loadingRegion(1));
    try {
      await ctx.api.swr('membership.rates.list', {}, paint);
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  function paint({ items }) {
    const today = new Date().toISOString().slice(0, 10);
    const now = (cat) => { const r = items.filter((x) => x.category === cat && x.from_date <= today).sort((a, b) => b.from_date.localeCompare(a.from_date))[0]; return r ? r.amount_paise : null; };
    body.replaceChildren(h('p', { class: 'small muted' }, t('fee.rateNote')), ...['house', 'open'].map((cat) => h('div', { class: 'list-row' },
      h('div', { class: 'grow' }, t(`exp.catPlot.${cat}`)), now(cat) != null ? h('strong', {}, money(now(cat))) : statusPill('pending', t('mt.notSet')),
      button(t('mt.changeFee'), { kind: 'text', onClick: () => membershipRateSheet(ctx, cat, load) }))),
      h('h3', {}, t('mt.history')), ...[...items].sort((a, b) => b.from_date.localeCompare(a.from_date)).map((x) => h('div', { class: 'list-row' },
        h('div', { class: 'grow' }, `${t(`exp.catPlot.${x.category}`)} · ${t('mt.from', { month: dateShort(x.from_date) })}`), h('strong', {}, money(x.amount_paise)))));
  }
  load();
  return card(t('fee.rates'), 'badge', body);
}
