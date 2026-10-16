// S2.1 Complaints list and S2.2 raise a complaint. Detail is complaint_detail.js.
import { h, button, field, statusPill, plotChip, emptyState, errorState, loadingRegion, openSheet, toast, icon, segmented } from '../ui.js';
import { friendly } from '../api.js';
import { can } from '../store.js';
import { compressPhoto } from '../photo.js';

export const STAGES = ['Open', 'Acknowledged', 'In progress', 'Resolved', 'Closed'];
export const STAGE_KIND = { Open: 'open', Acknowledged: 'ack', 'In progress': 'progress', Resolved: 'resolved', Closed: 'closed' };
export const STAGE_KEY = { Open: 'open', Acknowledged: 'ack', 'In progress': 'progress', Resolved: 'resolved', Closed: 'closed' };
export const AREAS = ['Park', 'Gate', 'Roads', 'Street lights', 'Water', 'Drainage', 'Security', 'Other'];
export const AREA_KEY = { Park: 'park', Gate: 'gate', Roads: 'roads', 'Street lights': 'lights', Water: 'water', Drainage: 'drainage', Security: 'security', Other: 'other' };
export const titleOf = (c) => String(c.description).split('\n')[0].slice(0, 80);
export const daysAgo = (iso, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86400000));
export const whereChip = (t, c) => (c.plot_key ? plotChip(c.plot_key.replace(/^([A-Z])(\d+)$/, '$1-$2')) : h('span', { class: 'plot' }, `${t('cmp.commonArea')}: ${t(`cmp.area.${AREA_KEY[c.area] || 'other'}`)}`));

export default async function render(ctx) {
  const { t } = ctx;
  let filter = 'all', items = [];
  const list = h('div', { class: 'stack-sm' });
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('cmp.search'), 'aria-label': t('cmp.search'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
  q.addEventListener('input', draw);
  const group = { all: () => true, open: (c) => c.stage === 'Open' || c.stage === 'Acknowledged', progress: (c) => c.stage === 'In progress', resolved: (c) => c.stage === 'Resolved', closed: (c) => c.stage === 'Closed' };

  function draw() {
    const f = q.value.trim().toLowerCase();
    const rows = items.filter((c) => group[filter](c) && (!f || (c.description + c.plot_key + c.area).toLowerCase().includes(f)));
    list.replaceChildren(...(rows.length ? rows.map((c) => h('a', { class: 'card', href: `#/issues/${c.id}`, style: 'display:block;text-decoration:none;color:inherit' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, h('strong', {}, titleOf(c)), statusPill(STAGE_KIND[c.stage], t(`cmp.stage.${STAGE_KEY[c.stage]}`))),
      h('div', { class: 'row', style: 'margin-top:8px' }, whereChip(t, c)),
      h('div', { class: 'small muted', style: 'margin-top:8px' }, daysAgo(c.raised_at) === 0 ? t('cmp.raisedToday', { name: c.raised_by_name }) : t('cmp.raisedAgo', { n: daysAgo(c.raised_at), name: c.raised_by_name }),
        c.comment_count ? ` · ${t('cmp.comments', { n: c.comment_count })}` : '')))
      : [emptyState(t('cmp.none'), 'report')]));
  }
  async function load() {
    list.replaceChildren(loadingRegion(3));
    try { items = (await ctx.api.call('complaints.list')).items; draw(); } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return h('div', { class: 'page stack' }, h('h1', {}, t('cmp.title')),
    segmented([['all', t('exp.f.all')], ['open', t('cmp.stage.open')], ['progress', t('cmp.stage.progress')], ['resolved', t('cmp.stage.resolved')], ['closed', t('cmp.stage.closed')]], 'all', (v) => { filter = v; draw(); }, t('exp.filter')),
    q, list, can('complaints', 'c') ? button(t('cmp.raise'), { kind: 'primary', block: true, icon: 'add', onClick: () => raiseSheet(ctx, load) }) : null);
}

function raiseSheet(ctx, done) {
  const { t } = ctx;
  let where = 'plot', plots = [];
  const plotInput = field({ id: 'cm-plot', label: t('cmp.plot'), placeholder: 'A-12', list: 'cm-plots', autocapitalize: 'characters' });
  const dl = h('datalist', { id: 'cm-plots' });
  ctx.api.call('map.plots').then((d) => { plots = d.plots; dl.replaceChildren(...plots.map((p) => h('option', { value: p.plot_label }))); }).catch(() => {});
  const area = h('div', { class: 'field' }, h('label', { for: 'cm-area' }, t('cmp.areaLabel')), h('select', { id: 'cm-area' }, AREAS.map((a) => h('option', { value: a }, t(`cmp.area.${AREA_KEY[a]}`)))));
  area.hidden = true;
  const text = h('textarea', { id: 'cm-text', rows: 4, maxlength: 500 });
  const count = h('div', { class: 'help' }, '0 / 500');
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / 500`; });
  const files = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'cm-files' });
  const note = h('div', { role: 'alert' });
  const warn = (m) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error'), m));
  openSheet({ title: t('cmp.raise'), body: h('div', { class: 'stack' }, dl,
    segmented([['plot', t('cmp.aPlot')], ['area', t('cmp.commonArea')]], 'plot', (v) => { where = v; plotInput.hidden = v !== 'plot'; area.hidden = v !== 'area'; }, t('cmp.where')), plotInput, area,
    h('div', { class: 'field' }, h('label', { for: 'cm-text' }, t('cmp.what')), text, count),
    h('div', { class: 'field' }, h('label', { for: 'cm-files' }, t('cmp.photos')), files, h('div', { class: 'help' }, t('cmp.photosHelp'))), note), actions: [
    { label: t('cmp.submit'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const description = text.value.trim();
      if (!description) return warn(t('cmp.whatNeeded'));
      const payload = { description };
      if (where === 'plot') {
        const typed = plotInput.querySelector('input').value.trim().toUpperCase().replace(/[\s-]/g, '');
        if (!typed) return warn(t('cmp.plotNeeded'));
        payload.plot_key = typed;
      } else payload.area = area.querySelector('select').value;
      if (files.files.length > 3) return warn(t('cmp.maxPhotos'));
      try {
        const { id } = await ctx.api.call('complaints.create', payload);
        let failed = 0;
        for (const f of files.files) {
          try { await ctx.api.call('media.addPhoto', { parentType: 'complaint', parentId: id, jpegBase64: await compressPhoto(f, { maxBase64: 1400000 }) }); } catch { failed++; }
        }
        close(); toast(failed ? t('cmp.raisedSomePhotos') : t('cmp.raised')); done();
      } catch (e) { warn(e.code === 'INVALID' ? t('cmp.plotUnknown') : friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
