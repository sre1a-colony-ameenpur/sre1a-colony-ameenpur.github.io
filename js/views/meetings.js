// S4.4 Meetings list (upcoming highlighted, open action items) and new meeting sheet.
import { h, button, fab, field, statusPill, emptyState, errorState, loadingRegion, openSheet, toast, icon, toastError } from '../ui.js';
import { appendPage } from '../paging.js';
import { friendly } from '../api.js';
import { whenShort } from '../fmt.js';
import { can } from '../store.js';

export const agendaLines = (a) => String(a || '').split('\n').map((x) => x.trim()).filter(Boolean);
export const meetingTitle = (m, fallback) => agendaLines(m.agenda)[0] || fallback;

export default async function render(ctx) {
  const { t } = ctx;
  const list = h('div', { class: 'stack-sm' });
  let all = [], cursor = null, openItems = { items: [] };
  const more = h('div');
  function draw() {
    const items = all, open = openItems;
    {
      const counts = {}; open.items.forEach((a) => { counts[a.meeting_id] = (counts[a.meeting_id] || 0) + 1; });
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = items.filter((m) => m.status !== 'held' && m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      const rest = items.filter((m) => !upcoming.includes(m));
      const card = (m, hi) => h('a', { class: `card${hi ? ' accent' : ''}`, href: `#/community/meetings/${m.id}`, style: 'display:block;text-decoration:none;color:inherit' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, h('strong', {}, meetingTitle(m, t('mtg.meeting'))), hi ? statusPill('open', t('mtg.upcoming')) : null),
        h('div', { class: 'small muted' }, `${whenShort(m.date, m.time)} · ${m.place}`),
        counts[m.id] ? h('div', { class: 'small', style: 'margin-top:8px' }, icon('checklist', 'sm'), ' ', t('mtg.openItems', { n: counts[m.id] })) : null);
      list.replaceChildren(...(items.length ? [...upcoming.map((m, i) => card(m, i === 0)), ...rest.map((m) => card(m, false))] : [emptyState(t('mtg.none'), 'event_note')]));
      more.replaceChildren(...(cursor ? [button(t('audit.more'), { block: true, onClick: () => load(true) })] : []));
    }
  }
  async function load(older = false) {
    if (!older && !all.length) list.replaceChildren(loadingRegion(2));
    try {
      if (older) { ({ items: all, cursor } = appendPage(all, await ctx.api.call('meetings.list', { before: cursor }))); draw(); return; }
      if (can('action_items', 'r')) ctx.api.swr('actionItems.list', { status: 'open' }, (r) => { openItems = r; if (all.length) draw(); }).catch(() => {});
      await ctx.api.swr('meetings.list', {}, (r) => { all = r.items; cursor = r.next_cursor || null; draw(); });
    } catch (e) { list.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return h('div', { class: 'stack' }, can('action_items', 'r') ? h('a', { class: 'btn', href: '#/community/action-items', style: 'align-self:flex-start' }, icon('checklist'), t('ai.title')) : null, list, more, can('meetings', 'c') ? fab(t('mtg.new'), () => newSheet(ctx, load)) : null);
}

function newSheet(ctx, done) {
  const { t } = ctx;
  const date = field({ id: 'mt-d', label: t('exp.date'), type: 'date', value: new Date().toISOString().slice(0, 10) });
  const time = field({ id: 'mt-t', label: t('mtg.time'), type: 'time', required: true });
  const place = field({ id: 'mt-p', label: t('mtg.place'), maxlength: 120 });
  const agenda = h('div', { class: 'field' }, h('label', { for: 'mt-a' }, t('mtg.agenda')), h('textarea', { id: 'mt-a', rows: 5, maxlength: 2000 }), h('div', { class: 'help' }, t('mtg.agendaHelp')));
  const note = h('div', { role: 'alert' });
  openSheet({ title: t('mtg.new'), body: h('div', { class: 'stack' }, h('div', { class: 'row', style: 'gap:var(--s3);align-items:flex-start' }, h('div', { style: 'flex:1' }, date), h('div', { style: 'flex:1' }, time)), place, agenda, note), actions: [
    { label: t('mtg.create'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const pl = place.querySelector('input').value.trim();
      if (!pl) { note.replaceChildren(h('div', { class: 'banner warn' }, t('mtg.placeNeeded'))); return; }
      const tm = time.querySelector('input').value;
      if (!tm) { note.replaceChildren(h('div', { class: 'banner warn' }, t('mtg.timeNeeded'))); return; }
      try { await ctx.api.call('meetings.create', { date: date.querySelector('input').value, time: tm, place: pl, agenda: agenda.querySelector('textarea').value.trim() }); close(); toast(t('mtg.created')); done(); }
      catch (e) { toastError(friendly(e, t)); }
    } }, { label: t('common.cancel') }] });
}
