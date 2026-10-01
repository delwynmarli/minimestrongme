// Viewport logis adaptif. Lebar tetap 360; tinggi dihitung dari rasio layar
// (clamp 560..800). Nilai disinkronkan ke CONFIG agar kode lama tetap benar.
import { CONFIG } from './config';

export const view = {
  width: CONFIG.view.width,
  height: CONFIG.view.height,
  centerX: CONFIG.view.width / 2,
  centerY: CONFIG.view.height / 2,
};

let current = { w: 0, h: 0 };

// Hitung ulang dari ukuran jendela (CSS px). Return true bila tinggi berubah.
export function updateView(innerWidth: number, innerHeight: number): boolean {
  const base = CONFIG.view.width;
  const raw = (base * innerHeight) / innerWidth;
  const h = Math.round(Math.min(CONFIG.view.heightMax, Math.max(CONFIG.view.heightMin, raw)));
  const changed = h !== current.h || base !== current.w;
  current = { w: base, h };
  view.width = base;
  view.height = h;
  view.centerX = base / 2;
  view.centerY = h / 2;
  // Sinkronkan ke CONFIG (dibaca banyak modul).
  CONFIG.view.width = view.width;
  CONFIG.view.height = view.height;
  CONFIG.arena.cx = view.centerX;
  CONFIG.arena.cy = view.centerY;
  CONFIG.player.x = view.centerX;
  CONFIG.player.y = view.centerY;
  return changed;
}
