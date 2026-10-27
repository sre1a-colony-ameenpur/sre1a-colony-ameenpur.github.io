// S6.5 Layout: President uploads the plot list made by the layout tool, previews what changes and which members have a plot
// that is not on the layout, then applies it. Committee roles with plots:r can see the current check.
import { h, card, plotChip, button, statusPill, emptyState, errorState, loadingRegion, confirmSheet, toast, icon, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { can } from '../store.js';

const label = (k) => k.replace(/^([A-Z])(\d+)$/, '$1-$2');

export default function render(ctx) {
  const { t } = ctx;
  const out = h('div', { class: 'stack', 'data-tour': 'ly-out' });
  let candidate = null;

  function summary(r, preview) {
    const chips = (keys) => h('span', { class: 'row', style: 'flex-wrap:wrap' }, keys.map((k) => plotChip(label(k))));
    const gone = r.membersMissing;
    return [
      card(t('layout.result'), 'fact_check',
        h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('layout.plotsOnLayout')), h('strong', {}, String(r.layoutCount))),
        preview ? h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('layout.newPlots')), r.newPlots.length ? chips(r.newPlots) : h('span', { class: 'muted' }, '0')) : null,
        preview ? h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('layout.removedPlots')), r.removedPlots.length ? chips(r.removedPlots) : h('span', { class: 'muted' }, '0')) : null,
        h('div', { class: 'list-row' }, h('div', { class: 'grow' }, t('layout.membersMissing')),
          statusPill(gone.length ? 'overdue' : 'paid', gone.length ? String(gone.length) : t('layout.allMapped')))),
      gone.length ? card(t('layout.missingTitle'), 'error',
        h('p', { class: 'small muted' }, t('layout.missingHelp')),
        ...gone.map((m) => h('div', { class: 'list-row' }, h('div', { class: 'grow' }, m.name), chips(m.plot_keys)))) : null,
      r.layoutPlotsWithoutMember.length ? card(t('layout.noMember'), 'home_work', h('p', { class: 'small muted' }, t('layout.noMemberHelp', { n: r.layoutPlotsWithoutMember.length }))) : null,
    ].filter(Boolean);
  }

  async function showCurrent() {
    out.replaceChildren(loadingRegion(2));
    try { out.replaceChildren(...summary(await ctx.api.call('layout.check'), false)); }
    catch (e) { out.replaceChildren(errorState(friendly(e, t), showCurrent)); }
  }

  async function onFile(file) {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!Array.isArray(json.plots)) throw new Error('shape');
      candidate = json.plots;
    } catch { toast(t('layout.badFile')); return; }
    out.replaceChildren(loadingRegion(2));
    try {
      const r = await ctx.api.call('layout.check', { plots: candidate });
      out.replaceChildren(...[h('div', { class: 'banner info', style: 'border-radius:12px' }, icon('visibility'), ' ', t('layout.previewNote')), ...summary(r, true),
        can('plots', 'u') ? button(t('layout.apply'), { kind: 'primary', block: true, icon: 'publish', onClick: apply }) : null].filter(Boolean));
    } catch (e) { out.replaceChildren(errorState(friendly(e, t), () => onFile(file))); }
  }

  async function apply() {
    if (!await confirmSheet(t('layout.applyTitle'), t('layout.applyText'), { confirmLabel: t('layout.apply') })) return;
    try { await ctx.api.call('layout.import', { plots: candidate }); toast(t('layout.applied')); candidate = null; showCurrent(); }
    catch (e) { toastError(friendly(e, t)); }
  }

  const input = h('input', { type: 'file', accept: 'application/json,.json', id: 'layout-file', class: 'sr-only' });
  input.addEventListener('change', () => onFile(input.files[0]));
  const root = h('div', { class: 'page stack' }, h('h1', {}, t('layout.title')),
    can('plots', 'u') ? card(t('layout.uploadTitle'), 'upload_file',
      h('p', { class: 'small muted' }, t('layout.uploadHelp')),
      input, h('label', { class: 'btn primary block', for: 'layout-file' }, icon('upload_file'), t('layout.choose'))) : null,
    out);
  showCurrent();
  return root;
}
