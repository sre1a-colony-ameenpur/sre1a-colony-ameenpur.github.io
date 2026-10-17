// What's new: release notes for members, newest first. Content lives in js/releases.js.
import { h, card } from '../ui.js';
import { RELEASES, latestRelease } from '../releases.js';
import { dateShort } from '../fmt.js';

export const SEEN_KEY = 'sre.whatsNewSeen';

export default function render(ctx) {
  const { t, lang } = ctx;
  try { localStorage.setItem(SEEN_KEY, latestRelease()); } catch { /* private mode */ }
  const pick = (o) => o[lang] || o.en;
  return h('div', { class: 'page' }, h('h1', {}, t('whatsNew.title')),
    h('div', { class: 'stack' }, RELEASES.map((r) => card(pick(r.title), 'new_releases',
      h('p', { class: 'small muted' }, dateShort(r.date)),
      h('ul', {}, r.items.map((i) => h('li', {}, pick(i))))))));
}
