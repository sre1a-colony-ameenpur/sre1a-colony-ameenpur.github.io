// Sheets for fees: raise a request (S3.10), request detail with recipients (S3.11), cancel/edit, record a fee payment, membership fee amount, proof.
import { withCamera } from '../camera.js';
import { h, button, field, openSheet, toast, icon, plotChip, segmented, statusPill, loadingRegion, errorState } from '../ui.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can } from '../store.js';
import { compressPhoto } from '../photo.js';
import { rupeesToPaise } from './expenses.js';
import { memberPicker } from './maintenance_sheets.js';

const label = (k) => k.replace(/^([A-Z])(\d+)$/, '$1-$2');
const warnBox = () => { const n = h('div', { role: 'alert' }); return [n, (m) => n.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m))]; };
const today = () => new Date().toISOString().slice(0, 10);
const kindOf = (d) => (d.overdue ? 'overdue' : d.status === 'partly_paid' ? 'partly' : d.status === 'paid' ? 'paid' : 'due');

// Several members, chosen by name or plot. get() returns the plot keys.
function multiPicker(ctx, id) {
  const { t } = ctx;
  const chosen = new Map();
  const single = memberPicker(ctx, id);
  const chips = h('div', { class: 'chips' });
  const redraw = () => chips.replaceChildren(...[...chosen].map(([k, name]) => h('button', { type: 'button', class: 'chip on', 'aria-label': t('fee.remove', { name }), onClick: () => { chosen.delete(k); redraw(); } }, name, icon('close', 'sm'))));
  // memberPicker keeps its own single choice; collect it when the user taps "Add".
  const add = button(t('fee.addMember'), { kind: 'text', icon: 'person_add', onClick: () => { const w = single.get(); if (w) { chosen.set(w.plotKey, w.name); redraw(); } } });
  return { el: h('div', { class: 'stack-sm' }, single.el, add, chips), get: () => [...chosen.keys()] };
}

