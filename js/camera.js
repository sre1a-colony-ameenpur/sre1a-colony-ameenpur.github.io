// A camera button next to a file input (photo or video): the picture or clip taken is added to the input's files, so the screen's own
// submit code needs no change. `multiple` keeps what was already chosen; otherwise the new file replaces it.
import { h, button } from './ui.js';
import { pickPhoto } from './photo.js';

export function withCamera(input, t, { video = false, multiple = false } = {}) {
  const take = button(t(video ? 'cam.record' : 'cam.take'), { icon: video ? 'videocam' : 'photo_camera', onClick: async () => {
    const file = await pickPhoto({ camera: 'environment', accept: video ? 'video/*' : 'image/*' });       // opened straight from the tap
    if (!file) return;
    const dt = new DataTransfer();
    if (multiple) [...input.files].forEach((f) => dt.items.add(f));
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } });
  return h('div', { class: 'stack-sm' }, input, take);
}
