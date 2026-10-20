// Pure helpers for the AI chat view (no DOM), so they can be tested on their own.
import { money, dateShort, timeShort, fullStamp, monthLabel } from './fmt.js';

export const MAX_LEN = 300;
export const SHOW_COUNT_AT = 250;
const HISTORY_TURNS = 4;
const STORE_KEY = 'sre.aiChat';

const PERIODS = ['this_month', 'last_month', 'this_year', 'all'];
const STAGES = ['any', 'Open', 'Acknowledged', 'In progress', 'Resolved', 'Closed'];
const VERBS = ['c', 'r', 'u', 'd'];
// The action each action-card kind may run: a card whose action is not on this list is not shown.
const KIND_ACTIONS = {
  set_role_access: ['roles.set', 'roles.setMany'], create_role: ['roles.create'], create_meeting: ['meetings.create'], update_meeting: ['meetings.update'],
  create_poll: ['polls.create'], cancel_poll: ['polls.cancel'], vote_poll: ['polls.vote'], create_event: ['events.create'], update_event: ['events.update'],
  create_action_item: ['actionItems.create'], finish_action_item: ['actionItems.update'], raise_complaint: ['complaints.create'], comment_complaint: ['comments.create'],
  take_on_complaint: ['complaints.takeOn'], move_complaint_stage: ['complaints.stage'], set_mobile_visibility: ['members.setMobileVisibility'], request_plot_change: ['plotRequests.create'],
  raise_fee_request: ['feeRequests.create'], update_fee_request: ['feeRequests.update'], cancel_fee_request: ['feeRequests.cancel'], raise_dues: ['maintenance.dues.raise'],
  set_maintenance_rate: ['maintenance.rates.set'], set_membership_rate: ['membership.rates.set'], set_member_role: ['members.setRole'], add_member: ['members.add'],
  approve_plot_request: ['plotRequests.approve'], reject_plot_request: ['plotRequests.reject'], mark_attendance: ['attendance.set'], remove_member: ['members.remove'],
  handover_presidency: ['members.handover'], confirm_payment: ['maintenance.payments.confirm', 'dues.payments.confirm'], reverse_payment: ['maintenance.payments.reverse', 'dues.payments.reverse'],
  approve_expense: ['expenses.approve'], reject_expense: ['expenses.reject'], reverse_expense: ['expenses.reverse'], transfer_plot: ['plots.transfer'],
};
export const ACTION_KINDS = Object.keys(KIND_ACTIONS);
export const DATA_KINDS = ['my_dues', 'maintenance_unpaid', 'maintenance_collected', 'expenses_pending', 'complaints_list', 'next_meeting', 'open_polls', 'upcoming_events', 'my_action_items', 'role_holders', 'find_member',
  'fee_requests_status', 'plot_requests_pending', 'payments_awaiting', 'expenses_to_decide'];
export const INFO_KINDS = ['no_change', 'not_allowed', 'role_exists', 'not_found', 'too_many', 'poll_not_open', 'already_voted', 'no_meeting', 'no_plot', 'missing', 'already_done', 'no_rate'];
export const FIELD_KEYS = ['date', 'time', 'place', 'agenda', 'title', 'description', 'question', 'options', 'type', 'closes_at', 'poll', 'option', 'meeting', 'owner', 'due', 'text', 'complaint', 'stage', 'area', 'plot', 'body', 'show', 'action', 'note', 'reason', 'role',
  'amount', 'deadline', 'audience', 'members', 'month', 'rate', 'category', 'from', 'member', 'email', 'mobile', 'plots', 'request', 'replaces', 'attendees', 'payment', 'expense', 'receiver', 'effective', 'will_create', 'name'];
const FIELD_UNITS = ['text', 'date', 'time', 'paise', 'list', 'key', 'month'];
export const ROW_KEYS = ['maintenance'];
export const ROW_FLAGS = ['voted', 'overdue'];
export const VAL_KEYS = ['open', 'secret', 'yes', 'no', 'add', 'remove', 'Acknowledged', 'In progress', 'Resolved', 'all', 'selected', 'house', 'none'];
export const MISSING_WHAT = ['date', 'time', 'place', 'question', 'options', 'reason', 'option', 'title', 'text', 'due', 'owner', 'description', 'area', 'plot', 'action', 'stage', 'body', 'closes_at', 'amount', 'deadline', 'month', 'category', 'from', 'member', 'email', 'role', 'name', 'plots', 'request', 'payment', 'expense', 'receiver', 'effective', 'attendees', 'mobile'];
export const NOT_FOUND_WHAT = ['meeting', 'poll', 'event', 'item', 'complaint', 'option', 'owner', 'request', 'member', 'role', 'payment', 'expense', 'plot_request'];
const MAX_OPTIONS = 8;

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

