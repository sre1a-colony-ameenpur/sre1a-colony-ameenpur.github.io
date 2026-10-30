// Money > Account ledger (US24): the colony bank account as posted entries, each with the balance after it. Members see their fellow members' payments
// added up per day; the committee sees every entry. The President and Developers can start the ledger once and check it against the records.
import { h, card, button, icon, errorState, loadingRegion, emptyState, openSheet, confirmSheet, toast, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { money, monthLabel, dateShort } from '../fmt.js';
import { can } from '../store.js';

const shift = (ym, by) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export default function render(ctx) {
  const { t } = ctx;
  const now = new Date().toISOString().slice(0, 7);
  let month = now;
  const body = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('ledger.title')), h('p', { class: 'muted', 'data-tour': 'lg-intro' }, t('ledger.intro')), body);
  const admin = can('roles_config', 'u');

  // An expense entry opens that expense; a payment reference has no screen of its own and stays as text.
  const refLink = (ref) => (/^expenses\//.test(ref) ? h('a', { href: `#/money/expense/${encodeURIComponent(ref.slice(9))}` }, ref) : ref);
  const entry = (x) => {
    const credit = x.direction === 'credit';
    return h('div', { class: 'list-row', 'data-direction': x.direction },
      h('div', { class: 'grow' }, h('div', {}, x.description, x.count > 1 ? ` (${t('ledger.count', { n: x.count })})` : ''),
        h('div', { class: 'small muted' }, h('span', {}, `${dateShort(x.date)} · ${t(`ledger.type.${x.type}`)}`), ...(x.reference ? [' · ', refLink(x.reference)] : []))),
      h('div', { style: 'text-align:end' }, h('div', { class: `amount${credit ? '' : ' neg'}`, 'aria-label': t(credit ? 'ledger.credit' : 'ledger.debit') }, `${credit ? '+' : '−'}${money(x.amount_paise)}`),
        h('div', { class: 'small muted' }, t('ledger.balanceAfter', { amount: money(x.balance_after_paise) }))));
  };

  async function start() {
    if (!(await confirmSheet(t('ledger.startTitle'), t('ledger.startText'), { confirmLabel: t('ledger.start') }))) return;
    try { const r = await ctx.api.call('ledger.backfill', {}); toast(t('ledger.startedN', { n: r.entries })); load(); } catch (e) { toastError(friendly(e, t)); }
  }
  async function check() {
    try {
      const r = await ctx.api.call('ledger.verify', {});
      openSheet({ title: t('ledger.check'), body: h('div', { class: 'stack' },
        h('p', { class: r.ok ? '' : 'banner warn' }, r.ok ? t('ledger.checkOk', { amount: money(r.balance_paise) }) : t('ledger.checkBad', { ledger: money(r.balance_paise), records: money(r.records_paise) })),
        ...r.kinds.map((k) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t(`ledger.type.${k.type}`)),
          h('div', { class: k.ok ? 'small muted' : 'small neg' }, t('ledger.kindLine', { entries: k.entries, records: k.records }))))), actions: [{ label: t('common.close') }] });
    } catch (e) { toastError(friendly(e, t)); }
  }

  async function load() {
    body.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('ledger.list', { month }, (d) => {
        if (!d.started) {
          body.replaceChildren(card(t('ledger.title'), 'menu_book', h('p', {}, t(admin ? 'ledger.notStartedAdmin' : 'ledger.notStarted')),
            admin ? button(t('ledger.start'), { kind: 'primary', icon: 'play_arrow', 'data-tour': 'lg-start', onClick: start }) : null));
          return;
        }
        body.replaceChildren(
          card(t('ledger.balance'), 'account_balance', h('div', { class: `amount big${d.balance_paise < 0 ? ' neg' : ''}` }, money(d.balance_paise)),
            admin ? button(t('ledger.check'), { kind: 'text', icon: 'fact_check', 'data-tour': 'lg-check', onClick: check }) : null),
          h('div', { class: 'row-between' },
            button('', { kind: 'text', icon: 'chevron_left', 'aria-label': t('cmp.m.prev'), onClick: () => { month = shift(month, -1); load(); } }),
            h('strong', {}, monthLabel(month)),
            button('', { kind: 'text', icon: 'chevron_right', 'aria-label': t('cmp.m.next'), disabled: month >= now, onClick: () => { month = shift(month, 1); load(); } })),
          d.items.length ? h('div', { class: 'stack-sm' }, d.items.map(entry)) : emptyState(t('ledger.none'), 'menu_book'));
        ['lg-balance', 'lg-nav', 'lg-list'].forEach((k, i) => body.children[i]?.setAttribute('data-tour', k));
      });
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}
