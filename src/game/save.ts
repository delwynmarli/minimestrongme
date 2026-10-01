// Penyimpanan lokal (best score + setting). Dibungkus try/catch agar aman
// saat localStorage tidak tersedia (mode privat / WebView ketat).
import type { Difficulty } from './config';

export interface GameSettings {
  effects: boolean;
  vibration: boolean; // hook saja (dipakai di Fase 6)
  sound: boolean; // placeholder (belum berfungsi)
  difficulty: Difficulty;
}

export interface SaveData {
  bestWave: number;
  bestKills: number;
  totalRuns: number;
  settings: GameSettings;
}

const KEY = 'minime_strongme_save_v1';

function defaults(): SaveData {
  return {
    bestWave: 0,
    bestKills: 0,
    totalRuns: 0,
    settings: { effects: true, vibration: false, sound: true, difficulty: 'normal' },
  };
}

function parseDifficulty(v: unknown): Difficulty {
  return v === 'easy' || v === 'hard' || v === 'normal' ? v : 'normal';
}

export function loadSave(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<SaveData>;
    return {
      bestWave: typeof p.bestWave === 'number' ? p.bestWave : d.bestWave,
      bestKills: typeof p.bestKills === 'number' ? p.bestKills : d.bestKills,
      totalRuns: typeof p.totalRuns === 'number' ? p.totalRuns : d.totalRuns,
      settings: {
        effects: p.settings?.effects ?? d.settings.effects,
        vibration: p.settings?.vibration ?? d.settings.vibration,
        sound: p.settings?.sound ?? d.settings.sound,
        difficulty: parseDifficulty(p.settings?.difficulty),
      },
    };
  } catch {
    return d;
  }
}

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* localStorage tidak tersedia: abaikan. */
  }
}