const isStr = (v) => typeof v === 'string';
const validRow = (r) => isObj(r) && ((isStr(r.label) && !!r.label) || (r.label === undefined && ROW_KEYS.includes(r.key))) && (r.vacant === undefined || typeof r.vacant === 'boolean') && (r.flag === undefined || ROW_FLAGS.includes(r.flag)) && (r.value === undefined || Number.isFinite(r.value)) && (r.unit === undefined || r.unit === 'paise' || r.unit === 'count')
  && (r.sub === undefined || isStr(r.sub)) && (r.date === undefined || /^\d{4}-\d{2}-\d{2}$/.test(r.date)) && (r.at === undefined || (isStr(r.at) && !Number.isNaN(Date.parse(r.at))));
const validField = (f) => isObj(f) && FIELD_KEYS.includes(f.key) && (f.unit === undefined || FIELD_UNITS.includes(f.unit))
  && (f.unit === 'list' ? Array.isArray(f.value) && f.value.every(isStr) : f.unit === 'key' ? VAL_KEYS.includes(f.value) : f.unit === 'month' ? isStr(f.value) && /^\d{4}-(0[1-9]|1[0-2])$/.test(f.value) : isStr(f.value) || Number.isFinite(f.value));

// confirm: absent, {word:'HANDOVER'} (type it to enable Apply) or {tap:true} (Apply asks "Are you sure?" first). Nothing else.
export function validConfirm(x) {
  if (x === undefined) return true;
  if (!isObj(x)) return false;
  const keys = Object.keys(x);
  if (keys.length !== 1) return false;
  return keys[0] === 'word' ? isStr(x.word) && /^[A-Z]{1,20}$/.test(x.word) : keys[0] === 'tap' && x.tap === true;
}
export const confirmMode = (c) => (isObj(c.confirm) ? (c.confirm.word ? 'word' : 'tap') : '');
// Apply is enabled when no word is needed, or the typed text is exactly the word.
export const applyReady = (c, typed) => confirmMode(c) !== 'word' || typed === c.confirm.word;
// What is sent: the prepared payload, plus the confirm word when one was asked for.
export const confirmPayload = (c, typed) => (confirmMode(c) === 'word' ? { ...c.payload, confirm: typed } : c.payload);

// Is this card one the view knows how to draw? Anything else is ignored.
function plainCard(c) {
  if (!isObj(c)) return false;
  const a = isObj(c.args) ? c.args : {};
  if (c.type === 'link') return Object.prototype.hasOwnProperty.call(SCREENS, c.screen);
  if (c.type === 'data') {
    if (c.kind === 'expenses_total') return Number.isFinite(c.value) && PERIODS.includes(a.period);
    if (c.kind === 'complaints_count') return Number.isFinite(c.value) && STAGES.includes(a.stage);
    if (c.kind === 'members_count') return Number.isFinite(c.value);
    if (!DATA_KINDS.includes(c.kind)) return false;
    if (c.value !== undefined && c.value !== null && !Number.isFinite(c.value)) return false;
    if (c.unit !== undefined && c.unit !== 'paise' && c.unit !== 'count') return false;
    if (c.rows !== undefined && !(Array.isArray(c.rows) && c.rows.every(validRow))) return false;
    if (c.more !== undefined && !(Number.isInteger(c.more) && c.more >= 0)) return false;
    return Array.isArray(c.rows) || Number.isFinite(c.value);
  }
  if (c.type === 'action') {
    if (!isStr(c.id) || !c.id || !(KIND_ACTIONS[c.kind] || []).includes(c.action) || !isObj(c.payload)) return false;
    if (c.danger !== undefined && typeof c.danger !== 'boolean') return false;
    if (!validConfirm(c.confirm)) return false;
    if (c.fields !== undefined && !(Array.isArray(c.fields) && c.fields.every(validField))) return false;
    if (c.kind === 'set_role_access') return isStr(a.role) && !!a.role && isStr(a.entity) && verbsOf(a.before) !== null && verbsOf(a.after) !== null;
    if (c.kind === 'create_role') return isStr(a.name) && !!a.name && typeof a.singleHolder === 'boolean';
    return Array.isArray(c.fields) && c.fields.length > 0;
  }
  if (c.type === 'info') {
    if (c.kind === 'no_change') return isStr(a.role) && !!a.role && isStr(a.entity) && verbsOf(a.rights) !== null;
    if (c.kind === 'not_allowed') return a.entity === undefined || (isStr(a.entity) && !!a.entity);
    if (c.kind === 'missing') return MISSING_WHAT.includes(a.what);
    if (c.kind === 'role_exists') return isStr(a.name) && !!a.name;
    return isStr(c.kind) && !!c.kind && (a.what === undefined || isStr(a.what));
  }
  return false;
}

