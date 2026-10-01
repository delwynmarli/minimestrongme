// Pemain: diam di tengah arena. Animasi idle di kode (napas + squash + skew).
import { CONFIG } from './config';
import { getImage, getTinted } from './assets';
import { drawByWidth } from './draw';
import { perspectiveScale, drawShadow } from './visual';
import { springTo, springKick, type Spring } from './anim';
import type { PlayerState } from './playerState';

export class Player {
  x = CONFIG.player.x;
  y = CONFIG.player.y;
  flashMs = 0;
  facing = 1;
  private lean: Spring = { value: 0, vel: 0 }; // condong saat menembak (derajat)
  private squashMs = 0;
  private hitTintMs = 0;
  private popMs = 0;
  private recoilX = 0;
  private recoilY = 0;
  private recoilMs = 0;

  constructor(private state: PlayerState) {}

  // Dasar sprite (untuk Y-sorting).
  get baseY(): number {
    return this.y;
  }

  reset(): void {
    this.flashMs = 0;
    this.recoilMs = 0;
    this.facing = 1;
    this.lean.value = 0;
    this.lean.vel = 0;
    this.squashMs = 0;
    this.hitTintMs = 0;
    this.popMs = 0;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    if (this.flashMs > 0) this.flashMs -= dtMs;
    if (this.recoilMs > 0) this.recoilMs -= dtMs;
    if (this.squashMs > 0) this.squashMs -= dtMs;
    if (this.hitTintMs > 0) this.hitTintMs -= dtMs;
    if (this.popMs > 0) this.popMs -= dtMs;
    if (this.state.invincibleMs > 0) this.state.invincibleMs -= dtMs;
    springTo(this.lean, 0, CONFIG.fx.anim.springStiffness, CONFIG.fx.anim.springDamping, dt);
  }

  damage(amount: number): void {
    if (this.state.invincibleMs > 0) return; // kebal sementara
    this.state.hp = Math.max(0, this.state.hp - amount);
    this.flashMs = CONFIG.player.flashMs;
    this.state.invincibleMs = Math.max(this.state.invincibleMs, CONFIG.player.hitInvincibleMs);
    this.squashMs = CONFIG.fx.anim.enemyHitSquashMs + 120; // squash singkat saat kena
    this.hitTintMs = CONFIG.fx.anim.enemyHitSquashMs;
  }

  // Dipanggil saat upgrade/level dipilih (pop skala kecil).
  onUpgrade(): void {
    this.popMs = CONFIG.fx.anim.playerPopMs;
  }

  // Dorongan balik + condong ke arah tembakan (spring, ada overshoot).
  recoil(angle: number): void {
    const p = CONFIG.player.recoilPx;
    this.recoilX = -Math.cos(angle) * p;
    this.recoilY = -Math.sin(angle) * p;
    this.recoilMs = CONFIG.player.recoilMs;
    this.facing = Math.cos(angle) >= 0 ? 1 : -1;
    springKick(this.lean, this.facing * CONFIG.fx.anim.leanKick);
  }

  drawShadow(ctx: CanvasRenderingContext2D): void {
    const img = getImage('player');
    const h = CONFIG.player.displayWidth * (img.naturalHeight / img.naturalWidth);
    const s = perspectiveScale(this.y);
    drawShadow(ctx, this.x, this.y + h * 0.45 * s, CONFIG.player.displayWidth * s, 1);
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const { bobAmp, bobSpeed, squashAmt, displayWidth, flashMs, recoilMs } = CONFIG.player;
    const an = CONFIG.fx.anim;
    const s = Math.sin(timeSec * bobSpeed);
    const bob = s * bobAmp;
    const squash = Math.abs(s) * squashAmt;
    const rk = this.recoilMs > 0 ? this.recoilMs / recoilMs : 0;
    const breathe = CONFIG.fx.hopAnim ? 1 + Math.sin(timeSec * 2.4) * an.breathe : 1;
    const persp = perspectiveScale(this.y);

    // Berkedip saat kebal sementara.
    if (this.state.invincibleMs > 0 && Math.floor(this.state.invincibleMs / 100) % 2 === 0) {
      return;
    }

    // Squash saat kena damage + pop saat upgrade.
    let sq = 0;
    if (this.squashMs > 0) sq = Math.sin((1 - this.squashMs / (an.enemyHitSquashMs + 120)) * Math.PI) * an.playerHitSquashPx;
    const pop = this.popMs > 0 ? Math.sin((1 - this.popMs / an.playerPopMs) * Math.PI) * an.playerPop : 0;
    const skew = CONFIG.fx.hopAnim ? Math.tan((Math.sin(timeSec * 2.2) * an.idleSkew * Math.PI) / 180) : 0;
    const leanRad = (this.lean.value * Math.PI) / 180;

    ctx.save();
    ctx.translate(this.x + this.recoilX * rk, this.y + bob + this.recoilY * rk);
    ctx.transform(1, 0, skew, 1, 0, 0); // ayunan "jubah"
    if (leanRad !== 0) ctx.rotate(leanRad);
    ctx.scale(
      this.facing * (1 + squash - sq) * breathe * persp * (1 + pop),
      (1 - squash + sq * 0.6) * breathe * persp * (1 + pop),
    );
    drawByWidth(ctx, getImage('player'), 0, 0, displayWidth);
    if (this.hitTintMs > 0) {
      ctx.globalAlpha = Math.min(1, this.hitTintMs / an.enemyHitSquashMs) * 0.7;
      drawByWidth(ctx, getTinted('player', '#ff4d4d'), 0, 0, displayWidth);
      ctx.globalAlpha = 1;
    }
    if (this.flashMs > 0) {
      ctx.globalAlpha = Math.min(1, this.flashMs / flashMs);
      drawByWidth(ctx, getTinted('player', '#ffffff'), 0, 0, displayWidth);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}


