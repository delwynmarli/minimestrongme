// Peluru: bergerak lurus, sprite berotasi mengikuti arah. Bisa menembus (pierce)
// dan memantul ke musuh berikutnya (bounce). `hitIds` mencegah musuh sama kena 2x.
// Digambar terangkat dari tanah (kesan ketinggian) + bayangan kecil + glow.
import { CONFIG } from './config';
import { getImage } from './assets';
import { drawByWidth } from './draw';
import { perspectiveScale, drawGlow, drawShadow } from './visual';

export class Bullet {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  rot = 0;
  speed = 0;
  damage = 0;
  radius = 5;
  critical = false;
  pierceLeft = 0;
  bounceLeft = 0;

  private hitIds: number[] = [];

  spawn(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    critical: boolean,
    pierce: number,
    bounce: number,
  ): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.rot = angle;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.critical = critical;
    this.pierceLeft = pierce;
    this.bounceLeft = bounce;
    this.hitIds.length = 0;
  }

  aim(angle: number): void {
    this.rot = angle;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
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

  drawShadow(ctx: CanvasRenderingContext2D): void {
    if (!CONFIG.fx.shadows) return;
    const w = CONFIG.bullet.basic.displayWidth * 0.5 * perspectiveScale(this.y);
    drawShadow(ctx, this.x, this.y, w, Math.max(0.35, 1 - CONFIG.fx.bulletHeight / 26));
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const w = CONFIG.bullet.basic.displayWidth * perspectiveScale(this.y);
    const img = getImage('bullet_basic');
    const y = this.y - CONFIG.fx.bulletHeight; // terangkat dari tanah
    const stretch = 1 + Math.min(0.6, this.speed / 700); // memanjang sesuai kecepatan
    if (CONFIG.fx.enabled) {
      // Jejak halus (trail) di belakang peluru.
      const t = CONFIG.effects.bulletTrail;
      const len = Math.hypot(this.vx, this.vy) || 1;
      const ux = this.vx / len;
      const uy = this.vy / len;
      for (let i = t.ghosts; i >= 1; i--) {
        ctx.globalAlpha = t.alpha * (1 - i / (t.ghosts + 1));
        ctx.save();
        ctx.translate(this.x - ux * t.spacing * i, y - uy * t.spacing * i);
        ctx.rotate(this.rot);
        ctx.scale(stretch, 1);
        drawByWidth(ctx, img, 0, 0, w);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // Glow berdenyut.
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 18 + this.x * 0.05);
    drawGlow(ctx, this.x, y, w * (1.6 + 0.3 * pulse), (this.critical ? 0.9 : 0.5) * (0.7 + 0.3 * pulse));
    ctx.save();
    ctx.translate(this.x, y);
    ctx.rotate(this.rot);
    ctx.scale(stretch, 1);
    drawByWidth(ctx, img, 0, 0, w);
    ctx.restore();
  }
}


