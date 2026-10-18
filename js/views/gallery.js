// Gallery: every photo and video by category, filtered by what it belongs to, by photos or videos, and by month. Thirty at a time.
// Event and meeting photos load straight from Google (public links); other photos use the small picture stored with them, or ask for it.
import { h, button, icon, errorState, loadingRegion, emptyState, openSheet, toast } from '../ui.js';
import { friendly } from '../api.js';
import { playVideo } from '../video.js';

const CAT_ICON = { events: 'celebration', meetings: 'groups', issues: 'report', fixes: 'task_alt', expense_proofs: 'receipt_long', payment_proofs: 'payments' };

export default function render(ctx) {
  const { t } = ctx;
  let category = '', kind = '', month = '', item = null, items = [], cursor = null, total = 0, categories = [];
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('gal.category') });
  const itemChip = h('div', {});
  const kindSel = h('select', { id: 'gal-kind', 'aria-label': t('gal.kind') }, [['', t('gal.all')], ['photo', t('gal.photos')], ['video', t('gal.videos')]].map(([v, l]) => h('option', { value: v }, l)));
  const monthIn = h('input', { type: 'month', id: 'gal-month', 'aria-label': t('pay.f.month') });
  const grid = h('div', { class: 'photo-grid gallery-grid' }), more = h('div', {}), count = h('p', { class: 'small muted', role: 'status', id: 'gal-count' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('menu.gallery')), chips, itemChip, h('div', { class: 'row' }, kindSel, monthIn), count, grid, more);

  // Thumbnails are fetched a few at a time, only as they come into view.
  let busy = 0; const queue = [];
  const pump = () => { while (busy < 6 && queue.length) { busy++; queue.shift()().finally(() => { busy--; pump(); }); } };
  const lazy = (img, fetcher) => {
    const go = () => { queue.push(async () => { try { img.src = `data:image/jpeg;base64,${await fetcher()}`; } catch { img.replaceWith(icon('broken_image')); } }); pump(); };
    if (!('IntersectionObserver' in window)) return go();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } });
    io.observe(img);
  };

  const proof = (x) => x.category === 'expense_proofs' || x.category === 'payment_proofs';
  async function open(x) {
    if (x.kind === 'video') return playVideo(ctx, x.id);
    try {
      const body = proof(x) ? await ctx.api.call('gallery.proof', { category: x.category, id: x.id, size: 'full' })
        : x.public_url ? null : await ctx.api.call('media.photo', { id: x.id, size: 'full' });
      const src = body ? `data:image/jpeg;base64,${body.jpegBase64}` : x.public_url.replace('sz=w400', 'sz=w1600');
      openSheet({ title: x.item_title || t('cmp.photo'), wide: true, body: h('div', { class: 'stack-sm' }, h('img', { src, alt: x.item_title || '', style: 'width:100%' }),
        x.item_id && !proof(x) ? button(t('gal.moreFrom', { name: x.item_title }), { kind: 'text', icon: 'filter_alt', onClick: () => { item = { id: x.item_id, title: x.item_title }; document.querySelector('dialog')?.close?.(); load(); } }) : null), actions: [{ label: t('common.close') }] });
    } catch (e) { toast(friendly(e, t)); }
  }

  function tile(x) {
    const img = h('img', { alt: '', class: 'photo-thumb' });
    if (x.kind === 'video') img.src = x.video_thumb;
    else if (x.public_url) img.src = x.public_url;
    else if (x.thumb) img.src = `data:image/jpeg;base64,${x.thumb}`;
    else lazy(img, async () => (proof(x) ? await ctx.api.call('gallery.proof', { category: x.category, id: x.id, size: 'thumb' }) : await ctx.api.call('media.photo', { id: x.id, size: 'tiny' })).jpegBase64);
    return h('button', { type: 'button', class: 'photo-btn', 'aria-label': x.item_title || t('cmp.photo'), title: x.item_title, onClick: () => open(x) }, img, x.kind === 'video' ? h('span', { class: 'play-badge' }, icon('play_circle')) : null);
  }

  function drawChips() {
    chips.replaceChildren(...[['', t('gal.all'), 'photo_library'], ...categories.map((c) => [c, t(`gal.cat.${c}`), CAT_ICON[c]])].map(([v, label, ic]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === category),
      onClick: () => { category = v; item = null; load(); } }, icon(ic, 'sm'), label)));
    itemChip.replaceChildren(item ? button(`${item.title} ✕`, { kind: 'text', onClick: () => { item = null; load(); } }) : '');
  }

  async function load(older = false) {
    if (!older) { items = []; cursor = null; grid.replaceChildren(loadingRegion(2)); more.replaceChildren(); }
    try {
      const r = await ctx.api.call('gallery.list', { ...(category ? { category } : {}), ...(item ? { itemId: item.id } : {}), ...(kind ? { kind } : {}), ...(month ? { month } : {}), ...(older && cursor ? { before: cursor } : {}) });
      categories = r.categories; items = items.concat(r.items); cursor = r.next_cursor; total = r.total;
      drawChips();
      grid.replaceChildren(...(items.length ? items.map(tile) : [emptyState(t('gal.none'), 'photo_library')]));
      count.textContent = t('gal.count', { n: total });
      more.replaceChildren(...(cursor ? [button(t('pay.more'), { block: true, onClick: () => load(true) })] : []));
    } catch (e) { grid.replaceChildren(errorState(friendly(e, t), () => load(older))); }
  }
  kindSel.addEventListener('change', () => { kind = kindSel.value; load(); });
  monthIn.addEventListener('change', () => { month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthIn.value) ? monthIn.value : ''; load(); });
  load();
  return root;
}
