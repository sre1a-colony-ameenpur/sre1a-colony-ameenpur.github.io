// S1 Home. Each card loads on its own and appears only if `caps` allows reading it.
import { pendingBody } from '../pending.js';
import { h, icon, button, statusPill, plotChip, rolePill, errorState } from '../ui.js';
import { friendly, ApiError } from '../api.js';
import { money, monthLabel, dateShort, whenShort, daysUntil } from '../fmt.js';
import { can, hasModule } from '../store.js';
import { summarize, currentTotals } from '../maint.js';
import { STAGE_KIND, STAGE_KEY, titleOf } from './complaints.js';

// A card that loads independently. render(data) returns nodes, or null to hide the card.
// act(data) says the card needs something from this member (money owed, a vote to cast); those cards sort above the rest (CSS order, so nothing moves in the DOM).
// Stored answers are drawn first; when the fresh answer arrives every card re-runs quietly (the bus), without a skeleton.
const bus = new Set();
function lazyCard(ctx, { title, ic, load, render, act, cls = '' }) {
  const box = h('section', { class: `card ${cls}`.trim(), 'aria-busy': 'true' });
  const head = () => h('h2', { class: 'card-title' }, icon(ic), title);
  async function run(silent = false) {
    if (!silent) {
      box.setAttribute('aria-busy', 'true');
      box.replaceChildren(head(), h('div', { class: 'skel line', style: 'width:70%;margin-top:8px' }), h('div', { class: 'skel line', style: 'width:45%;margin-top:8px' }));
    }
    try {
      const data = await load();
      const out = render(data);
      if (!out) { box.remove(); return; }
      box.style.order = cls.includes('accent') ? -1 : act?.(data) ? 0 : 1;
      box.replaceChildren(head(), ...out.filter(Boolean));
    } catch (e) { if (!silent) box.replaceChildren(head(), errorState(friendly(e, ctx.t), run)); }
    box.removeAttribute('aria-busy');
  }
  const again = () => { if (box.isConnected) run(true); else bus.delete(again); };
  bus.add(again);
  run();
  return box;
}

// Home data comes in three requests sent at the same time, grouped by the spreadsheets they read (Apps Script runs separate requests in
// parallel, but one request reads its sheets one after another). Each card draws as soon as its group answers; a group is asked for only
// if some card needs it, so switched-off modules cost nothing. Retry on a failed card or group asks again.
const GROUP = { 'maintenance.mine': 'money', 'dues.mine': 'money', 'maintenance.totals': 'money', 'expenses.list': 'money',
  'polls.list': 'community', 'meetings.list': 'community', 'actionItems.list': 'community',
  'complaints.list': 'around', 'complaints.pending': 'around', 'events.list': 'around', 'plotRequests.list': 'around' };

function homeData(api) {
  const pending = {}, latest = {};
  return async (action) => {
    const g = GROUP[action];
    if (!pending[g]) {
      pending[g] = new Promise((resolve, reject) => {
        let first = true;
        api.swr('home.summary', { group: g }, (s) => { latest[g] = s; if (first) { first = false; resolve(s); } else bus.forEach((f) => f()); }).catch((e) => { if (first) reject(e); });
      });
    }
    try { await pending[g]; } catch (e) { pending[g] = null; throw e; }
    const sum = latest[g];
    const v = sum[action];
    if (v === undefined) throw new ApiError('NOT_FOUND');
    if (v && v.error) { pending[g] = null; throw new ApiError(v.error.code); }
    return v;
  };
}

