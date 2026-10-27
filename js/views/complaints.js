// S2.1 Complaints list and S2.2 raise a complaint. Detail is complaint_detail.js.
import { withCamera } from '../camera.js';
import { h, button, field, statusPill, plotChip, emptyState, errorState, loadingRegion, openSheet, toast, icon, segmented, toastError } from '../ui.js';
import { appendPage } from '../paging.js';
import { friendly } from '../api.js';
import { can } from '../store.js';
import { takeTour, runTourWhenReady } from '../tour.js';
import { compressPhoto, photoWithThumb } from '../photo.js';

export const STAGES = ['Open', 'Acknowledged', 'In progress', 'Resolved', 'Closed'];
export const STAGE_KIND = { Open: 'cmpOpen', Acknowledged: 'cmpAck', 'In progress': 'cmpProgress', Resolved: 'resolved', Closed: 'closed' };
export const STAGE_KEY = { Open: 'open', Acknowledged: 'ack', 'In progress': 'progress', Resolved: 'resolved', Closed: 'closed' };
export const AREAS = ['Park', 'Gate', 'Roads', 'Street lights', 'Water', 'Drainage', 'Security', 'Other'];
export const AREA_KEY = { Park: 'park', Gate: 'gate', Roads: 'roads', 'Street lights': 'lights', Water: 'water', Drainage: 'drainage', Security: 'security', Other: 'other' };
export const titleOf = (c) => String(c.description).split('\n')[0].slice(0, 80);
export const daysAgo = (iso, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86400000));
export const whereChip = (t, c) => (c.plot_key ? plotChip(c.plot_key.replace(/^([A-Z])(\d+)$/, '$1-$2')) : h('span', { class: 'plot' }, `${t('cmp.commonArea')}: ${t(`cmp.area.${AREA_KEY[c.area] || 'other'}`)}`));

let initialFilter = 'all';
export const setIssuesFilter = (group) => { initialFilter = group; };      // the Pending tiles open the list already filtered

export default async function render(ctx) {
  const { t } = ctx;
  let filter = initialFilter;
  initialFilter = 'all';
  let items = [], cursor = null, total = 0, busy = false, timer = null;
  const list = h('div', { class: 'stack-sm', 'data-tour': 'i-list' }), more = h('div');
  const q = h('input', { 'data-tour': 'i-search', type: 'search', class: 'map-q', placeholder: t('cmp.search'), 'aria-label': t('cmp.search'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { items = []; load(); }, 350); });     // the server searches every complaint

  function draw() {
    list.replaceChildren(...(items.length ? items.map((c) => h('a', { class: 'card', href: `#/issues/${c.id}`, style: 'display:block;text-decoration:none;color:inherit' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, h('strong', {}, titleOf(c)), statusPill(STAGE_KIND[c.stage], t(`cmp.stage.${STAGE_KEY[c.stage]}`))),
      h('div', { class: 'row', style: 'margin-top:8px' }, whereChip(t, c)),
      h('div', { class: 'small muted', style: 'margin-top:8px' }, daysAgo(c.raised_at) === 0 ? t('cmp.raisedToday', { name: c.raised_by_name }) : t('cmp.raisedAgo', { n: daysAgo(c.raised_at), name: c.raised_by_name }),
        c.comment_count ? ` · ${t('cmp.comments', { n: c.comment_count })}` : '')))
      : [emptyState(t('cmp.none'), 'report')]));
    more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, disabled: busy, onClick: () => load(true) })] : []));
  }
  // Newest first, 30 a page. A filter or a search starts again from the newest; "Show more" asks for the next page.
  async function load(older = false) {
    if (!older && !items.length) { list.replaceChildren(loadingRegion(3)); more.replaceChildren(); }
    busy = true;
    try {
      const payload = {};
      if (filter !== 'all') payload.group = filter;
      if (q.value.trim()) payload.q = q.value.trim();
      if (older) payload.before = cursor;
      if (older) { const r = await ctx.api.call('complaints.list', payload); ({ items, cursor } = appendPage(items, r)); total = r.total; }
      else await ctx.api.swr('complaints.list', payload, (r) => { items = r.items; cursor = r.next_cursor || null; total = r.total; draw(); });
      busy = false; draw();
    } catch (e) { busy = false; list.replaceChildren(errorState(friendly(e, t), () => load(older))); }
  }
  const seg = segmented([['all', t('exp.f.all')], ['open', t('cmp.stage.open')], ['progress', t('cmp.stage.progress')], ['resolved', t('cmp.stage.resolved')], ['closed', t('cmp.stage.closed')]], filter, (v) => { filter = v; items = []; load(); }, t('exp.filter'));
  load();
  seg.setAttribute('data-tour', 'i-filter');
  const page = h('div', { class: 'page stack' }, h('div', { class: 'row-between' }, h('h1', { style: 'margin:0' }, t('cmp.title')), h('div', { class: 'row' },
    h('a', { class: 'icon-btn', 'data-tour': 'i-pending', href: '#/issues/pending', 'aria-label': t('pend.title'), title: t('pend.title') }, icon('pending_actions')),
    h('a', { class: 'icon-btn', 'data-tour': 'i-monthly', href: '#/issues/monthly', 'aria-label': t('cmp.monthly'), title: t('cmp.monthly') }, icon('insights')))),
    seg, q, list, more, can('complaints', 'c') ? h('button', { type: 'button', class: 'fab', 'data-tour': 'i-raise', 'aria-label': t('cmp.raise'), onClick: () => raiseSheet(ctx, load) }, icon('add'), h('span', { class: 'sr-only' }, t('cmp.raise'))) : null);
  if (takeTour('issues')) runTourWhenReady('issues', page);
  return page;
}

