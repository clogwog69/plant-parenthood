export interface Shot {
  full: string;
  thumb: string;
}

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
    img.src = url;
  });
}

function scale(img: HTMLImageElement, max: number, quality: number): string {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** Shrinks a camera photo so hundreds of them fit comfortably on the phone. */
export async function shoot(file: File): Promise<Shot> {
  const img = await load(file);
  return { full: scale(img, 1280, 0.8), thumb: scale(img, 360, 0.72) };
}
