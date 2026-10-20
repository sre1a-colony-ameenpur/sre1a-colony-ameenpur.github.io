// Bylaws and EC rules: one PDF per document. Everyone reads; the President uploads, and a new upload replaces the old file.
import { h, card, button, toast, icon, errorState, loadingRegion, emptyState, toastError } from '../ui.js';
import { friendly } from '../api.js';
import { dateShort } from '../fmt.js';
import { store, isFullRole } from '../store.js';

const MAX_BYTES = 2 * 1024 * 1024;
const toBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

export default function render(ctx) {
  const { t } = ctx;
  const isPresident = isFullRole(store.get().session?.role);
  const body = h('div', { class: 'stack' });
  const root = h('div', { class: 'page stack' }, h('h1', { style: 'margin:0' }, t('menu.documents')), body);

  // "Read" fetches the PDF and turns the button into a real link: browsers allow opening a link the person taps, but not one opened after waiting.
  async function readIt(slot, holder) {
    holder.replaceChildren(h('p', { role: 'status', class: 'muted' }, t('common.working')));
    try {
      const { pdfBase64 } = await ctx.api.call('documents.get', { slot });
      const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      holder.replaceChildren(h('a', { class: 'btn primary block', href: url, target: '_blank', rel: 'noopener' }, icon('picture_as_pdf'), t('doc.open')),
        h('a', { class: 'btn block', href: url, download: `${slot}.pdf` }, icon('download'), t('doc.download')));
    } catch (e) { toastError(friendly(e, t)); }
  }

  function uploadControl(it) {
    const input = h('input', { type: 'file', accept: 'application/pdf', class: 'sr-only', id: `doc-${it.slot}`, onChange: async () => {
      const f = input.files[0]; if (!f) return;
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return toast(t('doc.pdfOnly'));
      if (f.size > MAX_BYTES) return toast(t('doc.tooBig'));
      try { await ctx.api.call('documents.upload', { slot: it.slot, pdfBase64: await toBase64(f) }); toast(t('doc.saved')); load(); } catch (e) { toastError(friendly(e, t)); }
    } });
    return h('div', {}, input, h('label', { class: 'btn block', for: input.id }, icon('upload_file'), t(it.has_file ? 'doc.replace' : 'doc.upload')));
  }

  async function load() {
    body.replaceChildren(loadingRegion(2));
    try {
      const { items } = await ctx.api.call('documents.list');
      body.replaceChildren(...items.map((it) => {
        const holder = h('div', { class: 'stack-sm' });
        if (it.has_file) holder.append(button(t('doc.read'), { kind: 'primary', icon: 'menu_book', block: true, onClick: () => readIt(it.slot, holder) }));
        return card(it.title, 'description',
          it.has_file ? h('p', { class: 'small muted' }, t('doc.updated', { date: dateShort(it.uploaded_at), name: it.uploaded_by_name })) : emptyState(t('doc.none'), 'inbox'),
          holder, isPresident ? uploadControl(it) : null);
      }));
    } catch (e) { body.replaceChildren(errorState(friendly(e, t), load)); }
  }
  load();
  return root;
}
