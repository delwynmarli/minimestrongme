// Utilitas animasi (render-only): easing, spring teredam, tween timer kecil.
// Semua stateless/tanpa alokasi per frame.

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Overshoot (melewati target lalu balik).
export function easeOutBack(t: number, s = 1.70158): number {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export function easeOutElastic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
}

// Spring teredam sederhana (isi balik + overshoot). State disimpan di pemanggil.
// Mengembalikan nilai baru; mengubah vel (lewat objek kecil yang dipakai ulang).
export interface Spring {
  value: number;
  vel: number;
}

export function springTo(sp: Spring, target: number, stiffness: number, damping: number, dt: number): number {
  const force = (target - sp.value) * stiffness;
  sp.vel += force * dt;
  sp.vel *= Math.exp(-damping * dt);
  sp.value += sp.vel * dt;
  return sp.value;
}

// Impuls spring (dorongan awal).
export function springKick(sp: Spring, impulse: number): void {
  sp.vel += impulse;
}

// Timer turun sederhana (ms). True saat baru habis.
export function tickTimer(timer: { ms: number }, dtMs: number): boolean {
  if (timer.ms <= 0) return false;
  timer.ms -= dtMs;
  if (timer.ms <= 0) {
    timer.ms = 0;
    return true;
  }
  return false;
}
