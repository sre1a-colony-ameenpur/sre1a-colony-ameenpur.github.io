// Shared by My payments and All payments: one payment as a list row.
import { h, statusPill } from '../ui.js';
import { money, monthLabel, dateShort } from '../fmt.js';

export function paymentRow(t, x, { showMember = false } = {}) {
  const what = x.kind === 'maintenance' ? `${t('pay.kind.maintenance')} · ${x.months.map(monthLabel).join(', ')}` : `${t(`pay.kind.${x.kind}`)}${x.title && x.kind === 'fee' ? ` · ${x.title}` : ''}`;
  const who = showMember ? ` · ${x.member || '—'}${x.plot_keys?.length ? ` (${x.plot_keys.join(', ')})` : ''}` : '';
  return h('div', { class: 'list-row' },
    h('div', { class: 'grow' }, h('div', {}, what), h('div', { class: 'small muted' }, `${dateShort(x.at)}${who}${x.reversal ? ` · ${t('pay.reversal')}` : ''}`), x.status === 'failed' && x.fail_reason ? h('div', { class: 'small muted' }, t('mt.failedWhy', { reason: x.fail_reason })) : null),
    h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(x.amount_paise)), statusPill(x.status === 'confirmed' ? 'approved' : x.status === 'failed' ? 'rejected' : 'pending', t(`pay.s.${x.status}`))));
}
