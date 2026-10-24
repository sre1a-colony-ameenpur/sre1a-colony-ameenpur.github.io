// Profile: change my name (at once), my email or mobile (a request the President decides; the President and Developers change theirs at once),
// my open requests, and the decision list for the President and Developers (US22, FR-146..150).
import { h, card, button, openSheet, confirmSheet, field, toast, statusPill, emptyState, errorState, loadingRegion, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { isFull } from '../guide.js';

const kindOf = (s) => (s === 'Pending' ? 'pending' : s === 'Approved' ? 'approved' : s === 'Rejected' ? 'rejected' : 'closed');

export function editName(ctx, after) {
  const { t, store } = ctx;
  const input = field({ id: 'new-name', label: t('contact.name'), value: store.get().session.name, maxlength: 80, autocomplete: 'name' });
  openSheet({ title: t('contact.editName'), body: input, actions: [
    { label: t('common.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const name = input.querySelector('input').value.trim();
      if (!name) return toast(t('contact.nameNeeded'));
      try {
        await ctx.api.call('members.setName', { name });
        const s = store.get();
        store.set({ session: { ...s.session, name }, user: { ...s.user, name } });
        close(); toast(t('common.saved')); after();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

// field: 'email' | 'mobile'. The President and Developers save it; everyone else sends a request.
export function changeContact(ctx, fieldName, after) {
  const { t, store } = ctx;
  const direct = isFull(store.get().session.role);
  const isEmail = fieldName === 'email';
  const input = field({ id: 'new-contact', label: t(isEmail ? 'contact.newEmail' : 'contact.newMobile'), type: isEmail ? 'email' : 'tel',
    help: t(direct ? (isEmail ? 'contact.emailDirectHelp' : 'contact.mobileDirectHelp') : (isEmail ? 'contact.emailHelp' : 'contact.mobileHelp')),
    autocomplete: isEmail ? 'email' : 'tel', inputmode: isEmail ? 'email' : 'tel', maxlength: isEmail ? 254 : 20 });
  openSheet({ title: t(isEmail ? 'contact.changeEmail' : 'contact.changeMobile'), body: input, actions: [
    { label: t(direct ? 'common.save' : 'contact.send'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const value = input.querySelector('input').value.trim();
      if (!value) return toast(t('contact.valueNeeded'));
      try {
        if (direct) {
          const r = await ctx.api.call('members.setContact', { [fieldName]: value });
          close();
          if (r.signInAgain) { toast(t('contact.signInAgain', { email: value })); setTimeout(() => ctx.signOut(), 2500); return; }
          const s = store.get(); store.set({ session: { ...s.session, mobile: value } }); toast(t('common.saved')); after();
        } else {
          await ctx.api.call('contactRequests.create', { field: fieldName, value });
          close(); toast(t('contact.sent')); after();
        }
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

const fieldLabel = (t, f) => t(f === 'email' ? 'profile.email' : 'profile.mobile');

// My requests; hidden when I have none, so it costs a member nothing until they ask for something.
export function myRequests(ctx) {
  const { t } = ctx;
  const box = h('div', { class: 'stack-sm' });
  const wrap = h('div', { hidden: true }, card(t('contact.myRequests'), 'list_alt', box));
  async function load() {
    try {
      await ctx.api.swr('contactRequests.mine', {}, ({ items }) => {
        wrap.hidden = !items.length;
        box.replaceChildren(...items.map((r) => h('div', { class: 'list-row' },
          h('div', { class: 'grow', style: 'overflow-wrap:anywhere' }, `${fieldLabel(t, r.field)}: `, h('strong', {}, r.new_value),
            h('div', { class: 'small muted' }, dateShort(r.requested_at), r.reason ? ` · ${r.reason}` : '')),
          statusPill(kindOf(r.status), t(`req.status.${r.status}`)),
          r.status === 'Pending' ? button(t('common.cancel'), { kind: 'text', onClick: async () => {
            try { await ctx.api.call('contactRequests.cancel', { id: r.id }); toast(t('common.saved')); load(); } catch (e) { toastError(friendly(e, t)); }
          } }) : null)));
      });
    } catch { wrap.hidden = true; }
  }
  load();
  return { el: wrap, reload: load };
}

// For the President and Developers: requests waiting for a decision.
export function decisions(ctx) {
  const { t } = ctx;
  const box = h('div', { class: 'stack-sm' }, loadingRegion(1));
  const el = card(t('contact.decide'), 'how_to_reg', box);
  async function approve(r) {
    if (!(await confirmSheet(t('contact.approveTitle'), t('contact.approveText', { name: r.member_name || '', field: fieldLabel(t, r.field), value: r.new_value }), { confirmLabel: t('plots.req.approve') }))) return;
    try { await ctx.api.call('contactRequests.approve', { id: r.id }); toast(t('common.saved')); } catch (e) { toastError(friendly(e, t)); }
    load();
  }
  function reject(r) {
    const reason = h('textarea', { id: 'cr-reason', maxlength: 200, rows: 3 });
    openSheet({ title: t('plots.req.rejectTitle'), body: h('div', { class: 'field' }, h('label', { for: 'cr-reason' }, t('plots.req.reason')), reason),
      actions: [{ label: t('plots.req.reject'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
        if (!reason.value.trim()) { reason.focus(); return toast(t('plots.req.reasonNeeded')); }
        try { await ctx.api.call('contactRequests.reject', { id: r.id, reason: reason.value.trim() }); close(); toast(t('common.saved')); } catch (e) { toastError(friendly(e, t)); }
        load();
      } }, { label: t('common.cancel') }] });
  }
  async function load() {
    try {
      await ctx.api.swr('contactRequests.list', { status: 'Pending' }, ({ items }) => {
        box.replaceChildren(...(items.length ? items.map((r) => h('div', { class: 'stack-sm', style: 'overflow-wrap:anywhere' },
          h('div', {}, h('strong', {}, r.member_name || t('plots.unknown')), ` · ${fieldLabel(t, r.field)}`),
          h('div', { class: 'small' }, `${r.old_value || '—'} → `, h('strong', {}, r.new_value)),
          h('div', { class: 'small muted' }, dateShort(r.requested_at)),
          h('div', { class: 'row' }, button(t('plots.req.approve'), { kind: 'primary', onClick: () => approve(r) }), button(t('plots.req.reject'), { kind: 'danger', onClick: () => reject(r) })))) : [emptyState(t('contact.noneToDecide'), 'inbox')]));
      });
    } catch (e) { box.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return el;
}
