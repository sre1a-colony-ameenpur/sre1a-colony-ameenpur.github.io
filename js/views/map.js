// S5 Map: pan/zoom colony layout with owner name chips, search, Members and Committee lists, right slide-in profile (opened by tapping a chip; Members and search only fly to the plot).
// Geometry (map/plots.json, tiles) holds no names; names and roles come from map.plots at run time.
import { h, icon, button, rolePill, plotChip, avatar, emptyState, errorState, loadingRegion, toast } from '../ui.js';
import { friendly } from '../api.js';

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet';
let leafletReady = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      document.head.append(h('link', { rel: 'stylesheet', href: `${LEAFLET}.css` }));
      const s = h('script', { src: `${LEAFLET}.js` });
      s.onload = resolve; s.onerror = () => { leafletReady = null; reject(new Error('leaflet')); };
      document.head.append(s);
    });
  }
  return leafletReady;
}

const norm = (k) => String(k || '').replace(/[\s-]/g, '').toUpperCase();
const realKey = new Map();                       // norm(key) -> the key as written in the plots sheet (A8 -> A-8, A67P -> A-67/P); the API wants that one
const fold = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
const PLOT_HALF = 28;                             // half the side of the highlight square in map pixels (plots sit ~72 px apart)
const label = (key) => key.replace(/^([A-Z])(\d+)$/, '$1-$2');

