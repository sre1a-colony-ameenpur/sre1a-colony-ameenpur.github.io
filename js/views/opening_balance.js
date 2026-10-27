// Money > Opening balance: money in the bank handed over by the previous committee. Same approval rules as expenses; detail is opening_balance_detail.js.
import { withCamera } from '../camera.js';
import { h, card, button, field, statusPill, emptyState, errorState, loadingRegion, openSheet, toast, icon, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can, store } from '../store.js';
import { compressPhoto } from '../photo.js';
import { rupeesToPaise } from './expenses.js';

export async function decide(ctx, action, id, done, reason) {
  const { t } = ctx;
  try { await ctx.api.call(`openingBalance.${action}`, action === 'reject' ? { id, reason } : { id }); toast(t(action === 'approve' ? 'exp.approved' : 'exp.rejected')); done(); } catch (e) { toastError(friendly(e, t)); }
}
export function rejectSheet(ctx, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'orej', label: t('exp.reason'), help: t('exp.rejectHelp'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('exp.reject'), body: h('div', { class: 'stack' }, reason, note), actions: [
    { label: t('exp.reject'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const text = reason.querySelector('input').value.trim();
      if (!text) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      await decide(ctx, 'reject', id, done, text); close();
    } }, { label: t('common.cancel') }] });
}

export default async function render(ctx) {
  const { t } = ctx;
  const box = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('ob.title')), h('p', { class: 'muted' }, t('ob.intro')), box,
    can('expenses', 'c') ? h('button', { type: 'button', class: 'fab', 'data-tour': 'ob-add', 'aria-label': t('ob.add'), title: t('ob.add'), onClick: () => addSheet(ctx, load) }, icon('add')) : null);

  const row = (x) => h('a', { class: 'list-row', href: `#/money/opening/${x.id}`, style: x.reverses_id ? 'opacity:.75' : '' },
    h('div', { class: 'grow' }, h('div', {}, x.description), h('div', { class: 'small muted' }, `${t('ob.asOf', { date: dateShort(x.date) })} · ${t('exp.addedBy', { name: x.created_by_name })}`)),
    h('div', { style: 'text-align:end' }, h('div', { class: 'amount' }, money(x.amount_paise)), statusPill(x.status, t(`exp.status.${x.status}`))));

  async function load() {
    if (!box.childElementCount) box.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('openingBalance.list', {}, (r) => {
        const waiting = can('expense_approval', 'u') ? r.items.filter((x) => x.status === 'pending') : [];
        box.replaceChildren(
          card(t('ob.total'), 'account_balance', h('div', { class: 'amount big' }, money(r.approved_total_paise)), h('p', { class: 'small muted' }, t('ob.totalNote'))),
          waiting.length ? card(t('exp.queue', { n: waiting.length }), 'pending_actions', ...waiting.map((x) => h('div', { class: 'stack-sm queue-item' },
            h('a', { class: 'grow', href: `#/money/opening/${x.id}` }, h('div', {}, x.description), h('div', { class: 'small muted' }, `${money(x.amount_paise)} · ${t('exp.addedBy', { name: x.created_by_name })}`)),
            x.mine ? h('span', { class: 'small muted' }, t('exp.someoneElse')) : h('span', { class: 'row' },
              button(t('exp.approve'), { kind: 'primary', onClick: () => decide(ctx, 'approve', x.id, load) }),
              button(t('exp.reject'), { kind: 'danger', onClick: () => rejectSheet(ctx, x.id, load) }))))) : null,
          r.items.length ? h('div', { class: 'stack-sm' }, r.items.map(row)) : emptyState(t('ob.none'), 'savings'));
        const kids = [...box.children];          // the guided tour finds these by their marks: total, [queue], list
        kids[0].setAttribute('data-tour', 'ob-total'); kids.at(-1).setAttribute('data-tour', 'ob-list'); if (waiting.length) kids[1].setAttribute('data-tour', 'ob-queue');
      });
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}

function addSheet(ctx, done) {
  const { t } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const date = field({ id: 'o-date', label: t('ob.date'), type: 'date', value: today, help: t('ob.dateHelp') });
  const amount = field({ id: 'o-amt', label: t('exp.amount'), type: 'text', inputmode: 'decimal', placeholder: '185000' });
  const why = field({ id: 'o-why', label: t('ob.description'), help: t('ob.descriptionHelp'), maxlength: 300 });
  const file = h('input', { type: 'file', accept: 'image/*', id: 'o-file' });
  const proof = h('div', { class: 'field' }, h('label', { for: 'o-file' }, t('ob.proof')), withCamera(file, t), h('div', { class: 'help' }, t('exp.proofHelp')));
  const autoOk = store.get().session?.role === 'President';
  const note = h('div', { role: 'alert' });
  const warn = (m) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m));
  openSheet({ title: t('ob.add'), body: h('div', { class: 'stack' }, date, amount, why, proof, h('p', { class: 'small muted' }, t(autoOk ? 'ob.autoNote' : 'ob.approvalNote')), note), actions: [
    { label: t(autoOk ? 'ob.addNow' : 'exp.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const paise = rupeesToPaise(amount.querySelector('input').value), text = why.querySelector('input').value.trim();
      if (!(paise > 0)) return warn(t('exp.amountNeeded'));
      if (!text) return warn(t('ob.descriptionNeeded'));
      if (!file.files[0]) return warn(t('ob.proofNeeded'));
      try {
        const b64 = await compressPhoto(file.files[0]);
        await ctx.api.call('openingBalance.create', { date: date.querySelector('input').value, amount_paise: paise, description: text, proof_jpeg_base64: b64 });
        close(); toast(t(autoOk ? 'ob.addedApproved' : 'exp.submitted')); done();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