export default function render(ctx) {
  const { t, api } = ctx;
  const home = homeData(api);
  const s = ctx.store.get().session;
  const r = (e) => can(e, 'r');
  const first = s.name.split(' ')[0];
  const closes = (iso) => { const d = daysUntil(iso); return d <= 0 ? t('home.closesToday') : t('home.closesIn', { n: d }); };
  const link = (href, text) => button(text, { href, kind: 'text' });
  const cards = [];

  // Needs your action: only where caps allow approving.
  if (can('expense_approval', 'u') || can('plot_change_requests', 'u')) {
    cards.push(lazyCard(ctx, { title: t('home.action.title'), ic: 'notification_important', cls: 'accent span-all',
      load: async () => ({
        expenses: can('expense_approval', 'u') ? (await home('expenses.list')).pending_for_me : 0,
        plots: can('plot_change_requests', 'u') ? (await home('plotRequests.list')).items.length : 0,
      }),
      render: (d) => {
        const rows = [];
        if (d.expenses) rows.push(['#/money', t('home.action.expenses', { n: d.expenses })]);
        if (d.plots) rows.push(['#/plots', t('home.action.plots', { n: d.plots })]);
        return rows.length ? rows.map(([href, text]) => h('a', { class: 'list-row', href }, h('span', { class: 'grow' }, text), icon('chevron_right'))) : null;
      } }));
  }
  // Quick buttons for roles that can record payments or add expenses.
  const quick = [
    can('maintenance_payments', 'c') && button(t('home.quick.payment'), { kind: 'primary', icon: 'receipt_long', href: '#/money' }),
    can('expenses', 'c') && button(t('home.quick.expense'), { icon: 'add', href: '#/money' }),
  ].filter(Boolean);

  if (hasModule('maintenance') && (can('dues', 'r') || r('maintenance_payments'))) {
    cards.push(lazyCard(ctx, { title: t('home.maint.title'), ic: 'home_work', load: async () => summarize(await home('maintenance.mine')), act: (d) => !!d.due,
      render: (d) => [
        d.paidUpTo ? h('p', {}, t('home.maint.paidUpTo', { month: monthLabel(d.paidUpTo) })) : null,
        d.due ? h('div', { class: 'list-row' }, h('div', { class: 'grow' }, h('span', { class: 'amount' }, money(d.due.remaining_paise)), ' ', t('home.maint.for', { month: monthLabel(d.due.month) })),
          statusPill(d.due.status === 'partly_paid' ? 'partly' : 'due')) : null,
        h('p', { class: 'small muted' }, t('home.maint.flat')),
        link('#/money', t('common.view'))] }));
  }
  if (hasModule('fees') && (can('dues', 'r') || r('maintenance_payments'))) {
    cards.push(lazyCard(ctx, { title: t('home.fees.title'), ic: 'request_quote', load: async () => (await home('dues.mine')).items.filter((d) => d.status !== 'paid'), act: (list) => list.length > 0,
      render: (list) => list.length ? [
        ...list.map((d) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, d.title,
          h('div', { class: 'small muted' }, h('span', { class: 'amount' }, money(d.amount_paise - d.paid_paise)), ' · ', t('home.fees.payBy', { date: dateShort(d.due_date) }))), statusPill(d.overdue ? 'overdue' : d.status === 'partly_paid' ? 'partly' : 'due'))),
        link('#/money', t('common.view'))] : null }));
  }
  if (r('polls')) {
    cards.push(lazyCard(ctx, { title: t('home.polls.title'), ic: 'how_to_vote', load: async () => (await home('polls.list')).items.filter((p) => p.status === 'open'), act: (list) => can('polls', 'vote') && list.some((p) => !p.my_vote.voted),
      render: (list) => list.length ? [
        ...list.map((p) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, p.question, h('div', { class: 'small muted' }, closes(p.closes_at))),
          p.my_vote.voted ? statusPill('voted', t('home.polls.voted')) : can('polls', 'vote') ? button(t('home.polls.vote'), { href: `#/community/polls/${p.id}`, kind: 'primary' }) : null)),
        can('polls', 'vote') ? h('p', { class: 'small muted' }, t('home.polls.oneVote')) : null] : [h('p', { class: 'muted' }, t('home.polls.none'))] }));
  }
  if (r('meetings')) {
    cards.push(lazyCard(ctx, { title: t('home.meeting.title'), ic: 'event_note', load: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const next = (await home('meetings.list')).items.filter((m) => m.status === 'scheduled' && m.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
        const open = next && r('action_items') ? (await home('actionItems.list')).items.length : 0;
        return next ? [{ ...next, open }] : [];
      },
      render: (list) => list[0] ? [
        h('p', {}, h('strong', {}, String(list[0].agenda).split('\n')[0] || t('mtg.meeting'))), h('p', { class: 'muted' }, `${whenShort(list[0].date, list[0].time)}, ${list[0].place}`),
        list[0].open ? link('#/community', t('home.meeting.actions', { n: list[0].open })) : null] : [h('p', { class: 'muted' }, t('home.meeting.none'))] }));
  }
  if (r('complaints')) {
    cards.push(lazyCard(ctx, { title: t('home.complaints.title'), ic: 'report', load: async () => (await home('complaints.list')).items.filter((c) => c.stage !== 'Closed').slice(0, 2),
      render: (list) => [...(list.length ? list.map((c) => h('a', { class: 'list-row', href: `#/issues/${c.id}` }, h('span', { class: 'grow' }, titleOf(c)), statusPill(STAGE_KIND[c.stage], t(`cmp.stage.${STAGE_KEY[c.stage]}`)))) : [h('p', { class: 'muted' }, t('home.complaints.none'))]),
        link('#/issues', t('common.viewAll'))] }));
  }
  if (r('complaints')) {
    cards.push(lazyCard(ctx, { title: t('pend.title'), ic: 'pending_actions', load: () => home('complaints.pending'), render: (d) => [...pendingBody(t, d), link('#/issues', t('common.viewAll'))] }));
  }
  if (r('events')) {
    cards.push(lazyCard(ctx, { title: t('home.event.title'), ic: 'celebration', load: async () => (await home('events.list')).items.filter((e) => e.upcoming).slice(0, 1),
      render: (list) => list[0] ? [h('p', {}, h('strong', {}, list[0].title)), h('p', { class: 'muted' }, dateShort(list[0].date)), link(`#/community`, t('common.view'))] : [h('p', { class: 'muted' }, t('home.event.none'))] }));
  }
  if (hasModule('maintenance')) cards.push(lazyCard(ctx, { title: t('home.money.title'), ic: 'savings', load: async () => currentTotals(await home('maintenance.totals')),
    render: (d) => { const exp = d.collected_paise + d.outstanding_paise || 1; return [h('p', {}, t('home.money.collected', { month: monthLabel(d.month), got: money(d.collected_paise), of: money(exp) })),
      h('div', { class: 'progress', role: 'img', 'aria-label': `${Math.round(d.collected_paise / exp * 100)}%` }, h('i', { style: `width:${Math.min(100, d.collected_paise / exp * 100)}%` }))]; } }));

  // For 14 days after a handover everyone sees who the President is now. No message is sent anywhere.
  const sinceMs = Date.parse(s.presidentSince || '');
  const newPres = s.presidentName && Number.isFinite(sinceMs) && Date.now() - sinceMs >= 0 && Date.now() - sinceMs < 14 * 86400000
    ? h('div', { class: 'banner info', role: 'status', style: 'border-radius:12px;border:1px solid var(--c-border);margin-bottom:16px' }, icon('how_to_reg'),
      h('div', { class: 'grow' }, t('home.newPresident', { name: s.presidentName, date: dateShort(s.presidentSince) }))) : null;

  // Shown when there are no cards, or every card hid itself (nothing to report / module off).
  const none = h('p', { class: 'muted', role: 'status', hidden: true }, t('home.noUpdates'));
  const grid = h('div', { class: 'cards wide' }, cards);
  const sync = () => { none.hidden = !!grid.querySelector(':scope > .card'); };
  sync();
  new MutationObserver(sync).observe(grid, { childList: true });

  return h('div', { class: 'page wide' },
    newPres,
    h('div', { class: 'row', style: 'margin-bottom:16px' }, h('h1', {}, t('home.greeting', { name: first })), rolePill(s.role), s.plotKeys.map(plotChip)),
    quick.length ? h('div', { class: 'btn-row', style: 'margin-bottom:16px;flex-direction:row;flex-wrap:wrap;justify-content:flex-start' }, quick) : null,
    grid, none);
}
