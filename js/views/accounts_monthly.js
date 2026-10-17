// Money > Monthly accounts: what was spent (the approved expenses), what came in (maintenance and fees) and the net for a month, plus all-time totals.
import { h, card, button, icon, errorState, loadingRegion, emptyState } from '../ui.js';
import { friendly } from '../api.js';
import { money, monthLabel, dateShort } from '../fmt.js';

const shift = (ym, by) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export default function render(ctx) {
  const { t } = ctx;
  const now = new Date().toISOString().slice(0, 7);
  let month = now;
  const body = h('div', { class: 'stack' });
  const cat = (c) => { const k = `exp.cat.${c}`, v = t(k); return v === k ? c : v; };
  const stat = (amount, label, cls = '') => h('div', { class: 'stat' }, h('b', { class: cls }, money(amount)), h('span', { class: 'small muted' }, label));
  const row = (left, right) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, left), h('div', { class: 'amount' }, right));
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('acc.title')), body);

  async function load() {
    body.replaceChildren(loadingRegion(2));
    try {
      const d = await ctx.api.call('accounts.monthly', { month });
      body.replaceChildren(
        h('div', { class: 'row-between' },
          button('', { kind: 'text', icon: 'chevron_left', 'aria-label': t('cmp.m.prev'), onClick: () => { month = shift(month, -1); load(); } }),
          h('strong', {}, monthLabel(month)),
          button('', { kind: 'text', icon: 'chevron_right', 'aria-label': t('cmp.m.next'), disabled: month >= now, onClick: () => { month = shift(month, 1); load(); } })),
        card(t('acc.thisMonth'), 'account_balance', h('div', { class: 'stats' },
          stat(d.collected_paise, t('acc.collected')), stat(d.spent_paise, t('acc.spent')), stat(d.net_paise, t('acc.net'), d.net_paise < 0 ? 'neg' : ''), stat(d.collected_maintenance_paise, t('acc.maint'))),
          h('p', { class: 'small muted' }, t('acc.feesLine', { amount: money(d.collected_fees_paise) }))),
        card(t('acc.expenses'), 'receipt_long', d.expenses.length ? h('div', {}, d.expenses.map((x) => h('a', { class: 'list-row', href: `#/money/expense/${x.id}` },
          h('div', { class: 'grow' }, h('div', {}, x.reason), h('div', { class: 'small muted' }, `${cat(x.category)} · ${dateShort(x.date)}${x.reversal ? ` · ${t('acc.reversal')}` : ''}`)),
          h('div', { class: 'amount' }, money(x.amount_paise))))) : emptyState(t('acc.noExpenses'), 'inbox')),
        d.by_category.length ? card(t('acc.byCategory'), 'category', d.by_category.map((x) => row(cat(x.category), money(x.amount_paise)))) : null,
        card(t('acc.allTime'), 'savings', h('div', { class: 'stats' },
          stat(d.overall.collected_paise, t('acc.collected')), stat(d.overall.spent_paise, t('acc.spent')), stat(d.overall.net_paise, t('acc.net'), d.overall.net_paise < 0 ? 'neg' : ''))));
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}
