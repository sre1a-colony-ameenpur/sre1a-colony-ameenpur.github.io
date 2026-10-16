// S6.6 President handover wizard: choose the new President, review, account checklist, type HANDOVER, success. One call to members.handover.
import { h, button, card, avatar, plotChip, emptyState, errorState, loadingRegion, icon, toast } from '../ui.js';
import { friendly } from '../api.js';

const norm = (s) => String(s).toLowerCase().replace(/[\s-]/g, '');
const dashKey = (k) => String(k).toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2');
const keysOf = (m) => String(m.plot_keys || '').split(',').filter(Boolean);
const STEPS = 4, CHECKS = ['pw', 'recovery', 'twostep', 'codes'];

export default function render(ctx) {
  const { t } = ctx;
  let members = [], me = null, step = 1, pick = null, q = '', ticked = new Set(), busy = false;
  const body = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('menu.handover')), body);

  async function load() {
    body.replaceChildren(loadingRegion(2));
    try {
      members = (await ctx.api.call('members.list')).items.filter((m) => m.active === true || String(m.active) === 'true');
      me = (await ctx.api.call('session.get')).email;
      draw();
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }

  const progress = () => h('div', { class: 'stack-sm' }, h('div', { class: 'small muted', 'aria-live': 'polite' }, t('ho.step', { n: step, total: STEPS })),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': STEPS, 'aria-valuenow': step }, h('i', { style: `width:${(step / STEPS) * 100}%` })));
  const nav = (next, nextLabel, disabled, danger) => h('div', { class: 'row', style: 'gap:8px' },
    step > 1 ? button(t('ho.back'), { onClick: () => { step--; draw(); } }) : null,
    button(nextLabel, { kind: danger ? 'danger solid' : 'primary', disabled, onClick: next }));

  function draw() {
    const view = [stepOne, stepTwo, stepThree, stepFour][step - 1]();
    body.replaceChildren(progress(), view);
  }

  function stepOne() {
    const search = h('input', { id: 'ho-q', type: 'search', value: q, placeholder: t('ho.search'), 'aria-label': t('ho.search'), autocomplete: 'off' });
    const list = h('div', { class: 'card' });
    const drawList = () => {
      const rows = members.filter((m) => m.email !== me && m.role !== 'President' && (!q || norm(`${m.name} ${m.plot_keys}`).includes(norm(q))));
      list.replaceChildren(...(rows.length ? rows.slice(0, 40).map((m) => h('button', { type: 'button', class: 'list-row', style: 'width:100%;text-align:start', 'aria-pressed': String(pick?.email === m.email),
        onClick: () => { pick = m; draw(); } }, avatar(m.name), h('div', { class: 'grow' }, h('div', {}, m.name), h('div', { class: 'small muted row', style: 'gap:6px' }, m.role, keysOf(m).map((k) => plotChip(dashKey(k))))),
        pick?.email === m.email ? icon('check_circle') : null)) : [emptyState(t('ho.none'), 'person_search')]));
    };
    search.addEventListener('input', (e) => { q = e.target.value; drawList(); });
    drawList();
    return h('div', { class: 'stack' }, h('p', {}, t('ho.choose')), h('div', { class: 'field' }, h('label', { for: 'ho-q' }, t('ho.search')), search), list,
      nav(() => { step = 2; draw(); }, t('ho.next'), !pick));
  }

  const stepTwo = () => h('div', { class: 'stack' },
    card(t('ho.reviewTitle'), 'swap_horiz', h('p', {}, t('ho.review1', { name: pick.name })), h('p', {}, t('ho.review2')), h('p', {}, t('ho.review3')), h('p', { class: 'small muted' }, t('ho.review4'))),
    nav(() => { step = 3; draw(); }, t('ho.next')));

  function stepThree() {
    return h('div', { class: 'stack' }, card(t('ho.accountTitle'), 'key', h('p', {}, t('ho.accountHelp')),
      h('div', { class: 'stack-sm' }, CHECKS.map((k) => h('label', { class: 'row', style: 'gap:10px;align-items:flex-start;min-height:44px' },
        h('input', { type: 'checkbox', id: `ho-c-${k}`, checked: ticked.has(k), style: 'width:24px;height:24px;flex:none',
          onChange: (e) => { e.target.checked ? ticked.add(k) : ticked.delete(k); draw(); } }), h('span', {}, t(`ho.chk.${k}`)))))),
      nav(() => { step = 4; draw(); }, t('ho.next'), ticked.size < CHECKS.length));
  }

  function stepFour() {
    const word = h('input', { id: 'ho-word', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    const go = button(t('ho.confirm'), { kind: 'danger solid', disabled: true, onClick: () => run(word.value) });
    word.addEventListener('input', () => { go.disabled = word.value !== 'HANDOVER'; });
    return h('div', { class: 'stack' }, card(t('ho.confirmTitle'), 'warning', h('p', {}, t('ho.confirmText', { name: pick.name })),
      h('div', { class: 'field' }, h('label', { for: 'ho-word' }, t('ho.type')), word)),
      h('div', { class: 'row', style: 'gap:8px' }, button(t('ho.back'), { onClick: () => { step = 3; draw(); } }), go));
  }

  async function run(word) {
    if (busy) return; busy = true;
    try { done(await ctx.api.call('members.handover', { email: pick.email, confirm: word })); } catch (e) { toast(friendly(e, t)); } finally { busy = false; }
  }

  function done(r) {
    // The signed-in person is now a Member, so the menu and rights must be re-read from the server.
    body.replaceChildren(card(t('ho.doneTitle'), 'check_circle', h('p', {}, t('ho.done', { name: r.newPresident })), h('p', {}, t('ho.doneNext'))),
      button(t('ho.finish'), { kind: 'primary', block: true, onClick: () => { location.hash = '#/home'; location.reload(); } }));
  }

  load();
  return root;
}
