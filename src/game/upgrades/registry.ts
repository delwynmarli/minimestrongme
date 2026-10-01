// Daftar upgrade + pengundian pilihan acak (rogue-like).
import { CONFIG, diffPreset } from '../config';
import type { PlayerState } from '../playerState';
import type { UpgradeDef } from './types';
import { opensSynergy } from './synergy';

const U = CONFIG.upgrades;

const pct = (v: number): number => Math.round(v * 100);

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'damage',
    name: 'Damage',
    icon: 'ui_icon_damage',
    maxLevel: 5,
    tags: ['stat'],
    description: () => `Damage +${pct(U.damage.perLevel)}%`,
    apply: (s, level) => {
      s.damageMult = 1 + U.damage.perLevel * level;
    },
  },
  {
    id: 'attack_speed',
    name: 'Attack Speed',
    icon: 'ui_icon_attack_speed',
    maxLevel: 5,
    tags: ['stat'],
    description: () => `Attack Speed +${pct(U.attack_speed.perLevel)}%`,
    apply: (s, level) => {
      s.attackSpeedMult = 1 + U.attack_speed.perLevel * level;
    },
  },
  {
    id: 'max_hp',
    name: 'Max HP',
    icon: 'ui_icon_max_hp',
    maxLevel: 5,
    tags: ['stat'],
    description: () => `+${U.max_hp.perLevel} Max HP, heal ${U.max_hp.healPerLevel}`,
    apply: (s, level) => {
      s.maxHp = CONFIG.player.maxHp * diffPreset().playerHp + U.max_hp.perLevel * level;
      s.hp = Math.min(s.maxHp, s.hp + U.max_hp.healPerLevel);
    },
  },
  {
    id: 'multishot',
    name: 'Multishot',
    icon: 'ui_icon_multishot',
    maxLevel: 5,
    tags: ['projectile'],
    description: (level) => `Fire ${1 + U.multishot.perLevel * level} bullets (fan)`,
    apply: (s, level) => {
      s.bulletCount = 1 + U.multishot.perLevel * level;
    },
  },
  {
    id: 'heal_aura',
    name: 'Heal Aura',
    icon: 'ui_icon_heart',
    maxLevel: 5,
    tags: ['defense'],
    description: (level) => {
      const c = U.heal_aura;
      const sec = Math.max(c.minIntervalMs, c.intervalMs - c.intervalPerLevelMs * level) / 1000;
      return `Heal ${pct(c.healPct)}% every ${sec % 1 === 0 ? sec : sec.toFixed(1)}s`;
    },
    apply: (s, level) => {
      s.healAuraLevel = level;
    },
  },
  {
    id: 'proj_speed',
    name: 'Proj Speed',
    icon: 'ui_icon_proj_speed',
    maxLevel: 5,
    tags: ['stat'],
    description: () => `Projectile Speed +${pct(U.proj_speed.perLevel)}%`,
    apply: (s, level) => {
      s.bulletSpeedMult = 1 + U.proj_speed.perLevel * level;
    },
  },
  {
    id: 'crit',
    name: 'Crit',
    icon: 'ui_icon_crit',
    maxLevel: 5,
    tags: ['stat'],
    description: (level) => `Crit +${pct(U.crit.perLevel * 1)}% (x${U.crit.critMult})`,
    apply: (s, level) => {
      s.critChance = U.crit.perLevel * level;
    },
  },
  {
    id: 'piercing',
    name: 'Piercing',
    icon: 'ui_icon_piercing',
    maxLevel: 5,
    tags: ['projectile'],
    description: () => `Pierce +${U.piercing.perLevel} enemy`,
    apply: (s, level) => {
      s.pierceCount = U.piercing.perLevel * level;
    },
  },
  {
    id: 'bounce_bullet',
    name: 'Bounce',
    icon: 'ui_icon_bounce_bullet',
    maxLevel: 5,
    tags: ['projectile'],
    description: () => `Bounce +${U.bounce_bullet.perLevel}`,
    apply: (s, level) => {
      s.bounceCount = U.bounce_bullet.perLevel * level;
    },
  },
  {
    id: 'bounce_blade',
    name: 'Bounce Blade',
    icon: 'ui_icon_sword',
    maxLevel: 5,
    tags: ['projectile'],
    description: (level) => {
      const c = U.bounce_blade;
      const n = c.baseBlades + (level - 1) * c.bladesPerLevel;
      return `Spin ${n} blade${n > 1 ? 's' : ''} every 3s`;
    },
    apply: (s, level) => {
      s.bounceBladeLevel = level;
    },
  },
  {
    id: 'lightning',
    name: 'Lightning',
    icon: 'ui_icon_lightning',
    maxLevel: 5,
    tags: ['elemental'],
    description: (level) => {
      const c = U.lightning;
      const chain = c.chainBase + (level - 1) * c.chainPerLevel;
      return `Strike + chain ${chain}`;
    },
    apply: (s, level) => {
      s.lightningLevel = level;
    },
  },
  {
    id: 'meteor',
    name: 'Meteor',
    icon: 'ui_icon_meteor',
    maxLevel: 5,
    tags: ['elemental', 'aoe'],
    description: (level) => {
      const c = U.meteor;
      const n = c.baseCount + (level - 1) * c.countPerLevel;
      return `${n} meteors, area blast`;
    },
    apply: (s, level) => {
      s.meteorLevel = level;
    },
  },
];

export function getUpgrade(id: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

// Undi n pilihan: acak berbobot, tanpa duplikat, buang yang sudah level maks.
// Kartu yang akan MEMBUKA synergy diberi bobot sedikit lebih besar.
// Jika kandidat kurang dari n, kembalikan sebanyak yang ada.
export function rollChoices(state: PlayerState, n: number = CONFIG.upgrades.choiceCount): UpgradeDef[] {
  const candidates = UPGRADES.filter((u) => state.levelOf(u.id) < u.maxLevel);
  const picked: UpgradeDef[] = [];
  while (picked.length < n && candidates.length > 0) {
    let total = 0;
    for (const u of candidates) {
      const next = state.levelOf(u.id) + 1;
      total += 1 + (opensSynergy(state, u.id, next) ? CONFIG.synergy.choiceWeightBonus : 0);
    }
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < candidates.length; idx++) {
      const next = state.levelOf(candidates[idx].id) + 1;
      const w = 1 + (opensSynergy(state, candidates[idx].id, next) ? CONFIG.synergy.choiceWeightBonus : 0);
      r -= w;
      if (r <= 0) break;
    }
    if (idx >= candidates.length) idx = candidates.length - 1;
    picked.push(candidates[idx]);
    candidates.splice(idx, 1);
  }
  return picked;
}

