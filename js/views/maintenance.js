// Money > Maintenance. S3.5 my plot (every member) plus S3.6 committee month view, payments to confirm (S3.4) and fee settings (S3.8).
import { h, card, button, statusPill, plotChip, emptyState, errorState, loadingRegion, openSheet, toast, icon, segmented } from '../ui.js';
import { friendly } from '../api.js';
import { money, monthLabel, dateShort } from '../fmt.js';
import { can } from '../store.js';
import { ymNow, shiftMonth, rateFor, summarize, tileStatus, currentTotals } from '../maint.js';
import { recordPaymentSheet, raiseDuesSheet, editDueSheet, feeSheet, proofSheet, recentPaymentsCard, removedPaymentSheet } from './maintenance_sheets.js';

const PILL = { paid: 'paid', partly_paid: 'partly', unpaid: 'unpaid' };
const TILE_ICON = { paid: 'check_circle', partly_paid: 'timelapse', unpaid: 'error', future: 'remove', none: 'remove' };
const plot = (k) => plotChip(k.replace(/^([A-Z])(\d+)$/, '$1-$2'));

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'stack' });
  const mineBox = h('div', { class: 'stack' });
  root.append(mineBox);
  loadMine();
  if (can('maintenance_dues', 'c') || can('maintenance_payments', 'c') || can('payment_confirmation', 'u')) root.append(committee(ctx));
  if (can('maintenance_rates', 'c')) root.append(feeCard(ctx));
  return root;

  async function loadMine() {
    mineBox.replaceChildren(loadingRegion(2));
    try {
      const [mine, rates, totals] = await Promise.all([ctx.api.call('maintenance.mine'), ctx.api.call('maintenance.rates.list'), ctx.api.call('maintenance.totals')]);
      const now = ymNow(), sum = summarize(mine), fee = rateFor(rates.items, now);
      const year = now.slice(0, 4), tot = currentTotals(totals, now);
      const tiles = Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, '0')}`, st = tileStatus(mine, month, now);
        return h('button', { type: 'button', class: `tile ${st}`, disabled: st === 'future' || st === 'none', 'aria-label': `${monthLabel(month)}: ${t(`mt.tile.${st}`)}`,
          onClick: () => monthSheet(ctx, mine, month) }, h('span', {}, monthLabel(month).slice(0, 3)), icon(TILE_ICON[st], 'sm'));
      });
      mineBox.replaceChildren(
        card(null, null,
          mine.plot_keys.length ? h('div', { class: 'row' }, mine.plot_keys.map(plot)) : h('p', { class: 'muted' }, t('mt.noPlot')),
          fee != null ? h('div', { class: 'list-row' }, h('div', { class: 'grow muted' }, t('mt.monthlyFee')), h('strong', {}, money(fee))) : null,
          h('div', { class: 'list-row' }, h('div', { class: 'grow muted' }, t('mt.balance')),
            sum.balance > 0 ? h('strong', { class: 'bad-text' }, t('mt.due', { amount: money(sum.balance) }))
              : h('strong', {}, sum.paidUpTo ? t('mt.paidUpTo', { month: monthLabel(sum.paidUpTo) }) : t('mt.nothingDue'))),
          sum.credit > 0 ? h('p', { class: 'small muted' }, t('mt.credit', { amount: money(sum.credit) })) : null,
          h('p', { class: 'small muted' }, t('mt.flat'))),
        card(t('mt.year', { year }), 'calendar_month', h('div', { class: 'tiles' }, tiles)),
        card(t('mt.colony'), 'groups', h('p', {}, t('mt.colonyLine', { got: money(tot.collected_paise), out: money(tot.outstanding_paise) }))));
    } catch (e) { mineBox.replaceChildren(errorState(friendly(e, t), loadMine)); }
  }
}

function monthSheet(ctx, mine, month) {
  const { t } = ctx;
  const m = mine.months.find((x) => x.month === month);
  const pays = mine.payments.filter((p) => String(p.months).split(',').includes(month));
  openSheet({ title: monthLabel(month), actions: [{ label: t('common.close') }], body: h('div', { class: 'stack-sm' },
    h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('mt.amount')), h('strong', {}, money(m.amount_paise))),
    h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('mt.paid')), statusPill(PILL[m.status], `${money(m.paid_paise)} · ${t(`mt.tile.${m.status}`)}`)),
    pays.length ? h('h3', {}, t('mt.payments')) : h('p', { class: 'muted' }, t('mt.noPayments')),
    ...pays.map((p) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, dateShort(p.at)), h('div', {}, money(p.amount_paise), ' ', p.status === 'awaiting' ? statusPill('pending', t('mt.awaiting')) : null)))) });
}

// ---- Committee: month view + payments to confirm ----
function committee(ctx) {
  const { t } = ctx;
  let month = ymNow(), filter = 'all', data = null;
  const box = h('div', { class: 'stack' });
  const queue = h('div', { class: 'stack' });
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('mt.search'), 'aria-label': t('mt.search'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  q.addEventListener('input', draw);
  const list = h('div', { class: 'stack-sm' });
  const head = h('div', { class: 'stack' });

  async function load() {
    list.replaceChildren(loadingRegion(2));
    try { data = await ctx.api.call('maintenance.status', { month }); draw(); } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
    loadQueue();
  }
  function draw() {
    if (!data) return;
    const raised = data.items.length > 0;
    const f = q.value.trim().toLowerCase().replace(/[\s-]/g, '');
    const rows = data.items.filter((x) => (filter === 'all' || x.status === filter) && (!f || (x.member + x.plots.join('')).toLowerCase().replace(/[\s-]/g, '').includes(f)));
    head.replaceChildren(
      h('div', { class: raised ? 'banner ok' : 'banner warn', style: 'border-radius:12px' }, icon(raised ? 'check_circle' : 'schedule'), ' ', raised ? t('mt.raised', { month: monthLabel(month) }) : t('mt.notRaised', { month: monthLabel(month) })),
      h('div', { class: 'row' }, h('span', {}, t('mt.cnt.paid', { n: data.counts.paid })), h('span', {}, t('mt.cnt.partly', { n: data.counts.partly_paid })), h('span', {}, t('mt.cnt.unpaid', { n: data.counts.unpaid }))),
      segmented([['all', t('exp.f.all')], ['unpaid', t('mt.tile.unpaid')], ['partly_paid', t('mt.tile.partly_paid')], ['paid', t('mt.tile.paid')]], filter, (v) => { filter = v; draw(); }, t('exp.filter')), q);
    list.replaceChildren(...(rows.length ? rows.map((x) => h('div', { class: 'list-row' },
      h('div', { class: 'grow' }, h('div', { class: 'row', style: 'gap:6px' }, x.member, x.removed ? statusPill('closed', t('mt.removed')) : null), h('div', { class: 'row small' }, x.plots.map(plot), h('span', { class: 'muted' }, t('mt.by', { who: x.raised_by_name })))),
      h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(x.amount_paise)), statusPill(PILL[x.status], t(`mt.tile.${x.status}`)),
        x.awaiting_paise ? h('div', { class: 'small muted' }, t('mt.awaitingAmt', { amount: money(x.awaiting_paise) })) : null,
        can('maintenance_dues', 'u') && x.status !== 'paid' ? button(t('mt.editAmount'), { kind: 'text', onClick: () => editDueSheet(ctx, x, month, load) }) : null)))
      : [emptyState(raised ? t('mt.none') : t('mt.notRaisedEmpty'), 'inbox')]));
  }
  async function loadQueue() {
    if (!can('maintenance_payments', 'r') && !can('payment_confirmation', 'u')) return;
    try {
      const { items } = await ctx.api.call('maintenance.payments.list', { status: 'awaiting' });
      queue.replaceChildren(items.length ? card(t('mt.queue', { n: items.length }), 'pending_actions', ...items.map((p) => h('div', { class: 'stack-sm queue-item' },
        h('div', {}, h('strong', {}, p.member), ' ', p.plots.map(plot)),
        h('div', { class: 'small muted' }, `${money(p.amount_paise)} · ${p.months.map(monthLabel).join(', ')} · ${t('exp.addedBy', { name: p.recorded_by_name })}`),
        h('div', { class: 'row' },
          p.has_proof ? button(t('mt.proof'), { kind: 'text', icon: 'image', onClick: () => proofSheet(ctx, p.id) }) : null,
          can('payment_confirmation', 'u') && !p.mine ? button(t('mt.confirm'), { kind: 'primary', onClick: async () => {
            try { await ctx.api.call('maintenance.payments.confirm', { id: p.id }); toast(t('mt.confirmed')); load(); } catch (e) { toast(friendly(e, t)); }
          } }) : (p.mine ? h('span', { class: 'small muted' }, t('exp.someoneElse')) : null))))) : h('div'));
    } catch (e) { queue.replaceChildren(errorState(friendly(e, t), loadQueue)); }
  }

  const label = h('strong', {}, monthLabel(month));
  const step = (n) => { const next = shiftMonth(month, n); if (next > ymNow()) return; month = next; label.textContent = monthLabel(month); load(); };
  const picker = h('div', { class: 'row', style: 'justify-content:space-between' },
    button('', { kind: 'text', icon: 'chevron_left', 'aria-label': t('mt.prev'), onClick: () => step(-1) }), label,
    button('', { kind: 'text', icon: 'chevron_right', 'aria-label': t('mt.next'), onClick: () => step(1) }));
  const actions = h('div', { class: 'btn-row', style: 'flex-direction:row;flex-wrap:wrap;justify-content:flex-start' },
    can('maintenance_payments', 'c') ? button(t('mt.record'), { kind: 'primary', icon: 'receipt_long', onClick: () => recordPaymentSheet(ctx, load) }) : null,
    can('maintenance_dues', 'c') ? button(t('mt.raise'), { icon: 'playlist_add', onClick: () => raiseDuesSheet(ctx, month, load) }) : null);
  const removedBox = h('div');
  async function loadRemoved() {
    try {
      const { items, total_paise: total } = await ctx.api.call('maintenance.removedBalances');
      removedBox.replaceChildren(items.length ? card(t('mt.removedOwe', { amount: money(total) }), 'person_off', h('p', { class: 'small muted' }, t('mt.removedHelp')),
        ...items.map((i) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, h('div', {}, i.name), h('div', { class: 'row small' }, i.plots.map(plot),
          i.removed_at ? h('span', { class: 'muted' }, t('mt.removedOn', { date: dateShort(i.removed_at) })) : null,
          h('span', { class: 'muted' }, t('mt.removedSplit', { maintenance: money(i.maintenance_paise), fees: money(i.fees_paise) })))),
          h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(i.total_paise)),
            can('maintenance_payments', 'c') ? button(t('mt.record'), { kind: 'text', onClick: () => removedPaymentSheet(ctx, i, () => { loadRemoved(); load(); }) }) : null)))) : h('div'));
    } catch { /* the month view reports its own errors */ }
  }
  loadRemoved();
  box.append(h('h2', {}, t('mt.committee')), actions, queue, removedBox, card(t('mt.monthView'), 'fact_check', picker, head, list), recentPaymentsCard(ctx, 'maintenance', load));
  load();
  return box;
}

function feeCard(ctx) {
  const { t } = ctx;
  const body = h('div', { class: 'stack-sm' });
  async function load() {
    body.replaceChildren(loadingRegion(1));
    try {
      const r = await ctx.api.call('maintenance.rates.list'), cur = rateFor(r.items, ymNow());
      body.replaceChildren(
        h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('mt.currentFee')), cur != null ? h('strong', {}, money(cur)) : statusPill('pending', t('mt.notSet'))),
        button(t('mt.changeFee'), { icon: 'edit', onClick: () => feeSheet(ctx, r.last_raised_month, load) }),
        h('p', { class: 'small muted' }, t('mt.feeNote')),
        h('h3', {}, t('mt.history')),
        ...[...r.items].reverse().map((x) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('mt.from', { month: monthLabel(x.from_month) })), h('strong', {}, money(x.amount_paise)))));
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return card(t('mt.feeSettings'), 'tune', body);
}
