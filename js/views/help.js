// S7.2 Help: one accordion open at a time (details with the same name).
import { h, icon, card, button, toast, openSheet } from '../ui.js';
import { requestTour, runTour, tourPath, helpTours } from '../tour.js';
import { installState, promptInstall, onInstallChange, checkForUpdates, currentBuild } from '../pwa.js';

const SECTIONS = ['signin', 'complaint', 'vote', 'maintenance', 'broken'];
const FALLBACK_STEPS = ['s1', 's2', 's3', 's4'];

// "Install the app": a button where the browser allows it, the manual steps otherwise, nothing once installed.
function installCard(t) {
  const body = h('div', { class: 'stack-sm' });
  const draw = () => {
    const s = installState();
    body.replaceChildren(...(s.installed ? [h('p', {}, t('help.install.done'))]
      : s.canPrompt ? [h('p', {}, t('help.install.text')), button(t('help.install.button'), { kind: 'primary', icon: 'install_mobile', onClick: promptInstall })]
        : s.ios ? [h('p', {}, t('help.install.ios')), button(t('help.install.button'), { kind: 'primary', icon: 'install_mobile', onClick: () => iosSteps(t) })]
          : [h('p', {}, t('help.install.manual'))]));
  };
  draw(); onInstallChange(draw);
  return card(t('help.install.title'), 'install_mobile', body);
}

// iPhone and iPad give a web page no install button, so the steps are shown instead (Chrome only: Safari's Home Screen apps do not get notifications here).
function iosSteps(t) {
  openSheet({ title: t('help.install.title'), body: h('div', { class: 'stack' }, h('ol', { class: 'agenda' }, ['1', '2', '3', '4'].map((n) => h('li', {}, t(`help.install.ios${n}`)))),
    h('p', { class: 'small muted' }, t('help.install.iosNote'))), actions: [{ label: t('common.close') }] });
}

// "Check for updates": looks for a new release now; the Update bar appears if there is one.
function updateCard(t) {
  const build = h('p', { class: 'small muted' });
  currentBuild().then((b) => { if (b) build.textContent = t('help.update.build', { build: b }); });
  const btn = button(t('help.update.button'), { icon: 'refresh', onClick: async () => {
    btn.disabled = true;
    const r = await checkForUpdates();
    btn.disabled = false;
    if (r !== 'ready') toast(t(r === 'latest' ? 'help.update.latest' : 'help.update.unsupported'));
  } });
  return card(t('help.update.title'), 'system_update', h('div', { class: 'stack-sm' }, h('p', {}, t('help.update.text')), build, btn));
}

// One dropdown with every tour this member may take, and one button to start the chosen one.
function tourPicker(t, state) {
  const list = helpTours(state), pick = h('select', { id: 'tour-pick' }, list.map(([name, label]) => h('option', { value: name }, t(label))));
  const go = () => {
    const name = pick.value;
    if (location.hash.split('?')[0] === tourPath(name)) return runTour(name, document.getElementById('main') || document);
    requestTour(name); location.hash = tourPath(name);
  };
  return h('div', { class: 'stack-sm', style: 'margin-top:12px', 'data-tour': 'h-tours' },
    h('div', { class: 'field' }, h('label', { for: 'tour-pick' }, t('tour.pick')), pick),
    button(t('tour.go'), { kind: 'primary', icon: 'tour', onClick: go }));
}

export default function render(ctx) {
  const { t, store } = ctx;
  const pres = store.get().session?.presidentName;
  return h('div', { class: 'page' }, h('h1', {}, t('help.title')),
    h('div', { style: 'margin-bottom:16px' }, card(t('tour.help.title'), 'tour', h('p', {}, t('tour.help.text')), h('p', { class: 'small muted' }, t('tour.help.menu')),
      tourPicker(t, store.get()))),
    h('div', { style: 'margin-bottom:16px', 'data-tour': 'h-guide' }, card(t('help.guide.title'), 'menu_book', h('p', {}, t('help.guide.text')), button(t('help.guide.button'), { kind: 'primary', icon: 'menu_book', href: '#/help/guide', style: 'margin-top:12px' }))),
    h('div', { class: 'stack-sm', 'data-tour': 'h-faq' }, SECTIONS.map((k) => h('details', { class: 'acc', name: 'help' },
      h('summary', {}, h('span', {}, t(`help.${k}.q`)), icon('expand_more')),
      h('div', { class: 'acc-body' }, h('p', {}, t(`help.${k}.a`)))))
      .concat(h('details', { class: 'acc', name: 'help', id: 'help-fallback' },
        h('summary', {}, h('span', {}, t('help.fallback.q')), icon('expand_more')),
        h('div', { class: 'acc-body' }, h('p', {}, t('help.fallback.intro')),
          h('ol', {}, FALLBACK_STEPS.map((k) => h('li', {}, t(`help.fallback.${k}`)))),
          h('p', {}, t('help.fallback.note')))))),
    h('div', { style: 'margin-top:16px', 'data-tour': 'h-install' }, installCard(t)),
    h('div', { style: 'margin-top:16px', 'data-tour': 'h-update' }, updateCard(t)),
    h('div', { style: 'margin-top:16px', 'data-tour': 'h-stuck' }, card(t('help.stuck.title'), 'support_agent',
      h('p', {}, pres ? t('help.stuck.named', { name: pres }) : t('help.stuck.text')))));
}
