// Videos on events and complaints. The file never goes through our server: the backend starts an UNLISTED upload on the colony's YouTube channel,
// the browser sends the file straight to YouTube, and only the video id is stored. Played in the app with no address and no share button
// (a deterrent, not security: unlisted only means "not searchable").
import { h, button, card, openSheet, toast, icon } from './ui.js';
import { friendly } from './api.js';

const ORIGINS = ['https://sre1a-colony-ameenpur.github.io', 'http://localhost:8080', 'http://127.0.0.1:8080'];

// PUT the file to the YouTube session address; resolves with the video id YouTube returns.
export function putToYoutube(sessionUrl, file, onProgress, XHR = globalThis.XMLHttpRequest) {
  return new Promise((resolve, reject) => {
    const x = new XHR();
    x.open('PUT', sessionUrl);
    x.setRequestHeader('Content-Type', file.type || 'video/mp4');
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    x.onerror = () => reject(new Error('network'));
    x.onload = () => {
      let id = null;
      try { id = JSON.parse(x.responseText).id; } catch { /* no readable answer */ }
      if (x.status >= 200 && x.status < 300 && id) resolve(id); else reject(new Error(`youtube ${x.status}`));
    };
    x.send(file);
  });
}

export async function uploadVideo(ctx, { parentType, parentId, file, caption, onProgress }) {
  const origin = ORIGINS.includes(location.origin) ? location.origin : undefined;
  const { sessionUrl } = await ctx.api.call('media.initVideoUpload', { parentType, parentId, sizeBytes: file.size, mime: file.type || 'video/mp4', title: caption || file.name, origin });
  const videoId = await putToYoutube(sessionUrl, file, onProgress);
  return ctx.api.call('media.finalizeVideoUpload', { parentType, parentId, videoId, caption: caption || '' });
}

export function addVideoSheet(ctx, { parentType, parentId, done }) {
  const { t } = ctx;
  const file = h('input', { type: 'file', accept: 'video/*', id: 'vd-file' });
  const caption = h('input', { type: 'text', maxlength: 200, id: 'vd-cap', placeholder: t('vid.caption') });
  const bar = h('progress', { max: 100, value: 0, style: 'width:100%', hidden: true });
  const note = h('div', { role: 'alert', 'aria-live': 'polite' });
  openSheet({ title: t('vid.add'), body: h('div', { class: 'stack' },
    h('div', { class: 'field' }, h('label', { for: 'vd-file' }, t('vid.pick')), file), h('div', { class: 'field' }, h('label', { for: 'vd-cap' }, t('vid.caption')), caption),
    bar, h('p', { class: 'small muted' }, t('vid.keepOpen')), note), actions: [
    { label: t('vid.start'), kind: 'primary', keepOpen: true, onClick: async (close) => {
      const f = file.files[0];
      if (!f) { note.replaceChildren(h('div', { class: 'banner warn' }, t('vid.pick'))); return; }
      bar.hidden = false; bar.value = 0; note.replaceChildren();
      try {
        const r = await uploadVideo(ctx, { parentType, parentId, file: f, caption: caption.value.trim(), onProgress: (p) => { bar.value = p; } });
        close(); toast(r.processing ? t('vid.processing') : t('vid.added')); done?.();
      } catch (e) {
        bar.hidden = true;
        note.replaceChildren(h('div', { class: 'banner warn' }, e.code === 'INVALID' && e.extra?.details?.max_mb ? t('vid.tooBig', { mb: e.extra.details.max_mb }) : e.code ? friendly(e, t) : t('vid.failed')));
      }
    } }, { label: t('common.cancel') }] });
}

let apiReady = null;
const loadYoutubeApi = () => (apiReady ||= new Promise((resolve, reject) => {
  if (globalThis.YT?.Player) { resolve(); return; }
  globalThis.onYouTubeIframeAPIReady = () => resolve();
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { apiReady = null; reject(new Error('youtube api')); };
  document.head.append(s);
}));

// The in-app player: YouTube's embed with its own controls hidden and a click-shield over it; our play, seek and full screen controls below.
export async function playVideo(ctx, mediaId) {
  const { t } = ctx;
  try {
    const { youtubeId } = await ctx.api.call('media.video', { id: mediaId });
    await loadYoutubeApi();
    const mount = h('div', { style: 'position:absolute;inset:0;width:100%;height:100%' });
    const shield = h('div', { style: 'position:absolute;inset:0;z-index:2' });
    const box = h('div', { style: 'position:relative;aspect-ratio:16/9;background:#000' }, mount, shield);
    const note = h('p', { class: 'small muted', role: 'status' });
    let player;
    const pp = button(t('vid.play'), { icon: 'play_arrow', onClick: () => (player?.getPlayerState() === 1 ? player.pauseVideo() : player?.playVideo()) });
    const seek = h('input', { type: 'range', min: 0, max: 100, value: 0, 'aria-label': t('vid.seek'), style: 'flex:1', onInput: (e) => player?.seekTo(player.getDuration() * e.target.value / 100, true) });
    const full = button(t('vid.fullscreen'), { icon: 'fullscreen', kind: 'text', onClick: () => box.requestFullscreen?.() });
    shield.addEventListener('click', () => pp.click());
    const dlg = openSheet({ title: t('vid.title1'), wide: true, body: h('div', { class: 'stack' }, box, h('div', { class: 'row' }, pp, seek, full), note), actions: [{ label: t('common.close') }], onClose: () => { try { player?.destroy(); } catch { /* gone */ } } });
    player = new globalThis.YT.Player(mount, { host: 'https://www.youtube-nocookie.com', videoId: youtubeId,
      playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, iv_load_policy: 3 },
      events: { onError: () => { note.textContent = t('vid.playerError'); },
        onStateChange: (e) => { pp.lastChild.textContent = e.data === 1 ? t('vid.pause') : t('vid.play'); } } });
    return dlg;
  } catch (e) { toast(e.code ? friendly(e, t) : t('vid.playerError')); }
}

// A card with the videos of one record and an "Add a video" button. `videos` are media rows with kind 'video' (they never carry the YouTube id).
export function videosCard(ctx, { videos, parentType, parentId, canAdd, done }) {
  const { t } = ctx;
  if (!videos.length && !canAdd) return null;
  return card(t('vid.title', { n: videos.length }), 'videocam',
    videos.length ? h('div', { class: 'stack-sm' }, videos.map((m) => h('button', { type: 'button', class: 'list-row map-row', style: 'width:100%;text-align:start', onClick: () => playVideo(ctx, m.id) },
      icon('play_circle'), h('div', { class: 'grow' }, m.caption || t('vid.video'))))) : h('p', { class: 'muted' }, t('vid.none')),
    canAdd ? button(t('vid.add'), { icon: 'video_call', block: true, onClick: () => addVideoSheet(ctx, { parentType, parentId, done }) }) : null);
}
