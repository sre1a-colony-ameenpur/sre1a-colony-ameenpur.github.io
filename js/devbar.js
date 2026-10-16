// Dev role switcher, mock mode only.
import { h } from './ui.js';

export const DEV_CHOICES = [
  ['member', 'Member: Ramesh K. (A-12)'], ['lakshmi', 'Member: Lakshmi P. (C-49, C-50)'], ['treasurer', 'Treasurer: Madhavi S.'],
  ['gs', 'General Secretary: Kiran B.'], ['president', 'President: Suresh V.'],
  ['unlisted', 'Not on the list'], ['removed', 'Removed member'], ['down', 'App down (offline)'], ['out', 'Signed out'],
];

// Collapsed strip in normal flow at the top of the page, so it never covers content.
export function devbar(current, onPick) {
  const label = DEV_CHOICES.find(([v]) => v === current)?.[1] || current;
  const sel = h('select', { 'aria-label': 'Mock role', onChange: (e) => onPick(e.target.value) },
    DEV_CHOICES.map(([v, l]) => h('option', { value: v, selected: v === current }, l)));
  return h('details', { class: 'devbar' }, h('summary', {}, `Mock mode: ${label}`), sel);
}
