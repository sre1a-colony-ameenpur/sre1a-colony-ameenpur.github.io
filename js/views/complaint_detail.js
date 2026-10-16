// S2.3 Complaint detail: stage tracker, photos, comments, change status, hide.
import { h, card, button, field, statusPill, avatar, errorState, loadingRegion, openSheet, toast, icon } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort, dateDM } from '../fmt.js';
import { can } from '../store.js';
import { compressPhoto } from '../photo.js';
import { STAGES, STAGE_KIND, STAGE_KEY, titleOf, whereChip } from './complaints.js';

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });
  const back = () => h('a', { href: '#/issues', class: 'btn text', style: 'align-self:flex-start' }, icon('arrow_back'), t('common.back'));

  async function load() {
    root.replaceChildren(back(), loadingRegion(2));
    try {
      const d = await ctx.api.call('complaints.get', { id: ctx.params.id });
      const c = d.complaint;
      const stageDate = (s) => (s === 'Open' ? c.raised_at : d.history.filter((x) => x.to_stage === s).map((x) => x.at)[0]);
      const idx = STAGES.indexOf(c.stage);
      const tracker = h('ol', { class: 'tracker' }, STAGES.map((s, i) => h('li', { class: i <= idx ? 'done' : '', 'aria-current': i === idx ? 'step' : null },
        icon(i <= idx ? 'check_circle' : 'radio_button_unchecked', 'sm'), h('span', {}, t(`cmp.stage.${STAGE_KEY[s]}`)), h('small', { class: 'muted' }, stageDate(s) ? dateDM(stageDate(s)) : ''))));
      const days = Math.max(0, Math.round(c.elapsed_ms / 86400000));
      const photos = d.media.filter((m) => m.kind === 'photo' && m.parent_type === 'complaint');
      const commentPhotos = (cid) => d.media.filter((m) => m.kind === 'photo' && m.parent_type === 'comment' && m.parent_id === cid);
      const next = STAGES.slice(idx + 1);
      root.replaceChildren(back(),
        card(null, null, h('h2', {}, titleOf(c)), c.description.length > titleOf(c).length ? h('p', {}, c.description) : null,
          h('div', { class: 'row' }, whereChip(t, c), statusPill(STAGE_KIND[c.stage], t(`cmp.stage.${STAGE_KEY[c.stage]}`))),
          h('p', { class: 'small muted' }, t('cmp.raisedOn', { date: dateShort(c.raised_at), name: c.raised_by_name }))),
        card(t('cmp.progress'), 'timeline', tracker,
          ...d.history.filter((x) => x.note).map((x) => h('p', { class: 'small' }, icon('sticky_note_2', 'sm'), ' ', h('strong', {}, t(`cmp.stage.${STAGE_KEY[x.to_stage]}`)), `: ${x.note} `, h('span', { class: 'muted' }, `· ${x.by_name}, ${dateDM(x.at)}`))),
          h('p', { class: 'small' }, c.resolved_at ? t('cmp.resolvedIn', { n: days }) : t('cmp.timeSoFar', { n: days })),
          can('complaint_stage', 'u') && next.length ? button(t('cmp.changeStatus'), { kind: 'primary', icon: 'sync_alt', onClick: () => stageSheet(ctx, c, next, load) }) : null),
        photos.length ? card(t('cmp.photosTitle'), 'image', h('div', { class: 'photo-grid' }, photos.map((m) => thumb(ctx, m.id)))) : null,
        card(t('cmp.discussion', { n: d.comments.filter((m) => !m.hidden).length }), 'forum',
          ...(d.comments.length ? d.comments.map((m) => m.hidden ? h('div', { class: 'queue-item small muted', style: 'opacity:.7' }, icon('visibility_off', 'sm'), ' ', t('cmp.hiddenByCommittee'), ` · ${dateShort(m.at)}`) : h('div', { class: 'stack-sm queue-item' },
            h('div', { class: 'row' }, avatar(m.author_name), h('div', { class: 'grow' }, h('strong', {}, m.author_name), h('div', { class: 'small muted' }, dateShort(m.at))),
              can('comments', 'd') ? button(t('cmp.hide'), { kind: 'text', onClick: () => hideSheet(ctx, 'comments.hide', m.id, load) }) : null),
            h('p', {}, m.body), commentPhotos(m.id).length ? h('div', { class: 'photo-grid' }, commentPhotos(m.id).map((p) => thumb(ctx, p.id))) : null)) : [h('p', { class: 'muted' }, t('cmp.noComments'))]),
          can('comments', 'c') ? commentBox(ctx, c.id, load) : null),
        can('complaints', 'd') ? button(t('cmp.hideComplaint'), { kind: 'danger', block: true, onClick: () => hideSheet(ctx, 'complaints.hide', c.id, () => { location.hash = '#/issues'; }) }) : null);
    } catch (e) { root.replaceChildren(back(), errorState(e.code === 'NOT_FOUND' ? t('cmp.notFound') : friendly(e, t), load)); }
  }
  load();
  return root;
}

