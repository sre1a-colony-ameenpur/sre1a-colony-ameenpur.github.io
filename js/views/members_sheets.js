// S6.2 Add / edit member sheet, role change and replace-holder confirmations, remove confirmation.
import { h, button, field, openSheet, confirmSheet, toast, icon, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort, money } from '../fmt.js';
import { can, store, hasModule } from '../store.js';
import { ROLES, loadRoles, dashKey, plotsOf } from './members.js';

const val = (el) => el.querySelector('input,select').value.trim();
const today = () => new Date().toISOString().slice(0, 10);

// Membership fee for a set of plot keys, by the rule: the house rate if any plot is a house, otherwise the open-plot rate. null = cannot tell.
export async function feeForPlots(ctx, plotKeys) {
  if (!hasModule('fees')) return 0;                                  // Fees switched off: no membership fee
  try {
    const [{ items: plots }, { items: rates }] = await Promise.all([ctx.api.call('plots.list'), ctx.api.call('membership.rates.list')]);
    const cats = plotKeys.map((k) => plots.find((p) => p.plot_key === k)?.category).filter(Boolean);
    if (!cats.length) return null;
    const cat = cats.includes('house') ? 'house' : 'open', today = new Date().toISOString().slice(0, 10);
    const r = rates.filter((x) => x.category === cat && x.from_date <= today).sort((a, b) => b.from_date.localeCompare(a.from_date))[0];
    return r ? r.amount_paise : 0;
  } catch { return null; }
}

