// S6.5 Change log (committee): read-only list of everything that was changed, with filters, a before/after view and the integrity check.
import { h, button, rolePill, emptyState, errorState, loadingRegion, icon, toast, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort, money } from '../fmt.js';

const timeOf = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${dateShort(iso)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
};
// "amount_paise" -> "Amount Paise"
export const humanKey = (k) => String(k).replace(/[_\-.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
// Saved values as [Human Key, value] pairs; a lone value (not an object) has no key.
const entriesOf = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v).map(([k, x]) => [humanKey(k), show(x)]) : [['Value', show(v)]]);

export default function render(ctx) {
  const { t } = ctx;
  // The server filters and pages the log (PAGE entries at a time, newest first); this screen only asks for the next page.
  const PAGE = 50;
  let items = [], cursor = null, loadingMore = false, lastVerify = null, bad = null, q = '', person = '', action = '', from = '', to = '', open = new Set(), ticket = 0, timer = null;
  const people = new Set(), actions = new Set();                 // everything seen so far, so a filter choice never makes its own option vanish
  const top = h('div'), filters = h('div', { class: 'stack-sm' }), count = h('p', { class: 'small muted', 'aria-live': 'polite' }), list = h('div', { class: 'stack-sm' }), more = h('div');
  const body = h('div', { class: 'stack' }, top, filters, count, list, more);
  const root = h('div', { class: 'stack' }, body);

  const params = (before) => {
    const p = { limit: PAGE };
    if (before) p.before = before;
    if (q.trim()) p.q = q.trim();
    if (person) p.person = person;
    if (action) p.action = action;
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  };
  const remember = (rows) => rows.forEach((i) => { if (i.actor_name) people.add(i.actor_name); actions.add(i.action); });

  // First page: the whole screen (first time) or just the list (after a filter changed).
  async function load(first = true) {
    const mine = ++ticket;
    if (first) root.replaceChildren(loadingRegion(3));
    else { list.replaceChildren(loadingRegion(2)); more.replaceChildren(); count.textContent = ''; }
    try {
      await ctx.api.swr('audit.list', params(), (r) => {
        if (mine !== ticket) return;                             // a newer filter already asked
        items = r.items; cursor = r.next_cursor || null; lastVerify = r.last_verify; remember(items);
        if (lastVerify && !lastVerify.ok && !bad) bad = { from_ts: null };
        if (first) { root.replaceChildren(body); drawTop(); drawFilters(); }
        drawList();
      });
    } catch (e) {
      if (mine !== ticket) return;
      if (first) root.replaceChildren(errorState(friendly(e, t), () => load(true)));
      else list.replaceChildren(errorState(friendly(e, t), () => load(false)));
    }
  }

  async function older() {
    if (!cursor || loadingMore) return;
    loadingMore = true; drawMore();
    const mine = ticket;
    try {
      const r = await ctx.api.call('audit.list', params(cursor));
      if (mine !== ticket) return;
      items = items.concat(r.items); cursor = r.next_cursor || null; remember(r.items);
    } catch (e) { toastError(friendly(e, t)); }
    loadingMore = false; drawList();
  }

  const refilter = (now) => { clearTimeout(timer); if (now) load(false); else timer = setTimeout(() => load(false), 300); };

  let checking = false;
  async function check() {
    checking = true; drawTop();
    try {
      const r = await ctx.api.call('audit.verify');
      lastVerify = { at: new Date().toISOString(), ok: r.ok };
      bad = r.ok ? null : { from_ts: r.from_ts };
    } catch (e) { toastError(friendly(e, t)); }
    checking = false; drawTop(); drawList();
  }

  function drawTop() {
    const failed = lastVerify && !lastVerify.ok;
    const btn = button(t(failed ? 'audit.checkAgain' : 'audit.check'), { kind: failed ? 'danger' : '', disabled: checking, onClick: check });
    if (failed) {
      top.replaceChildren(h('div', { class: 'card', role: 'alert', style: 'border-inline-start:4px solid var(--danger, #b3261e)' },
        h('div', { class: 'stack-sm' },
          h('strong', {}, icon('warning', 'sm'), ' ', t('audit.integrity.bad')),
          h('p', {}, t('audit.integrity.badText', { when: bad?.from_ts ? timeOf(bad.from_ts) : '—' })),
          h('details', {}, h('summary', {}, t('audit.what')), h('ol', { class: 'stack-sm', style: 'padding-inline-start:20px' }, h('li', {}, t('audit.step1')), h('li', {}, t('audit.step2')))),
          btn)));
      return;
    }
    top.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'row-between' },
      h('div', {}, h('strong', {}, icon(lastVerify ? 'verified' : 'help', 'sm'), ' ', t(lastVerify ? 'audit.integrity.ok' : 'audit.integrity.never')),
        lastVerify ? h('div', { class: 'small muted' }, t('audit.integrity.checked', { when: timeOf(lastVerify.at) })) : null),
      checking ? h('span', { class: 'small muted', role: 'status' }, t('audit.checking')) : btn)));
  }

  function drawFilters() {
    const peopleList = [...people].sort(), actionList = [...actions].sort();
    const sel = (id, label, val, opts, all, set) => h('div', { class: 'field' }, h('label', { for: id }, label),
      h('select', { id, onChange: (e) => { set(e.target.value); refilter(true); } }, h('option', { value: '' }, all),
        opts.map(([v, text]) => h('option', { value: v, selected: v === val }, text))));
    const date = (id, label, val, set) => h('div', { class: 'field' }, h('label', { for: id }, label),
      h('input', { id, type: 'date', value: val, onInput: (e) => { set(e.target.value); refilter(true); } }));
    const search = h('input', { id: 'audit-q', type: 'search', value: q, placeholder: t('audit.search'), 'aria-label': t('audit.search'), autocomplete: 'off' });
    search.addEventListener('input', (e) => { q = e.target.value; refilter(false); });
    filters.replaceChildren(h('div', { class: 'field' }, h('label', { for: 'audit-q' }, t('audit.search')), search),
      sel('audit-person', t('audit.person'), person, peopleList.map((p) => [p, p]), t('audit.allPeople'), (v) => { person = v; }),
      sel('audit-action', t('audit.action'), action, actionList.map((a) => [a, label(a)]), t('audit.allActions'), (v) => { action = v; }),
      h('div', { class: 'row' }, date('audit-from', t('audit.from'), from, (v) => { from = v; }), date('audit-to', t('audit.to'), to, (v) => { to = v; })));
  }

  const label = (a) => { const k = `audit.a.${a}`; const s = t(k); return s === k ? a : s; };
  const who = (i) => i.actor_name || (i.role === 'System' ? t('audit.system') : t('audit.unknown'));
  // A short plain-language detail from the saved values: the amount and the reason, when there are any.
  const detailOf = (i) => {
    const n = i.new && typeof i.new === 'object' ? i.new : {};
    const parts = [];
    if (Number.isFinite(Number(n.amount_paise)) && n.amount_paise !== '' && n.amount_paise != null) parts.push(t('audit.detail.amount', { amount: money(Number(n.amount_paise)) }));
    if (typeof n.reason === 'string' && n.reason) parts.push(t('audit.detail.reason', { reason: n.reason }));
    return parts.join(' · ');
  };
  const sentence = (i) => `${label(i.action)}${i.entity_id ? ` · ${i.entity_id}` : ''}`;

  function drawList() {
    count.textContent = t(cursor ? 'audit.countMore' : 'audit.count', { n: items.length });
    list.replaceChildren(...(items.length ? items.map(row) : [emptyState(t('audit.none'), 'history')]));
    drawMore();
  }

  function drawMore() {
    more.replaceChildren(...(cursor ? [button(t('audit.older'), { block: true, disabled: loadingMore, onClick: older })] : []));
    if (loadingMore) more.append(h('p', { class: 'small muted', role: 'status' }, t('audit.loadingMore')));
  }

  // One card per record: the title shows alone; the chevron opens only this card (who, when, before, after).
  function row(i) {
    const key = `${i.ts}|${i.action}|${i.entity_id}`;
    const mismatch = bad?.from_ts && i.ts >= bad.from_ts;
    const line = (name, ...value) => h('div', { class: 'log-line' }, h('span', { class: 'log-key' }, name, ': '), ...value);
    const values = (title, v) => v === null || v === undefined ? null : h('div', { class: 'log-values' }, h('div', { class: 'log-key' }, `${title}:`),
      ...entriesOf(v).map(([k, val]) => h('div', { class: 'log-pair' }, `[${k} : ${val}]`)));
    const detail = h('div', { class: 'log-body stack-sm' },
      line(t('audit.who'), `${who(i)} `, rolePill(i.role)),
      line(t('audit.when'), timeOf(i.ts)),
      i.old === null && i.new === null ? h('p', { class: 'small muted' }, t('audit.noDetail')) : [values(t('audit.before'), i.old), values(t('audit.after'), i.new)]);
    const isOpen = open.has(key);
    detail.hidden = !isOpen;
    const chevron = icon(isOpen ? 'expand_less' : 'expand_more');
    const head = h('button', { type: 'button', class: 'log-head', 'aria-expanded': String(isOpen),
      onClick: () => {
        const now = !open.has(key);
        now ? open.add(key) : open.delete(key);
        detail.hidden = !now; head.setAttribute('aria-expanded', String(now)); chevron.textContent = now ? 'expand_less' : 'expand_more';
      } },
      h('span', { class: 'grow' }, sentence(i), mismatch ? [' ', h('span', { class: 'pill bad' }, t('audit.mismatch'))] : null,
        detailOf(i) ? h('span', { class: 'small muted log-sub' }, detailOf(i)) : null),
      chevron);
    return h('div', { class: `card log-card${mismatch ? ' log-bad' : ''}` }, head, detail);
  }

  load();
  return root;
}