export default function render(ctx) {
  const { t, store } = ctx;
  const mine = new Set((store.get().session?.plotKeys || []).map(norm));
  const mapEl = h('div', { class: 'map-canvas', role: 'application', 'aria-label': t('map.title') });
  const results = h('div', { class: 'map-results', hidden: true });
  const q = h('input', { type: 'search', class: 'map-q', placeholder: t('map.search'), 'aria-label': t('map.search'), autocomplete: 'off' });
  const panelBody = h('div', { class: 'map-panel-body' });
  const panel = h('aside', { class: 'map-panel', 'aria-label': t('map.panel') },
    h('button', { type: 'button', class: 'map-x', 'aria-label': t('map.close'), onClick: () => closePanel() }, icon('close')), panelBody);
  const backdrop = h('div', { class: 'map-backdrop', onClick: () => closePanel() });
  const root = h('div', { class: 'page wide map-page' },
    h('div', { class: 'map-bar' }, h('div', { class: 'map-search' }, icon('search'), q, results),
      button(t('map.members'), { icon: 'groups', onClick: () => showMembers() }),
      button(t('map.committee'), { icon: 'badge', onClick: () => showCommittee() })),
    h('div', { class: 'map-stage' }, mapEl, backdrop, panel, loadingRegion(1)));

  let G, data, map, sel, geom = new Map(), ownerOf = new Map(), ll, markers;
  const hasPos = (key) => geom.has(key) && data.plots.find((p) => norm(p.plot_key) === key)?.located !== false;

  function openPanel(...kids) { panelBody.replaceChildren(...kids); panel.classList.add('open'); backdrop.classList.add('on'); }
  function closePanel() { panel.classList.remove('open'); backdrop.classList.remove('on'); sel?.clearLayers(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open')) closePanel(); });

  function fly(key) {
    if (!hasPos(key)) { toast(t('map.noPosition')); return false; }
    sel.clearLayers();
    const [x, y] = geom.get(key).at, r = PLOT_HALF;
    const green = getComputedStyle(document.documentElement).getPropertyValue('--c-ok').trim() || '#2f855a';
    L.rectangle([ll([x - r, y - r]), ll([x + r, y + r])], { color: green, weight: 3, fillColor: green, fillOpacity: 0.35, interactive: false }).addTo(sel);   // geometry has centres only, so the plot area is drawn as a square of typical plot size
    map.flyTo(ll(geom.get(key).at), G.maxz, { duration: 0.6 });
    return true;
  }

  async function showProfile(key) {
    openPanel(loadingRegion(1));
    fly(key);
    try {
      const p = await ctx.api.call('map.profile', { plot_key: realKey.get(key) || key });
      const o = p.owner;
      openPanel(
        h('div', { class: 'row', style: 'margin-bottom:8px' }, avatar(o?.name || '?', true),
          h('div', {}, h('h2', {}, o?.name || t('map.noOwner')), h('div', { class: 'row' }, plotChip(p.plot_label || label(key)), o?.role && o.role !== 'Member' ? rolePill(o.role) : null))),
        h('p', { class: 'small muted' }, t(`map.cat.${p.category}`), p.facing ? ` · ${t('map.facing')}: ${p.facing} (${t('map.estimated')})` : ''),
        o?.plot_keys?.length > 1 ? h('p', { class: 'small' }, t('map.alsoOwns'), ' ', ...o.plot_keys.map((k) => plotChip(label(k)))) : null,
        o?.mobile ? h('div', { class: 'list-row' }, h('div', { class: 'muted small', style: 'min-width:96px' }, t('profile.mobile')),
          h('a', { href: `tel:${o.mobile.replace(/\s/g, '')}` }, icon('call', 'sm'), ' ', o.mobile)) : null,
        ...Object.entries(p.profile || {}).map(([k, v]) => h('div', { class: 'list-row' }, h('div', { class: 'muted small', style: 'min-width:96px' }, k), h('div', {}, String(v)))));
    } catch (e) { openPanel(errorState(friendly(e, t), () => showProfile(key))); }
  }

  function memberRow(m) {
    return h('button', { type: 'button', class: 'list-row map-row', onClick: () => {
      const k = m.plot_keys.map(norm).find(hasPos) || norm(m.plot_keys[0]);
      if (!k) return;
      closePanel();
      fly(k);
    } }, avatar(m.name), h('div', { class: 'grow' }, h('div', {}, m.name), h('div', { class: 'row small' }, m.plot_keys.map((k) => plotChip(label(norm(k)))))),
    m.role !== 'Member' ? rolePill(m.role) : null);
  }
  function showMembers() {
    const list = h('div', { class: 'stack-sm' });
    const search = h('input', { type: 'search', class: 'map-q', placeholder: t('map.searchMembers'), 'aria-label': t('map.searchMembers') });
    const draw = () => {
      const f = fold(search.value);
      const rows = data.members.filter((m) => !f || fold(m.name + m.plot_keys.join('')).includes(f));
      list.replaceChildren(...(rows.length ? rows.map(memberRow) : [emptyState(t('map.none'), 'search_off')]));
    };
    search.addEventListener('input', draw); draw();
    openPanel(h('h2', {}, t('map.members'), ` (${data.members.length})`), search, list);
  }
  async function showCommittee() {
    openPanel(h('h2', {}, t('map.committee')), loadingRegion(2));
    try {
      const { items } = await ctx.api.call('map.committee');
      openPanel(h('h2', {}, t('map.committee')), ...items.map((i) => h('div', { class: 'list-row' },
        i.member ? avatar(i.member.name) : h('span', { class: 'avatar off', 'aria-hidden': 'true' }, '–'),
        h('div', { class: 'grow' }, h('div', {}, rolePill(i.role)),
          i.member ? h('div', {}, i.member.name) : h('div', { class: 'muted' }, t('map.vacant')),
          i.member ? h('div', { class: 'row small' }, i.member.plot_keys.map((k) => plotChip(label(norm(k))))) : null),
        i.member?.mobile ? button('', { kind: 'text', icon: 'call', href: `tel:${i.member.mobile.replace(/\s/g, '')}`, 'aria-label': `${t('map.call')} ${i.member.name}` }) : null)));
    } catch (e) { openPanel(errorState(friendly(e, t), showCommittee)); }
  }

  function drawMarkers() {
    markers.clearLayers();
    const far = map.getZoom() < G.maxz - 1.5;
    ownerOf.forEach((o, key) => {
      if (!hasPos(key)) return;
      const cls = mine.has(key) ? ' mine' : '';
      const icn = far ? L.divIcon({ className: '', html: `<div class="map-dot${cls}"></div>`, iconSize: [0, 0] })
        : L.divIcon({ className: '', html: `<div class="map-chip${cls}">${o.name.replace(/[<&>"]/g, '')}</div>`, iconSize: [0, 0] });
      L.marker(ll(geom.get(key).at), { icon: icn, title: `${label(key)}: ${o.name}` }).on('click', () => showProfile(key)).addTo(markers);
    });
  }

  function search() {
    const f = fold(q.value);
    if (!f) { results.hidden = true; return; }
    const hits = [];
    data.plots.forEach((p) => { const k = norm(p.plot_key); if (fold(p.plot_label + k).includes(f)) hits.push({ key: k, text: p.plot_label || label(k), sub: p.owner?.name || t('map.noOwner') }); });
    data.members.forEach((m) => { if (fold(m.name).includes(f) && m.plot_keys[0]) hits.push({ key: norm(m.plot_keys[0]), text: m.name, sub: m.plot_keys.map((k) => label(norm(k))).join(', ') }); });
    results.replaceChildren(...hits.slice(0, 8).map((x) => h('button', { type: 'button', class: 'map-hit', onClick: () => { results.hidden = true; q.value = ''; fly(x.key); } },
      h('span', {}, x.text), h('small', { class: 'muted' }, x.sub))));
    if (!hits.length) results.replaceChildren(h('div', { class: 'map-hit muted' }, t('map.none')));
    results.hidden = false;
  }
  q.addEventListener('input', search);

  async function init() {
    const stage = root.querySelector('.map-stage');
    try {
      const [, g, d] = await Promise.all([loadLeaflet(), fetch('map/plots.json').then((r) => { if (!r.ok) throw new Error('geometry'); return r.json(); }), ctx.api.call('map.plots')]);
      G = g; data = d;
      g.plots.forEach((p) => geom.set(norm(p.key), p));
      d.plots.forEach((p) => {
        realKey.set(norm(p.plot_key), p.plot_key);
        if (p.owner) ownerOf.set(norm(p.plot_key), p.owner);
        if (p.x != null && p.y != null) geom.set(norm(p.plot_key), { at: [p.x, p.y] });   // positions uploaded by the President win over the bundled ones
      });
      stage.querySelector('[aria-busy]')?.remove();
      const U = 2 ** G.maxz;
      ll = ([x, y]) => L.latLng(-y / U, x / U);
      map = L.map(mapEl, { crs: L.CRS.Simple, minZoom: 0, maxZoom: G.maxz + 2, zoomSnap: 0.5, attributionControl: false });
      const bounds = L.latLngBounds(ll([0, G.h]), ll([G.w, 0]));
      L.tileLayer('map/tiles/{z}/{x}/{y}.jpg', { minZoom: 0, maxNativeZoom: G.maxz, maxZoom: G.maxz + 2, noWrap: true, bounds }).addTo(map);
      map.fitBounds(bounds); map.setMaxBounds(bounds.pad(0.2));
      markers = L.layerGroup().addTo(map); sel = L.layerGroup().addTo(map);
      map.on('zoomend', drawMarkers); drawMarkers();
      root.querySelector('.map-reset')?.remove();
      mapEl.append(h('button', { type: 'button', class: 'map-reset btn', onClick: () => map.fitBounds(bounds) }, icon('zoom_out_map'), t('map.reset')));
      setTimeout(() => map.invalidateSize(), 50);
    } catch (e) { stage.replaceChildren(errorState(friendly(e, t) || t('map.loadError'), () => ctx.router?.refresh?.() ?? location.reload())); }
  }
  setTimeout(init, 0);
  return root;
}
