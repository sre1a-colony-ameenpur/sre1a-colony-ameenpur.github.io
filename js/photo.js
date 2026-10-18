// Client-side photo reduction before upload (T036): long side 1600 px, JPEG 0.8, EXIF rotation applied.
export function fitSize(w, h, max = 1600) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// Opens the phone's camera ("user" = front, "environment" = back) or its photo gallery and resolves with the chosen File, or null when cancelled.
// Call it straight from a tap: browsers only open the picker from a user gesture.
export function pickPhoto({ camera = null, accept = 'image/*' } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    if (camera) input.setAttribute('capture', camera);
    input.addEventListener('change', () => resolve(input.files?.[0] || null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

// Returns the JPEG as base64 (no data: prefix). Retries at lower quality if the result is over maxBase64 characters.
export async function compressPhoto(file, { max = 1600, quality = 0.8, maxBase64 = 2400000 } = {}) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitSize(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, width, height);   // PNG transparency would turn black in a JPEG
  g.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  for (let q = quality; q >= 0.4; q -= 0.1) {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    const b64 = await blobToBase64(blob);
    if (b64.length <= maxBase64) return b64;
  }
  throw new Error('photo too large');
}

// A photo for the private categories (complaints, comments, fixes): the optimised picture plus a ~240 px thumbnail the gallery grid shows.
export async function photoWithThumb(file, { maxBase64 = 1400000 } = {}) {
  const jpegBase64 = await compressPhoto(file, { maxBase64 });
  let thumbBase64 = '';
  try { thumbBase64 = await compressPhoto(file, { max: 240, quality: 0.6, maxBase64: 28000 }); } catch { /* no thumbnail: the gallery asks for one later */ }
  return thumbBase64 ? { jpegBase64, thumbBase64 } : { jpegBase64 };
}
