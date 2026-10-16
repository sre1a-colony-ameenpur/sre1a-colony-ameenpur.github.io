// S6.7 Transfer a plot: plot and owner, receiver, review (dry run), confirm. Calls plots.transferPreview then plots.transfer.
import { h, button, field, plotChip, openSheet, toast, icon, emptyState } from '../ui.js';
import { friendly } from '../api.js';
import { money, dateShort } from '../fmt.js';
import { can } from '../store.js';

const dash = (k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2');
const keysOf = (m) => String(m.plot_keys || '').split(',').filter(Boolean);
const norm = (s) => String(s).toLowerCase().replace(/[\s-]/g, '');
const today = () => new Date().toISOString().slice(0, 10);

export async function transferSheet(ctx, { plot, done }) {
  const { t } = ctx;
  let members = [];
  try { members = (await ctx.api.call('members.list')).items.filter((m) => m.active); } catch (e) { toast(friendly(e, t)); return; }
  const key = plot.plot_key;
  const owner = members.find((m) => keysOf(m).includes(key));
  const st = { step: 1, kind: owner ? 'existing' : 'new', pick: null, q: '', preview: null };
  const date = field({ id: 'tr-date', label: t('tr.date'), type: 'date', value: today() });
  const note = field({ id: 'tr-note', label: t('tr.note'), maxlength: 300 });
  const nm = { email: field({ id: 'tr-email', label: t('mem.email'), type: 'email', autocapitalize: 'none' }), name: field({ id: 'tr-name', label: t('mem.name'), maxlength: 80 }),
    mobile: field({ id: 'tr-mobile', label: t('mem.mobile'), type: 'tel', maxlength: 20 }) };
  const v = (f) => f.querySelector('input').value.trim();
  const msg = h('div', { role: 'alert' });
  const err = (text) => msg.replaceChildren(text ? h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error', 'sm'), text) : '');

  const dlg = openSheet({ title: t('tr.title'), wide: true, body: h('div'), actions: [] });
  const sheetIn = dlg.el.querySelector('.sheet-in');
  const to = () => (st.kind === 'none' ? { none: true } : st.kind === 'existing' ? { existingEmail: st.pick.email } : { newMember: { email: v(nm.email), name: v(nm.name), mobile: v(nm.mobile) } });
  const payload = () => ({ plotKey: key, to: to(), effectiveDate: v(date) || today(), note: v(note) });

  function render() {
    const bar = h('div', { class: 'progress', role: 'img', 'aria-label': t('tr.step', { n: st.step, total: 4 }) }, h('i', { style: `width:${st.step * 25}%` }));
    const parts = [h('h2', { id: 'sheet-title' }, t('tr.title')), st.step <= 4 ? [bar, h('p', { class: 'small muted' }, t('tr.step', { n: st.step, total: 4 }))] : null, body(), msg, h('div', { class: 'btn-row' }, ...actions())];
    sheetIn.replaceChildren(...parts.flat().filter(Boolean));
  }
  function actions() {
    const cancel = button(t('common.cancel'), { block: true, onClick: () => dlg.close() });
    const back = button(t('common.back'), { block: true, onClick: () => { err(''); st.step--; render(); } });
    if (st.step === 1) return [button(t('tr.next'), { kind: 'primary', block: true, onClick: () => { st.step = 2; render(); } }), cancel];
    if (st.step === 2) return [button(t('tr.next'), { kind: 'primary', block: true, onClick: toReview }), back, cancel];
    if (st.step === 3) return [button(t('tr.next'), { kind: 'primary', block: true, onClick: () => { st.step = 4; render(); } }), back, cancel];
    if (st.step === 4) return [button(t('tr.confirm'), { kind: 'primary', block: true, icon: 'swap_horiz', onClick: confirm }), back, cancel];
    return [button(t('tr.done'), { kind: 'primary', block: true, onClick: () => { dlg.close(); done(); } })];
  }
  async function toReview() {
    err('');
    if (st.kind === 'existing' && !st.pick) return err(t('tr.needPick'));
    if (st.kind === 'new' && (!v(nm.name) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(nm.email)))) return err(t('tr.needNew'));
    try { st.preview = await ctx.api.call('plots.transferPreview', payload()); st.step = 3; render(); } catch (e) { err(friendly(e, t)); }
  }
  async function confirm() {
    err('');
    try { st.result = await ctx.api.call('plots.transfer', payload()); st.step = 5; render(); done(); } catch (e) { err(friendly(e, t)); }
  }

  function body() {
    if (st.step === 1) {
      return h('div', { class: 'stack' }, h('div', { class: 'row' }, plotChip(plot.plot_label), h('span', { class: 'muted' }, plot.category ? t(`plots.cat.${plot.category}`) : t('plots.cat.none'))),
        owner ? h('div', {}, h('div', { class: 'small muted' }, t('tr.currentOwner')), h('strong', {}, owner.name),
          h('div', { class: 'row', style: 'margin-top:4px' }, keysOf(owner).filter((k) => k !== key).map((k) => plotChip(dash(k))))) : h('p', {}, t('tr.noOwner')));
    }
    if (st.step === 2) {
      const kinds = [['existing', t('tr.existing')], ['new', t('tr.new')], ...(owner ? [['none', t('tr.none')]] : [])];
      const sub = h('div', { class: 'stack-sm' });
      const drawSub = () => {
        if (st.kind === 'existing') {
          const list = h('div');
          const drawList = () => {
            const m = members.filter((x) => x !== owner && norm(`${x.name} ${x.plot_keys}`).includes(norm(st.q))).slice(0, 8);
            list.replaceChildren(...(m.length ? m.map((x) => h('button', { type: 'button', class: 'list-row map-row', style: 'width:100%;text-align:start', 'aria-pressed': String(st.pick === x),
              onClick: () => { st.pick = x; drawList(); } }, h('div', { class: 'grow' }, h('div', { style: 'font-weight:600' }, x.name),
              h('div', { class: 'row' }, keysOf(x).map((k) => plotChip(dash(k))))), st.pick === x ? icon('check_circle') : null)) : [emptyState(t('mem.none'), 'group')]));
          };
          const s = field({ id: 'tr-q', label: t('tr.search'), type: 'search', value: st.q, autocomplete: 'off' });
          s.querySelector('input').addEventListener('input', (e) => { st.q = e.target.value; drawList(); });
          drawList(); sub.replaceChildren(s, list);
        } else if (st.kind === 'new') sub.replaceChildren(nm.email, nm.name, nm.mobile, h('p', { class: 'small muted' }, t('mem.noEmailSent')));
        else sub.replaceChildren(h('p', { class: 'small muted' }, t('tr.noneHelp')));
      };
      drawSub();
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('tr.receiver') }, kinds.map(([k, label]) => h('button', { type: 'button', 'aria-pressed': String(k === st.kind),
        onClick: () => { st.kind = k; err(''); render(); } }, label)));
      return h('div', { class: 'stack' }, seg, sub, date, note);
    }
    if (st.step === 3 || st.step === 4) {
      const p = st.preview, when = dateShort(v(date) || today());
      const lines = [h('p', {}, p.movesTo ? t('tr.moves', { plot: plot.plot_label, from: p.movesFrom?.name || t('tr.nobody'), to: p.movesTo.name, date: when })
        : t('tr.movesNone', { plot: plot.plot_label, from: p.movesFrom?.name || t('tr.nobody'), date: when }))];
      p.removedMembers.forEach((m) => lines.push(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('person_remove'), t('tr.removed', { name: m.name }))));
      p.keptMembers.forEach((m) => lines.push(h('div', { class: 'banner ok', style: 'border-radius:12px' }, icon('verified_user'), t('tr.kept', { name: m.name }))));
      if (p.unpaidMaintenance_paise) lines.push(h('p', { class: 'banner info', style: 'border-radius:12px' }, icon('info'), t('tr.unpaid', { name: p.movesFrom.name, amount: money(p.unpaidMaintenance_paise) })));
      if (st.kind === 'new') lines.push(h('p', {}, p.feeAmount_paise != null ? t('tr.fee', { amount: money(p.feeAmount_paise), name: p.movesTo.name }) : t('tr.noFeeRate')));
      if (st.kind === 'existing') lines.push(h('p', {}, t('tr.noFee', { name: p.movesTo.name })));
      if (st.step === 4) lines.push(h('p', { class: 'small muted' }, t('tr.confirmText')));
      return h('div', { class: 'stack' }, ...lines);
    }
    const r = st.result;
    return h('div', { class: 'stack' }, h('div', { class: 'state ok' }, icon('check_circle', 'lg'), h('p', {}, t('tr.success'))),
      ...(r.removed || []).map((m) => h('p', {}, t('tr.removed', { name: m.name }))), r.added ? h('p', {}, t('tr.added', { name: r.added.name })) : null,
      r.feeId ? h('p', {}, t('tr.feeRaised')) : r.fee_skipped ? h('p', { class: 'small muted' }, t('tr.noFeeRate')) : null,
      r.feeId && can('fee_requests', 'r') ? button(t('tr.viewFee'), { icon: 'badge', onClick: async () => {
        dlg.close(); (await import('./money.js')).setMoneyTab('fees'); (await import('./fees.js')).setFeesTab('membership');
        location.hash = '#/money';
      } }) : null);
  }
  render();
}