export function raiseRequestSheet(ctx, done) {
  const { t } = ctx;
  let type = 'request', who = 'all';
  const title = field({ id: 'fr-title', label: t('fee.title'), maxlength: 100 });
  const desc = h('div', { class: 'field' }, h('label', { for: 'fr-desc' }, t('fee.description')), h('textarea', { id: 'fr-desc', maxlength: 500, rows: 3 }));
  const amount = field({ id: 'fr-amt', label: t('exp.amount'), inputmode: 'decimal' });
  const deadline = field({ id: 'fr-dl', label: t('fee.deadline'), type: 'date', min: today() });
  const chosen = multiPicker(ctx, 'fr-who'); chosen.el.hidden = true;
  const one = memberPicker(ctx, 'fr-one');
  const requestBox = h('div', { class: 'stack' }, title, desc,
    segmented([['all', t('fee.allMembers')], ['selected', t('fee.chosenMembers')]], 'all', (v) => { who = v; chosen.el.hidden = v === 'all'; }, t('fee.who')), chosen.el);
  const membershipBox = h('div', { class: 'stack' }, one.el, h('p', { class: 'small muted' }, t('fee.membershipNote'))); membershipBox.hidden = true;
  const [note, warn] = warnBox();
  openSheet({ title: t('fee.raise'), body: h('div', { class: 'stack' },
    segmented([['request', t('fee.typeRequest')], ['membership', t('fee.typeMembership')]], 'request', (v) => { type = v; requestBox.hidden = v !== 'request'; membershipBox.hidden = v !== 'membership'; }, t('fee.raise')),
    requestBox, membershipBox, amount, deadline, h('p', { class: 'small muted' }, t('fee.noMessage')), note), actions: [
    { label: t('fee.raise'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value), dl = deadline.querySelector('input').value;
      if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      if (!dl) return warn(t('fee.deadlineNeeded'));
      let payload;
      if (type === 'membership') {
        const w = one.get(); if (!w) return warn(t('mt.pickMember'));
        payload = { kind: 'membership', plotKey: w.plotKey, amountPaise: paise, deadline: dl };
      } else {
        const ttl = title.querySelector('input').value.trim(); if (!ttl) return warn(t('fee.titleNeeded'));
        payload = { kind: 'request', title: ttl, description: desc.querySelector('textarea').value.trim(), amountPaise: paise, deadline: dl, audience: who };
        if (who === 'selected') { payload.memberPlotKeys = chosen.get(); if (!payload.memberPlotKeys.length) return warn(t('fee.pickSome')); }
      }
      try { await ctx.api.call('feeRequests.create', payload); close(); toast(t('fee.raised')); done(); } catch (e) { warn(e.code === 'CONFLICT' ? t('fee.alreadyHas') : friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export function requestDetailSheet(ctx, id, done) {
  const { t } = ctx;
  const body = h('div', { class: 'stack' }, loadingRegion(2));
  const dlg = openSheet({ title: t('fee.detail'), wide: true, body, actions: [{ label: t('common.close') }] });
  async function load() {
    try {
      const { request: r, dues } = await ctx.api.call('feeRequests.get', { id });
      body.replaceChildren(
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', {}, r.title), h('span', { class: 'amount' }, money(r.amount_paise))),
        r.description ? h('p', {}, r.description) : null,
        h('p', { class: 'small muted' }, `${t('home.fees.payBy', { date: dateShort(r.deadline) })} · ${t('fee.counts', { paid: r.paid, due: r.unpaid, overdue: r.overdue })}`),
        r.status !== 'active' ? h('p', { class: 'banner warn', style: 'border-radius:12px' }, t('fee.cancelled')) : null,
        r.status === 'active' ? h('div', { class: 'row' },
          can('fee_requests', 'u') ? button(t('fee.edit'), { icon: 'edit', onClick: () => { dlg.close(); editRequestSheet(ctx, r, done); } }) : null,
          can('fee_requests', 'd') ? button(t('fee.cancelRequest'), { kind: 'danger', onClick: () => { dlg.close(); cancelSheet(ctx, r.id, done); } }) : null) : null,
        h('h3', {}, t('fee.recipients')),
        ...dues.map((d) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, d.member_name),
          statusPill(kindOf(d), t(`fee.status.${d.overdue ? 'overdue' : d.status}`)),
          can('maintenance_payments', 'c') && d.status !== 'paid' && r.status === 'active' ? button(t('fee.record'), { kind: 'text', onClick: () => { dlg.close(); recordFeePaymentSheet(ctx, { ...d, member: d.member_name }, done); } }) : null,
          can('fee_requests', 'd') && d.status !== 'paid' && d.status !== 'cancelled' && r.status === 'active' ? button(t('fee.cancelDue'), { kind: 'text', onClick: () => { dlg.close(); cancelDueSheet(ctx, d, done); } }) : null)));
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
}

function cancelSheet(ctx, requestId, done) {
  const { t } = ctx;
  const reason = field({ id: 'fc-why', label: t('exp.reason'), maxlength: 200 });
  const [note, warn] = warnBox();
  openSheet({ title: t('fee.cancelRequest'), body: h('div', { class: 'stack' }, h('p', {}, t('fee.cancelNote')), reason, note), actions: [
    { label: t('fee.cancelRequest'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim(); if (!why) return warn(t('exp.reasonNeeded'));
      try { await ctx.api.call('feeRequests.cancel', { requestId, reason: why }); close(); toast(t('fee.cancelledToast')); done(); } catch (e) { warn(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

// Cancel one member's due (the request stays). The backend refuses when a payment is already confirmed.
function cancelDueSheet(ctx, d, done) {
  const { t } = ctx;
  const reason = field({ id: 'fd-why', label: t('exp.reason'), maxlength: 200 });
  const [note, warn] = warnBox();
  openSheet({ title: t('fee.cancelDue'), body: h('div', { class: 'stack' }, h('p', {}, t('fee.cancelDueNote', { name: d.member_name, amount: money(d.amount_paise) })), reason, note), actions: [
    { label: t('fee.cancelDue'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim(); if (!why) return warn(t('exp.reasonNeeded'));
      try { await ctx.api.call('dues.cancel', { dueId: d.id, reason: why }); close(); toast(t('fee.dueCancelled')); done(); } catch (e) { warn(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

function editRequestSheet(ctx, r, done) {
  const { t } = ctx;
  const title = field({ id: 'fe-title', label: t('fee.title'), value: r.title, maxlength: 100 });
  const amount = field({ id: 'fe-amt', label: t('exp.amount'), value: String(r.amount_paise / 100), inputmode: 'decimal' });
  const deadline = field({ id: 'fe-dl', label: t('fee.deadline'), type: 'date', value: r.deadline, min: today() });
  const reason = field({ id: 'fe-why', label: t('exp.reason'), maxlength: 200 });
  const [note, warn] = warnBox();
  openSheet({ title: t('fee.edit'), body: h('div', { class: 'stack' }, title, amount, deadline, reason, h('p', { class: 'small muted' }, t('fee.editNote')), note), actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim(), paise = rupeesToPaise(amount.querySelector('input').value);
      if (!why) return warn(t('exp.reasonNeeded')); if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      try {
        await ctx.api.call('feeRequests.update', { requestId: r.id, title: title.querySelector('input').value.trim(), amountPaise: paise, deadline: deadline.querySelector('input').value, reason: why });
        close(); toast(t('common.saved')); done();
      } catch (e) { warn(e.code === 'IMMUTABLE' ? t('fee.locked') : friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export function recordFeePaymentSheet(ctx, due, done) {
  const { t } = ctx;
  const owed = due.amount_paise - (due.paid_paise || 0);
  const amount = field({ id: 'fp-amt', label: t('exp.amount'), value: String(owed / 100), inputmode: 'decimal' });
  const file = h('input', { type: 'file', accept: 'image/*', id: 'fp-file' });
  const [note, warn] = warnBox();
  openSheet({ title: t('fee.record'), body: h('div', { class: 'stack' }, h('p', {}, `${due.member || ''} · ${due.title}`), h('p', { class: 'small muted' }, t('fee.owed', { amount: money(owed) })), amount,
    h('div', { class: 'field' }, h('label', { for: 'fp-file' }, t('exp.proof')), withCamera(file, t), h('div', { class: 'help' }, t('exp.proofHelp'))), h('p', { class: 'small muted' }, t('mt.confirmNote')), note), actions: [
    { label: t('mt.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value);
      if (!(paise > 0)) return warn(t('exp.amountNeeded')); if (!file.files[0]) return warn(t('exp.proofNeeded'));
      try { await ctx.api.call('dues.payments.create', { dueId: due.id, amountPaise: paise, proofJpegBase64: await compressPhoto(file.files[0]) }); close(); toast(t('mt.recorded')); done(); }
      catch (e) { warn(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export function membershipRateSheet(ctx, category, done) {
  const { t } = ctx;
  const amount = field({ id: 'mr-amt', label: t('exp.amount'), inputmode: 'decimal' });
  const from = field({ id: 'mr-from', label: t('mt.appliesFrom'), type: 'date', value: today(), min: today() });
  const [note, warn] = warnBox();
  openSheet({ title: `${t('mt.changeFee')}: ${t(`exp.catPlot.${category}`)}`, body: h('div', { class: 'stack' }, amount, from, h('p', { class: 'small muted' }, t('fee.rateSheetNote')), note), actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value);
      if (!(paise >= 0) || amount.querySelector('input').value.trim() === '') return warn(t('exp.amountNeeded'));
      try { await ctx.api.call('membership.rates.set', { category, amountPaise: paise, fromDate: from.querySelector('input').value }); close(); toast(t('common.saved')); done(); }
      catch (e) { warn(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

export async function feeProofSheet(ctx, id) {
  const { t } = ctx;
  const body = h('div', {}, loadingRegion(1));
  openSheet({ title: t('exp.proof'), wide: true, body, actions: [{ label: t('common.close') }] });
  try {
    const { jpegBase64 } = await ctx.api.call('dues.payments.proof', { id, size: 'full' });
    body.replaceChildren(h('img', { src: `data:image/jpeg;base64,${jpegBase64}`, alt: t('exp.proof'), style: 'width:100%' }));
  } catch (e) { body.replaceChildren(h('p', {}, friendly(e, t))); }
}
