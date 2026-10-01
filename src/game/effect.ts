// Efek visual: percikan, partikel, aura, segmen petir, hit petir, ledakan, angka.
import { CONFIG } from './config';
import { getImage } from './assets';
import { drawFit } from './draw';
import { drawGlow } from './visual';

type Kind =
  | 'spark'
  | 'particle'
  | 'aura'
  | 'bolt'
  | 'lightningHit'
  | 'explosion'
  | 'smoke'
  | 'ring'
  | 'text'
  | 'ember'
  | 'shard'
  | 'decal'
  | 'slash'
  | 'flatten';

export class Effect {
  active = false;
  private kind: Kind = 'particle';
  private x = 0;
  private y = 0;
  private x2 = 0;
  private y2 = 0;
  private vx = 0;
  private vy = 0;
  private lifeMs = 0;
  private maxLifeMs = 1;
  private size = 4;
  private endSize = 4;
  private rot = 0;
  private vrot = 0;
  private color = '#fff';
  private text = '';
  private g = 0; // gravitasi (px/s^2)
  private groundY = 0;
  private bounced = false;
  private imgKey = '';
  private sx = 0;
  private sy = 0;
  private sw = 0;
  private sh = 0;
  private angle = 0;

  spawnSpark(x: number, y: number, size: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'spark';
    this.x = x;
    this.y = y;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.size = size;
    this.rot = Math.random() * Math.PI * 2;
    this.vrot = (Math.random() - 0.5) * 6;
  }

  spawnParticle(x: number, y: number, vx: number, vy: number, size: number, lifeMs: number, color: string): void {
    this.active = true;
    this.kind = 'particle';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.size = size;
    this.rot = 0;
    this.vrot = 0;
    this.color = color;
  }

  // Cincin aura (vfx_aura) membesar dari startR ke endR lalu memudar.
  spawnAura(x: number, y: number, startR: number, endR: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'aura';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.size = startR;
    this.endSize = endR;
    this.rot = 0;
    this.vrot = 0;
  }

