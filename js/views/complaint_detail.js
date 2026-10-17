// S2.3 Complaint detail: stage tracker, photos, comments, change status, hide.
import { h, card, button, field, statusPill, avatar, errorState, loadingRegion, openSheet, toast, icon, when } from '../ui.js';
import { friendly } from '../api.js';
import { duration } from '../fmt.js';
import { can, store } from '../store.js';
import { plotChip } from '../ui.js';
import { videosCard } from '../video.js';
import { compressPhoto } from '../photo.js';
import { STAGES, STAGE_KIND, STAGE_KEY, titleOf, whereChip } from './complaints.js';

// A sentence with a tappable time inside it: the text has a {when} marker where the time goes (word order differs between languages).
const withWhen = (text, iso) => { const [a, b = ''] = text.split('{when}'); return [a, when(iso), b]; };
const flow = (el) => { el?.classList.add('flow'); return el; };      // even spacing between a card's children

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });

  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('complaints.get', { id: ctx.params.id }, (d) => {
      const c = d.complaint;
      const stageDate = (s) => (s === 'Open' ? c.raised_at : d.history.filter((x) => x.to_stage === s).map((x) => x.at)[0]);
      const idx = STAGES.indexOf(c.stage);
      // A stage after the first with no history row was skipped (a complaint may jump forward), so it has no time of its own.
      const tracker = h('ol', { class: 'tracker' }, STAGES.map((s, i) => {
        const at = stageDate(s), skipped = i < idx && !at;
        return h('li', { class: `${i <= idx ? 'done' : ''}${skipped ? ' skipped' : ''}`.trim(), 'aria-current': i === idx ? 'step' : null },
          icon(skipped ? 'remove_circle_outline' : i < idx ? 'check_circle' : i === idx ? 'radio_button_checked' : 'radio_button_unchecked'),
          h('span', {}, t(`cmp.stage.${STAGE_KEY[s]}`)),
          h('small', { class: 'muted' }, skipped ? t('cmp.skipped') : at ? when(at) : ''));
      }));
      const dur = duration(c.elapsed_ms), took = t(dur.key, { n: dur.n });
      const photos = d.media.filter((m) => m.kind === 'photo' && m.parent_type === 'complaint');
      const fixPhotos = d.media.filter((m) => m.kind === 'photo' && m.parent_type === 'resolution');
      const commentPhotos = (cid) => d.media.filter((m) => m.kind === 'photo' && m.parent_type === 'comment' && m.parent_id === cid);
      const next = STAGES.slice(idx + 1).filter((s) => s !== 'Closed');        // closing is the requester's (or the System's) call, never a stage you pick
      root.replaceChildren(
        flow(card(null, null, h('h2', {}, titleOf(c)), c.description.length > titleOf(c).length ? h('p', {}, c.description) : null,
          h('div', { class: 'row' }, whereChip(t, c), statusPill(STAGE_KIND[c.stage], t(`cmp.stage.${STAGE_KEY[c.stage]}`))),
          h('p', { class: 'small muted' }, ...withWhen(t('cmp.raisedOn', { date: '{when}', name: c.raised_by_name }), c.raised_at)),
          c.resolved_at ? h('p', { class: 'small muted' }, ...withWhen(t('cmp.resolvedOn', { date: '{when}' }), c.resolved_at)) : null,
          h('div', { class: 'row-between' }, h('p', { class: 'small' }, icon('assignment_ind', 'sm'), ' ', c.assigned_to_me ? t('cmp.assignedYou') : t('cmp.lookedAfter', { name: c.assigned_to_name })),
            store.get().session?.role === 'President' ? button(t('cmp.assign'), { kind: 'text', onClick: () => assignSheet(ctx, c, load) }) : null),
          c.can_take_on ? button(t('cmp.takeOn'), { kind: 'primary', icon: 'front_hand', onClick: async () => {
            try { await ctx.api.call('complaints.takeOn', { id: c.id }); toast(t('cmp.tookOn')); load(); } catch (e) { toast(friendly(e, t)); }
          } }) : null)),
        flow(card(t('cmp.progress'), 'timeline', tracker,
          ...d.history.filter((x) => x.note).map((x) => h('p', { class: 'small' }, icon('sticky_note_2', 'sm'), ' ', h('strong', {}, t(`cmp.stage.${STAGE_KEY[x.to_stage]}`)), `: ${x.note} `, h('span', { class: 'muted' }, `· ${x.by_name}, `, when(x.at)))),
          h('p', { class: 'small' }, c.resolved_at ? t('cmp.resolvedIn', { d: took }) : t('cmp.timeSoFar', { d: took })),
          (can('complaint_stage', 'u') || c.assigned_to_me) && next.length ? button(t('cmp.changeStatus'), { kind: 'primary', icon: 'sync_alt', block: true, onClick: () => stageSheet(ctx, c, next, load) }) : null)),
        requesterCard(ctx, c, load),
        fixPhotos.length || d.contributors?.length ? flow(card(t('cmp.fixPhotosTitle'), 'task_alt',
          fixPhotos.length ? h('div', { class: 'photo-grid' }, fixPhotos.map((m) => thumb(ctx, m.id))) : null,
          d.contributors?.length ? h('p', {}, icon('volunteer_activism', 'sm'), ' ', t('cmp.contribThanks', { names: d.contributors.map((x) => `${x.name} (${x.plot_keys.map((k) => String(k).replace(/^([A-Z])-?(\d+)$/, '$1-$2')).join(', ')})`).join(', ') })) : null)) : null,
        photos.length ? flow(card(t('cmp.photosTitle'), 'image', h('div', { class: 'photo-grid' }, photos.map((m) => thumb(ctx, m.id))))) : null,
        flow(videosCard(ctx, { videos: d.media.filter((m) => m.kind === 'video' && m.parent_type === 'complaint'), parentType: 'complaint', parentId: c.id, canAdd: can('complaints', 'c'), done: load })),
        flow(card(t('cmp.discussion', { n: d.comments.filter((m) => !m.hidden).length }), 'forum',
          ...(d.comments.length ? d.comments.map((m) => m.hidden ? h('div', { class: 'queue-item small muted', style: 'opacity:.7' }, icon('visibility_off', 'sm'), ' ', t('cmp.hiddenByCommittee'), ' · ', when(m.at)) : h('div', { class: 'stack-sm queue-item' },
            h('div', { class: 'row' }, avatar(m.author_name), h('div', { class: 'grow' }, h('strong', {}, m.author_name), h('div', { class: 'small muted' }, when(m.at))),
              can('comments', 'd') ? button(t('cmp.hide'), { kind: 'text', onClick: () => hideSheet(ctx, 'comments.hide', m.id, load) }) : null),
            h('p', {}, m.body), commentPhotos(m.id).length ? h('div', { class: 'photo-grid' }, commentPhotos(m.id).map((p) => thumb(ctx, p.id))) : null)) : [h('p', { class: 'muted' }, t('cmp.noComments'))]),
          can('comments', 'c') ? commentBox(ctx, c.id, load) : null)),
        can('complaints', 'd') ? button(t('cmp.hideComplaint'), { kind: 'danger', block: true, onClick: () => hideSheet(ctx, 'complaints.hide', c.id, () => { location.hash = '#/issues'; }) }) : null);
      });
    } catch (e) { root.replaceChildren(errorState(e.code === 'NOT_FOUND' ? t('cmp.notFound') : friendly(e, t), load)); }
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

