// S4.9 Poll voting and S4.10 results.
import { h, card, button, statusPill, errorState, loadingRegion, openSheet, toast, icon, field } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can } from '../store.js';
import { createSheet } from './polls.js';

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });

  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('polls.get', { id: ctx.params.id }, ({ poll: p, my_vote: mv, results: r }) => {
      const stateText = p.status === 'open' ? t('poll.closes', { date: dateShort(p.closes_at) }) : p.status === 'upcoming' ? t('poll.opens', { date: dateShort(p.opens_at) }) : p.status === 'cancelled' ? t('poll.cancelled') : t('poll.closed');
      const head = card(null, null, h('h2', {}, p.question),
        h('div', { class: 'row' }, h('span', { class: 'pill role' }, icon(p.type === 'secret' ? 'lock' : 'visibility', 'sm'), t(p.type === 'secret' ? 'poll.secret' : 'poll.open')), h('span', { class: 'small muted' }, stateText)),
        p.cancel_reason ? h('p', { class: 'small muted' }, p.cancel_reason) : null);
      const parts = [head];
      if (p.status === 'open' && !mv.voted && can('polls', 'vote')) parts.push(voteCard(ctx, p, load));
      else if (mv.voted) parts.push(card(null, null, statusPill('voted', t('poll.youVoted'))));
      parts.push(resultsCard(ctx, p, r));
      if (can('polls', 'u') && (p.status === 'open' || p.status === 'upcoming')) parts.push(button(t('poll.edit'), { block: true, icon: 'edit', onClick: () => createSheet(ctx, load, p) }));
      if (can('polls', 'd') && (p.status === 'open' || p.status === 'upcoming')) parts.push(button(t('poll.cancelPoll'), { kind: 'danger', block: true, onClick: () => cancelSheet(ctx, p.id, load) }));
      root.replaceChildren(...parts);
      });
    } catch (e) { root.replaceChildren(errorState(e.code === 'NOT_FOUND' ? t('poll.notFound') : friendly(e, t), load)); }
  }
  load();
  return root;
}

function voteCard(ctx, p, done) {
  const { t } = ctx;
  let chosen = null;
  const btn = button(t('poll.vote'), { kind: 'primary', block: true, disabled: true, onClick: () => confirm() });
  const radios = p.options.map((o) => h('label', { class: 'list-row', style: 'cursor:pointer' }, h('input', { type: 'radio', name: 'opt', value: o.option_id, style: 'width:24px;height:24px', onChange: () => { chosen = o; btn.disabled = false; } }), h('span', { class: 'grow' }, o.text)));
  function confirm() {
    openSheet({ title: t('poll.confirmTitle', { option: chosen.text }), body: h('p', {}, t('poll.confirmText')), actions: [
      { label: t('poll.confirmYes'), kind: 'primary', keepOpen: true, onClick: async (close) => {
        try { await ctx.api.call('polls.vote', { pollId: p.id, optionId: chosen.option_id }); close(); toast(t('poll.thanks')); done(); }
        catch (e) { close(); toast(e.code === 'ALREADY_VOTED' ? t('poll.youVoted') : friendly(e, t)); done(); }
      } }, { label: t('common.cancel') }] });
  }
  return card(t('poll.yourVote'), 'how_to_vote', ...radios, h('p', { class: 'small muted' }, t('poll.oneVote'), p.type === 'secret' ? ` ${t('poll.choiceSecret')}` : ''), btn);
}

function resultsCard(ctx, p, r) {
  const { t } = ctx;
  if (!r.visible) return card(t('poll.results'), 'bar_chart', h('p', { class: 'muted' }, t('poll.later', { date: dateShort(p.closes_at) })));
  const total = r.options.reduce((a, o) => a + o.n, 0) || 1;
  const rows = r.options.map((o) => h('div', { class: 'stack-sm' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: r.winners.includes(o.option_id) ? 'win' : '' }, o.text, r.winners.includes(o.option_id) && r.status === 'closed' ? ` · ${t(r.tie ? 'poll.tie' : 'poll.winner')}` : ''),
      h('strong', {}, `${o.n} (${Math.round(o.n / total * 100)}%)`)),
    h('div', { class: 'progress', role: 'img', 'aria-label': `${o.text}: ${o.n}` }, h('i', { style: `width:${Math.round(o.n / total * 100)}%` }))));
  const optText = Object.fromEntries(r.options.map((o) => [o.option_id, o.text]));
  return card(t('poll.results'), 'bar_chart', ...rows,
    h('p', { class: 'small muted' }, t('poll.turnout', { voted: r.members_voted, total: r.members_total, pct: r.members_total ? Math.round(r.members_voted / r.members_total * 100) : 0 })),
    r.type === 'secret' ? h('p', { class: 'small muted' }, icon('lock', 'sm'), ' ', t('poll.choiceSecret')) : null,
    r.choices ? h('div', { class: 'stack-sm' }, h('h3', {}, t('poll.byMember')), ...r.choices.map((c) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, c.member_name), h('span', {}, optText[c.option_id] || '')))) : null);
}

function cancelSheet(ctx, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'pc-why', label: t('exp.reason'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('poll.cancelPoll'), body: h('div', { class: 'stack' }, reason, note), actions: [
    { label: t('poll.cancelPoll'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim(); if (!why) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      try { await ctx.api.call('polls.cancel', { id, reason: why }); close(); toast(t('poll.cancelledToast')); done(); } catch (e) { note.replaceChildren(h('div', { class: 'banner warn' }, friendly(e, t))); }
    } }, { label: t('common.cancel') }] });
}
