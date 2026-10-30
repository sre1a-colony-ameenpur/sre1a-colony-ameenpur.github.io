// S4.5 Meeting detail: agenda, attendance, notes, action items.
import { h, card, button, field, statusPill, avatar, plotChip, errorState, loadingRegion, openSheet, toast, icon, toastError } from '../ui.js';
import { shareHead, entityPath, clip } from '../share.js';
import { friendly } from '../api.js';
import { dateShort, whenShort } from '../fmt.js';
import { can } from '../store.js';
import { agendaLines, meetingTitle } from './meetings.js';

const plot = (k) => plotChip(k.replace(/^([A-Z])(\d+)$/, '$1-$2'));

export default async function render(ctx) {
  const { t } = ctx;
  const root = h('div', { class: 'page stack' });

  async function load() {
    root.replaceChildren(loadingRegion(2));
    try {
      await ctx.api.swr('meetings.get', { id: ctx.params.id }, (d) => {
      const m = d.meeting, began = m.status !== 'scheduled';
      const setStatus = async (status) => { try { await ctx.api.call('meetings.update', { id: m.id, status }); load(); } catch (e) { toastError(friendly(e, t)); } };
      const needStart = () => h('p', { class: 'small muted' }, t('mtg.startFirst'));
      const item = (a, carried) => h('div', { class: 'list-row' },
        can('action_items', 'u') ? h('input', { type: 'checkbox', checked: a.status === 'done', style: 'width:24px;height:24px', 'aria-label': t('mtg.markDone'), onChange: async (e) => {
          try { await ctx.api.call('actionItems.update', { id: a.id, status: e.target.checked ? 'done' : 'open' }); load(); } catch (err) { e.target.checked = !e.target.checked; toastError(friendly(err, t)); }
        } }) : null,
        h('div', { class: 'grow' }, h('div', { class: a.status === 'done' ? 'muted' : '' }, a.text),
          h('div', { class: 'small muted' }, `${a.owner_name}${a.mine ? ` (${t('mtg.you')})` : ''} · ${t('mtg.due', { date: dateShort(a.due_date) })}`, carried ? ` · ${t('mtg.carried')}` : '')),
        a.overdue ? statusPill('overdue', t('mtg.overdue')) : a.status === 'done' ? statusPill('paid', t('mtg.done')) : null);
      const tag = (el, k) => { el.setAttribute('data-tour', k); return el; };
      root.replaceChildren(
        tag(card(null, null, shareHead(ctx, h('h2', {}, meetingTitle(m, t('mtg.meeting'))), { title: t('share.meeting', { title: clip(meetingTitle(m, t('mtg.meeting')), 60), when: whenShort(m.date, m.time) }), path: entityPath('/community/meetings', m.id) }), h('p', { class: 'muted' }, `${whenShort(m.date, m.time)} · ${m.place}`),
          h('div', { class: 'row' }, statusPill(m.status === 'held' ? 'paid' : 'open', t(m.status === 'held' ? 'mtg.held' : m.status === 'started' ? 'mtg.started' : 'mtg.scheduled')),
            can('meetings', 'u') && m.status === 'scheduled' ? button(t('mtg.start'), { 'data-tour': 'md-start', icon: 'play_arrow', onClick: () => setStatus('started') }) : null,
            can('meetings', 'u') && m.status === 'started' ? button(t('mtg.markHeld'), { 'data-tour': 'md-held', kind: 'text', onClick: () => setStatus('held') }) : null)), 'md-head'),
        tag(card(t('mtg.agenda'), 'format_list_numbered', agendaLines(m.agenda).length ? h('ol', { class: 'agenda' }, agendaLines(m.agenda).map((l) => h('li', {}, l))) : h('p', { class: 'muted' }, t('mtg.noAgenda'))), 'md-agenda'),
        tag(card(`${t('mtg.attendance')} (${d.attendees.length})`, 'groups',
          d.attendees.length ? h('div', { class: 'stack-sm' }, d.attendees.map((a) => h('div', { class: 'row' }, avatar(a.name), h('span', { class: 'grow' }, a.name), a.plot_keys.map(plot)))) : h('p', { class: 'muted' }, t('mtg.noAttendance')),
          !began ? needStart() : can('attendance', 'u') ? button(t('mtg.editAttendance'), { 'data-tour': 'md-att-btn', icon: 'how_to_reg', onClick: () => attendanceSheet(ctx, m.id, d.attendees, load) }) : null), 'md-att'),
        tag(card(t('mtg.notes'), 'sticky_note_2', m.notes ? h('p', { style: 'white-space:pre-wrap' }, m.notes) : h('p', { class: 'muted' }, t('mtg.noNotes')),
          can('notes', 'u') ? button(t('mtg.editNotes'), { 'data-tour': 'md-notes-btn', icon: 'edit_note', onClick: () => notesSheet(ctx, m, load) }) : null), 'md-notes'),
        tag(card(t('mtg.actionItems'), 'checklist', ...(d.action_items.length ? d.action_items.map((a) => item(a, false)) : [h('p', { class: 'muted' }, t('mtg.noItems'))]),
          d.carried_open.length ? h('h3', {}, t('mtg.carriedTitle')) : null, ...d.carried_open.map((a) => item(a, true)),
          !began ? needStart() : can('action_items', 'c') ? button(t('mtg.addItem'), { 'data-tour': 'md-item-btn', icon: 'add_task', onClick: () => itemSheet(ctx, m.id, load) }) : null), 'md-items'));
      });
    } catch (e) { root.replaceChildren(errorState(e.code === 'NOT_FOUND' ? t('mtg.notFound') : friendly(e, t), load)); }
  }
  load();
  return root;
}

