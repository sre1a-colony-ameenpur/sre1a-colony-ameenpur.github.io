// S4.1 Events list (cover photo, upcoming first) and S4.3 new event.
import { withCamera } from '../camera.js';
import { h, button, fab, field, emptyState, errorState, loadingRegion, openSheet, toast, icon, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { can } from '../store.js';
import { compressPhoto } from '../photo.js';

// A photo thumbnail that fills in when loaded; falls back to an icon.
export function photoImg(ctx, id, cls = 'photo-thumb') {
  const img = h('img', { alt: '', class: cls, loading: 'lazy' });
  ctx.api.media('media.photo', { id, size: 'thumb' }).then((d) => { img.src = `data:image/jpeg;base64,${d.jpegBase64}`; }).catch(() => img.replaceWith(icon('broken_image')));
  return img;
}
export async function uploadPhotos(ctx, parentId, files) {
  let failed = 0;
  for (const f of files) {
    try { await ctx.api.call('media.addPhoto', { parentType: 'event', parentId, jpegBase64: await compressPhoto(f, { maxBase64: 1400000 }) }); } catch { failed++; }
  }
  return failed;
}

export default async function render(ctx) {
  const { t } = ctx;
  const list = h('div', { class: 'stack-sm' });
  let items = [], cursor = null;
  const more = h('div');
  function draw() {
    {
      list.replaceChildren(...(items.length ? items.map((e) => h('a', { class: 'card', href: `#/community/events/${e.id}`, style: 'display:block;text-decoration:none;color:inherit;padding:0;overflow:hidden' },
        e.cover_media_id ? h('div', { class: 'cover' }, photoImg(ctx, e.cover_media_id, 'cover-img')) : h('div', { class: 'cover empty' }, icon('celebration')),
        h('div', { style: 'padding:12px' }, h('strong', {}, e.title), h('div', { class: 'small muted' }, `${dateShort(e.date)}${e.place ? ` · ${e.place}` : ''}`),
          !e.upcoming ? h('div', { class: 'small muted' }, t('evt.past')) : null))) : [emptyState(t('evt.none'), 'celebration')]));
      more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
    }
  }
  async function load(older = false) {
    if (!older && !items.length) list.replaceChildren(loadingRegion(2));
    try {
      if (older) { const r = await ctx.api.call('events.list', { before: cursor }); items = items.concat(r.items); cursor = r.next_cursor || null; draw(); return; }
      await ctx.api.swr('events.list', {}, (r) => { items = r.items; cursor = r.next_cursor || null; draw(); });
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return h('div', { class: 'stack' }, list, more, can('events', 'c') ? fab(t('evt.new'), () => newSheet(ctx, load)) : null);
}

function newSheet(ctx, done) {
  const { t } = ctx;
  const title = field({ id: 'ev-t', label: t('evt.title'), maxlength: 120 });
  const date = field({ id: 'ev-d', label: t('exp.date'), type: 'date', value: new Date().toISOString().slice(0, 10) });
  const place = field({ id: 'ev-p', label: t('mtg.place'), maxlength: 120 });
  const desc = h('div', { class: 'field' }, h('label', { for: 'ev-x' }, t('fee.description')), h('textarea', { id: 'ev-x', rows: 4, maxlength: 2000 }));
  const files = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'ev-f' });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('evt.new'), body: h('div', { class: 'stack' }, title, date, place, desc,
    h('div', { class: 'field' }, h('label', { for: 'ev-f' }, t('evt.photos')), withCamera(files, t, { multiple: true }), h('div', { class: 'help' }, t('evt.photosHelp'))), note), actions: [
    { label: t('evt.publish'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const ttl = title.querySelector('input').value.trim();
      if (!ttl) { note.replaceChildren(h('div', { class: 'banner warn' }, t('fee.titleNeeded'))); return; }
      try {
        const { id } = await ctx.api.call('events.create', { title: ttl, date: date.querySelector('input').value, place: place.querySelector('input').value.trim(), description: desc.querySelector('textarea').value.trim() });
        const failed = await uploadPhotos(ctx, id, files.files);
        close(); toast(failed ? t('evt.publishedSome') : t('evt.published')); done();
      } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
