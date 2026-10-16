// S4.6 Action items overview: every open action item across meetings, grouped Overdue / Due soon / Later, with a "Mine" filter.
import { h, card, statusPill, emptyState, errorState, loadingRegion, toast, icon, segmented } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can } from '../store.js';
import { groupItems } from '../actions.js';
import { meetingTitle } from './meetings.js';

export default async function render(ctx) {
  const { t } = ctx;
  let scope = 'all', items = [], titles = {};
  const body = h('div', { class: 'stack' });
  const today = new Date().toISOString().slice(0, 10);

  function row(a) {
    return h('div', { class: 'list-row' },
      can('action_items', 'u') ? h('input', { type: 'checkbox', style: 'width:24px;height:24px', 'aria-label': t('mtg.markDone'), onChange: async (e) => {
        try { await ctx.api.call('actionItems.update', { id: a.id, status: 'done' }); toast(t('common.saved')); load(); } catch (err) { e.target.checked = false; toast(friendly(err, t)); }
      } }) : null,
      h('div', { class: 'grow' }, h('div', {}, a.text),
        h('div', { class: 'small muted' }, `${a.owner_name}${a.mine ? ` (${t('mtg.you')})` : ''} · ${t('mtg.due', { date: dateShort(a.due_date) })}`),
        h('a', { class: 'small', href: `#/community/meetings/${a.meeting_id}` }, icon('event_note', 'sm'), ' ', titles[a.meeting_id] || t('mtg.meeting'))),
      a.due_date < today ? statusPill('overdue', t('mtg.overdue')) : null);
  }
  function draw() {
    const g = groupItems(items, today, scope === 'mine');
    const parts = [['overdue', 'ai.overdue'], ['soon', 'ai.soon'], ['later', 'ai.later']].filter(([k]) => g[k].length)
      .map(([k, key]) => card(`${t(key)} (${g[k].length})`, k === 'overdue' ? 'warning' : 'checklist', ...g[k].map(row)));
    body.replaceChildren(segmented([['all', t('ai.all')], ['mine', t('ai.mine')]], scope, (v) => { scope = v; draw(); }, t('exp.filter')),
      ...(parts.length ? parts : [emptyState(t(scope === 'mine' ? 'ai.noneMine' : 'ai.none'), 'task_alt')]));
  }
  async function load() {
    body.replaceChildren(loadingRegion(3));
    try {
      const [open, meetings] = await Promise.all([ctx.api.call('actionItems.list', { status: 'open' }), ctx.api.call('meetings.list')]);
      items = open.items; titles = Object.fromEntries(meetings.items.map((m) => [m.id, meetingTitle(m, t('mtg.meeting'))]));
      draw();
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return h('div', { class: 'page stack' }, h('a', { href: '#/community', class: 'btn text', style: 'align-self:flex-start' }, icon('arrow_back'), t('common.back')), h('h1', {}, t('ai.title')), body);
}
