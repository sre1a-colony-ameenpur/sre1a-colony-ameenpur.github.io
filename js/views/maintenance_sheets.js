// Sheets for maintenance: record a payment (S3.7), raise dues (S3.12), edit a due (S3.13), change the fee (S3.8), view a proof.
import { withCamera } from '../camera.js';
import { h, card, button, field, openSheet, toast, icon, plotChip, loadingRegion, statusPill, errorState, toastError } from '../ui.js';
import { appendPage } from '../paging.js';
import { friendly } from '../api.js';
import { money, monthLabel, dateShort } from '../fmt.js';
import { can, hasModule } from '../store.js';
import { compressPhoto } from '../photo.js';
import { ymNow, shiftMonth } from '../maint.js';
import { rupeesToPaise } from './expenses.js';

const label = (k) => k.replace(/^([A-Z])(\d+)$/, '$1-$2');
const warnBox = () => { const n = h('div', { role: 'alert' }); return [n, (m) => n.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m))]; };

// Member picker by name or plot. Returns { el, get() } where get() is the chosen { name, plotKey } or null.
export function memberPicker(ctx, id = 'mp', onPick) {
  const { t } = ctx;
  let chosen = null;
  const input = field({ id, label: t('mt.member'), placeholder: t('mt.memberSearch'), autocomplete: 'off' });
  const results = h('div', { class: 'stack-sm' });
  const picked = h('div', { class: 'row' });
  let timer;
  input.querySelector('input').addEventListener('input', (e) => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (!q) { results.replaceChildren(); return; }
    timer = setTimeout(async () => {
      try {
        const { items } = await ctx.api.call('members.lookup', { q });
        results.replaceChildren(...items.filter((m) => m.plot_keys.length).map((m) => h('button', { type: 'button', class: 'list-row map-row', onClick: () => {
          chosen = { name: m.name, plotKey: m.plot_keys[0] };
          picked.replaceChildren(h('strong', {}, m.name), ...m.plot_keys.map((k) => plotChip(label(k))));
          results.replaceChildren(); e.target.value = ''; if (onPick) onPick(chosen);
        } }, h('div', { class: 'grow' }, m.name), ...m.plot_keys.map((k) => plotChip(label(k))))));
      } catch (err) { toastError(friendly(err, t)); results.replaceChildren(h('p', { class: 'small muted' }, friendly(err, t))); }
    }, 250);
  });
  return { el: h('div', { class: 'stack-sm' }, input, results, picked), get: () => chosen };
}

