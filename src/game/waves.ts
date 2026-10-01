// Sistem wave: akses data wave dari config + helper komposisi/tekanan.
import { CONFIG } from './config';
import type { EnemyDef } from './enemy';

export interface WaveDef {
  budget: number; // total musuh di wave ini
  comp: Record<string, number>; // bobot tiap tipe musuh
  boss?: string; // id tipe boss (opsional)
}

export function waveCount(): number {
  return CONFIG.wave.total;
}

export function waveDef(index: number): WaveDef {
  return CONFIG.wave.data[index];
}

// Def boss untuk wave ini (null bila bukan wave boss).
export function waveBoss(index: number): EnemyDef | null {
  const id = CONFIG.wave.data[index].boss;
  if (!id) return null;
  const types = CONFIG.enemy.types as unknown as Record<string, EnemyDef>;
  return types[id] ?? null;
}

// Multiplier HP/damage musuh untuk wave ke-index (0-based): naik sedikit tiap wave.
export function waveHpMult(index: number): number {
  return 1 + CONFIG.wave.hpMultPerWave * index;
}

export function waveDmgMult(index: number): number {
  return 1 + CONFIG.wave.dmgMultPerWave * index;
}

// Pilih tipe musuh untuk wave ini sesuai bobot komposisi.
export function pickWaveType(index: number): EnemyDef {
  const comp = CONFIG.wave.data[index].comp;
  const types = CONFIG.enemy.types as unknown as Record<string, EnemyDef>;
  let total = 0;
  for (const k in comp) total += comp[k];
  let r = Math.random() * total;
  for (const k in comp) {
    r -= comp[k];
    if (r <= 0) return types[k];
  }
  const first = Object.keys(comp)[0];
  return types[first];
}
