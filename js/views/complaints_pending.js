// Issues > Pending issues: the counts by stage, how long they have waited and who has them. A tile opens the Issues list on that stage.
import { h, card, errorState, loadingRegion } from '../ui.js';
import { friendly } from '../api.js';
import { pendingBody } from '../pending.js';

export default function render(ctx) {
  const { t } = ctx;
  const body = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('pend.title')), body);
  const load = () => ctx.api.swr('complaints.pending', {}, (d) => body.replaceChildren(card(t('pend.title'), 'pending_actions', ...pendingBody(t, d).filter(Boolean)))).catch((e) => body.replaceChildren(errorState(friendly(e, t), load)));
  body.replaceChildren(loadingRegion(2));
  load();
  return root;
}
