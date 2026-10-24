// What's new: release notes for members, newest first. Content lives in js/releases.js.
import { h, icon } from '../ui.js';
import { RELEASES, latestRelease } from '../releases.js';
import { dateShort } from '../fmt.js';

export const SEEN_KEY = 'sre.whatsNewSeen';

export default function render(ctx) {
  const { t, lang } = ctx;
  try { localStorage.setItem(SEEN_KEY, latestRelease()); } catch { /* private mode */ }
  const pick = (o) => o[lang] || o.en;
  const when = (r) => (r.time ? `${dateShort(r.date)}, ${new Date(`1970-01-01T${r.time}:00`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : dateShort(r.date));
  // Every release starts closed, so the page is a short list; the newest is easy to find at the top. One is opened by tapping it.
  return h('div', { class: 'page' }, h('h1', {}, t('whatsNew.title')),
    h('div', { class: 'stack-sm' }, RELEASES.map((r) => h('details', { class: 'acc' },
      h('summary', {}, h('span', {}, pick(r.title), h('span', { class: 'small muted log-sub' }, when(r))), icon('expand_more')),
      h('div', { class: 'acc-body' }, h('ul', {}, r.items.map((i) => h('li', {}, pick(i)))))))));
}
