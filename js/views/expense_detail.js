// S3.3 Expense detail: amount, status, proof screenshot, timeline, approve/reject/reverse by role.
import { h, card, button, field, statusPill, errorState, loadingRegion, openSheet, toast, icon } from '../ui.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can, hasModule } from '../store.js';
import { statusLabel, approve, rejectSheet, editSheet } from './expenses.js';

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${dateShort(iso)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`; };

  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('expenses.get', { id: ctx.params.id }, (got) => {
      const x = got.item, reversed = got.reversed;
      const isReversal = !!x.reverses_id;
      const proof = h('div', { class: 'proof' });
      if (x.has_proof) showProof(proof, x.id);
      const steps = [h('li', {}, t('exp.addedBy', { name: x.created_by_name }), ` · ${when(x.created_at)}`)];
      if (x.status === 'approved') steps.push(h('li', {}, t('exp.approvedBy', { name: x.decided_by_name }), ` · ${when(x.decided_at)}`));
      if (x.status === 'rejected') steps.push(h('li', {}, t('exp.rejectedBy', { name: x.decided_by_name }), x.reject_reason ? `: ${x.reject_reason}` : '', ` · ${when(x.decided_at)}`));
      const canDecide = x.status === 'pending' && can('expense_approval', 'u');
      const actions = [];
      if (canDecide && x.mine) actions.push(h('p', { class: 'banner info', style: 'border-radius:12px' }, icon('info'), t('exp.someoneElseNote')));
      if (canDecide && !x.mine) actions.push(button(t('exp.approve'), { kind: 'primary', block: true, icon: 'check', onClick: () => approve(ctx, x.id, load) }),
        button(t('exp.reject'), { kind: 'danger', block: true, onClick: () => rejectSheet(ctx, x.id, load) }));
      if (x.status === 'pending' && can('expenses', 'u')) actions.push(button(t('exp.edit'), { block: true, icon: 'edit', onClick: () => editSheet(ctx, x, load) }));
      if (x.status === 'approved' && !isReversal && !reversed && can('expenses', 'c')) actions.push(button(t('exp.reverse'), { block: true, icon: 'undo', onClick: () => reverseSheet(ctx, x.id, load) }));
      if (x.status === 'approved') actions.push(h('p', { class: 'small muted' }, icon('lock', 'sm'), ' ', t('exp.locked')));
      if (reversed) actions.push(h('p', { class: 'small muted' }, t('exp.alreadyReversed')));
      root.replaceChildren(card(null, null, h('div', { class: 'amount big' }, money(x.amount_paise)), statusPill(x.status, statusLabel(t, x.status)),
          h('h2', {}, x.reason), h('p', { class: 'muted' }, `${t(`exp.cat.${x.category}`)} · ${dateShort(x.date)}`),
          x.event_id && x.event_title ? h('p', {}, icon('celebration', 'sm'), ' ', t('exp.forEvent'), ': ', hasModule('events') ? h('a', { href: `#/community/events/${x.event_id}` }, x.event_title) : x.event_title) : null,
          isReversal ? h('p', { class: 'small' }, t('exp.reversalOf', { id: x.reverses_id })) : null),
        x.has_proof ? card(t('exp.proof'), 'image', proof) : null,
        card(t('exp.history'), 'history', h('ul', { class: 'timeline' }, steps)),
        ...actions);
      });
    } catch (e) { root.replaceChildren(e.code === 'NOT_FOUND' ? errorState(t('exp.notFound'), () => { location.hash = '#/money'; }) : errorState(friendly(e, t), load)); }
  }

  async function showProof(box, id) {
    box.replaceChildren(loadingRegion(1));
    try {
      const { jpegBase64 } = await ctx.api.call('expenses.proof', { id, size: 'thumb' });
      const img = h('img', { src: `data:image/jpeg;base64,${jpegBase64}`, alt: t('exp.proof'), style: 'width:100%;border-radius:12px;cursor:zoom-in;max-height:360px;object-fit:contain;background:var(--c-surface,#f4f4f4)' });
      img.addEventListener('click', async () => {
        try {
          const full = await ctx.api.call('expenses.proof', { id, size: 'full' });
          openSheet({ title: t('exp.proof'), wide: true, body: h('img', { src: `data:image/jpeg;base64,${full.jpegBase64}`, alt: t('exp.proof'), style: 'width:100%' }), actions: [{ label: t('common.close') }] });
        } catch (e) { toast(friendly(e, t)); }
      });
      box.replaceChildren(img);
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), () => showProof(box, id))); }
  }
  load();
  return root;
}

function reverseSheet(ctx, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'rev', label: t('exp.reason'), help: t('exp.reverseHelp'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('exp.reverse'), body: h('div', { class: 'stack' }, reason, note), actions: [
    { label: t('exp.reverse'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const text = reason.querySelector('input').value.trim();
      if (!text) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      try { await ctx.api.call('expenses.reverse', { id, reason: text }); close(); toast(t('exp.reversed')); done(); }
      catch (e) { note.replaceChildren(h('div', { class: 'banner warn' }, friendly(e, t))); }
    } }, { label: t('common.cancel') }] });
}
