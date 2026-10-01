// Sistem synergy: kombinasi upgrade yang aktif otomatis saat syaratnya terpenuhi.
import { CONFIG } from '../config';
import type { PlayerState } from '../playerState';

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  requires: { upgradeId: string; minLevel: number }[];
  onActivate: (state: PlayerState) => void;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'storm_fire',
    name: 'Storm Fire',
    description: 'Lightning burns foes; meteors call extra lightning.',
    requires: [
      { upgradeId: 'lightning', minLevel: 1 },
      { upgradeId: 'meteor', minLevel: 1 },
    ],
    onActivate: () => {},
  },
  {
    id: 'ricochet_pierce',
    name: 'Ricochet Pierce',
    description: 'Bullets keep full damage when bouncing.',
    requires: [
      { upgradeId: 'piercing', minLevel: 1 },
      { upgradeId: 'bounce_bullet', minLevel: 1 },
    ],
    onActivate: () => {},
  },
  {
    id: 'fan_of_blades',
    name: 'Fan of Blades',
    description: 'Bounce Blade throws +1 blade.',
    requires: [
      { upgradeId: 'multishot', minLevel: 2 },
      { upgradeId: 'bounce_blade', minLevel: 1 },
    ],
    onActivate: () => {},
  },
  {
    id: 'vital_storm',
    name: 'Vital Storm',
    description: 'Each lightning strike heals 1 HP.',
    requires: [
      { upgradeId: 'heal_aura', minLevel: 1 },
      { upgradeId: 'lightning', minLevel: 1 },
    ],
    onActivate: () => {},
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Crit damage x3 instead of x2.',
    requires: [
      { upgradeId: 'damage', minLevel: 3 },
      { upgradeId: 'crit', minLevel: 2 },
    ],
    onActivate: (s) => {
      s.critMult = CONFIG.synergy.glassCannon.critMult;
    },
  },
];

// Cek synergy yang baru aktif, aktifkan, lalu kembalikan daftarnya.
export function newlyActivated(state: PlayerState): SynergyDef[] {
  const out: SynergyDef[] = [];
  for (const s of SYNERGIES) {
    if (state.has(s.id)) continue;
    let ok = true;
    for (const r of s.requires) {
      if (state.levelOf(r.upgradeId) < r.minLevel) {
        ok = false;
        break;
      }
    }
    if (ok) {
      state.activate(s.id);
      s.onActivate(state);
      out.push(s);
    }
  }
  return out;
}

// Apakah memilih upgrade `id` sampai level `nextLevel` akan MEMBUKA synergy baru?
export function opensSynergy(state: PlayerState, id: string, nextLevel: number): boolean {
  for (const s of SYNERGIES) {
    if (state.has(s.id)) continue;
    const req = s.requires.find((r) => r.upgradeId === id);
    if (!req || nextLevel < req.minLevel) continue;
    let ok = true;
    for (const r of s.requires) {
      if (r.upgradeId === id) continue;
      if (state.levelOf(r.upgradeId) < r.minLevel) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
