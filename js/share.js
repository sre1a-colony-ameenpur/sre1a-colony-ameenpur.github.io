// Share a link to one record. The link is this app's address plus the record's own route, so it opens the installed app or the browser on that screen.
// The text is only a short title built from the record by the caller; amounts, people and phone numbers are never put in it.
import { h, icon, toast } from './ui.js';

const clip = (s, n = 80) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export { clip };

// Route path (starting with '/') -> full link. Each id is escaped so it stays one path part.
export function shareUrl(path, loc = globalThis.location) { return `${loc.origin}${loc.pathname}#${path}`; }
export const entityPath = (base, id) => `${base}/${encodeURIComponent(id)}`;

// The share sheet of the phone; where there is none (most computers) the title and link are copied instead.
export async function shareEntity(ctx, { title, path }) {
  const url = shareUrl(path), text = clip(title);
  if (globalThis.navigator?.share) {
    try { await navigator.share({ title: text, text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); ctx.toast ? ctx.toast(ctx.t('share.copied')) : toast(ctx.t('share.copied')); }
  catch { toast(`${text} ${url}`, 12000); }
}

export function shareButton(ctx, spec) {
  const label = ctx.t('share.button');
  return h('button', { type: 'button', class: 'icon-btn', 'data-tour': 'share', 'aria-label': label, title: label, onClick: () => shareEntity(ctx, spec) }, icon('share'));
}

// A heading with the Share icon at its end.
export function shareHead(ctx, heading, spec) {
  return h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;flex-wrap:nowrap' }, heading, shareButton(ctx, spec));
}
