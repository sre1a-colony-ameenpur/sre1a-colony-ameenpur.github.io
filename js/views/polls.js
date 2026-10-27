// S4.7 Polls list and S4.8 create poll. Voting and results are in poll_detail.js.
import { h, button, fab, field, statusPill, emptyState, errorState, loadingRegion, openSheet, toast, icon, segmented, toastError } from '../ui.js';
import { appendPage } from '../paging.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can } from '../store.js';

const hours = (n) => new Date(Date.now() + n * 3600000);
const localInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export default async function render(ctx) {
  const { t } = ctx;
  let tab = 'open', items = [];
  const list = h('div', { class: 'stack-sm', 'data-tour': 'po-list' });
  function draw() {
    const rows = items.filter((p) => (tab === 'open' ? p.status === 'open' || p.status === 'upcoming' : p.status === 'closed' || p.status === 'cancelled'));
    list.replaceChildren(...(rows.length ? rows.map((p) => h('a', { class: 'card', href: `#/community/polls/${p.id}`, style: 'display:block;text-decoration:none;color:inherit' },
      h('strong', {}, p.question),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'pill role' }, icon(p.type === 'secret' ? 'lock' : 'visibility', 'sm'), t(p.type === 'secret' ? 'poll.secret' : 'poll.open')),
        h('span', { class: 'small muted' }, p.status === 'open' ? t('poll.closes', { date: dateShort(p.closes_at) }) : p.status === 'upcoming' ? t('poll.opens', { date: dateShort(p.opens_at) }) : p.status === 'cancelled' ? t('poll.cancelled') : t('poll.closed'))),
      p.status === 'open' ? h('div', { style: 'margin-top:8px' }, p.my_vote.voted ? statusPill('voted', t('poll.voted'))
        : can('polls', 'vote') ? h('span', { class: 'btn primary' }, t('poll.vote')) : null) : null))
      : [emptyState(t('poll.none'), 'how_to_vote')]));
    more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
  }
  let cursor = null;
  const more = h('div');
  async function load(older = false) {
    if (!older && !items.length) list.replaceChildren(loadingRegion(2));
    try {
      if (older) { ({ items, cursor } = appendPage(items, await ctx.api.call('polls.list', { before: cursor }))); draw(); return; }
      await ctx.api.swr('polls.list', {}, (r) => { items = r.items; cursor = r.next_cursor || null; draw(); });
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  const seg = segmented([['open', t('poll.tabOpen')], ['closed', t('poll.tabClosed')]], 'open', (v) => { tab = v; draw(); }, t('com.polls'));
  seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('data-tour', `po-tab-${i ? 'closed' : 'open'}`));
  return h('div', { class: 'stack' }, seg,
    list, more, can('polls', 'c') ? fab(t('poll.new'), () => createSheet(ctx, load)) : null);
}

// Create a poll, or edit one (pass `poll` from polls.get). The backend refuses edits once anyone has voted.
export function createSheet(ctx, done, poll = null) {
  const { t } = ctx;
  let type = poll ? poll.type : 'open', display = poll ? poll.result_display : 'after_close';
  const question = field({ id: 'pl-q', label: t('poll.question'), maxlength: 300, value: poll ? poll.question : '' });
  const rows = h('div', { class: 'stack-sm' });
  const addRow = (v = '') => {
    if (rows.children.length >= 8) return;
    const input = h('input', { type: 'text', maxlength: 100, value: v, 'aria-label': t('poll.option'), placeholder: t('poll.option') });
    const row = h('div', { class: 'row' }, h('div', { class: 'grow field' }, input), button('', { kind: 'text', icon: 'close', 'aria-label': t('poll.removeOption'), onClick: () => { if (rows.children.length > 2) row.remove(); } }));
    rows.append(row);
  };
  if (poll) poll.options.forEach((o) => addRow(o.text)); else { addRow(); addRow(); }
  const opens = field({ id: 'pl-o', label: t('poll.opensAt'), type: 'datetime-local', value: localInput(poll ? new Date(poll.opens_at) : hours(0)) });
  const closes = field({ id: 'pl-c', label: t('poll.closesAt'), type: 'datetime-local', value: localInput(poll ? new Date(poll.closes_at) : hours(72)) });
  const note = h('div', { role: 'alert' });
  const warn = (m) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m));
  const summary = h('p', { class: 'small muted', 'aria-live': 'polite' });
  const sum = () => { summary.textContent = `${t(type === 'secret' ? 'poll.sumSecret' : 'poll.sumOpen')} ${t(display === 'ongoing' ? 'poll.sumOngoing' : 'poll.sumAfter')}`; };
  sum();
  openSheet({ title: t(poll ? 'poll.edit' : 'poll.new'), wide: true, body: h('div', { class: 'stack' }, question,
    h('div', { class: 'field' }, h('label', {}, t('poll.options')), rows, button(t('poll.addOption'), { kind: 'text', icon: 'add', onClick: () => addRow() })), opens, closes,
    h('div', { class: 'field' }, h('label', {}, t('poll.whoSees')), segmented([['open', t('poll.typeOpen')], ['secret', t('poll.typeSecret')]], type, (v) => { type = v; sum(); }, t('poll.whoSees'))),
    h('div', { class: 'field' }, h('label', {}, t('poll.whenResults')), segmented([['after_close', t('poll.afterClose')], ['ongoing', t('poll.whileOpen')]], display, (v) => { display = v; sum(); }, t('poll.whenResults'))),
    summary, note), actions: [
    { label: t(poll ? 'poll.saveEdit' : 'poll.create'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const q = question.querySelector('input').value.trim(), options = [...rows.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
      if (!q) return warn(t('poll.questionNeeded'));
      if (options.length < 2) return warn(t('poll.twoOptions'));
      const o = new Date(opens.querySelector('input').value), c = new Date(closes.querySelector('input').value);
      if (isNaN(o) || isNaN(c) || c <= o) return warn(t('poll.windowBad'));
      const body = { question: q, options, type, resultDisplay: display, opensAt: o.toISOString(), closesAt: c.toISOString() };
      try { await ctx.api.call(poll ? 'polls.update' : 'polls.create', poll ? { id: poll.id, ...body } : body); close(); toast(t(poll ? 'poll.edited' : 'poll.created')); done(); }
      catch (e) { toastError(e.code === 'IMMUTABLE' && poll ? t('poll.hasVotes') : friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
