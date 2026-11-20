// Client-side Canvas image compression and square cropping for avatars & chat images

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selecciona un archivo de imagen válido (JPG, PNG, WebP o GIF).'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen está dañada o no es compatible.'));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function exportCanvasOptimal(canvas, quality = 0.82) {
  // Prefer WebP when supported, fall back to JPEG
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Center-crops any image to a square 256x256 avatar (~15-35 KB)
 */
export async function compressAvatar(file, targetSize = 256) {
  const img = await loadImageFromFile(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

  return exportCanvasOptimal(canvas, 0.82);
}

/**
 * Resizes a chat photo preserving aspect ratio up to maxDimension (default 800px)
 */
export async function compressChatImage(file, maxDimension = 800) {
  const img = await loadImageFromFile(file);
  let { width, height } = img;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return exportCanvasOptimal(canvas, 0.8);
}
