// President settings: the number of hours a resolved complaint waits before the System closes it.
import { h, button, card, field, toast, errorState, loadingRegion, toastError } from '../ui.js';
import { friendly } from '../api.js';

export default function render(ctx) {
  const { t } = ctx;
  const body = h('div', { class: 'stack', 'data-tour': 'st-body' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('menu.settings')), body);

  async function load() {
    body.replaceChildren(loadingRegion(1));
    try {
      const { autoclose_hours: hours } = await ctx.api.call('complaints.settings.get');
      const input = field({ id: 'set-hours', label: t('set.autoclose'), help: t('set.autocloseHelp'), value: String(hours), inputmode: 'numeric', maxlength: 3 });
      const note = h('div', { role: 'alert' });
      body.replaceChildren(card(t('set.cmpTitle'), 'forum', input, note, button(t('mem.save'), { kind: 'primary', block: true, onClick: async () => {
        const n = Number(input.querySelector('input').value.trim());
        if (!Number.isInteger(n) || n < 1 || n > 720) return note.replaceChildren(h('div', { class: 'banner warn', style: 'border-radius:12px' }, t('set.hoursBad')));
        try { await ctx.api.call('complaints.settings.set', { autoclose_hours: n }); note.replaceChildren(); toast(t('common.saved')); } catch (e) { toastError(friendly(e, t)); }
      } })));
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}
