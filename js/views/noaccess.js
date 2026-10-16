// S0.2 No access (not listed, or removed). Shows the Gmail that tried.
import { h, icon, button } from '../ui.js';
import { langToggle } from '../shell.js';

export default function render(ctx) {
  const { t, store } = ctx;
  const email = store.get().user?.email;
  return h('div', { class: 'bare' },
    h('div', { class: 'bare-top' }, langToggle(ctx.lang, ctx.setLang)),
    h('div', { class: 'bare-main' },
      icon('lock', 'lg'),
      h('h1', {}, t('noaccess.title')),
      h('p', {}, t('noaccess.text')),
      email ? h('p', { class: 'card', style: 'overflow-wrap:anywhere' }, h('span', { class: 'small muted' }, t('noaccess.tried')), h('br'), h('strong', {}, email)) : null,
      button(t('noaccess.another'), { kind: 'primary', block: true, onClick: () => ctx.signOut() }),
      button(t('common.close'), { block: true, onClick: () => { window.close(); ctx.signOut(); } })));
}
