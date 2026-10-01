// Musuh: jalan menuju pemain, bob, flip sesuai arah, bar HP saat terluka.
// Demon punya dash berkala (telegraph kedip merah). Bos punya fase 2 (di game).
import { CONFIG } from './config';
import { getImage, getTinted } from './assets';
import { drawByWidth, drawFit } from './draw';
import { perspectiveScale, drawShadow, drawGlow } from './visual';
import { easeOutBack } from './anim';

export interface EnemyDash {
  intervalMs: number;
  telegraphMs: number;
  speed: number;
  durationMs: number;
}

export interface EnemyPhase2 {
  hpPct: number;
  speedMult: number;
  summonIntervalMs: number;
  summonType: string;
  summonCount: number;
}

export interface EnemyDef {
  hp: number;
  speed: number;
  dmg: number;
  width: number;
  key: string;
  color: string;
  weight: number;
  dash?: EnemyDash;
  knockbackResist?: boolean;
  splitInto?: string;
  splitCount?: number;
  boss?: boolean;
  bossName?: string;
  phase2?: EnemyPhase2;
  anim?: 'hop' | 'fly' | 'run' | 'sway';
}

export class Enemy {
  private static nextId = 1;

  active = false;
  id = 0;
  def!: EnemyDef;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  hp = 0;
  maxHp = 0;
  dmg = 0;
  flashMs = 0;
  contactCdMs = 0;
  phase = 0;
  faceLeft = false;
  burnMs = 0;
  burnDps = 0;
  speedMul = 1;
  telegraphMs = 0; // >0 = siap dash (kedip merah)
  dashingMs = 0; // >0 = sedang dash
  spawnMs = 0; // animasi spawn-in
  hitSquashMs = 0; // squash saat kena pukul

  private dashCdMs = 0;
  private tx = 0;
  private ty = 0;
  private stopDist = 0;

  // tx/ty = target (pemain). stopDist = jarak berhenti (saat sudah kontak).
  // hpMult/dmgMult = pengali dari wave system.
  spawn(def: EnemyDef, x: number, y: number, tx: number, ty: number, stopDist: number, hpMult: number, dmgMult: number): void {
    this.active = true;
    this.id = Enemy.nextId++;
    this.def = def;
    this.maxHp = Math.round(def.hp * hpMult);
    this.hp = this.maxHp;
    this.dmg = def.dmg * dmgMult;
    this.x = x;
    this.y = y;
    this.tx = tx;
    this.ty = ty;
    this.stopDist = stopDist;
    this.flashMs = 0;
    this.contactCdMs = 0;
    this.burnMs = 0;
    this.burnDps = 0;
    this.speedMul = 1;
    this.telegraphMs = 0;
    this.dashingMs = 0;
    this.spawnMs = CONFIG.fx.anim.enemySpawnMs;
    this.hitSquashMs = 0;
    this.dashCdMs = def.dash ? def.dash.intervalMs : 0;
    this.phase = Math.random() * Math.PI * 2;
    this.steer();
  }

  // Efek bakar (Storm Fire): damage over time.
  applyBurn(dps: number, ms: number): void {
    this.burnDps = dps;
    this.burnMs = ms;
  }

  // Dasar sprite (untuk Y-sorting).
  get baseY(): number {
    return this.y;
  }

  // Ubah target (dipakai saat ukuran view berubah).
  retarget(tx: number, ty: number): void {
    this.tx = tx;
    this.ty = ty;
  }

  // Tinggi angkat sprite dari tanah (dipakai animasi + bayangan).
  private animLift(timeSec: number): number {
    if (!CONFIG.fx.hopAnim) return 0;
    const a = CONFIG.fx.anim;
    const anim = this.def.anim;
    if (anim === 'hop') return Math.abs(Math.sin(timeSec * a.hopSpeed + this.phase)) * a.hopHeight;
    if (anim === 'fly') return a.flyHeight + Math.sin(timeSec * a.flapSpeed + this.phase) * 2;
    if (anim === 'sway') return Math.abs(Math.sin(timeSec * a.stepSpeed + this.phase)) * 1.5;
    return 0;
  }

  drawShadow(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const lift = this.animLift(timeSec);
    const persp = perspectiveScale(this.y);
    const fade = Math.max(0.3, 1 - lift / 26);
    const width = this.def.width * persp * (1 - lift / 70);
    drawShadow(ctx, this.x, this.y + 2, width, fade);
  }

