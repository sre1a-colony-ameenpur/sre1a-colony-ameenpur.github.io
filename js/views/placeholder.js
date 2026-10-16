// Stand-in for screens built later.
import { h } from '../ui.js';
import { emptyState } from '../ui.js';

export default function render(ctx) {
  return h('div', { class: 'page' }, h('h1', {}, ctx.t(ctx.route.title)),
    emptyState(ctx.t('common.comingSoon'), 'construction'));
}
