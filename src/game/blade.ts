// Bilah berputar (bounce_blade): memantul di tepi arena, menembus musuh, hidup
// beberapa detik. Arah setelah kena musuh diatur oleh game (menuju musuh berikutnya).
import { CONFIG } from './config';
import { getImage } from './assets';
import { drawByWidth } from './draw';
import { quality } from './quality';

export class Blade {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  rot = 0;
  damage = 0;
  radius = 10;
  lifeMs = 0;

  private maxLifeMs = 1;
  private hitIds: number[] = [];

  spawn(x: number, y: number, angle: number, speed: number, damage: number, lifeMs: number): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.rot = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.hitIds.length = 0;
  }

  aim(angle: number, speed: number): void {
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  addHit(id: number): void {
    this.hitIds.push(id);
  }

  hasHit(id: number): boolean {
    return this.hitIds.indexOf(id) >= 0;
  }

  hits(): number[] {
    return this.hitIds;
  }

  update(dtMs: number, W: number, H: number, pad: number): void {
    const dt = dtMs / 1000;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += CONFIG.upgrades.bounce_blade.spinRate * dt;
    // Pantul di tepi arena.
    if (this.x < pad) {
      this.x = pad;
      this.vx = -this.vx;
    } else if (this.x > W - pad) {
      this.x = W - pad;
      this.vx = -this.vx;
    }
    if (this.y < pad) {
      this.y = pad;
      this.vy = -this.vy;
    } else if (this.y > H - pad) {
      this.y = H - pad;
      this.vy = -this.vy;
    }
    this.lifeMs -= dtMs;
    if (this.lifeMs <= 0) this.active = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const a = this.lifeMs < 300 ? this.lifeMs / 300 : 1; // memudar di akhir
    const w = CONFIG.upgrades.bounce_blade.displayWidth;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);
    // Motion blur: 2-3 salinan dengan sudut tertinggal.
    if (quality.bladeBlur) {
      for (let k = 3; k >= 1; k--) {
        ctx.save();
        ctx.globalAlpha = a * (0.35 - k * 0.08);
        ctx.rotate(this.rot - k * 0.35);
        drawByWidth(ctx, getImage('bullet_blade'), 0, 0, w);
        ctx.restore();
      }
    }
    ctx.rotate(this.rot);
    drawByWidth(ctx, getImage('bullet_blade'), 0, 0, w);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