  private steer(): void {
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.faceLeft = dx < 0;
    if (d <= this.stopDist) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    const sp = this.def.speed * this.speedMul;
    this.vx = (dx / d) * sp;
    this.vy = (dy / d) * sp;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const dash = this.def.dash;
    if (dash) {
      this.updateDash(dtMs, dt, dash);
    } else {
      this.steer();
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    if (this.flashMs > 0) this.flashMs -= dtMs;
    if (this.contactCdMs > 0) this.contactCdMs -= dtMs;
    if (this.spawnMs > 0) this.spawnMs -= dtMs;
    if (this.hitSquashMs > 0) this.hitSquashMs -= dtMs;
    if (this.burnMs > 0) {
      this.burnMs -= dtMs;
      this.hp -= this.burnDps * dt;
    }
  }

  // Pola demon: jalan -> berhenti + telegraph -> dash cepat -> ulang.
  private updateDash(dtMs: number, dt: number, dash: EnemyDash): void {
    if (this.dashingMs > 0) {
      this.dashingMs -= dtMs;
      this.faceLeft = this.vx < 0;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    if (this.telegraphMs > 0) {
      this.telegraphMs -= dtMs;
      if (this.telegraphMs <= 0) {
        this.dashingMs = dash.durationMs;
        const ang = Math.atan2(this.ty - this.y, this.tx - this.x);
        this.vx = Math.cos(ang) * dash.speed;
        this.vy = Math.sin(ang) * dash.speed;
        this.faceLeft = this.vx < 0;
      }
      return;
    }
    this.dashCdMs -= dtMs;
    if (this.dashCdMs <= 0) {
      this.dashCdMs = dash.intervalMs;
      this.telegraphMs = dash.telegraphMs;
      this.vx = 0;
      this.vy = 0;
      return;
    }
    this.steer();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const { hitFlashMs, hpBarWidth, hpBarHeight } = CONFIG.enemy;
    const an = CONFIG.fx.anim;
    const img = getImage(this.def.key);
    const w = this.def.width;
    const persp = perspectiveScale(this.y);
    const lift = this.animLift(timeSec);
    const anim = this.def.anim;

    // Transform animasi per tipe (hanya render).
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let bob = 0;
    if (CONFIG.fx.hopAnim) {
      if (anim === 'hop') {
        const hopp = Math.abs(Math.sin(timeSec * an.hopSpeed + this.phase));
        const k = (hopp - 0.5) * 0.3;
        sx = 1 - k;
        sy = 1 + k;
      } else if (anim === 'fly') {
        sy = 1 + Math.sin(timeSec * an.flapSpeed + this.phase) * 0.18;
      } else if (anim === 'run') {
        bob = Math.sin(timeSec * 9 + this.phase) * 1.5;
        if (this.dashingMs > 0) rot = ((this.faceLeft ? -1 : 1) * an.runTiltDeg * Math.PI) / 180;
      } else if (anim === 'sway') {
        rot = (Math.sin(timeSec * an.swaySpeed + this.phase) * an.swayDeg * Math.PI) / 180;
      }
    } else {
      bob = Math.sin(timeSec * CONFIG.enemy.bobSpeed + this.phase) * CONFIG.enemy.bobAmp;
    }

    ctx.save();
    ctx.translate(this.x, this.y - lift + bob);
    // Spawn-in (easeOutBack) & squash saat kena pukul.
    if (this.spawnMs > 0) {
      const e = easeOutBack(1 - this.spawnMs / an.enemySpawnMs);
      sx *= e;
      sy *= e;
    }
    if (this.hitSquashMs > 0) {
      const k = Math.sin((1 - this.hitSquashMs / an.enemyHitSquashMs) * Math.PI) * an.enemyHitSquashPx;
      sx *= 1 + k;
      sy *= 1 - k;
    }
    ctx.scale(sx * persp, sy * persp);
    if (rot !== 0) ctx.rotate(rot);
    if (this.faceLeft) ctx.scale(-1, 1); // flip horizontal sesuai arah gerak
    drawByWidth(ctx, img, 0, 0, w);
    if (this.flashMs > 0) {
      ctx.globalAlpha = Math.min(1, this.flashMs / hitFlashMs);
      drawByWidth(ctx, getTinted(this.def.key, '#ffffff'), 0, 0, w);
      ctx.globalAlpha = 1;
    }
    // Telegraph dash demon: kedip merah.
    if (this.telegraphMs > 0) {
      const on = Math.floor(this.telegraphMs / 80) % 2 === 0;
      ctx.globalAlpha = on ? 0.85 : 0.3;
      drawByWidth(ctx, getTinted(this.def.key, '#ff2f2f'), 0, 0, w);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Telegraph dash demon: glow merah di tanah + tanda seru.
    if (this.telegraphMs > 0) {
      drawGlow(ctx, this.x, this.y + 6, w * 1.1, 0.5);
      ctx.fillStyle = '#ff3b3b';
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', this.x, this.y - w * 0.9 - 8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Api kecil di atas musuh saat terbakar (Storm Fire).
    if (this.burnMs > 0) {
      ctx.globalAlpha = 0.8 + Math.random() * 0.2;
      drawFit(ctx, getImage('vfx_burn'), this.x, this.y - lift - w * 0.75 + bob, CONFIG.effects.burn.size, CONFIG.effects.burn.size);
      ctx.globalAlpha = 1;
    }

    // Bar HP kecil di atas musuh yang sudah terluka (bos pakai bar besar di HUD).
    if (this.hp < this.maxHp && !this.def.boss) {
      const h = w * (img.naturalHeight / img.naturalWidth) * persp;
      const bx = this.x - hpBarWidth / 2;
      const by = this.y - lift - h / 2 - 8 + bob;
      ctx.fillStyle = '#000';
      ctx.fillRect(bx - 1, by - 1, hpBarWidth + 2, hpBarHeight + 2);
      ctx.fillStyle = '#7a1010';
      ctx.fillRect(bx, by, hpBarWidth, hpBarHeight);
      ctx.fillStyle = '#59d24a';
      ctx.fillRect(bx, by, hpBarWidth * Math.max(0, this.hp / this.maxHp), hpBarHeight);
    }
  }
}


