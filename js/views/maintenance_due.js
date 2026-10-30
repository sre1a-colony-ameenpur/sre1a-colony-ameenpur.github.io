// A member's maintenance for one month as its own screen (opened from a shared link): the same details as the month sheet on Money.
import { h, card, errorState, loadingRegion } from '../ui.js';
import { friendly } from '../api.js';
import { monthLabel } from '../fmt.js';
import { shareHead } from '../share.js';
import { monthBody, monthShare } from './maintenance.js';

export default async function render(ctx) {
  const { t } = ctx, month = ctx.params.month;
  const root = h('div', { class: 'page stack' });
  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('maintenance.mine', {}, (mine) => {
        if (!/^\d{4}-\d{2}$/.test(month) || !mine.months.some((x) => x.month === month)) { root.replaceChildren(errorState(t('mt.dueNotFound'), () => { location.hash = '#/money'; })); return; }
        root.replaceChildren(card(null, null, shareHead(ctx, h('h2', {}, monthLabel(month)), monthShare(ctx, month)), monthBody(ctx, mine, month)));
      });
    } catch (e) { root.replaceChildren(errorState(friendly(e, t), load)); }
  }
  await load();
  return root;
}
