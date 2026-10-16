// S0.3 App not reachable.
import { h, icon, button } from '../ui.js';
import { langToggle } from '../shell.js';
import { CONFIG } from '../config.js';

export default function render(ctx) {
  const { t } = ctx;
  return h('div', { class: 'bare' },
    h('div', { class: 'bare-top' }, langToggle(ctx.lang, ctx.setLang)),
    h('div', { class: 'bare-main' },
      icon('cloud_off', 'lg'),
      h('h1', {}, t('down.title')),
      h('p', {}, t('down.text')),
      CONFIG.driveUrl ? button(t('down.drive'), { block: true, icon: 'folder_open', href: CONFIG.driveUrl, target: '_blank', rel: 'noopener' }) : null,
      button(t('common.retry'), { kind: 'primary', block: true, icon: 'refresh', onClick: () => ctx.retryBoot() })));
}