function raiseSheet(ctx, done) {
  const { t } = ctx;
  let where = 'plot', plots = [];
  const picker = plotPicker(ctx, 'cm-plot', t('cmp.plot'), (ctx.store.get().session?.plotKeys || [])[0] || '');       // starts with your own plot
  const plotInput = picker.el;
  const area = h('div', { class: 'field' }, h('label', { for: 'cm-area' }, t('cmp.areaLabel')), h('select', { id: 'cm-area' }, AREAS.map((a) => h('option', { value: a }, t(`cmp.area.${AREA_KEY[a]}`)))));
  area.hidden = true;
  const text = h('textarea', { id: 'cm-text', rows: 4, maxlength: 500 });
  const count = h('div', { class: 'help' }, '0 / 500');
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / 500`; });
  const files = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'cm-files' });
  const note = h('div', { role: 'alert' });
  const warn = (m) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m));
  openSheet({ title: t('cmp.raise'), body: h('div', { class: 'stack' },
    segmented([['plot', t('cmp.aPlot')], ['area', t('cmp.commonArea')]], 'plot', (v) => { where = v; plotInput.hidden = v !== 'plot'; area.hidden = v !== 'area'; }, t('cmp.where')), plotInput, area,
    h('div', { class: 'field' }, h('label', { for: 'cm-text' }, t('cmp.what')), text, count),
    h('div', { class: 'field' }, h('label', { for: 'cm-files' }, t('cmp.photos')), withCamera(files, t, { multiple: true }), h('div', { class: 'help' }, t('cmp.photosHelp'))), note), actions: [
    { label: t('cmp.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const description = text.value.trim();
      if (!description) return warn(t('cmp.whatNeeded'));
      const payload = { description };
      if (where === 'plot') {
        const typed = picker.input.value.trim();
        if (!typed) return warn(t('cmp.plotNeeded'));
        const known = picker.find(typed);
        if (picker.loaded() && !known) return warn(t('cmp.plotPick'));          // only a plot on the list; until the list arrives the server checks it
        payload.plot_key = known ? known.plot_key : typed.toUpperCase().replace(/\s/g, '');
      } else payload.area = area.querySelector('select').value;
      if (files.files.length > 3) return warn(t('cmp.maxPhotos'));
      try {
        const { id } = await ctx.api.call('complaints.create', payload);
        let failed = 0;
        for (const f of files.files) {
          try { await ctx.api.call('media.addPhoto', { parentType: 'complaint', parentId: id, ...(await photoWithThumb(f)) }); } catch { failed++; }
        }
        close(); toast(failed ? t('cmp.raisedSomePhotos') : t('cmp.raised')); done();
      } catch (e) { toastError(e.code === 'INVALID' ? t('cmp.plotUnknown') : friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

// A searchable list of the colony's plots: type to narrow it, tap one to choose. Only a plot on the list is accepted.
function plotPicker(ctx, id, labelText, initial) {
  const { t } = ctx;
  let plots = [];
  const norm = (k) => String(k || '').replace(/[\s-]/g, '').toUpperCase();
  const input = h('input', { id, type: 'text', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': `${id}-list`, autocomplete: 'off', autocapitalize: 'characters', placeholder: 'A-12', value: initial || '' });
  const list = h('ul', { id: `${id}-list`, role: 'listbox', class: 'combo-list', hidden: true });
  const find = (v) => plots.find((p) => norm(p.plot_label) === norm(v) || norm(p.plot_key) === norm(v));
  const hide = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const pick = (p) => { input.value = p.plot_label; hide(); };
  function draw() {
    const f = norm(input.value);
    const hits = plots.filter((p) => !f || norm(p.plot_label).includes(f)).slice(0, 8);
    list.replaceChildren(...hits.map((p) => h('li', { role: 'option', class: 'combo-opt', onPointerdown: (e) => { e.preventDefault(); pick(p); } }, p.plot_label)));
    list.hidden = !hits.length; input.setAttribute('aria-expanded', String(!list.hidden));
  }
  input.addEventListener('focus', () => { input.select?.(); draw(); });
  input.addEventListener('input', draw);
  input.addEventListener('blur', hide);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !list.hidden && list.firstChild) { e.preventDefault(); input.value = list.firstChild.textContent; hide(); } });
  ctx.api.swr('map.plots', {}, () => {}).then((d) => { plots = d.plots; const own = find(initial); if (own) input.value = own.plot_label; }).catch(() => {});
  const el = h('div', { class: 'field combo' }, h('label', { for: id }, labelText), input, list, h('div', { class: 'help' }, t('cmp.plotHelp')));
  return { el, input, find, loaded: () => plots.length > 0 };
}