// The President picks who looks after a complaint (from the members list, by name or plot), or keeps it with themself.
function assignSheet(ctx, c, done) {
  const { t } = ctx;
  let all = [];
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('com.membersSearch'), 'aria-label': t('com.membersSearch'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  const list = h('div', { class: 'stack-sm' });
  const norm = (v) => String(v).toLowerCase().replace(/[\s-]/g, '');
  const pick = async (payload, close) => {
    try { await ctx.api.call('complaints.assign', { id: c.id, ...payload }); close(); toast(t('cmp.assigned')); done(); } catch (e) { toast(friendly(e, t)); }
  };
  let closeSheet = () => {};
  function draw() {
    const f = norm(q.value.trim());
    const rows = all.filter((m) => m.role !== 'Member' && m.plot_keys?.length && (!f || norm(`${m.name},${m.plot_keys.join(',')}`).includes(f)));
    list.replaceChildren(...rows.map((m) => h('button', { type: 'button', class: 'list-row map-row', style: 'width:100%;text-align:start', onClick: () => pick({ plotKey: m.plot_keys[0] }, closeSheet) },
      avatar(m.name), h('div', { class: 'grow' }, h('div', {}, m.name), h('div', { class: 'row small' }, m.plot_keys.map((k) => plotChip(String(k).replace(/^([A-Z])-?(\d+)$/, '$1-$2'))))))));
  }
  q.addEventListener('input', draw);
  ctx.api.swr('members.directory', {}, (r) => { all = r.items; draw(); }).catch((e) => toast(friendly(e, t)));
  const dlg = openSheet({ title: t('cmp.assignTitle'), body: h('div', { class: 'stack' }, q, list), actions: [
    { label: t('cmp.assignPresident'), keepOpen: true, onClick: (close) => pick({ toPresident: true }, close) }, { label: t('common.cancel') }] });
  closeSheet = () => dlg.close();
}

// The person who raised the complaint closes it once it is resolved, or reopens it (also after it closed) when the problem is still there.
function requesterCard(ctx, c, done) {
  const { t } = ctx;
  if (c.stage !== 'Resolved' && c.stage !== 'Closed') return null;
  if (!c.raised_by_me) return c.stage === 'Resolved' ? flow(card(null, null, h('p', { class: 'small muted' }, icon('hourglass_top', 'sm'), ' ', t('cmp.closeWaits')))) : null;
  const act = async (action, msg) => { try { await ctx.api.call(action, { id: c.id }); toast(t(msg)); done(); } catch (e) { toast(friendly(e, t)); } };
  return flow(card(t('cmp.yourSay'), 'how_to_reg', h('p', {}, t(c.stage === 'Resolved' ? 'cmp.closeAsk' : 'cmp.closedReopen')),
    c.stage === 'Resolved' ? button(t('cmp.confirmClose'), { kind: 'primary', icon: 'check_circle', block: true, onClick: () => act('complaints.close', 'cmp.closed') }) : null,
    button(t('cmp.reopen'), { icon: 'undo', block: true, onClick: () => act('complaints.reopen', 'cmp.reopened') })));
}

function stageSheet(ctx, c, next, done) {
  const { t } = ctx;
  const note = h('div', { role: 'alert' });
  const why = field({ id: 'st-note', label: t('cmp.stageNote'), help: t('cmp.stageNoteHelp'), maxlength: 200 });
  const picked = new Set();                                           // plot keys of the members who helped
  const finishing = next.includes('Resolved');
  const files = h('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': t('cmp.fixPhotos') });
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('com.membersSearch'), 'aria-label': t('com.membersSearch'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  const list = h('div', { class: 'stack-sm', style: 'max-height:220px;overflow:auto' });
  const chosen = h('p', { class: 'small muted' }, t('cmp.contribNone'));
  let all = [];
  const norm = (v) => String(v).toLowerCase().replace(/[\s-]/g, '');
  function drawList() {
    const f = norm(q.value.trim());
    list.replaceChildren(...all.filter((m) => m.plot_keys?.length && (!f || norm(`${m.name},${m.plot_keys.join(',')}`).includes(f))).map((m) => {
      const key = m.plot_keys[0], box = h('input', { type: 'checkbox', checked: picked.has(key), onChange: () => { box.checked ? picked.add(key) : picked.delete(key); drawChosen(); } });
      return h('label', { class: 'row', style: 'gap:8px' }, box, h('span', { class: 'grow' }, m.name), h('span', { class: 'small muted' }, m.plot_keys.map((k) => String(k).replace(/^([A-Z])-?(\d+)$/, '$1-$2')).join(', ')));
    }));
  }
  function drawChosen() { chosen.textContent = picked.size ? all.filter((m) => picked.has(m.plot_keys?.[0])).map((m) => m.name).join(', ') : t('cmp.contribNone'); }
  if (finishing) {
    q.addEventListener('input', drawList);
    ctx.api.swr('members.directory', {}, (r) => { all = r.items; drawList(); drawChosen(); }).catch((e) => toast(friendly(e, t)));
  }
  const extras = finishing ? h('div', { class: 'stack-sm' }, h('strong', {}, t('cmp.resolveExtras')),
    h('div', { class: 'stack-sm' }, h('div', {}, h('strong', { class: 'small' }, t('cmp.contribTitle')), h('p', { class: 'small muted' }, t('cmp.contribHelp'))), q, list, chosen),
    h('div', { class: 'stack-sm' }, h('strong', { class: 'small' }, t('cmp.fixPhotos')), h('p', { class: 'small muted' }, t('cmp.fixPhotosHelp')), files)) : null;
  openSheet({ title: t('cmp.changeStatus'), body: h('div', { class: 'stack-sm' }, h('p', { class: 'small muted' }, t('cmp.forwardOnly')), why, extras, note), actions: [
    ...next.map((s) => ({ label: t(`cmp.stage.${STAGE_KEY[s]}`), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const finish = s === 'Resolved';
      try {
        await ctx.api.call('complaints.stage', { id: c.id, stage: s, note: why.querySelector('input').value.trim(), ...(finish && picked.size ? { contributors: [...picked] } : {}) });
        let failed = 0;
        if (finish) for (const f of [...files.files].slice(0, 3)) {
          try { await ctx.api.call('media.addPhoto', { parentType: 'resolution', parentId: c.id, jpegBase64: await compressPhoto(f, { maxBase64: 1400000 }) }); } catch { failed++; }
        }
        close(); toast(failed ? t('cmp.photoFailed') : t('common.saved')); done();
      } catch (e) { note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, friendly(e, t))); }
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
