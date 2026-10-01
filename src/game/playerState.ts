// Statistik pemain yang diubah oleh upgrade. Semua sistem (tembak, HP, dll)
// WAJIB membaca nilai dari sini, bukan angka hardcode di tempat lain.
import { CONFIG, diffPreset } from './config';

// HP maksimum dasar pemain (memperhitungkan preset kesulitan).
function baseMaxHp(): number {
  return CONFIG.player.maxHp * diffPreset().playerHp;
}

export class PlayerState {
  // Level tiap upgrade (id -> level).
  levels: Record<string, number> = {};

  // Multiplier & stat hasil upgrade.
  damageMult = 1;
  attackSpeedMult = 1;
  bulletSpeedMult = 1;
  bulletCount = 1;
  critChance = 0;
  critMult: number = CONFIG.upgrades.crit.critMult;

  pierceCount = 0;
  bounceCount = 0;
  bounceBladeLevel = 0;
  lightningLevel = 0;
  meteorLevel = 0;

  healAuraLevel = 0;

  // Synergy yang sudah aktif (id).
  synergies: string[] = [];

  hp = baseMaxHp();
  maxHp = baseMaxHp();
  lives = CONFIG.player.lives;
  invincibleMs = 0;

  reset(): void {
    this.levels = {};
    this.damageMult = 1;
    this.attackSpeedMult = 1;
    this.bulletSpeedMult = 1;
    this.bulletCount = 1;
    this.critChance = 0;
    this.critMult = CONFIG.upgrades.crit.critMult;
    this.pierceCount = 0;
    this.bounceCount = 0;
    this.bounceBladeLevel = 0;
    this.lightningLevel = 0;
    this.meteorLevel = 0;
    this.healAuraLevel = 0;
    this.synergies = [];
    this.maxHp = baseMaxHp();
    this.hp = this.maxHp;
    this.lives = CONFIG.player.lives;
    this.invincibleMs = 0;
  }

  // ----- Stat dasar (nilai efektif) -----
  get damage(): number {
    return CONFIG.bullet.basic.damage * this.damageMult * diffPreset().playerDmg;
  }

  get fireIntervalMs(): number {
    return CONFIG.weapon.fireIntervalMs / this.attackSpeedMult;
  }

  get bulletSpeed(): number {
    return CONFIG.bullet.basic.speed * this.bulletSpeedMult;
  }

  get healAuraIntervalMs(): number {
    if (this.healAuraLevel <= 0) return Infinity;
    const c = CONFIG.upgrades.heal_aura;
    return Math.max(c.minIntervalMs, c.intervalMs - c.intervalPerLevelMs * this.healAuraLevel);
  }

  // ----- Skill (bounce_blade / lightning / meteor) -----
  get bladeCount(): number {
    if (this.bounceBladeLevel <= 0) return 0;
    const c = CONFIG.upgrades.bounce_blade;
    let n = c.baseBlades + (this.bounceBladeLevel - 1) * c.bladesPerLevel;
    if (this.has('fan_of_blades')) n += CONFIG.synergy.fanOfBlades.extraBlades;
    return n;
  }

  get bladeDamage(): number {
    const c = CONFIG.upgrades.bounce_blade;
    return (c.damage + c.damagePerLevel * (this.bounceBladeLevel - 1)) * this.damageMult;
  }

  get lightningChain(): number {
    const c = CONFIG.upgrades.lightning;
    return c.chainBase + Math.max(0, this.lightningLevel - 1) * c.chainPerLevel;
  }

  get lightningDamage(): number {
    return CONFIG.upgrades.lightning.damage * this.damageMult;
  }

  get meteorCount(): number {
    const c = CONFIG.upgrades.meteor;
    return c.baseCount + Math.max(0, this.meteorLevel - 1) * c.countPerLevel;
  }

  get meteorDamage(): number {
    const c = CONFIG.upgrades.meteor;
    return (c.damage + c.damagePerLevel * (this.meteorLevel - 1)) * this.damageMult;
  }

  get meteorIntervalMs(): number {
    const c = CONFIG.upgrades.meteor;
    return Math.max(c.minIntervalMs, c.intervalMs - c.intervalPerLevelMs * (this.meteorLevel - 1));
  }

  // ----- Synergy -----
  has(id: string): boolean {
    return this.synergies.includes(id);
  }

  activate(id: string): void {
    if (!this.has(id)) this.synergies.push(id);
  }

  levelOf(id: string): number {
    return this.levels[id] ?? 0;
  }

  // Set level sebuah upgrade (idempotent).
  setLevel(id: string, level: number): void {
    this.levels[id] = level;
  }
}

