// Helper gambar: menjaga rasio aset ("fit in box") supaya pixel art tidak gepeng/terpotong.
type AnyImage = HTMLImageElement | HTMLCanvasElement;

function dims(img: AnyImage): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: img.width, h: img.height };
}

// Gambar di tengah kotak boxW x boxH, rasio dijaga.
export function drawFit(ctx: CanvasRenderingContext2D, img: AnyImage, cx: number, cy: number, boxW: number, boxH: number): void {
  const d = dims(img);
  const k = Math.min(boxW / d.w, boxH / d.h);
  const w = d.w * k;
  const h = d.h * k;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

// Gambar dengan lebar tetap, tinggi mengikuti rasio. Titik (cx, cy) = tengah.
export function drawByWidth(ctx: CanvasRenderingContext2D, img: AnyImage, cx: number, cy: number, width: number): void {
  const d = dims(img);
  const h = width * (d.h / d.w);
  ctx.drawImage(img, cx - width / 2, cy - h / 2, width, h);
}
