// Layar pilih upgrade: overlay gelap + panel bawah + 3 kartu (animasi & klik).
import { CONFIG } from '../config';
import { getImage } from '../assets';
import { drawFit } from '../draw';
import { easeOutBack } from '../anim';
import type { PlayerState } from '../playerState';
import type { UpgradeDef } from '../upgrades/types';
import { opensSynergy } from '../upgrades/synergy';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Bungkus teks jadi beberapa baris agar muat dalam maxWidth.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export class UpgradeScreen {
  private choices: UpgradeDef[] = [];
  private state!: PlayerState;
  private appearMs = 0;
  private pressedIndex = -1;

  open(choices: UpgradeDef[], state: PlayerState): void {
    this.choices = choices;
    this.state = state;
    this.appearMs = 0;
    this.pressedIndex = -1;
  }

  close(): void {
    this.choices = [];
    this.pressedIndex = -1;
  }

  isOpen(): boolean {
    return this.choices.length > 0;
  }

  update(dtMs: number): void {
    this.appearMs += dtMs;
  }

  private cardRects(): Rect[] {
    const { cardWidth, cardHeight, cardGap, cardTopGap, panelHeight } = CONFIG.ui;
    const n = this.choices.length;
    const totalW = n * cardWidth + (n - 1) * cardGap;
    const startX = (CONFIG.view.width - totalW) / 2;
    const y = CONFIG.view.height - panelHeight + cardTopGap;
    const out: Rect[] = [];
    for (let i = 0; i < n; i++) out.push({ x: startX + i * (cardWidth + cardGap), y, w: cardWidth, h: cardHeight });
    return out;
  }

  private hitCard(x: number, y: number): number {
    const rects = this.cardRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  onPointerDown(x: number, y: number): void {
    this.pressedIndex = this.hitCard(x, y);
  }

  onPointerUp(x: number, y: number): UpgradeDef | null {
    const i = this.hitCard(x, y);
    const chosen = i >= 0 && i === this.pressedIndex ? this.choices[i] : null;
    this.pressedIndex = -1;
    return chosen ?? null;
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    const { panelHeight, titleFont } = CONFIG.ui;
    const panelY = H - panelHeight;

    // Overlay gelap.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    // Panel gelap bawah.
    ctx.fillStyle = 'rgba(12,14,22,0.94)';
    ctx.fillRect(0, panelY, W, panelHeight);
    ctx.fillStyle = 'rgba(90,120,200,0.5)';
    ctx.fillRect(0, panelY, W, 2);

    // Judul.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${titleFont}px "Press Start 2P"`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    const title = 'CHOOSE YOUR UPGRADE';
    ctx.strokeText(title, W / 2, panelY + 18);
    ctx.fillText(title, W / 2, panelY + 18);

    // Kartu.
    const rects = this.cardRects();
    for (let i = 0; i < this.choices.length; i++) this.drawCard(ctx, rects[i], i);
  }

  private drawCard(ctx: CanvasRenderingContext2D, r: Rect, i: number): void {
    const { appearStaggerMs, appearDurMs, slideUpPx, pressScale, iconBox, nameFont, descFont, levelFont, cardWidth } = CONFIG.ui;
    const t = Math.min(1, Math.max(0, (this.appearMs - i * appearStaggerMs) / appearDurMs));
    const e = easeOutBack(t); // overshoot
    const slide = (1 - Math.min(1, e)) * slideUpPx + Math.sin((this.appearMs / 1000) * 2 + i) * 1.5; // float
    const appearScale = 0.6 + 0.4 * e;
    const scale = (i === this.pressedIndex ? pressScale : 1) * appearScale;

    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + slide;

    ctx.save();
    ctx.globalAlpha = 0.15 + 0.85 * Math.min(1, t * 1.3);
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    const def = this.choices[i];
    const cur = this.state.levelOf(def.id);
    const frameSize = cardWidth;

    // Bingkai ui_panel (persegi) di bagian atas kartu.
    drawFit(ctx, getImage('ui_panel'), cx, r.y + slide + frameSize / 2, frameSize, frameSize);

    // Ikon di tengah bingkai.
    drawFit(ctx, getImage(def.icon), cx, r.y + slide + frameSize / 2, iconBox, iconBox);

    // Nama.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `${nameFont}px "Press Start 2P"`;
    ctx.fillText(def.name, cx, r.y + slide + frameSize + 12);

    // Deskripsi (1-2 baris).
    ctx.fillStyle = '#cfd6e6';
    ctx.font = `${descFont}px "Press Start 2P"`;
    const lines = wrapText(ctx, def.description(cur + 1), frameSize - 8).slice(0, 2);
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], cx, r.y + slide + frameSize + 28 + li * 10);
    }

    // Indikator level.
    ctx.fillStyle = '#8fd4ff';
    ctx.font = `${levelFont}px "Press Start 2P"`;
    ctx.fillText(`Lv ${cur + 1}/${def.maxLevel}`, cx, r.y + r.h + slide - 12);

    // Lencana synergy bila kartu ini akan membuka synergy (bergetar halus).
    if (opensSynergy(this.state, def.id, cur + 1)) {
      const jig = Math.sin(this.appearMs * 0.012 + i) * 1.5;
      const bs = CONFIG.synergy.badgeSize;
      drawFit(ctx, getImage('ui_badge_synergy'), r.x + r.w - bs / 2 - 4 + jig, r.y + slide + bs / 2 + 4, bs, bs);
    }

    // Kilau (shine sweep) melintas berkala.
    const shine = ((this.appearMs / 1000 + i * 0.6) % 2.2) / 2.2;
    if (shine < 0.28) {
      const px = r.x - 20 + (shine / 0.28) * (r.w + 40);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y + slide, r.w, r.h);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px, r.y + slide);
      ctx.lineTo(px + 10, r.y + slide);
      ctx.lineTo(px - 8, r.y + slide + r.h);
      ctx.lineTo(px - 18, r.y + slide + r.h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}
