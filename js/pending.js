// The Pending issues numbers, drawn as tiles. Each tile opens the Issues list on the matching filter.
import { h } from './ui.js';
import { setIssuesFilter } from './views/complaints.js';

// onPick(group): used on the Issues screen itself, where a link to the same address would do nothing; elsewhere the tile is a link.
export function pendingBody(t, d, onPick = null) {
  if (!d.total) return [h('p', { class: 'muted' }, t('pend.none'))];
  const tile = (n, label, group) => h(onPick ? 'button' : 'a', onPick ? { type: 'button', class: 'stat', onClick: () => onPick(group) } : { class: 'stat', href: '#/issues', onClick: () => setIssuesFilter(group) }, h('b', {}, String(n)), h('span', { class: 'small muted' }, label));
  return [
    h('div', { class: 'stats', 'data-tour': 'pend-tiles' }, tile(d.by_stage.open, t('cmp.stage.open'), 'open'), tile(d.by_stage.acknowledged, t('cmp.stage.ack'), 'open'),
      tile(d.by_stage.in_progress, t('cmp.stage.progress'), 'progress'), tile(d.by_stage.resolved, t('pend.awaitingClose'), 'resolved')),
    d.oldest_days === null ? null : h('p', { class: 'small', 'data-tour': 'pend-age' }, t('pend.age', { oldest: d.oldest_days, avg: d.average_days })),
    d.oldest_days === null ? null : h('p', { class: 'small muted', 'data-tour': 'pend-buckets' }, t('pend.buckets', { a: d.buckets.lt3, b: d.buckets.d3to7, c: d.buckets.gt7 })),
    d.by_person.length ? h('p', { class: 'small muted', 'data-tour': 'pend-with' }, `${t('pend.with')} ${d.by_person.map((x) => `${x.name} ${x.count}`).join(' · ')}`) : null,
  ];
}
