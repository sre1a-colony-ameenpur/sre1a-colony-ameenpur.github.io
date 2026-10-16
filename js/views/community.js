// Community landing: Polls | Meetings | Events | Members. Each tab is its own module.
import { h, segmented, emptyState } from '../ui.js';
import { isDevHost } from '../config.js';
import { can } from '../store.js';

let lastTab = (isDevHost() && new URLSearchParams(location.search).get('ctab')) || 'polls';   // ?ctab= opens a tab directly (dev and smoke)

export default async function render(ctx) {
  const { t } = ctx;
  const tabs = [can('polls', 'r') && ['polls', t('com.polls')], can('meetings', 'r') && ['meetings', t('com.meetings')], can('events', 'r') && ['events', t('com.events')], ['members', t('com.members')]].filter(Boolean);
  if (!tabs.length) return h('div', { class: 'page' }, h('h1', {}, t('nav.community')), emptyState(t('common.notAvailable'), 'lock'));
  if (!tabs.some(([k]) => k === lastTab)) lastTab = tabs[0][0];
  const body = h('div', { class: 'stack' });
  async function show(tab) {
    lastTab = tab; body.replaceChildren();
    const mod = await import(tab === 'polls' ? './polls.js' : tab === 'meetings' ? './meetings.js' : tab === 'members' ? './community_members.js' : './events.js');
    body.replaceChildren(await mod.default(ctx));
  }
  const root = h('div', { class: 'page stack' }, h('h1', {}, t('nav.community')), tabs.length > 1 ? segmented(tabs, lastTab, show, t('nav.community')) : null, body);
  show(lastTab);
  return root;
}