// The card as it may be drawn, or null. A choice keeps only its valid options (an action or data card each) and needs at least two left.
export function cleanCard(c) {
  if (isObj(c) && c.type === 'choice') {
    if (!isStr(c.kind) || !Array.isArray(c.options)) return null;
    const options = c.options.filter((o) => isObj(o) && isStr(o.label) && !!o.label && (o.sub === undefined || isStr(o.sub)) && isObj(o.card)
      && (o.card.type === 'action' || o.card.type === 'data') && plainCard(o.card)).slice(0, MAX_OPTIONS);
    return options.length >= 2 ? { ...c, options } : null;
  }
  return plainCard(c) ? c : null;
}
export const renderableCard = (c) => cleanCard(c) !== null;

// [key, vars] for the plain note on an info card (the request was understood but nothing can be prepared).
export function infoText(c, t) {
  if (c.kind === 'role_exists') return ['asst.info.role_exists', { name: c.args.name }];
  if (c.kind === 'not_allowed' && !(isObj(c.args) && c.args.entity)) return ['asst.info.not_allowed_any', {}];
  if (c.kind === 'not_allowed') return ['asst.info.not_allowed', { entity: t(`roles.e.${c.args.entity}`) }];
  if (c.kind === 'no_change') return ['asst.info.no_change', { role: c.args.role, entity: t(`roles.e.${c.args.entity}`), rights: verbWords(c.args.rights, t).join(', ') || t('asst.act.none') }];
  const what = isObj(c.args) && isStr(c.args.what) ? c.args.what : '';
  if (c.kind === 'missing') return ['asst.info.missing', { what: t(`asst.field.${what}`) }];
  if (c.kind === 'not_found') return NOT_FOUND_WHAT.includes(what) ? ['asst.info.not_found', { what: t(`asst.what.${what}`) }] : ['asst.info.not_found_any', {}];
  return [INFO_KINDS.includes(c.kind) ? `asst.info.${c.kind}` : 'asst.info.generic', { what }];
}

export const dataValue = (c) => (c.kind === 'expenses_total' || c.unit === 'paise' ? money(c.value) : String(c.value));
export const dataTitleKey = (c) => (c.kind === 'members_count' ? 'asst.data.members_count' : c.kind === 'complaints_count' ? `asst.data.complaints_count.${c.args.stage === 'In progress' ? 'in_progress' : c.args.stage.toLowerCase()}`
  : c.kind === 'expenses_total' ? `asst.data.expenses_total.${c.args.period}` : `asst.data.${c.kind}`);
// A list card with nothing in it and no number.
export const dataIsEmpty = (c) => (!Array.isArray(c.rows) || !c.rows.length) && !Number.isFinite(c.value);
export const dataHasValue = (c) => Number.isFinite(c.value);

// One row of a list card: { label, value (text or ''), sub (text or '') }. Dates are as stored; times are shown in India time.
export function rowView(r) {
  const value = Number.isFinite(r.value) ? (r.unit === 'paise' ? money(r.value) : String(r.value)) : '';
  const sub = [r.sub, r.date ? dateShort(r.date) : '', r.at ? fullStamp(r.at) : ''].filter(Boolean).join(' · ');
  return { label: r.label, key: r.label === undefined ? r.key : '', vacant: r.vacant === true, flag: r.flag || '', value, sub };
}

// [key, vars] for the small line under the number, or null.
export function dataDetail(c) {
  if (c.kind !== 'expenses_total' || !isObj(c.detail) || !Number.isFinite(c.detail.count)) return null;
  const { count, from, to } = c.detail;
  if (!from || !to) return ['asst.detail.expensesAll', { n: count }];
  return ['asst.detail.expenses', { n: count, from: dateShort(from), to: dateShort(to) }];
}

// A field of an action card as { key, label key, text }.
export function fieldView(f) {
  let text;
  if (f.unit === 'list') text = f.value.join(', ');
  else if (f.unit === 'date') text = dateShort(f.value) || String(f.value);
  else if (f.unit === 'time') text = timeShort(f.value) || String(f.value);
  else if (f.unit === 'key') text = String(f.value);
  else if (f.unit === 'month') text = monthLabel(f.value) || String(f.value);
  else if (f.unit === 'paise') text = money(Number(f.value));
  else text = String(f.value);
  return { key: f.key, label: `asst.field.${f.key}`, text, textKey: f.unit === 'key' ? `asst.val.${f.value}` : '' };
}

// The button and done texts: the first two kinds keep their own, the rest share one pair.
export const actionTexts = (c) => (c.kind === 'set_role_access' || c.kind === 'create_role'
  ? { title: null, confirm: `asst.act.${c.kind}.confirm`, done: `asst.act.${c.kind}.done` }
  : { title: `asst.action.${c.kind}`, confirm: 'asst.act.apply', done: 'asst.applied' });

// Verb letters as words, in c r u d order: 'ru' -> ['Read', 'Update'] (t is the translate function).
export const verbWords = (letters, t) => VERBS.filter((v) => letters.includes(v)).map((v) => t(`roles.vf.${v}`));

// [key, vars] for the sentence on an action card.
export function actionSummary(c, t) {
  if (c.kind !== 'set_role_access' && c.kind !== 'create_role') return null;
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