// member null = add. items = every member row (to show who holds a plot and earlier removals).
export function memberSheet(ctx, { member, items, done }) {
  const { t } = ctx;
  const editing = !!member;
  const me = store.get().session;
  const isPresident = me.role === 'President';
  const note = h('div', { role: 'alert' });
  const showErr = (text) => note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, icon('error', 'sm'), text));

  const email = field({ id: 'mem-email', label: t('mem.email'), type: 'email', value: member?.email || '', help: t('mem.emailHelp'), disabled: editing, autocapitalize: 'none', autocomplete: 'off' });
  const name = field({ id: 'mem-name', label: t('mem.name'), value: member?.name || '', maxlength: 80 });
  const mobile = field({ id: 'mem-mobile', label: t('mem.mobile'), type: 'tel', value: member?.mobile || '', maxlength: 20 });

  // Plots: editable chips on add; read-only on edit (changes go through a plot request or transfer).
  const plots = editing ? plotsOf(member) : [];
  const plotBox = h('div', { class: 'row' });
  const plotErr = h('div', { class: 'err small', role: 'alert' });
  const plotIn = field({ id: 'mem-plot', label: t('mem.plotAdd'), help: t('req.plotHelp'), autocapitalize: 'characters' });
  const feePlot = h('div');
  let joinReady = false, feeSeq = 0;   // drawJoin exists only after the plot chips are first drawn
  const drawPlots = () => {
    plotBox.replaceChildren(...(plots.length ? plots.map((k) => h('span', { class: 'chip on' }, dashKey(k),
      editing ? null : h('button', { type: 'button', class: 'icon-btn', style: 'width:24px;height:24px', 'aria-label': t('mem.removePlot', { plot: dashKey(k) }),
        onClick: () => { plots.splice(plots.indexOf(k), 1); drawPlots(); } }, icon('close', 'sm')))) : [h('span', { class: 'small muted' }, t('mem.noPlots'))]));
    if (editing) return;
    if (!editing) refreshFee();
    feePlot.replaceChildren(plots.length > 1 ? h('p', { class: 'small muted' }, t('mem.feeOnce')) : '');   // one fee per member, by the rule: house if any house, else open
  };
  const addPlot = () => {
    plotErr.textContent = '';
    const raw = val(plotIn).toUpperCase().replace(/\s/g, '');       // the key as written in the plots sheet, e.g. A-67/P
    if (!/^(?=.*[A-Z])(?=.*\d)[A-Z0-9\/-]{1,20}$/.test(raw)) { plotErr.textContent = t('mem.plotUnknown'); return; }
    if (plots.includes(raw)) { plotIn.querySelector('input').value = ''; return; }
    const owner = items.find((m) => m.active && plotsOf(m).includes(raw));
    if (owner) {
      // The President (or anyone allowed to transfer) can act on it: the link opens Plots, where Transfer a plot lives.
      plotErr.replaceChildren(t(can('plot_transfer', 'c') ? 'mem.plotTakenMove' : 'mem.plotTaken', { name: owner.name }),
        ...(can('plot_transfer', 'c') ? [' ', h('a', { href: '#/plots', onClick: () => document.querySelector('dialog.sheet')?.close() }, t('mem.plotTakenLink'))] : []));
      return;
    }
    plots.push(raw); plotIn.querySelector('input').value = ''; drawPlots();
  };
  plotIn.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPlot(); } });
  drawPlots();

  function refreshFee() {
    const seq = ++feeSeq;
    if (!joinReady) return;
    if (!plots.length) { feeAmount = null; drawJoin(); return; }
    feeForPlots(ctx, plots).then((a) => { if (seq === feeSeq) { feeAmount = a; drawJoin(); } });
  }
  // Joining type (add only). Only the President may add an existing member (no fee).
  let joining = 'new', feeAmount = null;
  const joinBox = h('div', { class: 'stack-sm' });
  const former = h('p', { class: 'small', role: 'status' });
  const drawJoin = () => joinBox.replaceChildren(
    isPresident ? h('div', { class: 'seg', role: 'group', 'aria-label': t('mem.joining') }, [['new', t('mem.joinNew')], ['existing', t('mem.joinExisting')]].map(([v, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(v === joining), onClick: () => { joining = v; drawJoin(); } }, label))) : '',
    !hasModule('fees') ? null : h('p', { class: 'small muted', 'aria-live': 'polite' }, joining === 'new' ? (feeAmount == null ? t('mem.feeApplies') : feeAmount > 0 ? t('mem.feeAmount', { amount: money(feeAmount) }) : t('mem.feeNone')) : t('mem.noFee')));
  const date = field({ id: 'mem-date', label: t('mem.joinedAt'), type: 'date', value: today(), max: today() });
  joinReady = true;
  if (!editing) {
    drawJoin();
    email.querySelector('input').addEventListener('input', () => {
      const old = items.find((m) => !m.active && m.email.toLowerCase() === val(email).toLowerCase());
      former.textContent = old ? t('mem.formerNote', { date: dateShort(old.removed_at) }) : '';
      if (old) { joining = 'new'; drawJoin(); }
    });
  }

  // Role (edit only; the President is never offered and cannot change their own role).
  const target = editing && member.role === 'President';
  const self = editing && member.email.toLowerCase() === me.email.toLowerCase();
  const role = editing && can('roles_config', 'u') ? h('div', { class: 'field' }, h('label', { for: 'mem-role' }, t('mem.role')),
    h('select', { id: 'mem-role', disabled: target || self }, target ? h('option', {}, member.role) : ROLES.map((r) => h('option', { value: r, selected: r === member.role }, r))),
    target || self ? h('div', { class: 'help' }, t(target ? 'mem.presidentRole' : 'mem.ownRole')) : null) : null;

  async function save(close) {
    note.replaceChildren();
    const n = val(name), m = val(mobile);
    let mailed;                                           // undefined = not an add; true or false = the welcome email went out or not
    if (!n) return showErr(t('mem.needName'));
    try {
      if (editing) {
        if (n !== member.name || m !== (member.mobile || '')) await ctx.api.call('members.update', { email: member.email, name: n, mobile: m });
        const newRole = role && !target && !self ? val(role) : member.role;
        if (newRole !== member.role && !(await changeRole(ctx, member, newRole))) { done(); return; }
      } else {
        const em = val(email);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return showErr(t('mem.needEmail'));
        if (!plots.length) return showErr(t('mem.needPlot'));
        const body = { email: em, name: n, mobile: m, plot_keys: plots, joiningType: joining, joinedAt: val(date) };
        const r = await ctx.api.call('members.add', body);
        mailed = r.welcome_mail;
      }
      close();
      if (mailed === undefined) toast(t('common.saved'));
      else if (mailed) toast(t('mem.welcomeSent', { email: val(email) }), 6000);
      else toast(t('mem.welcomeFailed', { name: n }), 12000, 'warning');
      done();
    } catch (e) { toastError(friendly(e, t)); }
  }

  const removeBtn = editing && can('members', 'd') && !target && !self ? button(t('mem.remove'), { kind: 'danger', block: true, icon: 'person_remove', onClick: async () => {
    if (!(await confirmSheet(t('mem.removeTitle', { name: member.name }), t('mem.removeText'), { confirmLabel: t('mem.remove'), danger: true }))) return;
    try { await ctx.api.call('members.remove', { email: member.email }); document.querySelector('dialog.sheet')?.close(); toast(t('mem.removedToast')); done(); } catch (e) { toastError(friendly(e, t)); }
  } }) : null;

  openSheet({ title: editing ? t('mem.edit') : t('mem.add'), wide: true,
    actions: [can('members', editing ? 'u' : 'c') ? { label: t('mem.save'), kind: 'primary', keepOpen: true, onClick: save } : null, { label: t('common.cancel') }].filter(Boolean),
    body: h('div', { class: 'stack' }, email, former, name, mobile,
      h('div', { class: 'stack-sm' }, h('div', { class: 'label small', style: 'font-weight:500' }, t('mem.plots')), plotBox,
        editing ? h('p', { class: 'small muted' }, t('mem.plotsReadonly')) : [plotIn, button(t('mem.addPlotBtn'), { icon: 'add', onClick: addPlot }), plotErr, feePlot]),
      editing ? null : [joinBox, date], role, h('p', { class: 'small muted' }, t('mem.noEmailSent')), note),
    footer: removeBtn });
}

// Role change: confirm, then setRole; a held one-holder role asks to replace. Returns true when the role changed.
async function changeRole(ctx, member, newRole) {
  const { t } = ctx;
  if (!(await confirmSheet(t('mem.roleTitle'), t('mem.roleText', { name: member.name, role: newRole }), { confirmLabel: t('common.confirm') }))) return false;
  try { await ctx.api.call('members.setRole', { email: member.email, role: newRole }); return true; } catch (e) {
    const holder = e.extra?.details?.holder;
    if (e.code !== 'CONFLICT' || !holder) throw e;
    if (!(await confirmSheet(t('mem.replaceTitle'), t('mem.replaceText', { holder: holder.name, role: newRole }), { confirmLabel: t('mem.replace') }))) return false;
    await ctx.api.call('members.setRole', { email: member.email, role: newRole, replace: true });
    return true;
  }
}
