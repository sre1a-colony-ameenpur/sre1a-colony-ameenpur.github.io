// Reports: download one of the reports the President has allowed this role, for a month or the last 3, 6 or 12 months, as Excel or PDF.
// The President also sees "Who can download": roles against reports, one tick per cell, saved at once.
import { h, card, button, icon, toast, errorState, loadingRegion, emptyState } from '../ui.js';
import { friendly } from '../api.js';
import { can } from '../store.js';
import { getLang } from '../i18n.js';
import { monthLabel } from '../fmt.js';

const PERIODS = ['month', '3m', '6m', '12m'];
const shift = (ym, by) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const title = (item) => item.title[getLang()] || item.title.en;

// base64 -> a saved file (the browser's own download, no page change)
export function saveFile({ filename, mime, base64 }) {
  const bin = atob(base64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function render(ctx) {
  const { t } = ctx;
  const now = new Date().toISOString().slice(0, 7);
  let items = [], report = '', period = 'month', month = now, busy = false;
  const pick = h('div', { class: 'stack-sm' }), when = h('div', { class: 'stack-sm' }), go = h('div', { class: 'btn-row' }), msg = h('p', { class: 'small muted', role: 'status' });
  const dl = card(t('rep.download'), 'assessment', pick, when, go, msg);
  const access = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('rep.title')), dl, access);

  function drawPick() {
    pick.replaceChildren(h('strong', {}, t('rep.pick')), ...items.map((i) => h('button', { type: 'button', class: 'list-row map-row', 'aria-pressed': String(report === i.key),
      onClick: () => { report = i.key; drawPick(); } }, icon(report === i.key ? 'radio_button_checked' : 'radio_button_unchecked'), h('span', { class: 'grow' }, title(i)))));
    drawWhen();
  }
  function drawWhen() {
    when.replaceChildren(
      h('strong', {}, t('rep.period')),
      h('div', { class: 'chips', role: 'group' }, PERIODS.map((p) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(period === p), onClick: () => { period = p; drawWhen(); } }, t(`rep.p.${p}`)))),
      h('div', { class: 'row-between' },
        button('', { kind: 'text', icon: 'chevron_left', 'aria-label': t('cmp.m.prev'), onClick: () => { month = shift(month, -1); drawWhen(); } }),
        h('span', {}, period === 'month' ? monthLabel(month) : `${monthLabel(shift(month, 1 - ({ '3m': 3, '6m': 6, '12m': 12 }[period])))} – ${monthLabel(month)}`),
        button('', { kind: 'text', icon: 'chevron_right', 'aria-label': t('cmp.m.next'), disabled: month >= now, onClick: () => { month = shift(month, 1); drawWhen(); } })));
    go.replaceChildren(button(t('rep.excel'), { kind: 'primary', icon: 'table_view', disabled: busy || !report, onClick: () => download('xlsx') }),
      button(t('rep.pdf'), { icon: 'picture_as_pdf', disabled: busy || !report, onClick: () => download('pdf') }));
  }
  async function download(format) {
    busy = true; drawWhen(); msg.textContent = t('rep.making');
    try {
      const r = await ctx.api.call('reports.file', { report, period, month, format, lang: getLang() });
      saveFile(r);
      toast(t('rep.done', { name: r.filename }));
      if (r.truncated) toast(t('rep.cut'), 6000);
    } catch (e) { toast(friendly(e, t), 6000); }
    busy = false; msg.textContent = ''; drawWhen();
  }

  // The President's table: a tick per role and report. Each tick is saved at once and goes back if the save fails.
  async function loadAccess() {
    access.replaceChildren(loadingRegion(1));
    try {
      const g = await ctx.api.call('reports.access.get');
      const cell = (role, rep) => {
        const box = h('input', { type: 'checkbox', checked: !!g.grants[role][rep.key], 'aria-label': `${role}: ${title(rep)}`, onChange: async () => {
          const want = box.checked; box.disabled = true;
          try { await ctx.api.call('reports.access.set', { role, report: rep.key, allowed: want }); g.grants[role][rep.key] = want; toast(t('rep.access.saved')); }
          catch (e) { box.checked = !want; toast(friendly(e, t), 6000); }
          box.disabled = false;
        } });
        return h('td', {}, box);
      };
      access.replaceChildren(card(t('rep.access.title'), 'admin_panel_settings', h('p', { class: 'small muted' }, t('rep.access.help')),
        h('div', { style: 'overflow-x:auto' }, h('table', { class: 'rep-table' },
          h('thead', {}, h('tr', {}, h('th', {}, t('rep.access.role')), g.reports.map((r) => h('th', {}, title(r))))),
          h('tbody', {}, g.roles.map((role) => h('tr', {}, h('th', { scope: 'row' }, role), g.reports.map((r) => cell(role, r)))))))));
    } catch (e) { access.replaceChildren(errorState(friendly(e, t), loadAccess)); }
  }

  (async () => {
    try {
      const c = await ctx.api.call('reports.catalog');
      items = c.items; report = items[0]?.key || '';
      if (items.length) drawPick(); else dl.replaceChildren(emptyState(t('rep.none'), 'assessment'));
    } catch (e) { dl.replaceChildren(errorState(friendly(e, t), () => ctx.router?.refresh?.())); }
  })();
  if (can('roles_config', 'u')) loadAccess();
  return root;
}
