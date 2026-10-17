// Money landing: one page with a segmented control (Expenses | Maintenance | Fees). Each tab is its own module.
import { h, segmented, emptyState, icon } from '../ui.js';
import { isDevHost } from '../config.js';
import { can, canAny, hasModule } from '../store.js';

let lastTab = (isDevHost() && new URLSearchParams(location.search).get('tab')) || 'expenses';   // ?tab= opens a tab directly (also used by the smoke test)

export const setMoneyTab = (tab) => { lastTab = tab; };   // used by links that open a given tab (e.g. after a plot transfer)

export default async function render(ctx) {
  const { t } = ctx;
  const tabs = [
    can('expenses', 'r') && ['expenses', t('money.expenses')],
    hasModule('maintenance') && (canAny('maintenance_payments') || canAny('dues')) && ['maintenance', t('money.maintenance')],
    hasModule('fees') && (canAny('fee_requests') || canAny('dues')) && ['fees', t('money.fees')],
  ].filter(Boolean);
  if (!tabs.length) return h('div', { class: 'page' }, h('h1', {}, t('nav.money')), emptyState(t('common.notAvailable'), 'lock'));
  if (!tabs.some(([k]) => k === lastTab)) lastTab = tabs[0][0];
  const body = h('div', { class: 'stack' });
  async function show(tab) {
    lastTab = tab;
    body.replaceChildren();
    const mod = await import(tab === 'expenses' ? './expenses.js' : tab === 'maintenance' ? './maintenance.js' : './fees.js');
    body.replaceChildren(await mod.default(ctx, tab));
  }
  const root = h('div', { class: 'page stack' }, h('div', { class: 'row-between' }, h('h1', { style: 'margin:0' }, t('nav.money')), h('div', { class: 'row' }, can('maintenance_payments', 'r') ? h('a', { class: 'btn', href: '#/money/payments' }, icon('receipt', 'sm'), t('pay.allTitle')) : null, can('expenses', 'r') ? h('a', { class: 'btn', href: '#/money/accounts' }, icon('account_balance', 'sm'), t('acc.title')) : null)),
    tabs.length > 1 ? segmented(tabs, lastTab, show, t('nav.money')) : null, body);
  show(lastTab);
  return root;
}
