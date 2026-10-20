// AI tab: a chat with the colony assistant. Text in; answers, numbers and one-tap action cards out. The assistant never saves anything itself:
// an action card runs the normal action as the signed-in person only when they tap its button.
import { h, icon, button, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { getLang } from '../i18n.js';
import {
  MAX_LEN, SCREENS, historyFor, canSend, showCount, cleanCard, dataValue, dataTitleKey, dataDetail, dataIsEmpty, dataHasValue, rowView, fieldView, actionTexts, actionSummary, infoText, chatErrorKey, loadChat, saveChat,
} from '../ai_helpers.js';

const EXAMPLES = ['asst.ex1', 'asst.ex2', 'asst.ex3', 'asst.ex4'];

export default function render(ctx) {
  const { t } = ctx;
  const who = ctx.store.get().session?.email || '';
  let { messages, left } = loadChat(who);
  let busy = false;
  const confirming = new Set();                                   // action cards with a request in flight: one tap, one request

  const list = h('div', { class: 'ai-list', role: 'log', 'aria-live': 'polite', 'aria-label': t('asst.title') });
  const leftNote = h('span', { class: 'small muted' });
  const input = h('textarea', { id: 'ai-input', rows: '1', maxlength: String(MAX_LEN), placeholder: t('asst.placeholder'), 'aria-label': t('asst.placeholder'), enterkeyhint: 'send',
    onInput: () => { grow(); sync(); }, onKeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } } });
  const sendBtn = h('button', { type: 'button', class: 'ai-send', 'aria-label': t('asst.send'), title: t('asst.send'), onClick: () => send(input.value) }, icon('arrow_upward'));
  const count = h('span', { class: 'small muted ai-count', hidden: true });

  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 136) + 'px'; }
  function sync() {
    sendBtn.disabled = !canSend(input.value, busy);
    count.hidden = !showCount(input.value);
    count.textContent = `${input.value.length}/${MAX_LEN}`;
  }
  const persist = () => saveChat(who, messages, left);
  function toBottom() { list.scrollTop = list.scrollHeight; }

  function avatarDot() { return h('span', { class: 'ai-avatar', 'aria-hidden': 'true' }, icon('auto_awesome', 'sm')); }

  function dataCard(c) {
    const d = dataDetail(c);
    const rows = Array.isArray(c.rows) ? c.rows : [];
    return h('section', { class: 'ai-card' }, h('div', { class: 'small muted' }, t(dataTitleKey(c))),
      dataHasValue(c) ? h('div', { class: 'ai-value' }, dataValue(c)) : null,
      d ? h('div', { class: 'small muted' }, t(d[0], d[1])) : null,
      dataIsEmpty(c) ? h('p', { class: 'muted' }, t('asst.data.empty')) : null,
      rows.length ? h('ul', { class: 'ai-rows' }, rows.map((r) => {
        const v = rowView(r);
        return h('li', { class: 'ai-item' }, h('div', { class: 'ai-item-main' }, h('span', {}, v.key ? t(`asst.row.${v.key}`) : v.label, v.vacant ? h('span', { class: 'small muted' }, ` · ${t('asst.vacant')}`) : null, v.flag ? h('span', { class: 'small muted' }, ` · ${t(`asst.flag.${v.flag}`)}`) : null), v.sub ? h('span', { class: 'small muted' }, v.sub) : null), v.value ? h('strong', {}, v.value) : null);
      })) : null,
      c.more > 0 ? h('div', { class: 'small muted' }, t('asst.more', { n: c.more })) : null);
  }

  // The body of an action card: its summary, then Apply and Dismiss (or the result). onDone runs after a successful Apply.
  function actionCard(c, onDone) {
    const tx = actionTexts(c);
    const body = h('div', { class: 'stack-sm' });
    function draw() {
      if (c.state === 'done') body.replaceChildren(h('div', { class: 'row ai-done' }, icon('check_circle', 'sm'), t(tx.done)));
      else if (c.state === 'dismissed') body.replaceChildren(h('div', { class: 'small muted' }, t('asst.act.dismissed')));
      else {
        const ok = button(t(tx.confirm), { kind: 'primary', icon: 'bolt', onClick: () => confirm() });
        body.replaceChildren(h('div', { class: 'row' }, ok, button(t('asst.act.dismiss'), { kind: 'text', onClick: () => { c.state = 'dismissed'; persist(); draw(); } })));
      }
    }
    async function confirm() {
      if (c.state || confirming.has(c.id)) return;
      confirming.add(c.id);
      try {
        await ctx.api.call(c.action, c.payload);                  // a write: stored answers are dropped by api.call, so other screens show the change
        c.state = 'done'; persist(); draw(); if (onDone) onDone();
      } catch (e) { toastError(friendly(e, t)); }
      finally { confirming.delete(c.id); }
    }
    draw();
    const summary = tx.title ? h('p', {}, h('strong', {}, t(tx.title))) : h('p', {}, t(...actionSummary(c, t)));
    const fields = Array.isArray(c.fields) && c.fields.length ? h('dl', { class: 'ai-fields' }, c.fields.flatMap((f) => { const v = fieldView(f); return [h('dt', { class: 'small muted' }, t(v.label)), h('dd', {}, v.textKey ? t(v.textKey) : v.text)]; })) : null;
    return h('section', { class: 'ai-card action' }, h('div', { class: 'small muted row' }, icon('bolt', 'sm'), t('asst.act.title')), summary, fields, body);
  }

  // Several matches: tap one to see what would happen, switch freely, and once one is applied the others go away.
  function choiceCard(c) {
    const wrap = h('section', { class: 'ai-card' });
    function draw() {
      const chosen = c.options[c.selected];
      const applied = chosen && chosen.card.state === 'done';
      const rows = (applied ? [chosen] : c.options).map((o) => {
        const on = o === chosen;
        return h('button', { type: 'button', class: `ai-choice${on ? ' on' : ''}`, 'aria-pressed': String(on), disabled: applied ? 'true' : null,
          onClick: () => { c.selected = c.options.indexOf(o); persist(); draw(); } }, h('span', {}, o.label), o.sub ? h('span', { class: 'small muted' }, o.sub) : null);
      });
      wrap.replaceChildren(h('div', { class: 'small muted' }, t('asst.choice.title')), h('div', { class: 'ai-choices' }, rows),
        chosen ? (chosen.card.type === 'action' ? actionCard(chosen.card, draw) : dataCard(chosen.card)) : null);
    }
    draw();
    return wrap;
  }

  function linkCard(c) {
    const [path, label] = SCREENS[c.screen];
    return h('div', { class: 'row' }, button(t('asst.open', { screen: t(label) }), { icon: 'open_in_new', onClick: () => ctx.navigate(path) }));
  }

  function cardEl(m, c) {
    if (c.type === 'data') return dataCard(c);
    if (c.type === 'action') return actionCard(c);
    if (c.type === 'choice') return choiceCard(c);
    if (c.type === 'info') return h('section', { class: 'ai-card' }, h('p', {}, t(...infoText(c, t))));
    return linkCard(c);
  }

  function messageEl(m) {
    if (m.role === 'user') return h('div', { class: 'ai-row user' }, h('div', { class: 'ai-bubble user' }, m.text));
    return h('div', { class: 'ai-row' }, avatarDot(), h('div', { class: 'ai-col' },
      m.text ? h('div', { class: `ai-bubble${m.error ? ' err' : ''}` }, m.text) : null,
      ...(m.cards || []).map((c) => cardEl(m, c))));
  }

  function empty() {
    return h('div', { class: 'ai-empty' }, h('span', { class: 'ai-hero', 'aria-hidden': 'true' }, icon('auto_awesome')),
      h('h2', {}, t('asst.welcome')), h('p', { class: 'muted' }, t('asst.welcomeHelp')),
      h('div', { class: 'ai-examples' }, EXAMPLES.map((k) => button(t(k), { kind: 'chip', onClick: () => send(t(k)) }))));
  }

  function draw() {
    leftNote.textContent = left == null ? '' : t('asst.left', { n: left });
    if (!messages.length && !busy) list.replaceChildren(empty());
    else {
      list.replaceChildren(...messages.map(messageEl), ...(busy ? [h('div', { class: 'ai-row', role: 'status', 'aria-label': t('asst.thinking') }, avatarDot(), h('div', { class: 'ai-bubble typing' }, h('i'), h('i'), h('i')))] : []));
      toBottom();
    }
    sync();
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!canSend(text, busy)) return;
    const history = historyFor(messages);
    messages.push({ role: 'user', text });
    input.value = ''; grow(); busy = true; persist(); draw();
    try {
      const r = await ctx.api.call('assistant.ask', { text, history, lang: getLang() });
      const cards = (Array.isArray(r?.cards) ? r.cards : []).map(cleanCard).filter(Boolean);
      const answer = typeof r?.answer === 'string' ? r.answer.trim() : '';
      messages.push({ role: 'assistant', text: answer || (cards.length ? '' : t('asst.noAnswer')), cards });
      if (r && 'left' in r) left = Number.isFinite(r.left) ? r.left : null;      // null: no daily limit, so nothing is said about it
    } catch (e) {
      const k = chatErrorKey(e.code);
      if (k) messages.push({ role: 'assistant', text: t(k), error: true });
      else toastError(friendly(e, t));
    } finally { busy = false; persist(); draw(); input.focus({ preventScroll: true }); }
  }

  function newChat() { messages = []; persist(); draw(); input.focus({ preventScroll: true }); }

  const head = h('div', { class: 'ai-head' }, leftNote, h('span', { class: 'grow' }), button(t('asst.newChat'), { kind: 'text', icon: 'edit_square', onClick: newChat }));
  const composer = h('div', { class: 'ai-composer' },
    h('div', { class: 'ai-box' }, input, sendBtn),
    h('div', { class: 'row-between ai-foot' }, h('span', { class: 'small muted' }, t('asst.privacy')), count));
  draw();
  return h('div', { class: 'ai' }, head, list, composer);
}
