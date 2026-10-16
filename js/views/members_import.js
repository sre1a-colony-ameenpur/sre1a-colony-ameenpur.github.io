// S6.8 Load members from a sheet (President): check the sheet, read every problem in plain words, then load. Nothing is saved until the sheet is clean.
import { h, button, card, statusPill, errorState, confirmSheet, icon, toast } from '../ui.js';
import { friendly } from '../api.js';
import { money } from '../fmt.js';

const sentence = (m) => { const s = String(m).charAt(0).toUpperCase() + String(m).slice(1); return /[.!?]$/.test(s) ? s : `${s}.`; };

const BATCH = 100;                                         // rows loaded per call, so a long sheet never runs into the time limit

export default function render(ctx) {
  const { t } = ctx;
  let busy = false;
  const body = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('div', { class: 'row-between' }, h('h1', { style: 'margin:0' }, t('imp.title')),
    button(t('imp.back'), { kind: 'text', icon: 'arrow_back', href: '#/members' })), body);

  const guide = () => card(t('imp.guideTitle'), 'list_alt', h('ol', { class: 'stack-sm', style: 'padding-inline-start:20px' },
    h('li', {}, t('imp.g1')), h('li', {}, t('imp.g2')), h('li', {}, t('imp.g3'))));

  function start(note) {
    body.replaceChildren(guide(), note || null, button(t('imp.check'), { kind: 'primary', block: true, icon: 'fact_check', onClick: runCheck }));
  }

  async function runCheck() {
    if (busy) return; busy = true;
    body.replaceChildren(guide(), h('p', { role: 'status', class: 'muted' }, t('imp.checking')));
    try { show(await ctx.api.call('members.importCheck')); } catch (e) { body.replaceChildren(errorState(friendly(e, t), runCheck)); } finally { busy = false; }
  }

  // One collapsible list per kind of row, each row by name and plots (no emails or mobiles are ever sent to this screen).
  const rowsList = (title, rows) => (rows.length ? h('details', { class: 'acc' }, h('summary', {}, h('span', {}, `${title} (${rows.length})`), icon('expand_more')),
    h('ul', { class: 'stack-sm acc-body', style: 'padding-inline-start:20px' }, rows.map((x) => h('li', {}, h('strong', {}, x.name || t('imp.row', { n: x.row })),
      x.plots?.length ? ` · ${x.plots.join(', ')}` : '', h('span', { class: 'small muted' }, ` · ${t('imp.row', { n: x.row })}`.replace(/:$/, ''))))))
    : null);

  function show(r) {
    const { counts: c } = r, problems = r.rows.filter((x) => x.status === 'error');
    const clean = problems.length === 0 && c.new + c.update > 0;
    body.replaceChildren(guide(),
      card(t('imp.result'), 'fact_check',
        h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' }, ['new', 'update', 'unchanged', 'error'].map((k) => statusPill(k === 'error' && c[k] ? 'rejected' : k === 'new' ? 'approved' : 'closed', t(`imp.c.${k}`, { n: c[k] })))),
        r.feeCount ? h('p', {}, t('imp.fees', { n: r.feeCount, amount: money(r.feeTotalPaise) })) : null,
        problems.length ? h('ul', { class: 'stack-sm', style: 'padding-inline-start:20px' }, problems.map((x) => h('li', {}, h('strong', {}, t('imp.row', { n: x.row })), ' ', sentence(x.message)))) : null,
        !problems.length && !clean ? h('p', { class: 'muted' }, t('imp.empty')) : null),
      rowsList(t('imp.list.new'), r.rows.filter((x) => x.status === 'new')),
      rowsList(t('imp.list.update'), r.rows.filter((x) => x.status === 'update')),
      problems.length ? h('p', { class: 'why' }, icon('info', 'sm'), ' ', t('imp.fix')) : null,
      h('div', { class: 'stack-sm' }, button(t('imp.load'), { kind: 'primary', block: true, icon: 'upload', disabled: !clean, onClick: () => confirmLoad(c.new + c.update) }),
        button(t('imp.checkAgain'), { block: true, onClick: runCheck })));
  }

  async function confirmLoad(n) {
    if (!(await confirmSheet(t('imp.confirmTitle', { n }), t('imp.confirmText'), { confirmLabel: t('imp.load') }))) return;
    if (busy) return; busy = true;
    const total = { added: 0, updated: 0, unchanged: 0, feesRaised: 0, driveSyncFailed: 0, loaded: [] };
    try {
      let left = n;
      for (;;) {
        body.replaceChildren(guide(), h('p', { role: 'status', class: 'muted' }, t('imp.loading', { done: total.loaded.length, n })));
        const r = await ctx.api.call('members.importApply', { limit: BATCH });
        for (const k of ['added', 'updated', 'feesRaised', 'driveSyncFailed']) total[k] += r[k];
        total.unchanged = r.unchanged; total.loaded.push(...r.loaded); left = r.remaining;
        if (!left || !r.loaded.length) break;
      }
      done(total);
    } catch (e) {
      const d = e?.extra?.details;
      if (d?.rows) { toast(t('imp.nothing')); show(d); }
      else if (total.loaded.length) { toast(friendly(e, t)); body.replaceChildren(card(t('imp.partialTitle'), 'warning', h('p', {}, t('imp.partial', { n: total.loaded.length })),
        h('p', { class: 'small muted' }, t('imp.partialAgain'))), button(t('imp.checkAgain'), { kind: 'primary', block: true, onClick: runCheck })); }
      else { toast(friendly(e, t)); show(await ctx.api.call('members.importCheck')); }
    } finally { busy = false; }
  }

  function done(r) {
    body.replaceChildren(card(t('imp.doneTitle'), 'check_circle', h('p', {}, t('imp.done', { added: r.added, updated: r.updated, unchanged: r.unchanged })),
      rowsList(t('imp.list.loaded'), r.loaded || []),
      r.feesRaised ? h('p', {}, t('imp.doneFees', { n: r.feesRaised })) : null,
      r.driveSyncFailed ? h('p', { class: 'why' }, t('imp.driveFail', { n: r.driveSyncFailed })) : null,
      h('p', { class: 'small muted' }, t('imp.noMessage'))),
      button(t('imp.toMembers'), { kind: 'primary', block: true, href: '#/members' }));
  }

  start();
  return root;
}
