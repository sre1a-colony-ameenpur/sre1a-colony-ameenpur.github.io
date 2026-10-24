// Issues > Monthly summary: how many complaints were raised, resolved and closed in a month, and how long resolving took.
import { h, card, button, icon, errorState, loadingRegion } from '../ui.js';
import { friendly } from '../api.js';
import { monthLabel, duration } from '../fmt.js';

const shift = (ym, by) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export default function render(ctx) {
  const { t } = ctx;
  const now = new Date().toISOString().slice(0, 7);
  let month = now;
  const body = h('div', { class: 'stack' });
  const stat = (n, label) => h('div', { class: 'stat' }, h('b', {}, String(n)), h('span', { class: 'small muted' }, label));
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('cmp.monthly')), body);

  async function load() {
    body.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('complaints.monthly', { month }, (d) => {
        body.replaceChildren(
          h('div', { class: 'row-between' },
            button('', { kind: 'text', icon: 'chevron_left', 'aria-label': t('cmp.m.prev'), onClick: () => { month = shift(month, -1); load(); } }),
            h('strong', {}, monthLabel(month)),
            button('', { kind: 'text', icon: 'chevron_right', 'aria-label': t('cmp.m.next'), disabled: month >= now, onClick: () => { month = shift(month, 1); load(); } })),
          card(t('cmp.m.title'), 'insights', h('div', { class: 'stats' },
            stat(d.raised, t('cmp.m.raised')), stat(d.resolved, t('cmp.m.resolved')), stat(d.still_open, t('cmp.m.stillOpen')), stat(d.reopened, t('cmp.m.reopened')),
            stat(d.closed_by_hand, t('cmp.m.closedHand')), stat(d.closed_by_system, t('cmp.m.closedAuto'))),
            h('p', {}, icon('timer', 'sm'), ' ', d.avg_hours_to_resolve === null ? t('cmp.m.noAvg') : t('cmp.m.avg', { d: (({ key, n }) => t(key, { n }))(duration(d.avg_hours_to_resolve * 3600000)) }))));
      });
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}
