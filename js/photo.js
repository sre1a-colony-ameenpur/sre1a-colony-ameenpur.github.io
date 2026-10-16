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