// S3.7 Record a payment. First "What is this payment for?": monthly maintenance (member and months) or a fee (the member's membership fee or a fee request).
export function recordPaymentSheet(ctx, done) {
  const { t } = ctx;
  let purpose = 'maint', dueChosen = null;
  const picker = memberPicker(ctx, 'rp-member', (who) => { if (purpose === 'fee') loadDues(who); });
  const picked = new Set();
  const now = ymNow();
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(now, i - 11)).reverse();
  const chips = h('div', { class: 'chips' }, months.map((m) => h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onClick: (e) => {
    picked.has(m) ? picked.delete(m) : picked.add(m); e.currentTarget.setAttribute('aria-pressed', String(picked.has(m)));
  } }, monthLabel(m))));
  const monthsBox = h('div', { class: 'field' }, h('label', {}, t('mt.months')), chips);
  const duesBox = h('div', { class: 'field', hidden: true });
  const amount = field({ id: 'rp-amt', label: t('exp.amount'), inputmode: 'decimal', placeholder: '1500' });
  const file = h('input', { type: 'file', accept: 'image/*', id: 'rp-file' });
  const [note, warn] = warnBox();

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('mt.paymentFor') }, [['maint', t('mt.purposeMaint')], hasModule('fees') && ['fee', t('mt.purposeFee')]].filter(Boolean).map(([v, text]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === purpose), 'data-purpose': v, onClick: () => { setPurpose(v); } }, text)));
  function setPurpose(v) {
    purpose = v; dueChosen = null; note.replaceChildren();
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.purpose === v)));
    monthsBox.hidden = v !== 'maint'; duesBox.hidden = v !== 'fee';
    duesBox.replaceChildren();
    if (v === 'fee' && picker.get()) loadDues(picker.get());
    if (v === 'fee') amount.querySelector('input').value = '';
  }
  async function loadDues(who) {
    duesBox.replaceChildren(loadingRegion(1));
    try {
      const r = await ctx.api.call('dues.forMember', { plotKey: who.plotKey });
      if (purpose !== 'fee' || picker.get() !== who) return;
      dueChosen = null;
      if (!r.items.length) { duesBox.replaceChildren(h('p', { class: 'small muted' }, t('mt.noOpenFees', { name: r.member }))); return; }
      duesBox.replaceChildren(h('label', {}, t('mt.whichFee')), ...r.items.map((d) => h('label', { class: 'list-row', style: 'cursor:pointer' },
        h('input', { type: 'radio', name: 'rp-due', style: 'width:24px;height:24px', onChange: () => {
          dueChosen = d; amount.querySelector('input').value = String(d.outstanding_paise / 100); note.replaceChildren(); } }),
        h('span', { class: 'grow' }, d.title, h('div', { class: 'small muted' }, t('mt.dueBy', { date: dateShort(d.due_date) }))), h('strong', {}, money(d.outstanding_paise)))));
    } catch (e) { toastError(friendly(e, t)); duesBox.replaceChildren(h('p', { class: 'small muted' }, friendly(e, t))); }
  }

  openSheet({ title: t('mt.record'), body: h('div', { class: 'stack' }, hasModule('fees') ? h('div', { class: 'field' }, h('label', {}, t('mt.paymentFor')), seg) : null, picker.el,
    monthsBox, duesBox, amount,
    h('div', { class: 'field' }, h('label', { for: 'rp-file' }, t('exp.proof')), withCamera(file, t), h('div', { class: 'help' }, t('exp.proofHelp'))),
    h('p', { class: 'small muted' }, t('mt.confirmNote')), note), actions: [
    { label: t('mt.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const who = picker.get(), paise = rupeesToPaise(amount.querySelector('input').value);
      if (!who) return warn(t('mt.pickMember'));
      if (purpose === 'maint' && !picked.size) return warn(t('mt.pickMonths'));
      if (purpose === 'fee' && !dueChosen) return warn(t('mt.pickFee'));
      if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      if (purpose === 'fee' && paise > dueChosen.outstanding_paise) return warn(t('mt.moreThanOwed', { amount: money(dueChosen.outstanding_paise) }));
      if (!file.files[0]) return warn(t('exp.proofNeeded'));
      try {
        const proof = await compressPhoto(file.files[0]);
        if (purpose === 'maint') await ctx.api.call('maintenance.payments.create', { plotKey: who.plotKey, months: [...picked].sort(), amountPaise: paise, proofJpegBase64: proof });
        else await ctx.api.call('dues.payments.create', { dueId: dueChosen.id, amountPaise: paise, proofJpegBase64: proof });
        close(); toast(t('mt.recorded')); done();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export function raiseDuesSheet(ctx, defaultMonth, done) {
  const { t } = ctx;
  const now = ymNow();
  let scope = 'all';
  const sel = h('select', { id: 'rd-month' }, Array.from({ length: 7 }, (_, i) => shiftMonth(now, -i)).map((m) => h('option', { value: m, selected: m === defaultMonth }, monthLabel(m))));
  const picker = memberPicker(ctx, 'rd-member'); picker.el.hidden = true;
  const preview = h('p', { class: 'small', 'aria-live': 'polite' });
  const [note, warn] = warnBox();
  async function refresh() {
    try {
      const p = await ctx.api.call('maintenance.dues.preview', { month: sel.value });
      preview.textContent = p.amount_paise == null ? t('mt.noRate')
        : t('mt.preview', { n: p.will_create, amount: money(p.amount_paise), skip: p.already_have, nop: p.no_plot });
    } catch (e) { toastError(friendly(e, t)); preview.textContent = friendly(e, t); }
  }
  sel.addEventListener('change', refresh); refresh();
  openSheet({ title: t('mt.raise'), body: h('div', { class: 'stack' },
    h('div', { class: 'field' }, h('label', { for: 'rd-month' }, t('mt.month')), sel),
    h('div', { class: 'seg' }, ...[['all', t('mt.allMembers')], ['one', t('mt.oneMember')]].map(([v, txt]) => h('button', { type: 'button', 'aria-pressed': String(v === 'all'), onClick: (e) => {
      scope = v; e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); picker.el.hidden = v === 'all';
    } }, txt))),
    picker.el, preview, h('p', { class: 'small muted' }, t('mt.autoNote')), note), actions: [
    { label: t('mt.raise'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const payload = { month: sel.value };
      if (scope === 'one') { const w = picker.get(); if (!w) return warn(t('mt.pickMember')); payload.plotKey = w.plotKey; }
      try { const r = await ctx.api.call('maintenance.dues.raise', payload); close(); toast(t('mt.raisedToast', { n: r.created })); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export function editDueSheet(ctx, row, month, done) {
  const { t } = ctx;
  const amount = field({ id: 'ed-amt', label: t('exp.amount'), inputmode: 'decimal', value: String(row.amount_paise / 100) });
  const reason = field({ id: 'ed-why', label: t('exp.reason'), maxlength: 200 });
  const line = h('p', { class: 'small', 'aria-live': 'polite' });
  const [note, warn] = warnBox();
  amount.querySelector('input').addEventListener('input', () => {
    const p = rupeesToPaise(amount.querySelector('input').value);
    line.textContent = p >= 0 && p !== row.amount_paise ? t('mt.editLine', { who: row.member, month: monthLabel(month), from: money(row.amount_paise), to: money(p), diff: money(Math.abs(p - row.amount_paise)) }) : '';
  });
  openSheet({ title: t('mt.editAmount'), body: h('div', { class: 'stack' }, h('p', {}, `${row.member} · ${monthLabel(month)}`), amount, reason, line, note), actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const p = rupeesToPaise(amount.querySelector('input').value), why = reason.querySelector('input').value.trim();
      if (!(p >= 0)) return warn(t('exp.amountNeeded'));
      if (!why) return warn(t('exp.reasonNeeded'));
      try { await ctx.api.call('maintenance.dues.update', { plotKey: row.plots[0], month, amountPaise: p, reason: why }); close(); toast(t('common.saved')); done(); }
      catch (e) { toastError(e.code === 'IMMUTABLE' ? t('mt.locked') : friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export function feeSheet(ctx, lastRaised, done) {
  const { t } = ctx;
  const amount = field({ id: 'fs-amt', label: t('exp.amount'), inputmode: 'decimal', placeholder: '1500' });
  const first = shiftMonth(lastRaised || ymNow(), 1);
  const sel = h('select', { id: 'fs-from' }, Array.from({ length: 12 }, (_, i) => shiftMonth(first, i)).map((m) => h('option', { value: m }, monthLabel(m))));
  const [note, warn] = warnBox();
  openSheet({ title: t('mt.changeFee'), body: h('div', { class: 'stack' }, amount, h('div', { class: 'field' }, h('label', { for: 'fs-from' }, t('mt.appliesFrom')), sel),
    h('p', { class: 'small muted' }, t('mt.earlierNote')), note), actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const p = rupeesToPaise(amount.querySelector('input').value);
      if (!(p >= 0)) return warn(t('exp.amountNeeded'));
      try { await ctx.api.call('maintenance.rates.set', { amountPaise: p, fromMonth: sel.value }); close(); toast(t('common.saved')); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export async function proofSheet(ctx, id) {
  const { t } = ctx;
  const body = h('div', {}, loadingRegion(1));
  openSheet({ title: t('exp.proof'), wide: true, body, actions: [{ label: t('common.close') }] });
  try {
    const { jpegBase64 } = await ctx.api.media('maintenance.payments.proof', { id, size: 'full' });
    body.replaceChildren(h('img', { src: `data:image/jpeg;base64,${jpegBase64}`, alt: t('exp.proof'), style: 'width:100%' }));
  } catch (e) { toastError(friendly(e, t)); body.replaceChildren(h('p', {}, friendly(e, t))); }
}

// Reverse a confirmed payment (maintenance or fee): a reversing entry cancels it, the original stays on record. `action` is the API verb.
// A Paid payment the checker does not accept: a reason is needed; the member sees it and the due is raised again. `action` is the API verb.
export function failPaymentSheet(ctx, action, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'pf-why', label: t('mt.failReason'), help: t('mt.failHelp'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('mt.failTitle'), body: h('div', { class: 'stack' }, reason, note), actions: [
    { label: t('mt.fail'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const text = reason.querySelector('input').value.trim();
      if (!text) { note.replaceChildren(h('div', { class: 'banner warn' }, t('mt.failNeeded'))); return; }
      try { await ctx.api.call(action, { id, reason: text }); close(); toast(t('mt.failedDone')); done(); } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

// Own payment row status: Paid (waiting for a second person), or Failed with the reason; a Confirmed one needs no pill.
export function ownPaymentPill(t, p) {
  if (p.status === 'awaiting') return statusPill('pending', t('pay.s.awaiting'));
  if (p.status === 'failed') return statusPill('rejected', t('mt.failed'));
  return null;
}

export function reversePaymentSheet(ctx, action, p, done) {
  const { t } = ctx;
  const reason = field({ id: 'rv-why', label: t('exp.reason'), help: t('mt.reverseHelp'), maxlength: 200 });
  const [note, warn] = warnBox();
  openSheet({ title: t('mt.reversePayment'), body: h('div', { class: 'stack' }, h('p', {}, `${p.member} · ${money(p.amount_paise)}`), reason, note), actions: [
    { label: t('mt.reversePayment'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim();
      if (!why) return warn(t('exp.reasonNeeded'));
      try { await ctx.api.call(action, { id: p.id, reason: why }); close(); toast(t('mt.reversedToast')); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

// "Recent payments" card for the committee. kind: 'maintenance' | 'fee'. Confirmed payments and reversing entries, newest first; Reverse unless already reversed.
export function recentPaymentsCard(ctx, kind, onChange) {
  const { t } = ctx;
  const fee = kind === 'fee';
  const listAction = fee ? 'dues.payments.list' : 'maintenance.payments.list';
  const reverseAction = fee ? 'dues.payments.reverse' : 'maintenance.payments.reverse';
  const body = h('div', { class: 'stack-sm' });
  let all = [], cursor = null;
  const more = h('div');
  async function load(older = false) {
    if (!older && !all.length) body.replaceChildren(loadingRegion(1));
    try {
      if (older) { ({ items: all, cursor } = appendPage(all, await ctx.api.call(listAction, { before: cursor }))); paint(all); return; }
      await ctx.api.swr(listAction, {}, (r) => { all = r.items; cursor = r.next_cursor || null; paint(all); });
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  function paint(items) {
    {
      const reversed = new Set(items.filter((x) => x.reverses_id).map((x) => x.reverses_id));   // a reversal waits for a second person to confirm it
      const shown = items.filter((x) => x.reverses_id || x.status === 'confirmed');
      body.replaceChildren(...(shown.length ? shown.map((x) => {
        const what = fee ? x.title : (x.months || []).map(monthLabel).join(', ');
        const isReversal = !!x.reverses_id;
        return h('div', { class: 'list-row', style: isReversal ? 'opacity:.75' : '' },
          h('div', { class: 'grow' }, h('div', {}, x.member), h('div', { class: 'small muted' }, `${what} · ${dateShort(x.created_at)}`)),
          h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(x.amount_paise)),
            isReversal ? h('span', { class: 'small muted' }, t(x.status === 'confirmed' ? 'mt.reversalRow' : 'mt.reversalWaiting')) : reversed.has(x.id) ? statusPill('closed', t('mt.reversed'))
              : can('maintenance_payments', 'c') ? button(t('mt.reversePayment'), { kind: 'text', onClick: () => reversePaymentSheet(ctx, reverseAction, x, () => { load(); onChange?.(); }) }) : null));
      }) : [h('p', { class: 'small muted' }, t('mt.noRecent'))]));
      more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
    }
  }
  load();
  return card(t('mt.recent'), 'history', body, more);
}

// Record a payment for a removed member's debt. "What is it for" is either their unpaid monthly maintenance or one fee due.
// Members are named by the opaque `ref` the API gave, never by email.
export function removedPaymentSheet(ctx, row, done) {
  const { t } = ctx;
  const targets = [];
  if (row.maintenance_paise > 0) targets.push({ key: 'maint', label: t('mt.forMaint', { n: row.unpaid_months.length }), paise: row.maintenance_paise });
  (row.fee_dues || []).forEach((d) => targets.push({ key: d.id, label: d.title, paise: d.outstanding_paise }));
  let chosen = targets[0];
  const amount = field({ id: 'rm-amt', label: t('exp.amount'), inputmode: 'decimal', value: String(chosen.paise / 100) });
  const file = h('input', { type: 'file', accept: 'image/*', id: 'rm-file' });
  const [note, warn] = warnBox();
  const radios = targets.map((x, i) => h('label', { class: 'list-row', style: 'cursor:pointer' },
    h('input', { type: 'radio', name: 'rm-for', checked: i === 0, style: 'width:24px;height:24px', onChange: () => { chosen = x; amount.querySelector('input').value = String(x.paise / 100); } }),
    h('span', { class: 'grow' }, x.label), h('strong', {}, money(x.paise))));
  openSheet({ title: t('mt.recordFor', { name: row.name }), body: h('div', { class: 'stack' }, h('p', { class: 'small muted' }, t('mt.removedHelp')),
    h('div', { class: 'field' }, h('label', {}, t('mt.paymentFor')), ...radios), amount,
    h('div', { class: 'field' }, h('label', { for: 'rm-file' }, t('exp.proof')), withCamera(file, t), h('div', { class: 'help' }, t('exp.proofHelp'))),
    h('p', { class: 'small muted' }, t('mt.confirmNote')), note), actions: [
    { label: t('mt.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value);
      if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      if (paise > chosen.paise) return warn(t('mt.moreThanOwed', { amount: money(chosen.paise) }));
      if (!file.files[0]) return warn(t('exp.proofNeeded'));
      try {
        const proof = await compressPhoto(file.files[0]);
        if (chosen.key === 'maint') await ctx.api.call('maintenance.payments.create', { removedRef: row.ref, months: row.unpaid_months, amountPaise: paise, proofJpegBase64: proof });
        else await ctx.api.call('dues.payments.create', { dueId: chosen.key, amountPaise: paise, proofJpegBase64: proof });
        close(); toast(t('mt.recorded')); done();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