  // Segmen petir dari (x1,y1) ke (x2,y2) memakai vfx_lightning_bolt dirotasi & diregangkan.
  spawnBolt(x1: number, y1: number, x2: number, y2: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'bolt';
    this.x = x1;
    this.y = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  spawnLightningHit(x: number, y: number): void {
    const c = CONFIG.effects.lightningHit;
    this.active = true;
    this.kind = 'lightningHit';
    this.x = x;
    this.y = y;
    this.size = c.size;
    this.lifeMs = c.lifeMs;
    this.maxLifeMs = c.lifeMs;
  }

  spawnExplosion(x: number, y: number, size: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'explosion';
    this.x = x;
    this.y = y;
    this.size = size;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  // Gumpalan asap kecil yang membesar & memudar (kematian/ledakan).
  spawnSmoke(x: number, y: number, size: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'smoke';
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = -12 - Math.random() * 10;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.size = size;
    this.rot = (Math.random() - 0.5) * 0.6;
  }

  // Cincin ledakan (digambar lewat kode) yang mengembang lalu memudar.
  spawnRing(x: number, y: number, startR: number, endR: number, lifeMs: number, color: string): void {
    this.active = true;
    this.kind = 'ring';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.size = startR;
    this.endSize = endR;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.color = color;
  }

  // Ember/api kecil (gravitasi) + glow.
  spawnEmber(x: number, y: number, vx: number, vy: number, size: number, lifeMs: number, color: string): void {
    this.active = true;
    this.kind = 'ember';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.g = 260;
    this.size = size;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
    this.color = color;
    this.rot = 0;
    this.vrot = 0;
  }

  // Kepingan sprite (potongan) terlempar: gravitasi + memantul sekali.
  spawnShard(
    imgKey: string,
    x: number,
    y: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    vx: number,
    vy: number,
    vrot: number,
    groundY: number,
    lifeMs: number,
  ): void {
    this.active = true;
    this.kind = 'shard';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.g = 520;
    this.imgKey = imgKey;
    this.sx = sx;
    this.sy = sy;
    this.sw = sw;
    this.sh = sh;
    this.rot = 0;
    this.vrot = vrot;
    this.groundY = groundY;
    this.bounced = false;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  // Bekas gosong (decal) di tanah yang memudar lama.
  spawnDecal(x: number, y: number, size: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'decal';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.size = size;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  // Busur tebasan (crescent) digambar lewat kode.
  spawnSlash(x: number, y: number, angle: number, radius: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'slash';
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.size = radius;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  // Sprite digepengkan (mis. slime mati) lalu memudar.
  spawnFlatten(imgKey: string, x: number, y: number, width: number, lifeMs: number): void {
    this.active = true;
    this.kind = 'flatten';
    this.imgKey = imgKey;
    this.x = x;
    this.y = y;
    this.size = width;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  // Angka damage melayang (mis. crit = kuning).
  spawnText(x: number, y: number, value: string, color: string, lifeMs: number): void {
    this.active = true;
    this.kind = 'text';
    this.x = x;
    this.y = y;
    this.text = value;
    this.color = color;
    this.lifeMs = lifeMs;
    this.maxLifeMs = lifeMs;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === 'ember' || this.kind === 'shard') {
      this.vy += this.g * dt;
      if (this.kind === 'shard' && !this.bounced && this.vy > 0 && this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = -this.vy * 0.5; // memantul sekali
        this.bounced = true;
      }
    }
    this.rot += this.vrot * dt;
    this.lifeMs -= dtMs;
    if (this.lifeMs <= 0) this.active = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const a = Math.max(0, this.lifeMs / this.maxLifeMs);
    switch (this.kind) {
      case 'spark':
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        drawFit(ctx, getImage('vfx_hit_spark'), 0, 0, this.size, this.size);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      case 'aura': {
        const t = 1 - a;
        const r = this.size + (this.endSize - this.size) * t;
        ctx.globalAlpha = a;
        drawFit(ctx, getImage('vfx_aura'), this.x, this.y, r * 2, r * 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'bolt': {
        const ang = Math.atan2(this.y2 - this.y, this.x2 - this.x);
        const len = Math.hypot(this.x2 - this.x, this.y2 - this.y);
        const jitter = (Math.random() - 0.5) * CONFIG.upgrades.lightning.jitter;
        const w = 24;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(ang - Math.PI / 2);
        ctx.drawImage(getImage('vfx_lightning_bolt'), -w / 2 + jitter, 0, w, len);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
      case 'lightningHit': {
        const t = 1 - a;
        ctx.globalAlpha = a;
        const s = this.size * (0.8 + 0.6 * t);
        drawFit(ctx, getImage('vfx_lightning_hit'), this.x, this.y, s, s);
        ctx.globalAlpha = 1;
        break;
      }
      case 'explosion': {
        const t = 1 - a;
        ctx.globalAlpha = a;
        const s = this.size * (0.7 + 0.7 * t);
        drawFit(ctx, getImage('vfx_explosion'), this.x, this.y, s, s);
        ctx.globalAlpha = 1;
        drawGlow(ctx, this.x, this.y, s * 1.5, 0.5 * a);
        break;
      }
      case 'smoke': {
        const t = 1 - a;
        const s = this.size * (0.6 + 1.0 * t);
        ctx.globalAlpha = a * 0.8;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        drawFit(ctx, getImage('vfx_smoke_puff'), 0, 0, s, s);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
      case 'ring': {
        const t = 1 - a;
        const r = this.size + (this.endSize - this.size) * t;
        ctx.globalAlpha = a;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, r, r * 0.5, 0, 0, Math.PI * 2); // gelombang pipih di tanah
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'ember':
        ctx.globalAlpha = a;
        drawGlow(ctx, this.x, this.y, this.size * 3, 0.6 * a);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1;
        break;
      case 'shard':
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.drawImage(getImage(this.imgKey), this.sx, this.sy, this.sw, this.sh, -this.sw / 2, -this.sh / 2, this.sw, this.sh);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      case 'decal':
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'slash': {
        const t = 1 - a;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#dff7ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (0.9 + 0.4 * t), this.angle - 0.7, this.angle + 0.7);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
      case 'flatten': {
        const t = 1 - a;
        const img = getImage(this.imgKey);
        const w = this.size * (1 + 0.5 * t);
        const h = w * (img.naturalHeight / img.naturalWidth) * (0.35 - 0.2 * t);
        ctx.globalAlpha = a;
        ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
        ctx.globalAlpha = 1;
        break;
      }
      case 'text': {
        const t = 1 - a;
        const pop = 1 + (1 - Math.min(1, t * 4)) * 0.6; // pop lalu normal
        const xx = this.x + Math.sin(t * Math.PI) * 10; // lintasan melengkung
        const yy = this.y - t * 22;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(xx, yy);
        ctx.scale(pop, pop);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '8px "Press Start 2P"';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(this.text, 0, 0);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }
      default:
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
  }
}

