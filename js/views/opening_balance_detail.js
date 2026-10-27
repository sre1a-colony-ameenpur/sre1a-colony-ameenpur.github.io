// Opening balance entry: amount, status, proof, history; approve, reject or reverse by right.
import { h, card, button, field, statusPill, errorState, loadingRegion, openSheet, toast, icon, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can } from '../store.js';
import { decide, rejectSheet } from './opening_balance.js';

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${dateShort(iso)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`; };

  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('openingBalance.get', { id: ctx.params.id }, (got) => {
        const x = got.item, reversed = got.reversed, isReversal = !!x.reverses_id;
        const proof = h('div', { class: 'proof' });
        if (x.has_proof) showProof(proof, x.id);
        const steps = [h('li', {}, t('exp.addedBy', { name: x.created_by_name }), ` · ${when(x.created_at)}`)];
        if (x.status === 'approved') steps.push(h('li', {}, t('exp.approvedBy', { name: x.decided_by_name }), ` · ${when(x.decided_at)}`));
        if (x.status === 'rejected') steps.push(h('li', {}, t('exp.rejectedBy', { name: x.decided_by_name }), x.reject_reason ? `: ${x.reject_reason}` : '', ` · ${when(x.decided_at)}`));
        const canDecide = x.status === 'pending' && can('expense_approval', 'u'), actions = [];
        if (canDecide && x.mine) actions.push(h('p', { class: 'banner info', style: 'border-radius:12px' }, icon('info'), t('exp.someoneElseNote')));
        if (canDecide && !x.mine) actions.push(button(t('exp.approve'), { kind: 'primary', block: true, icon: 'check', 'data-tour': 'od-approve', onClick: () => decide(ctx, 'approve', x.id, load) }),
          button(t('exp.reject'), { kind: 'danger', block: true, 'data-tour': 'od-reject', onClick: () => rejectSheet(ctx, x.id, load) }));
        if (x.status === 'approved' && !isReversal && !reversed && can('expenses', 'c')) actions.push(button(t('exp.reverse'), { block: true, icon: 'undo', 'data-tour': 'od-reverse', onClick: () => reverseSheet(ctx, x.id, load) }));
        if (x.status === 'approved') actions.push(h('p', { class: 'small muted' }, icon('lock', 'sm'), ' ', t('exp.locked')));
        if (reversed) actions.push(h('p', { class: 'small muted' }, t('exp.alreadyReversed')));
        root.replaceChildren(card(null, null, h('div', { class: 'amount big' }, money(x.amount_paise)), statusPill(x.status, t(`exp.status.${x.status}`)),
            h('h2', {}, x.description), h('p', { class: 'muted' }, t('ob.asOf', { date: dateShort(x.date) })),
            isReversal ? h('p', { class: 'small' }, t('exp.reversalOf', { id: x.reverses_id })) : null),
          x.has_proof ? card(t('ob.proof'), 'image', proof) : null,
          card(t('exp.history'), 'history', h('ul', { class: 'timeline' }, steps)),
          ...actions);
        const kids = [...root.children];          // the guided tour finds these by their marks: summary, [proof], history
        kids[0].setAttribute('data-tour', 'od-sum'); if (x.has_proof) kids[1].setAttribute('data-tour', 'od-proof'); kids[x.has_proof ? 2 : 1].setAttribute('data-tour', 'od-hist');
      });
    } catch (e) { root.replaceChildren(e.code === 'NOT_FOUND' ? errorState(t('ob.notFound'), () => { location.hash = '#/money/opening'; }) : errorState(friendly(e, t), load)); }
  }

  async function showProof(box, id) {
    box.replaceChildren(loadingRegion(1));
    try {
      const { jpegBase64 } = await ctx.api.media('openingBalance.proof', { id, size: 'thumb' });
      const img = h('img', { src: `data:image/jpeg;base64,${jpegBase64}`, alt: t('ob.proof'), style: 'width:100%;border-radius:12px;cursor:zoom-in;max-height:360px;object-fit:contain;background:var(--c-surface,#f4f4f4)' });
      img.addEventListener('click', async () => {
        try {
          const full = await ctx.api.media('openingBalance.proof', { id, size: 'full' });
          openSheet({ title: t('ob.proof'), wide: true, body: h('img', { src: `data:image/jpeg;base64,${full.jpegBase64}`, alt: t('ob.proof'), style: 'width:100%' }), actions: [{ label: t('common.close') }] });
        } catch (e) { toastError(friendly(e, t)); }
      });
      box.replaceChildren(img);
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), () => showProof(box, id))); }
  }
  load();
  return root;
}

function reverseSheet(ctx, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'orev', label: t('exp.reason'), help: t('exp.reverseHelp'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('exp.reverse'), body: h('div', { class: 'stack' }, reason, note), actions: [
    { label: t('exp.reverse'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const text = reason.querySelector('input').value.trim();
      if (!text) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      try { await ctx.api.call('openingBalance.reverse', { id, reason: text }); close(); toast(t('exp.reversed')); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
