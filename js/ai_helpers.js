// Pure helpers for the AI chat view (no DOM), so they can be tested on their own.
import { money, dateShort } from './fmt.js';

export const MAX_LEN = 300;
export const SHOW_COUNT_AT = 250;
const HISTORY_TURNS = 4;
const STORE_KEY = 'sre.aiChat';

const PERIODS = ['this_month', 'last_month', 'this_year', 'all'];
const STAGES = ['any', 'Open', 'Acknowledged', 'In progress', 'Resolved', 'Closed'];
const VERBS = ['c', 'r', 'u', 'd'];
// The action each action-card kind may run: a card whose action is not on this list is not shown.
const KIND_ACTIONS = { set_role_access: ['roles.set', 'roles.setMany'], create_role: ['roles.create'] };

// Screens a link card may open: [route, i18n label].
export const SCREENS = {
  home: ['/home', 'nav.home'], issues: ['/issues', 'nav.issues'], money: ['/money', 'nav.money'], community: ['/community', 'nav.community'],
  map: ['/map', 'nav.map'], roles: ['/roles', 'menu.roles'], members: ['/members', 'menu.members'], plots: ['/plots', 'menu.plots'],
  reports: ['/reports', 'menu.reports'], documents: ['/documents', 'menu.documents'], audit: ['/audit', 'menu.audit'],
};

// The earlier turns sent with a question: the last four that have text (a reply that was only cards has none).
export function historyFor(messages) {
  return (messages || []).filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.error && typeof m.text === 'string' && m.text.trim())
    .slice(-HISTORY_TURNS).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_LEN) }));
}

export const canSend = (text, busy) => !busy && text.trim().length > 0 && text.length <= MAX_LEN;
export const showCount = (text) => text.length >= SHOW_COUNT_AT;

const verbsOf = (s) => (typeof s === 'string' && /^[crud]*$/.test(s) ? s : null);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// Is this card one the view knows how to draw? Anything else is ignored.
export function renderableCard(c) {
  if (!isObj(c)) return false;
  const a = isObj(c.args) ? c.args : {};
  if (c.type === 'link') return Object.prototype.hasOwnProperty.call(SCREENS, c.screen);
  if (c.type === 'data') {
    if (!Number.isFinite(c.value)) return false;
    if (c.kind === 'expenses_total') return PERIODS.includes(a.period);
    if (c.kind === 'complaints_count') return STAGES.includes(a.stage);
    return c.kind === 'members_count';
  }
  if (c.type === 'action') {
    if (typeof c.id !== 'string' || !c.id || !(KIND_ACTIONS[c.kind] || []).includes(c.action) || !isObj(c.payload)) return false;
    if (c.kind === 'set_role_access') return typeof a.role === 'string' && !!a.role && typeof a.entity === 'string' && verbsOf(a.before) !== null && verbsOf(a.after) !== null;
    return typeof a.name === 'string' && !!a.name && typeof a.singleHolder === 'boolean';
  }
  if (c.type === 'info') {
    if (c.kind === 'no_change') return typeof a.role === 'string' && !!a.role && typeof a.entity === 'string' && verbsOf(a.rights) !== null;
    if (c.kind === 'not_allowed') return typeof a.entity === 'string' && !!a.entity;
    return c.kind === 'role_exists' && typeof a.name === 'string' && !!a.name;
  }
  return false;
}

// [key, vars] for the plain note on an info card (the request was understood but nothing can be prepared).
export function infoText(c, t) {
  if (c.kind === 'role_exists') return ['asst.info.role_exists', { name: c.args.name }];
  if (c.kind === 'not_allowed') return ['asst.info.not_allowed', { entity: t(`roles.e.${c.args.entity}`) }];
  return ['asst.info.no_change', { role: c.args.role, entity: t(`roles.e.${c.args.entity}`), rights: verbWords(c.args.rights, t).join(', ') || t('asst.act.none') }];
}

export const dataValue = (c) => (c.kind === 'expenses_total' ? money(c.value) : String(c.value));
export const dataTitleKey = (c) => (c.kind === 'members_count' ? 'asst.data.members_count' : c.kind === 'complaints_count' ? `asst.data.complaints_count.${c.args.stage === 'In progress' ? 'in_progress' : c.args.stage.toLowerCase()}` : `asst.data.expenses_total.${c.args.period}`);

// [key, vars] for the small line under the number, or null.
export function dataDetail(c) {
  if (c.kind !== 'expenses_total' || !isObj(c.detail) || !Number.isFinite(c.detail.count)) return null;
  const { count, from, to } = c.detail;
  if (!from || !to) return ['asst.detail.expensesAll', { n: count }];
  return ['asst.detail.expenses', { n: count, from: dateShort(from), to: dateShort(to) }];
}

// Verb letters as words, in c r u d order: 'ru' -> ['Read', 'Update'] (t is the translate function).
export const verbWords = (letters, t) => VERBS.filter((v) => letters.includes(v)).map((v) => t(`roles.vf.${v}`));

// [key, vars] for the sentence on an action card.
export function actionSummary(c, t) {
  if (c.kind === 'create_role') return ['asst.act.create_role.text', { name: c.args.name, who: t(c.args.singleHolder ? 'asst.act.oneHolder' : 'asst.act.manyHolders') }];
  const list = (s) => verbWords(s, t).join(', ') || t('asst.act.none');
  return ['asst.act.set_role_access.text', { role: c.args.role, entity: t(`roles.e.${c.args.entity}`), after: list(c.args.after), before: list(c.args.before) }];
}

// Assistant-side wording for the errors the chat explains itself; any other code is shown as a toast.
export const chatErrorKey = (code) => ({ FORBIDDEN: 'asst.err.FORBIDDEN', RATE_LIMITED: 'asst.err.RATE_LIMITED', UNAVAILABLE: 'asst.err.UNAVAILABLE' })[code] || null;

// The conversation lives in sessionStorage for the tab session, per signed-in person. Every access is guarded: private mode may refuse it.
export function loadChat(who, storage = globalThis.sessionStorage) {
  try {
    const o = JSON.parse(storage.getItem(STORE_KEY) || 'null');
    return o && o.who === who && Array.isArray(o.messages) ? { messages: o.messages.slice(-60), left: Number.isFinite(o.left) ? o.left : null } : { messages: [], left: null };
  } catch { return { messages: [], left: null }; }
}
export function saveChat(who, messages, left, storage = globalThis.sessionStorage) {
  try { messages.length ? storage.setItem(STORE_KEY, JSON.stringify({ who, messages: messages.slice(-60), left })) : storage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
