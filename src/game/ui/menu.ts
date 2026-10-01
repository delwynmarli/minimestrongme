// Elemen UI menu bersama: tombol, fade, layar Title, dan overlay Pause.
// Semua tombol memakai ui_btn_blank + teks Press Start 2P (tinggi min 44 px).
import { CONFIG } from '../config';
import { getImage } from '../assets';
import { drawFit, drawByWidth } from '../draw';
import type { GameSettings } from '../save';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, fontPx: number, pressed: boolean): void {
  const s = pressed ? CONFIG.ui.pressScale : 1;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  ctx.drawImage(getImage('ui_btn_blank'), r.x, r.y, r.w, r.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontPx}px "Press Start 2P"`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.strokeText(label, cx, cy);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

export function drawFade(ctx: CanvasRenderingContext2D, alpha: number): void {
  if (alpha <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
  ctx.globalAlpha = 1;
}

// ----- Title screen -----

export function titlePlayRect(): Rect {
  const w = 180;
  const h = 80;
  const y = (CONFIG.view.height / 640) * 452;
  return { x: (CONFIG.view.width - w) / 2, y, w, h };
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  bestWave: number,
  bestKills: number,
  pressed: boolean,
): void {
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;
  const S = H / 640; // skala tata letak vertikal
  // Latar cover layar (jaga rasio).
  const bg = getImage('bg_title');
  const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
  const bw = bg.naturalWidth * k;
  const bh = bg.naturalHeight * k;
  ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
  ctx.fillStyle = `rgba(0,0,0,${CONFIG.background.titleDim})`;
  ctx.fillRect(0, 0, W, H);

  // Logo melayang halus.
  const logo = getImage('ui_logo_title');
  const lw = 250;
  const lh = lw * (logo.naturalHeight / logo.naturalWidth);
  const ly = 122 * S + Math.sin(timeSec * 1.8) * 6;
  drawFit(ctx, logo, W / 2, ly, lw, lh);

  // Kilau melintas pada logo.
  const sh = (timeSec % 2.4) / 2.4;
  if (sh < 0.35) {
    const sx0 = W / 2 - lw / 2 - 20 + (sh / 0.35) * (lw + 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(sx0, ly - lh / 2);
    ctx.lineTo(sx0 + 14, ly - lh / 2);
    ctx.lineTo(sx0 - 10, ly + lh / 2);
    ctx.lineTo(sx0 - 24, ly + lh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Player idle di tengah.
  const bob = Math.sin(timeSec * 3.2) * 3;
  drawByWidth(ctx, getImage('player'), W / 2, 362 * S + bob, 56);

  drawButton(ctx, titlePlayRect(), 'PLAY', 18, pressed);

  // Skor terbaik.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '9px "Press Start 2P"';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(`BEST WAVE ${bestWave}`, W / 2, 566 * S);
  ctx.fillStyle = '#cfd6e6';
  ctx.fillText(`BEST KILLS ${bestKills}`, W / 2, 586 * S);
}

// ----- Pause overlay -----

export interface PauseLayout {
  resume: Rect;
  restart: Rect;
  menu: Rect;
  effects: Rect;
  vibration: Rect;
  sound: Rect;
  difficulty: Rect;
}

export function pauseLayout(): PauseLayout {
  const W = CONFIG.view.width;
  const w = 200;
  const h = 46;
  const gap = 12;
  const toggle = 44;
  // Total tinggi blok (di-center vertikal agar pas di semua rasio).
  const total = h * 3 + gap * 2 + 14 + toggle * 4 + 4 * 3;
  let y = Math.max(58, (CONFIG.view.height - total) / 2);
  const x = (W - w) / 2;
  const resume: Rect = { x, y, w, h };
  y += h + gap;
  const restart: Rect = { x, y, w, h };
  y += h + gap;
  const menu: Rect = { x, y, w, h };
  y += h + gap + 14;
  const tw = 240;
  const tx = (W - tw) / 2;
  const effects: Rect = { x: tx, y, w: tw, h: toggle };
  y += toggle + 4;
  const vibration: Rect = { x: tx, y, w: tw, h: toggle };
  y += toggle + 4;
  const sound: Rect = { x: tx, y, w: tw, h: toggle };
  y += toggle + 4;
  const difficulty: Rect = { x: tx, y, w: tw, h: toggle };
  return { resume, restart, menu, effects, vibration, sound, difficulty };
}

function drawToggle(ctx: CanvasRenderingContext2D, r: Rect, label: string, on: boolean): void {
  ctx.fillStyle = 'rgba(20,22,32,0.92)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#5a7bd0';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '9px "Press Start 2P"';
  ctx.fillStyle = '#cfd6e6';
  ctx.fillText(label, r.x + 12, r.y + r.h / 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = on ? '#5ad06a' : '#8a8f98';
  ctx.fillText(on ? 'ON' : 'OFF', r.x + r.w - 12, r.y + r.h / 2);
}

export function drawPause(ctx: CanvasRenderingContext2D, settings: GameSettings, pressed: (id: string) => boolean): void {
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  const L = pauseLayout();
  const titleY = Math.max(24, L.resume.y - 44);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px "Press Start 2P"';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  ctx.strokeText('PAUSED', W / 2, titleY);
  ctx.fillText('PAUSED', W / 2, titleY);

  drawButton(ctx, L.resume, 'RESUME', 12, pressed('resume'));
  drawButton(ctx, L.restart, 'RESTART', 12, pressed('restart'));
  drawButton(ctx, L.menu, 'MENU', 12, pressed('menu'));
  drawToggle(ctx, L.effects, 'EFFECTS', settings.effects);
  drawToggle(ctx, L.vibration, 'VIBRATION', settings.vibration);
  drawToggle(ctx, L.sound, 'SOUND', settings.sound);
  drawValueRow(ctx, L.difficulty, 'DIFFICULTY', settings.difficulty.toUpperCase(), '#ffd24d');
}

// Baris pilihan teks (mis. DIFFICULTY: NORMAL).
function drawValueRow(ctx: CanvasRenderingContext2D, r: Rect, label: string, value: string, color: string): void {
  ctx.fillStyle = 'rgba(20,22,32,0.92)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#5a7bd0';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '9px "Press Start 2P"';
  ctx.fillStyle = '#cfd6e6';
  ctx.fillText(label, r.x + 12, r.y + r.h / 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.fillText(value, r.x + r.w - 12, r.y + r.h / 2);
}
