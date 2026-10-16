// Small DOM helpers and shared components (UX spec S8). No framework.
import { t } from './i18n.js';
import { initials } from './fmt.js';

// The DOM turns null/false/undefined children into the text "null". h() already skips them; make the direct calls do the same.
for (const m of typeof Element === 'undefined' ? [] : ['replaceChildren', 'append', 'prepend']) {
  const native = Element.prototype[m];
  Element.prototype[m] = function (...kids) { return native.apply(this, kids.filter((k) => k != null && k !== false)); };
}

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (Array.isArray(c)) c.forEach(add);
    else if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

export const icon = (name, cls = '') => h('span', { class: `icon ${cls}`.trim(), 'aria-hidden': 'true' }, name);

// Status kinds -> colour class and icon. Colour is never the only signal: icon + word.
const STATUS = {
  pending: ['warn', 'schedule'], due: ['warn', 'schedule'], approved: ['ok', 'check_circle'], paid: ['ok', 'check_circle'],
  rejected: ['bad', 'cancel'], overdue: ['bad', 'error'], open: ['info', 'radio_button_unchecked'], ack: ['info', 'visibility'], progress: ['warn', 'autorenew'],
  resolved: ['ok', 'task_alt'], closed: ['off', 'lock'], partly: ['warn', 'timelapse'], unpaid: ['bad', 'error'], voted: ['ok', 'check_circle'],
};
export function statusPill(kind, label) {
  const [cls, ic] = STATUS[kind] || ['off', 'info'];
  return h('span', { class: `pill ${cls}` }, icon(ic, 'sm'), label || t(`status.${kind}`));
}
export const rolePill = (role) => h('span', { class: 'pill role' }, role);
export const plotChip = (key) => h('span', { class: 'plot' }, key);
export const avatar = (name, lg = false) => h('span', { class: `avatar${lg ? ' lg' : ''}`, 'aria-hidden': 'true' }, initials(name));
export const crest = (sm = false) => h('span', { class: `crest${sm ? ' sm' : ''}`, 'aria-hidden': 'true' }, icon('home'));

// While an async click handler runs, disable the control and show a spinner on it; a second click cannot start a second action.
export function whileBusy(el, run) {
  if (el.disabled || el.classList.contains('busy')) return undefined;
  const done = () => { el.classList.remove('busy'); el.removeAttribute('aria-busy'); el.disabled = false; };
  let out;
  try { out = run(); } catch (e) { done(); throw e; }
  if (out && typeof out.then === 'function') {
    el.classList.add('busy'); el.setAttribute('aria-busy', 'true'); el.disabled = true;
    out.then(done, done);
  }
  return out;
}

export function button(label, { kind = '', icon: ic, onClick, block = false, href, disabled, ...rest } = {}) {
  const el = h(href ? 'a' : 'button', {
    class: `btn ${kind} ${block ? 'block' : ''}`.trim(), type: href ? null : 'button', href, disabled, ...rest,
  }, ic && icon(ic), label);
  if (onClick) el.addEventListener('click', href ? onClick : (e) => whileBusy(el, () => onClick(e)));
  return el;
}

// Full-screen block while a write is in flight. A modal <dialog> sits above any open sheet, so nothing underneath can be clicked.
let busyCount = 0;
let busyDlg = null;
export const busy = {
  start() {
    if (++busyCount > 1 || typeof document === 'undefined') return;
    busyDlg = h('dialog', { class: 'busy-overlay', 'aria-label': t('common.working') },
      h('div', { class: 'busy-box', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), t('common.working')));
    busyDlg.addEventListener('cancel', (e) => e.preventDefault());
    document.body.append(busyDlg);
    busyDlg.showModal();
  },
  end() {
    if (busyCount === 0 || --busyCount > 0) return;
    busyDlg?.close(); busyDlg?.remove(); busyDlg = null;
  },
};

export function segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  options.forEach(([val, text]) => wrap.append(h('button', {
    type: 'button', 'aria-pressed': String(val === value),
    onClick: (e) => { wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); onChange(val); },
  }, text)));
  return wrap;
}

export function field({ id, label, type = 'text', value = '', help, error, ...rest }) {
  const input = h('input', { id, type, value, ...rest, 'aria-describedby': help || error ? `${id}-d` : null, 'aria-invalid': error ? 'true' : null });
  return h('div', { class: `field${error ? ' error' : ''}` }, h('label', { for: id }, label), input,
    error ? h('div', { class: 'err', id: `${id}-d` }, icon('error', 'sm'), error) : help ? h('div', { class: 'help', id: `${id}-d` }, help) : null);
}

export function card(title, ic, ...body) {
  return h('section', { class: 'card' },
    title ? h('h2', { class: 'card-title' }, ic && icon(ic), title) : null, ...body);
}

export function emptyState(text, ic = 'inbox', action) {
  return h('div', { class: 'state' }, icon(ic), h('p', {}, text), action);
}
export function errorState(text, onRetry) {
  return h('div', { class: 'state bad', role: 'alert' }, icon('error'), h('p', {}, text),
    onRetry && button(t('common.retry'), { icon: 'refresh', onClick: onRetry }));
}
export const skeletonCard = () => h('div', { class: 'skel card', 'aria-hidden': 'true' });
export const loadingRegion = (n = 3) => h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': t('common.loading') },
  Array.from({ length: n }, skeletonCard));

// Toast: short, polite, auto-hides.
export function toast(msg, ms = 3500) {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const el = h('div', { class: 'toast', role: 'status' }, icon('check_circle', 'sm'), msg);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}

// Sheet: <dialog> gives focus trap and Esc. Resolves nothing; actions close it themselves.
export function openSheet({ title, body, actions = [], wide = false, onClose }) {
  const dlg = h('dialog', { class: `sheet${wide ? ' wide' : ''}`, 'aria-labelledby': 'sheet-title' });
  const close = () => dlg.close();
  // The sheet stays open, with its buttons disabled, until the action finishes; it closes only after it succeeds.
  let acts = [];
  const lock = (on) => acts.forEach((b) => { b.disabled = on; });
  acts = actions.map((a) => button(a.label, { kind: a.kind, block: true, onClick: async () => {
    lock(true);
    try { await a.onClick?.(close); if (!a.keepOpen && dlg.open) close(); } finally { lock(false); }
  } }));
  dlg.append(h('div', { class: 'sheet-in' },
    h('h2', { id: 'sheet-title' }, title), body, acts.length ? h('div', { class: 'btn-row' }, acts) : null));
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, el: dlg };
}

// Confirmation sheet: confirm(title, text, {confirmLabel, danger}) -> Promise<boolean>
export function confirmSheet(title, text, { confirmLabel = t('common.confirm'), danger = false } = {}) {
  return new Promise((resolve) => {
    let answer = false;
    openSheet({
      title, body: h('p', {}, text), onClose: () => resolve(answer),
      actions: [
        { label: confirmLabel, kind: danger ? 'danger solid' : 'primary', onClick: () => { answer = true; } },
        { label: t('common.cancel') },
      ],
    });
  });
}

// "Only the committee can do this" style line for a missing action.
export const whyNot = (text) => h('p', { class: 'why' }, text);
