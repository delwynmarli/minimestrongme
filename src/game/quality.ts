// Kualitas adaptif: pantau FPS rata-rata beberapa detik; turunkan bertahap bila
// berat, naikkan lagi bila pulih. Level 0 = terbaik. Dipakai untuk mengurangi
// partikel / glow / blur / kepingan pecah.
import { CONFIG } from './config';

export const quality = {
  level: 0,
  // Pengali jumlah partikel per level (index = level).
  particleMul(level: number): number {
    const arr = [1, 0.7, 0.45, 0.25];
    return arr[level] ?? arr[arr.length - 1];
  },
  get particles(): number {
    return quality.particleMul(quality.level);
  },
  get glow(): boolean {
    return CONFIG.fx.lighting && quality.level < 2;
  },
  get bladeBlur(): boolean {
    return CONFIG.fx.bladeBlur && quality.level < 2;
  },
  get shards(): boolean {
    return CONFIG.fx.shards && quality.level < 3;
  },
};

let accMs = 0;
let accFrames = 0;
let avgFps = 60;

// Panggil tiap frame. Mengembalikan level kualitas aktif.
export function qualityTick(dtMs: number, fps: number): number {
  accMs += dtMs;
  accFrames += 1;
  if (accMs >= CONFIG.fx.quality.windowMs) {
    avgFps = accFrames > 0 ? (accFrames * 1000) / accMs : 60;
    accMs = 0;
    accFrames = 0;
    if (avgFps < CONFIG.fx.quality.downFps && quality.level < CONFIG.fx.quality.maxLevel) {
      quality.level++;
    } else if (avgFps > CONFIG.fx.quality.upFps && quality.level > 0) {
      quality.level--;
    }
  }
  void fps;
  return quality.level;
}

export function avgFpsValue(): number {
  return avgFps;
}
