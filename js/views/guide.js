// User guide: one guide for everyone, shown for a role chosen at the top. The President and Developers may look at any role; everyone else sees their own.
import { h, icon, button, errorState } from '../ui.js';
import { friendly } from '../api.js';
import { can, hasModule } from '../store.js';
import { SECTIONS } from '../guide_content.js';
import { rightsFor, visibleSections, roleChoices, localise } from '../guide.js';
import { guideImage } from '../guide_images.js';

export default function render(ctx) {
  const { t, store } = ctx;
  const own = store.get().session?.role || 'Member';
  let role = own, matrix = null, known = [], te = null;
  const lang = store.get().lang;
  const pick = h('select', { id: 'guide-role', 'aria-describedby': 'guide-role-help', onChange: (e) => { role = e.target.value; drawBody(); } });
  const note = h('p', { class: 'small muted', id: 'guide-role-help' });
  const body = h('div', { class: 'stack' });

  // A picture from the colony Drive, fetched when it scrolls into view; hidden if it is not there.
  function shot(x) {
    const fig = h('figure', { class: 'guide-shot loading' });
    const show = () => guideImage((a, p) => ctx.api.call(a, p), x.id).then((url) => {
      if (!url) { fig.remove(); return; }
      fig.classList.remove('loading');
      fig.append(h('img', { src: url, alt: x.caption, loading: 'lazy' }), h('figcaption', {}, x.caption));
    });
    if (typeof IntersectionObserver === 'undefined') show();
    else { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); show(); } }, { rootMargin: '300px' }); queueMicrotask(() => io.observe(fig)); }
    return fig;
  }

  function drawPicker() {
    pick.replaceChildren(...roleChoices(own, known).map((c) => h('option', { value: c.role, selected: c.role === role, disabled: !c.enabled }, c.role)));
    note.textContent = t(roleChoices(own, known).some((c) => c.enabled && c.role !== own) ? 'guide.role.free' : 'guide.role.own');
  }
  function drawBody() {
    const rights = rightsFor(role, { ownRole: own, can, matrix });
    const list = visibleSections(role, rights, hasModule, localise(SECTIONS, lang === 'te' ? te : null));
    body.replaceChildren(
      role !== own ? h('div', { class: 'banner info', role: 'status' }, icon('visibility'), t('guide.viewingAs', { role })) : null,
      h('nav', { class: 'card', 'aria-label': t('guide.contents') }, h('h2', { class: 'card-title' }, icon('list'), t('guide.contents')),
        h('div', { class: 'guide-toc' }, list.map((s) => button(s.title, { kind: 'text', onClick: () => document.getElementById(`guide-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })))),
      ...list.map((s) => h('section', { class: 'card guide-sec', id: `guide-${s.id}` },
        h('h2', { class: 'card-title' }, icon(s.icon), s.title),
        s.intro ? h('p', {}, s.intro) : null,
        h('ul', { class: 'guide-steps' }, s.steps.map(([lead, text], i) => h('li', {}, h('strong', {}, lead), ' ', text, (s.shots || []).filter((x) => x.after === i).map(shot)))))));
    drawPicker();
  }

  // The President and Developers also need the Roles table, to see what another role holds.
  async function load() {
    if (!(own === 'President' || own === 'Developer') || !can('roles_config', 'r')) return;
    try { await ctx.api.swr('roles.get', {}, (g) => { matrix = g.matrix; known = g.roles || []; drawBody(); }); }
    catch (e) { body.prepend(errorState(friendly(e, t), load)); }
  }

  if (lang === 'te') import('../guide_te.js').then((m) => { te = m.TE; drawBody(); }).catch(() => {});
  drawPicker(); drawBody(); load();
  return h('div', { class: 'page' }, h('h1', {}, t('help.guide.title')),
    h('div', { class: 'field' }, h('label', { for: 'guide-role' }, t('guide.role.label')), pick, note), body);
}