function thumb(ctx, id) {
  const img = h('img', { alt: ctx.t('cmp.photo'), class: 'photo-thumb', loading: 'lazy' });
  const btn = h('button', { type: 'button', class: 'photo-btn', 'aria-label': ctx.t('cmp.photo'), onClick: async () => {
    try {
      const { jpegBase64 } = await ctx.api.call('media.photo', { id, size: 'full' });
      openSheet({ title: ctx.t('cmp.photo'), wide: true, body: h('img', { src: `data:image/jpeg;base64,${jpegBase64}`, alt: ctx.t('cmp.photo'), style: 'width:100%' }), actions: [{ label: ctx.t('common.close') }] });
    } catch (e) { toast(friendly(e, ctx.t)); }
  } }, img);
  ctx.api.call('media.photo', { id, size: 'thumb' }).then((d) => { img.src = `data:image/jpeg;base64,${d.jpegBase64}`; }).catch(() => { btn.replaceChildren(icon('broken_image')); });
  return btn;
}

function commentBox(ctx, complaintId, done) {
  const { t } = ctx;
  const text = h('textarea', { rows: 2, maxlength: 1000, 'aria-label': t('cmp.writeComment'), placeholder: t('cmp.writeComment') });
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('cmp.addPhoto') });
  return h('div', { class: 'stack-sm' }, text, file, button(t('cmp.send'), { kind: 'primary', icon: 'send', onClick: async () => {
    const body = text.value.trim(); if (!body) return;
    try {
      const { id } = await ctx.api.call('comments.create', { complaint_id: complaintId, body });
      if (file.files[0]) { try { await ctx.api.call('media.addPhoto', { parentType: 'comment', parentId: id, jpegBase64: await compressPhoto(file.files[0], { maxBase64: 1400000 }) }); } catch { toast(t('cmp.photoFailed')); } }
      done();
    } catch (e) { toast(friendly(e, t)); }
  } }));
}

function stageSheet(ctx, c, next, done) {
  const { t } = ctx;
  const note = h('div', { role: 'alert' });
  const why = field({ id: 'st-note', label: t('cmp.stageNote'), help: t('cmp.stageNoteHelp'), maxlength: 200 });
  openSheet({ title: t('cmp.changeStatus'), body: h('div', { class: 'stack-sm' }, h('p', { class: 'small muted' }, t('cmp.forwardOnly')), why, note), actions: [
    ...next.map((s) => ({ label: t(`cmp.stage.${STAGE_KEY[s]}`), kind: 'primary', keepOpen: true, onClick: async (close) => {
      try { await ctx.api.call('complaints.stage', { id: c.id, stage: s, note: why.querySelector('input').value.trim() }); close(); toast(t('common.saved')); done(); }
      catch (e) { note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, friendly(e, t))); }
    } })), { label: t('common.cancel') }] });
}

function hideSheet(ctx, action, id, done) {
  const { t } = ctx;
  const reason = field({ id: 'hd-why', label: t('exp.reason'), maxlength: 200 });
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('cmp.hide'), body: h('div', { class: 'stack' }, h('p', { class: 'small muted' }, t('cmp.hideNote')), reason, note), actions: [
    { label: t('cmp.hide'), kind: 'danger solid', keepOpen: true, onClick: async (close) => {
      const why = reason.querySelector('input').value.trim();
      if (!why) { note.replaceChildren(h('div', { class: 'banner warn' }, t('exp.reasonNeeded'))); return; }
      try { await ctx.api.call(action, { id, reason: why }); close(); toast(t('cmp.hidden')); done(); } catch (e) { note.replaceChildren(h('div', { class: 'banner warn' }, friendly(e, t))); }
    } }, { label: t('common.cancel') }] });
}
