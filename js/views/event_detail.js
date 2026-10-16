// S4.2 Event detail: details, photo grid with full-size viewer, add photos, edit and hide for allowed roles.
import { h, card, button, field, errorState, loadingRegion, openSheet, toast, icon } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can } from '../store.js';
import { photoImg, uploadPhotos } from './events.js';

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });
  const back = () => h('a', { href: '#/community', class: 'btn text', style: 'align-self:flex-start' }, icon('arrow_back'), t('common.back'));

  async function load() {
    root.replaceChildren(back(), loadingRegion(2));
    try {
      await ctx.api.swr('events.get', { id: ctx.params.id }, ({ event: e, media }) => {
      const photos = media.filter((m) => m.kind === 'photo');
      const files = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', id: 'ev-add', onChange: async (ev) => {
        if (!ev.target.files.length) return;
        toast(t('evt.uploading'));
        const failed = await uploadPhotos(ctx, e.id, ev.target.files);
        toast(failed ? t('evt.publishedSome') : t('evt.photosAdded')); load();
      } });
      root.replaceChildren(back(),
        photos[0] ? h('div', { class: 'cover' }, photoImg(ctx, photos[0].id, 'cover-img')) : null,
        card(null, null, h('h2', {}, e.title), h('p', { class: 'muted' }, `${dateShort(e.date)}${e.place ? ` · ${e.place}` : ''}`), e.description ? h('p', { style: 'white-space:pre-wrap' }, e.description) : null,
          h('div', { class: 'row' },
            can('events', 'u') ? button(t('fee.edit'), { icon: 'edit', onClick: () => editSheet(ctx, e, load) }) : null,
            can('events', 'd') ? button(t('cmp.hide'), { kind: 'danger', onClick: () => hideSheet(ctx, e.id) }) : null)),
        card(t('evt.photosTitle', { n: photos.length }), 'photo_library',
          photos.length ? h('div', { class: 'photo-grid' }, photos.map((m) => h('button', { type: 'button', class: 'photo-btn', 'aria-label': t('cmp.photo'), onClick: () => viewer(ctx, m.id) }, photoImg(ctx, m.id)))) : h('p', { class: 'muted' }, t('evt.noPhotos')),
          can('media', 'c') ? h('div', {}, files, h('label', { class: 'btn block', for: 'ev-add' }, icon('add_a_photo'), t('evt.addPhotos'))) : null));
      });
    } catch (e) { root.replaceChildren(back(), errorState(e.code === 'NOT_FOUND' ? t('evt.notFound') : friendly(e, t), load)); }
  }
  load();
  return root;
}

async function viewer(ctx, id) {
  try {
    const { jpegBase64 } = await ctx.api.call('media.photo', { id, size: 'full' });
    openSheet({ title: ctx.t('cmp.photo'), wide: true, body: h('img', { src: `data:image/jpeg;base64,${jpegBase64}`, alt: ctx.t('cmp.photo'), style: 'width:100%' }), actions: [{ label: ctx.t('common.close') }] });
  } catch (e) { toast(friendly(e, ctx.t)); }
}

function editSheet(ctx, e, done) {
  const { t } = ctx;
  const title = field({ id: 'ee-t', label: t('evt.title'), value: e.title, maxlength: 120 });
  const date = field({ id: 'ee-d', label: t('exp.date'), type: 'date', value: e.date });
  const place = field({ id: 'ee-p', label: t('mtg.place'), value: e.place, maxlength: 120 });
  const desc = h('div', { class: 'field' }, h('label', { for: 'ee-x' }, t('fee.description')), h('textarea', { id: 'ee-x', rows: 4, maxlength: 2000 }));
  desc.querySelector('textarea').value = e.description || '';
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('fee.edit'), body: h('div', { class: 'stack' }, title, date, place, desc, note), actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const ttl = title.querySelector('input').value.trim(); if (!ttl) { note.replaceChildren(h('div', { class: 'banner warn' }, t('fee.titleNeeded'))); return; }
      try { await ctx.api.call('events.update', { id: e.id, title: ttl, date: date.querySelector('input').value, place: place.querySelector('input').value.trim(), description: desc.querySelector('textarea').value.trim() }); close(); toast(t('common.saved')); done(); }
      catch (err) { note.replaceChildren(h('div', { class: 'banner warn' }, friendly(err, t))); }
    } }, { label: t('common.cancel') }] });
}

function hideSheet(ctx, id) {
  const { t } = ctx;
  const reason = field({ id: 'eh-why', label: t('exp.reason'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('cmp.hide'), body: h('div', { class: 'stack' }, h('p', { class: 'small muted' }, t('cmp.hideNote')), reason, note), actions: [
    { label: t('cmp.hide'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim(); if (!why) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      try { await ctx.api.call('events.hide', { id, reason: why }); close(); toast(t('cmp.hidden')); location.hash = '#/community'; } catch (e) { note.replaceChildren(h('div', { class: 'banner warn' }, friendly(e, t))); }
    } }, { label: t('common.cancel') }] });
}
