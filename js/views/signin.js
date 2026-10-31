// S0.1 Sign-in. Google button (or a mock button in mock mode).
import { h, icon, crest, button } from '../ui.js';
import { isInAppBrowser } from '../env.js';
import { langToggle } from '../shell.js';
import { CONFIG } from '../config.js';

export default function render(ctx) {
  const { t, store } = ctx;
  const s = store.get();
  const slot = h('div', { class: 'gsi-slot', id: 'gsi' });
  const hint = isInAppBrowser(navigator.userAgent) ? inAppHint(ctx) : null;
  const el = h('div', { class: 'bare' },
    hint,
    h('div', { class: 'bare-top' }, langToggle(ctx.lang, ctx.setLang)),
    h('div', { class: 'bare-main' },
      crest(),
      h('h1', {}, CONFIG.appName),
      h('p', { class: 'muted' }, t('signin.subtitle')),
      s.notice ? h('p', { class: 'small', role: 'alert' }, t(s.notice)) : null,
      ctx.mock ? button(t('signin.mock'), { kind: 'primary', block: true, icon: 'login', onClick: () => ctx.mockSignIn('member') }) : slot,
      h('p', { class: 'small muted' }, t('signin.hint'))),
    h('div', { class: 'bare-foot small muted' },
      h('p', {}, t('signin.help')),
      h('p', { class: 'legal-links' },
        h('a', { href: 'privacy/', target: '_blank', rel: 'noopener' }, t('signin.privacy')), ' · ',
        h('a', { href: 'tnc/', target: '_blank', rel: 'noopener' }, t('signin.terms')))));
  if (!ctx.mock) queueMicrotask(() => ctx.auth.renderButton(slot, ctx.lang));
  return el;
}

// Google sign-in often fails inside Facebook, Instagram, WebView browsers.
function inAppHint(ctx) {
  const { t } = ctx;
  const bar = h('div', { class: 'banner warn', role: 'note' }, icon('open_in_browser'),
    h('div', { class: 'grow' }, t('inapp.text')),
    button(t('inapp.copy'), { onClick: async () => { try { await navigator.clipboard.writeText(location.href); ctx.toast(t('inapp.copied')); } catch { /* ignore */ } } }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onClick: () => bar.remove() }, icon('close')));
  return bar;
}
