// Cincin rune ritual (RENDER saja): berputar pelan, glow berdenyut, dan flash
// interaktif (menembak / kena damage / pilih upgrade + gelombang kejut wave).
// Semua digambar via path + sprite glow pra-render (tanpa alokasi per frame).
import { CONFIG } from './config';
import { drawGlow } from './visual';

export class RuneField {
  private outerRot = 0;
  private innerRot = 0;
  private shootMs = 0;
  private hitMs = 0;
  private upgradeMs = 0;
  private upgradeColor = '#4fd2ff';
  private shockMs = 0;

  flashShoot(): void {
    this.shootMs = CONFIG.arena.runeShootFlashMs;
  }
  flashHit(): void {
    this.hitMs = CONFIG.arena.runeHitFlashMs;
  }
  flashUpgrade(color: string): void {
    this.upgradeMs = CONFIG.arena.runeUpgradeFlashMs;
    this.upgradeColor = color;
  }
  shockwave(): void {
    this.shockMs = CONFIG.arena.shockwaveMs;
  }

  update(dtMs: number): void {
    if (!CONFIG.fx.runes) return;
    const dt = dtMs / 1000;
    this.outerRot += CONFIG.arena.runeOuterSpeed * dt;
    this.innerRot += CONFIG.arena.runeInnerSpeed * dt;
    if (this.shootMs > 0) this.shootMs -= dtMs;
    if (this.hitMs > 0) this.hitMs -= dtMs;
    if (this.upgradeMs > 0) this.upgradeMs -= dtMs;
    if (this.shockMs > 0) this.shockMs -= dtMs;
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    if (!CONFIG.fx.runes) return;
    const a = CONFIG.arena;
    const cx = a.cx;
    const cy = a.cy;
    const pulse = a.runeGlowMin + (a.runeGlowMax - a.runeGlowMin) * (0.5 + 0.5 * Math.sin((timeSec / a.runeGlowPeriodSec) * Math.PI * 2));
    const shoot = this.shootMs > 0;
    const hit = this.hitMs > 0;
    const up = this.upgradeMs > 0;
    let color = a.runeColor;
    if (hit) color = '#ff5a5a';
    else if (up) color = this.upgradeColor;
    const alpha = Math.min(1, pulse + (shoot ? 0.5 : 0));

    // Getar halus platform/rune saat kena damage.
    let sx = 0;
    let sy = 0;
    if (hit) {
      const k = this.hitMs / a.runeHitFlashMs;
      sx = (Math.random() - 0.5) * 2 * a.platformShakePx * k;
      sy = (Math.random() - 0.5) * 2 * a.platformShakePx * k;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;

    // Glow lembut pusat (pra-render).
    drawGlow(ctx, cx, cy, a.runeOuterR * 2.1, 0.1 * alpha);

    // Cincin rune luar: 24 tanda + lingkaran tipis.
    ctx.beginPath();
    for (let i = 0; i < a.runeOuterCount; i++) {
      const ang = this.outerRot + (i / a.runeOuterCount) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const r1 = a.runeOuterR - a.runeMarkLen / 2;
      const r2 = a.runeOuterR + a.runeMarkLen / 2;
      ctx.moveTo(cx + c * r1, cy + s * r1);
      ctx.lineTo(cx + c * r2, cy + s * r2);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, a.runeOuterR, 0, Math.PI * 2);
    ctx.stroke();

    // Cincin rune tengah: 12 glyph (segitiga / garis / titik).
    const gR = a.runeGlyphR;
    ctx.beginPath();
    for (let i = 0; i < a.runeInnerCount; i++) {
      if (i % 3 === 2) continue; // titik digambar terpisah
      const ang = this.innerRot + (i / a.runeInnerCount) * Math.PI * 2;
      const x = cx + Math.cos(ang) * a.runeInnerR;
      const y = cy + Math.sin(ang) * a.runeInnerR;
      if (i % 3 === 0) {
        ctx.moveTo(x, y - gR);
        ctx.lineTo(x + gR, y + gR * 0.7);
        ctx.lineTo(x - gR, y + gR * 0.7);
        ctx.closePath();
      } else {
        ctx.moveTo(x - gR, y);
        ctx.lineTo(x + gR, y);
      }
    }
    ctx.stroke();
    for (let i = 0; i < a.runeInnerCount; i++) {
      if (i % 3 !== 2) continue;
      const ang = this.innerRot + (i / a.runeInnerCount) * Math.PI * 2;
      const x = cx + Math.cos(ang) * a.runeInnerR;
      const y = cy + Math.sin(ang) * a.runeInnerR;
      ctx.beginPath();
      ctx.arc(x, y, gR * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, a.runeInnerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = a.runeColorDeep;
    ctx.beginPath();
    ctx.arc(cx, cy, a.platformR + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Gelombang kejut (elips pipih) saat wave mulai.
    if (this.shockMs > 0) {
      const t = 1 - this.shockMs / a.shockwaveMs;
      const r = a.platformR + (a.plazaR * 1.15 - a.platformR) * t;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.strokeStyle = a.runeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}
