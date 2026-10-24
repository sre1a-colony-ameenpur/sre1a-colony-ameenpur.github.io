// S7.1 My profile: read-only details, language, appearance, plot change requests, sign out.
import { h, card, rolePill, plotChip, avatar, segmented, button, openSheet, confirmSheet, statusPill, field, toast, emptyState, errorState, loadingRegion, setMyPhoto, toastError } from '../ui.js';
import { pickPhoto, compressPhoto } from '../photo.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can, hasModule } from '../store.js';
import { pushSupport, isOn, turnOn, turnOff } from '../push.js';
import { isFull } from '../guide.js';
import { editName, changeContact, myRequests, decisions } from './profile_contact.js';

const dashKey = (k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2');

export default function render(ctx) {
  const { t, store } = ctx;
  const s = store.get().session;
  const row = (label, val) => h('div', { class: 'list-row' }, h('div', { class: 'muted small', style: 'min-width:96px' }, label), h('div', { class: 'grow', style: 'overflow-wrap:anywhere' }, val));
  const reqBox = h('div', { class: 'stack-sm' });
  const mine = myRequests(ctx);
  const redraw = () => { mine.reload(); ctx.refresh(); };
  const edit = (label, onClick) => button(label, { kind: 'text', icon: 'edit', onClick });

  const root = h('div', { class: 'page stack' },
    h('h1', {}, t('profile.title')),
    card(null, null,
      h('div', { class: 'row', style: 'margin-bottom:8px' }, avatar(s.name, true, true), h('div', { class: 'grow' }, h('h2', {}, s.name), rolePill(s.role)),
        edit(t('contact.edit'), () => editName(ctx, redraw))),
      button(t('profile.changePhoto'), { kind: 'text', icon: 'photo_camera', onClick: () => photoSheet(ctx) }),
      row(t('profile.email'), h('span', { class: 'row-between' }, h('span', { style: 'overflow-wrap:anywhere' }, s.email), edit(t('contact.edit'), () => changeContact(ctx, 'email', redraw)))),
      row(t('profile.mobile'), h('span', { class: 'row-between' }, s.mobile || h('span', { class: 'muted' }, t('profile.notAdded')), edit(t('contact.edit'), () => changeContact(ctx, 'mobile', redraw)))),
      row(t('profile.plots'), h('span', { class: 'row' }, s.plotKeys.length ? s.plotKeys.map(plotChip) : t('profile.noPlots'))),
      isFull(s.role) ? null : h('p', { class: 'small muted', style: 'margin-top:8px' }, t('profile.readonly')),
      can('plot_change_requests', 'c') ? h('div', { style: 'margin-top:16px' }, button(t('profile.requestPlot'), { icon: 'edit_location_alt', block: true, onClick: () => requestSheet(ctx, loadRequests) })) : null),
    mine.el,
    isFull(s.role) ? decisions(ctx) : null,
    (hasModule('maintenance') || hasModule('fees')) ? button(t('pay.mineTitle'), { icon: 'receipt_long', block: true, onClick: () => { location.hash = '#/profile/payments'; } }) : null,
    card(t('profile.showMobile'), 'call', mobileSwitch(ctx, s)),
    s.push ? card(t('notify.title'), 'notifications', notifySwitch(ctx, s.push)) : null,
    can('plot_change_requests', 'c') ? card(t('profile.myRequests'), 'list_alt', reqBox) : null,
    card(t('profile.language'), 'translate', segmented([['en', 'English'], ['te', 'తెలుగు']], ctx.lang, ctx.setLang, t('lang.label'))),
    card(t('profile.appearance'), 'contrast', segmented([['auto', t('theme.auto')], ['light', t('theme.light')], ['dark', t('theme.dark')]], store.get().theme, ctx.setTheme, t('profile.appearance'))),
    button(t('menu.signOut'), { kind: 'danger', block: true, icon: 'logout', onClick: async () => {
      if (await confirmSheet(t('signout.title'), t('signout.text'), { confirmLabel: t('menu.signOut'), danger: true })) ctx.signOut();
    } }));

  async function loadRequests() {
    if (!can('plot_change_requests', 'c')) return;
    reqBox.replaceChildren(loadingRegion(1));
    try {
      await ctx.api.swr('plotRequests.mine', {}, ({ items: list }) => {
        reqBox.replaceChildren(...(list.length ? list.map((r) => h('div', { class: 'list-row' },
          h('div', { class: 'grow' }, `${t(r.action === 'add' ? 'req.add' : 'req.remove')} `, plotChip(dashKey(r.plot_key)),
            h('div', { class: 'small muted' }, dateShort(r.requested_at))),
          statusPill(r.status === 'Pending' ? 'pending' : r.status === 'Approved' ? 'approved' : r.status === 'Rejected' ? 'rejected' : 'closed', t(`req.status.${r.status}`)),
          r.status === 'Pending' ? button(t('common.cancel'), { kind: 'text', onClick: async () => {
            try { await ctx.api.call('plotRequests.cancel', { id: r.id }); toast(t('common.saved')); loadRequests(); } catch (e) { toastError(friendly(e, t)); }
          } }) : null)) : [emptyState(t('req.none'), 'inbox')]));
      });
    } catch (e) { reqBox.replaceChildren(errorState(friendly(e, t), loadRequests)); }
  }
  loadRequests();
  return root;
}

// Request a plot change: Add / Remove, then plot id. Server decides; ownedByOther shows the amber note.
function requestSheet(ctx, done) {
  const { t } = ctx;
  let action = 'add';
  const note = h('div', { role: 'alert' });
  const input = field({ id: 'plotkey', label: t('req.plot'), help: t('req.plotHelp'), autocapitalize: 'characters' });
  const send = { label: t('req.send'), kind: 'primary', keepOpen: true, onClick: async (close) => {
    note.replaceChildren();
    try {
      await ctx.api.call('plotRequests.create', { action, plotKey: input.querySelector('input').value.trim().toUpperCase() });
      close(); toast(t('req.sent')); done();
    } catch (e) {
      toastError(e.extra?.details?.owner ? t('req.ownedByOther') : friendly(e, t));
    }
  } };
  openSheet({ title: t('profile.requestPlot'), actions: [send, { label: t('common.cancel') }],
    body: h('div', { class: 'stack' }, segmented([['add', t('req.add')], ['remove', t('req.remove')]], 'add', (v) => { action = v; }, t('profile.requestPlot')), input, note) });
}

// Member's own choice to show their mobile number to other members (FR-084); off by default.
function mobileSwitch(ctx, s) {
  const { t, store } = ctx;
  const box = h('input', { type: 'checkbox', id: 'show-mobile', checked: !!s.showMobile, style: 'width:24px;height:24px' });
  box.addEventListener('change', async () => {
    const show = box.checked;
    try {
      await ctx.api.call('members.setMobileVisibility', { show });
      store.set({ session: { ...store.get().session, showMobile: show } });
      toast(t('common.saved'));
    } catch (e) { box.checked = !show; toastError(friendly(e, t)); }
  });
  return h('div', { class: 'stack-sm' },
    h('label', { class: 'row', for: 'show-mobile' }, box, h('span', { class: 'grow' }, t('profile.showMobileLabel'))),
    h('p', { class: 'small muted' }, t('profile.showMobileHelp')));
}

// Notifications on this phone (FR-138): off until the member turns them on; the phone asks permission only then.
function notifySwitch(ctx, publicKey) {
  const { t } = ctx;
  const support = pushSupport();
  if (support !== 'ok') return h('p', { class: 'small muted' }, t(support === 'ios-home' ? 'notify.iosHome' : 'notify.unsupported'));
  const box = h('input', { type: 'checkbox', id: 'notify-on', style: 'width:24px;height:24px', disabled: true });
  const note = h('p', { class: 'small muted' }, t('notify.help'));
  isOn().then((on) => { box.checked = on; box.disabled = false; });
  box.addEventListener('change', async () => {
    const want = box.checked;
    box.disabled = true;
    try {
      if (want) {
        if (await turnOn(ctx.api, publicKey) === 'denied') { box.checked = false; note.textContent = t('notify.blocked'); }
        else { toast(t('notify.onDone')); note.textContent = t('notify.help'); }
      } else { await turnOff(ctx.api); toast(t('notify.offDone')); }
    } catch (e) { box.checked = !want; toastError(friendly(e, t)); }
    box.disabled = false;
  });
  return h('div', { class: 'stack-sm' }, h('label', { class: 'row', for: 'notify-on' }, box, h('span', { class: 'grow' }, t('notify.label'))), note);
}

// Profile photo: take one with the camera (front camera on a phone) or choose one from the gallery. Kept small (512 px) before it is sent.
function photoSheet(ctx) {
  const { t } = ctx;
  const note = h('div', { role: 'alert' });
  const choose = (camera) => async (close) => {
    const file = await pickPhoto({ camera });                       // opened straight from the tap
    if (!file) return;
    close();
    try {
      const jpegBase64 = await compressPhoto(file, { max: 512, quality: 0.85, maxBase64: 1300000 });
      await ctx.api.call('profile.setPhoto', { jpegBase64 });
      setMyPhoto(`data:image/jpeg;base64,${jpegBase64}`);
      toast(t('profile.photoSaved'));
    } catch (e) { toastError(friendly(e, t)); }
  };
  openSheet({ title: t('profile.photoTitle'), body: h('div', { class: 'stack-sm' }, h('p', { class: 'small muted' }, t('profile.photoHelp')), note), actions: [
    { label: t('profile.takePhoto'), kind: 'primary', keepOpen: true, onClick: choose('user') },
    { label: t('profile.pickGallery'), keepOpen: true, onClick: choose(null) },
    { label: t('common.cancel') }] });
}