async function memberList(ctx) { return (await ctx.api.swr('map.plots', {}, () => {})).members.filter((m) => m.plot_keys.length); }

async function attendanceSheet(ctx, id, current, done) {
  const { t } = ctx;
  const body = h('div', { class: 'stack-sm' }, loadingRegion(1));
  const here = new Set(current.map((a) => a.plot_keys[0]));
  openSheet({ title: t('mtg.editAttendance'), wide: true, body, actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      try { await ctx.api.call('attendance.set', { meeting_id: id, plotKeys: [...here] }); close(); toast(t('common.saved')); done(); } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
  try {
    const members = await memberList(ctx);
    const q = h('input', { type: 'search', class: 'map-q', placeholder: t('mt.search'), 'aria-label': t('mt.search'), style: 'border:1px solid var(--c-border);border-radius:var(--r);padding:0 12px' });
    const list = h('div', { class: 'stack-sm' });
    const draw = () => {
      const f = q.value.trim().toLowerCase().replace(/[\s-]/g, '');
      list.replaceChildren(...members.filter((m) => !f || (m.name + m.plot_keys.join('')).toLowerCase().replace(/[\s-]/g, '').includes(f)).map((m) => {
        const key = m.plot_keys[0];
        return h('label', { class: 'list-row', style: 'cursor:pointer' }, h('input', { type: 'checkbox', checked: here.has(key), style: 'width:24px;height:24px',
          onChange: (e) => { e.target.checked ? here.add(key) : here.delete(key); } }), h('span', { class: 'grow' }, m.name), m.plot_keys.map(plot));
      }));
    };
    q.addEventListener('input', draw); draw(); body.replaceChildren(q, list);
  } catch (e) { body.replaceChildren(errorState(friendly(e, t))); }
}

function notesSheet(ctx, m, done) {
  const { t } = ctx;
  const ta = h('textarea', { rows: 8, maxlength: 5000, 'aria-label': t('mtg.notes') }); ta.value = m.notes || '';
  openSheet({ title: t('mtg.editNotes'), body: h('div', { class: 'stack' }, ta, h('p', { class: 'small muted' }, t('mtg.notesNote'))), actions: [
    { label: t('mt.save'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      try { await ctx.api.call('meetings.update', { id: m.id, notes: ta.value.trim() }); close(); toast(t('common.saved')); done(); } catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}

async function itemSheet(ctx, meetingId, done) {
  const { t } = ctx;
  const text = field({ id: 'ai-t', label: t('mtg.task'), maxlength: 300 });
  const due = field({ id: 'ai-d', label: t('mtg.dueLabel'), type: 'date', value: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) });
  const sel = h('select', { id: 'ai-o' }, h('option', { value: '' }, t('common.loading')));
  const note = h('div', { role: 'alert' });
  memberList(ctx).then((ms) => sel.replaceChildren(h('option', { value: '' }, t('mtg.pickOwner')), ...ms.map((m) => h('option', { value: m.plot_keys[0] }, `${m.name} (${m.plot_keys.join(', ')})`)))).catch(() => {});
  openSheet({ title: t('mtg.addItem'), body: h('div', { class: 'stack' }, text, h('div', { class: 'field' }, h('label', { for: 'ai-o' }, t('mtg.owner')), sel), due, note), actions: [
    { label: t('mtg.addItem'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const tx = text.querySelector('input').value.trim();
      if (!tx || !sel.value) { note.replaceChildren(h('div', { class: 'banner warn' }, t('mtg.itemNeeded'))); return; }
      try { await ctx.api.call('actionItems.create', { meeting_id: meetingId, text: tx, owner_plot_key: sel.value, due_date: due.querySelector('input').value }); close(); toast(t('common.saved')); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
