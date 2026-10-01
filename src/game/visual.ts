// Visual 2.5D (lapisan render saja): bayangan, glow additive, cahaya hangat,
// partikel ambient, dekorasi tepi, dan skala perspektif. Semua sprite bantu
// (bayangan/glow/cahaya) di-pre-render SEKALI ke offscreen canvas (cache).
import { CONFIG } from './config';
import { quality } from './quality';

let shadowCanvas: HTMLCanvasElement | null = null;
let glowCanvas: HTMLCanvasElement | null = null;
let lightCanvas: HTMLCanvasElement | null = null;

function makeRadial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

// Panggil sekali setelah DOM siap.
export function initVisual(): void {
  if (!shadowCanvas) {
    shadowCanvas = makeRadial(64, [
      [0, 'rgba(0,0,0,0.9)'],
      [0.55, 'rgba(0,0,0,0.5)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }
  if (!glowCanvas) {
    glowCanvas = makeRadial(64, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.5, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
  }
  if (!lightCanvas) {
    lightCanvas = makeRadial(256, [
      [0, 'rgba(255,224,150,0.55)'],
      [0.45, 'rgba(255,205,120,0.22)'],
      [1, 'rgba(255,180,90,0)'],
    ]);
  }
}

// Skala perspektif halus berdasarkan posisi Y (atas lebih kecil, bawah lebih besar).
export function perspectiveScale(y: number): number {
  const d = CONFIG.fx.depthScale;
  if (!d.enabled) return 1;
  let t = y / CONFIG.view.height;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return d.top + (d.bottom - d.top) * t;
}

// Elips bayangan di tanah. fade < 1 saat objek terangkat.
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, width: number, fade = 1): void {
  if (!CONFIG.fx.shadows || !shadowCanvas) return;
  const w = width * 0.7;
  const h = w / 3;
  ctx.globalAlpha = CONFIG.fx.shadowAlpha * fade;
  ctx.drawImage(shadowCanvas, x - w / 2, groundY - h / 2, w, h);
  ctx.globalAlpha = 1;
}

// Glow additive (peluru, petir, meteor, ledakan).
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  if (!quality.glow || !glowCanvas) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowCanvas, x - size / 2, y - size / 2, size, size);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Cahaya hangat lembut (mis. sekitar player).
export function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  if (!CONFIG.fx.lighting || !lightCanvas) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(lightCanvas, x - size / 2, y - size / 2, size, size);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ----- Partikel ambient (debu/kunang-kunang) -----
interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}
const dust: Dust[] = [];

export function initAmbient(): void {
  if (dust.length) return;
  for (let i = 0; i < CONFIG.fx.ambientCount; i++) {
    dust.push({
      x: Math.random() * CONFIG.view.width,
      y: Math.random() * CONFIG.view.height,
      vx: (Math.random() - 0.5) * 7,
      vy: -4 - Math.random() * 7,
      size: 1 + Math.floor(Math.random() * 2),
      alpha: 0.12 + Math.random() * 0.18,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

export function updateAmbient(dtMs: number): void {
  if (!CONFIG.fx.ambient) return;
  const dt = dtMs / 1000;
  for (const d of dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y < -4) {
      d.y = CONFIG.view.height + 4;
      d.x = Math.random() * CONFIG.view.width;
    }
    if (d.x < -4) d.x = CONFIG.view.width + 4;
    else if (d.x > CONFIG.view.width + 4) d.x = -4;
  }
}

export function drawAmbient(ctx: CanvasRenderingContext2D, timeSec: number): void {
  if (!CONFIG.fx.ambient) return;
  for (const d of dust) {
    const tw = 0.55 + 0.45 * Math.sin(timeSec * 2 + d.phase);
    ctx.globalAlpha = d.alpha * tw;
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(d.x, d.y, d.size + 1, d.size + 1);
  }
  ctx.globalAlpha = 1;
}

// ----- Dekorasi tepi (digambar lewat kode, ikut Y-sorting) -----
export interface Decor {
  isDecor: true;
  baseY: number;
  x: number;
  y: number;
  kind: 0 | 1; // 0 = batu, 1 = semak
  scale: number;
}

let decorList: Decor[] = [];
let decorSize = { w: 0, h: 0 };

// Dekorasi tepi dibangun ulang bila ukuran view berubah.
export function getDecor(): Decor[] {
  const w = CONFIG.view.width;
  const h = CONFIG.view.height;
  if (decorSize.w === w && decorSize.h === h) return decorList;
  decorSize = { w, h };
  decorList = [
    { isDecor: true, x: 22, y: 44, baseY: 44, kind: 0, scale: 1 },
    { isDecor: true, x: w - 22, y: 52, baseY: 52, kind: 1, scale: 0.9 },
    { isDecor: true, x: 30, y: h - 44, baseY: h - 44, kind: 1, scale: 1.1 },
    { isDecor: true, x: w - 28, y: h - 36, baseY: h - 36, kind: 0, scale: 1.05 },
    { isDecor: true, x: w / 2, y: 14, baseY: 14, kind: 0, scale: 0.85 },
  ];
  return decorList;
}

export function drawDecor(ctx: CanvasRenderingContext2D, d: Decor): void {
  if (!CONFIG.fx.decor) return;
  const s = perspectiveScale(d.y) * d.scale;
  // bayangan
  drawShadow(ctx, d.x, d.y + 6 * s, 26 * s, 0.9);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(s, s);
  if (d.kind === 0) {
    // batu: gundukan abu gelap
    ctx.fillStyle = '#4a4640';
    ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = '#5c574f';
    ctx.fillRect(-7, -10, 12, 6);
    ctx.fillStyle = '#3a3630';
    ctx.fillRect(-7, 4, 14, 3);
  } else {
    // semak: rumpun hijau gelap
    ctx.fillStyle = '#2f4a26';
    ctx.fillRect(-9, -8, 18, 14);
    ctx.fillStyle = '#3c5c2f';
    ctx.fillRect(-7, -11, 12, 8);
    ctx.fillStyle = '#243a1d';
    ctx.fillRect(-9, 4, 18, 3);
  }
  ctx.restore();
}
