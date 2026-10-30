// One fee due of the signed-in member as its own screen (opened from a shared link): the same details as the sheet on Money > Fees.
import { h, card, errorState, loadingRegion } from '../ui.js';
import { friendly } from '../api.js';
import { shareHead } from '../share.js';
import { dueBody, dueShare } from './fees.js';

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });
  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('dues.mine', {}, ({ items }) => {
        const d = items.find((x) => x.id === ctx.params.id) || items.find((x) => x.request_id === ctx.params.id);
        if (!d) { root.replaceChildren(errorState(t('fee.dueNotFound'), () => { location.hash = '#/money'; })); return; }
        root.replaceChildren(card(null, null, shareHead(ctx, h('h2', {}, d.title), dueShare(ctx, d)), dueBody(ctx, d)));
      });
    } catch (e) { root.replaceChildren(errorState(friendly(e, t), load)); }
  }
  await load();
  return root;
}
