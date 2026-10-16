// S7.2 Help: one accordion open at a time (details with the same name).
import { h, icon, card } from '../ui.js';

const SECTIONS = ['signin', 'complaint', 'vote', 'maintenance', 'broken'];
const FALLBACK_STEPS = ['s1', 's2', 's3', 's4'];

export default function render(ctx) {
  const { t, store } = ctx;
  const pres = store.get().session?.presidentName;
  return h('div', { class: 'page' }, h('h1', {}, t('help.title')),
    h('div', { class: 'stack-sm' }, SECTIONS.map((k) => h('details', { class: 'acc', name: 'help' },
      h('summary', {}, h('span', {}, t(`help.${k}.q`)), icon('expand_more')),
      h('div', { class: 'acc-body' }, h('p', {}, t(`help.${k}.a`)))))
      .concat(h('details', { class: 'acc', name: 'help', id: 'help-fallback' },
        h('summary', {}, h('span', {}, t('help.fallback.q')), icon('expand_more')),
        h('div', { class: 'acc-body' }, h('p', {}, t('help.fallback.intro')),
          h('ol', {}, FALLBACK_STEPS.map((k) => h('li', {}, t(`help.fallback.${k}`)))),
          h('p', {}, t('help.fallback.note')))))),
    h('div', { style: 'margin-top:16px' }, card(t('help.stuck.title'), 'support_agent',
      h('p', {}, pres ? t('help.stuck.named', { name: pres }) : t('help.stuck.text')))));
}
