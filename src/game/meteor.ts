// Meteor (meteor): fase mark (penanda merah di tanah) -> fall (jatuh dari
// atas-kanan) -> explode (ledakan area). Game memberi damage saat ledakan mulai.
import { CONFIG } from './config';
import { getImage } from './assets';
import { drawFit } from './draw';
import { perspectiveScale, drawGlow, drawShadow } from './visual';

type Phase = 'mark' | 'fall' | 'explode';

export class Meteor {
  active = false;
  x = 0;
  y = 0;
  private phase: Phase = 'mark';
  private timer = 0;
  private phaseDur = 1;

  spawn(x: number, y: number): void {
    const c = CONFIG.upgrades.meteor;
    this.active = true;
    this.x = x;
    this.y = y;
    this.phase = 'mark';
    this.timer = c.markMs;
    this.phaseDur = c.markMs;
  }

  // return true tepat saat ledakan mulai (frame itu).
  update(dtMs: number): boolean {
    if (!this.active) return false;
    this.timer -= dtMs;
    if (this.timer > 0) return false;
    const c = CONFIG.upgrades.meteor;
    if (this.phase === 'mark') {
      this.phase = 'fall';
      this.timer = c.fallMs;
      this.phaseDur = c.fallMs;
      return false;
    }
    if (this.phase === 'fall') {
      this.phase = 'explode';
      this.timer = c.explosionMs;
      this.phaseDur = c.explosionMs;
      return true;
    }
    this.active = false;
    return false;
  }

  // Bayangan di tanah: membesar saat meteor mendekat.
  drawShadow(ctx: CanvasRenderingContext2D): void {
    const c = CONFIG.upgrades.meteor;
    const persp = perspectiveScale(this.y);
    let width = c.radius * 0.6 * persp;
    let fade = 0.5;
    if (this.phase === 'fall') {
      const t = 1 - this.timer / this.phaseDur;
      width = (c.radius * 0.5 + c.radius * 0.9 * t) * 2 * persp;
      fade = 0.5 + 0.5 * t;
    } else if (this.phase === 'explode') {
      width = c.radius * 2.6 * persp;
      fade = 1;
    }
    drawShadow(ctx, this.x, this.y, width, fade);
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const c = CONFIG.upgrades.meteor;
    if (this.phase === 'mark') {
      const t = 1 - this.timer / this.phaseDur;
      ctx.save();
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + 0.3 * Math.abs(Math.sin(timeSec * 10));
      ctx.beginPath();
      ctx.arc(this.x, this.y, c.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,70,70,0.22)';
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1, c.radius * (1 - t)), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,120,120,0.4)';
      ctx.fill();
      ctx.restore();
    } else if (this.phase === 'fall') {
      const t = 1 - this.timer / this.phaseDur;
      const sx = this.x + c.spawnOffsetX * (1 - t);
      const sy = this.y - c.spawnOffsetY * (1 - t);
      drawGlow(ctx, sx, sy, c.displayWidth * 1.8, 0.7);
      drawFit(ctx, getImage('vfx_meteor'), sx, sy, c.displayWidth, c.displayWidth);
    } else {
      const t = 1 - this.timer / this.phaseDur;
      const size = c.radius * 2 * (0.8 + 0.6 * t);
      ctx.globalAlpha = 1 - t;
      drawFit(ctx, getImage('vfx_explosion'), this.x, this.y, size, size);
      ctx.globalAlpha = 1;
      drawGlow(ctx, this.x, this.y, size * 1.5, 0.6 * (1 - t));
    }
  }
}
