// S3.1 Expenses list (with S3.4 approvals queue and S3.2 add sheet). Detail is expense_detail.js.
import { withCamera } from '../camera.js';
import { h, card, button, field, statusPill, emptyState, errorState, loadingRegion, openSheet, toast, icon, segmented, toastError } from '../ui.js';
import { appendPage } from '../paging.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can, hasModule, store } from '../store.js';
import { compressPhoto } from '../photo.js';

export const CATEGORIES = ['Electricity', 'Water', 'Security', 'Repairs', 'Gardening', 'Events', 'Other'];
const KIND = { pending: 'pending', approved: 'approved', rejected: 'rejected' };
export const statusLabel = (t, s) => t(`exp.status.${s}`);
export const rupeesToPaise = (v) => Math.round(Number(String(v).replace(/[,\s₹]/g, '')) * 100);

export function rejectSheet(ctx, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'rej', label: t('exp.reason'), help: t('exp.rejectHelp'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('exp.reject'), body: h('div', { class: 'stack' }, reason, note), actions: [
    { label: t('exp.reject'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const text = reason.querySelector('input').value.trim();
      if (!text) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      try { await ctx.api.call('expenses.reject', { id, reason: text }); close(); toast(t('exp.rejected')); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
export async function approve(ctx, id, done) {
  try { await ctx.api.call('expenses.approve', { id }); toast(ctx.t('exp.approved')); done(); } catch (e) { toastError(friendly(e, ctx.t)); }
}

export default async function render(ctx) {
  const { t } = ctx;
  const box = h('div', { class: 'stack' });
  let filter = 'all', items = [], queue = [], cursor = null, stats = { year_total_paise: 0 }, busy = false;

  function row(x) {
    const rev = !!x.reverses_id;
    return h('a', { class: 'list-row', href: `#/money/expense/${x.id}`, style: rev ? 'opacity:.75' : '' },
      h('div', { class: 'grow' }, h('div', {}, x.reason), h('div', { class: 'small muted' }, `${t(`exp.cat.${x.category}`)} · ${dateShort(x.date)}`), x.event_title ? h('div', { class: 'small muted' }, icon('celebration', 'sm'), ' ', x.event_title) : null),
      h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(x.amount_paise)), statusPill(KIND[x.status], statusLabel(t, x.status))));
  }

  function draw() {
    const waiting = queue, parts = [];
    if (can('expense_approval', 'u') && waiting.length) {
      parts.push(card(t('exp.queue', { n: stats.pending_count }), 'pending_actions', ...waiting.map((x) => h('div', { class: 'stack-sm queue-item' },
        h('a', { class: 'grow', href: `#/money/expense/${x.id}` }, h('div', {}, x.reason), h('div', { class: 'small muted' }, `${money(x.amount_paise)} · ${t('exp.addedBy', { name: x.created_by_name })}`)),
        x.mine ? h('span', { class: 'small muted' }, t('exp.someoneElse')) : h('span', { class: 'row' },
          button(t('exp.approve'), { kind: 'primary', onClick: () => approve(ctx, x.id, load) }),
          button(t('exp.reject'), { kind: 'danger', onClick: () => rejectSheet(ctx, x.id, load) }))))));
    }
    parts.push(segmented([['all', t('exp.f.all')], ['pending', t('exp.f.pending')], ['approved', t('exp.f.approved')], ['rejected', t('exp.f.rejected')]], filter, (v) => { filter = v; loadList(); }, t('exp.filter')));
    parts.push(items.length ? h('div', { class: 'stack-sm' }, items.map(row)) : emptyState(t('exp.none'), 'receipt_long'));
    if (cursor) parts.push(button(t('audit.more'), { block: true, disabled: busy, onClick: () => loadList(true) }));
    box.replaceChildren(...parts);
  }

  // The first page comes from the server's cache of the newest rows; the waiting list for approvers is its own request.
  async function fetchPage(older) {
    const payload = {};
    if (filter !== 'all') payload.status = filter;
    if (older) payload.before = cursor;
    const apply = (r) => { if (older) ({ items, cursor } = appendPage(items, r)); else { items = r.items; cursor = r.next_cursor || null; } stats = r; };
    if (older) apply(await ctx.api.call('expenses.list', payload));
    else await ctx.api.swr('expenses.list', payload, (r) => { apply(r); if (box.childElementCount) draw(); });
  }
  async function loadList(older = false) {
    busy = true;
    try { await fetchPage(older); busy = false; draw(); } catch (e) { busy = false; toastError(friendly(e, t)); }
  }
  async function load() {
    if (!items.length) box.replaceChildren(loadingRegion(3));
    try {
      await fetchPage(false);
      queue = can('expense_approval', 'u') && stats.pending_count ? (await ctx.api.swr('expenses.list', { status: 'pending' }, () => {})).items : [];
      draw();
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return h('div', { class: 'stack' }, box,
    can('expenses', 'c') ? h('button', { type: 'button', class: 'fab', 'aria-label': t('exp.add'), title: t('exp.add'), onClick: () => addSheet(ctx, load) }, icon('add')) : null);
}

// "Which event is this for?" (optional). Only offered while the Events module is on and the person may read events.
// The list fills in from the stored/fresh events answer; `selected` is the event to start on.
export function eventPicker(ctx, id, selected = '') {
  const { t } = ctx;
  const sel = h('select', { id }, h('option', { value: '' }, t('exp.noEvent')));
  const box = h('div', { class: 'field' }, h('label', { for: id }, t('exp.event')), sel, h('div', { class: 'help' }, t('exp.eventHelp')));
  if (!hasModule('events') || !can('events', 'r')) { box.hidden = true; return box; }
  ctx.api.swr('events.list', {}, ({ items }) => {
    const keep = sel.value || selected;
    sel.replaceChildren(h('option', { value: '' }, t('exp.noEvent')), ...items.map((e) => h('option', { value: e.id }, `${e.title} · ${dateShort(e.date)}`)));
    sel.value = [...sel.options].some((o) => o.value === keep) ? keep : '';
  }).catch(() => { box.hidden = true; });
  return box;
}

export function addSheet(ctx, done, eventId = '') {
  const { t } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const date = field({ id: 'e-date', label: t('exp.date'), type: 'date', value: today, max: today });
  const amount = field({ id: 'e-amt', label: t('exp.amount'), type: 'text', inputmode: 'decimal', placeholder: '1500' });
  const cat = h('div', { class: 'field' }, h('label', { for: 'e-cat' }, t('exp.category')),
    h('select', { id: 'e-cat' }, CATEGORIES.map((c) => h('option', { value: c }, t(`exp.cat.${c}`)))));
  const reason = field({ id: 'e-why', label: t('exp.reason'), maxlength: 300 });
  const event = eventPicker(ctx, 'e-event', eventId);
  const file = h('input', { type: 'file', accept: 'image/*', id: 'e-file' });
  const proof = h('div', { class: 'field' }, h('label', { for: 'e-file' }, t('exp.proof')), withCamera(file, t), h('div', { class: 'help' }, t('exp.proofHelp')));
  const autoOk = store.get().session?.role === 'President';   // the President's own entries are approved on entry
  const note = h('div', { role: 'alert' });
  const warn = (m) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m));
  openSheet({ title: t('exp.add'), body: h('div', { class: 'stack' }, date, amount, cat, event, reason, proof, h('p', { class: 'small muted' }, t(autoOk ? 'exp.autoNote' : 'exp.approvalNote')), note), actions: [
    { label: t(autoOk ? 'exp.addNow' : 'exp.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value);
      const why = reason.querySelector('input').value.trim();
      if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      if (!why) return warn(t('exp.reasonNeeded'));
      if (!file.files[0]) return warn(t('exp.proofNeeded'));
      try {
        const b64 = await compressPhoto(file.files[0]);
        await ctx.api.call('expenses.create', { date: date.querySelector('input').value, amount_paise: paise, category: cat.querySelector('select').value, reason: why, event_id: event.querySelector('select').value, proof_jpeg_base64: b64 });
        close(); toast(t(autoOk ? 'exp.addedApproved' : 'exp.submitted')); done();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

// Edit a pending expense (amount, date, category, reason). The screenshot stays as submitted.
export function editSheet(ctx, x, done) {
  const { t } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const date = field({ id: 'x-date', label: t('exp.date'), type: 'date', value: x.date, max: today });
  const amount = field({ id: 'x-amt', label: t('exp.amount'), type: 'text', inputmode: 'decimal', value: String(x.amount_paise / 100) });
  const cat = h('div', { class: 'field' }, h('label', { for: 'x-cat' }, t('exp.category')),
    h('select', { id: 'x-cat' }, CATEGORIES.map((c) => h('option', { value: c, selected: c === x.category }, t(`exp.cat.${c}`)))));
  const reason = field({ id: 'x-why', label: t('exp.reason'), maxlength: 300, value: x.reason });
  const event = eventPicker(ctx, 'x-event', x.event_id || '');
  const note = h('div', { role: 'alert' });
  const warn = (m) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m));
  openSheet({ title: t('exp.edit'), body: h('div', { class: 'stack' }, date, amount, cat, event, reason, h('p', { class: 'small muted' }, t('exp.editNote')), note), actions: [
    { label: t('exp.saveEdit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value);
      const why = reason.querySelector('input').value.trim();
      if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      if (!why) return warn(t('exp.reasonNeeded'));
      try {
        await ctx.api.call('expenses.update', { id: x.id, date: date.querySelector('input').value, amount_paise: paise, category: cat.querySelector('select').value, reason: why, ...(event.hidden ? {} : { event_id: event.querySelector('select').value }) });
        close(); toast(t('exp.edited')); done();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
