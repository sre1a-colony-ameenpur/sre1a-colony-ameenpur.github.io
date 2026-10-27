// Profile > My payments: every payment I made (maintenance, membership fee, fee requests), newest first.
import { h, errorState, loadingRegion, emptyState } from '../ui.js';
import { friendly } from '../api.js';
import { paymentRow } from './payments_common.js';

export default function render(ctx) {
  const { t } = ctx;
  const body = h('div', { class: 'stack', 'data-tour': 'pm-list' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('pay.mineTitle')), body);
  async function load() {
    body.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('payments.mine', {}, ({ items }) => {
        body.replaceChildren(items.length ? h('div', {}, items.map((x) => paymentRow(t, x))) : emptyState(t('pay.none'), 'inbox'));
      });
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}
