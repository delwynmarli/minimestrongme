// Spatial grid sederhana: mempercepat pencarian musuh terdekat & collision.
// Dibangun ulang tiap frame; array bucket dipakai ulang (tanpa alokasi per frame).
import type { Enemy } from './enemy';

export class SpatialGrid {
  private cols: number;
  private rows: number;
  private cell: number;
  private buckets: Enemy[][];

  constructor(width: number, height: number, cell: number) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell) + 1;
    this.rows = Math.ceil(height / cell) + 1;
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }

  clear(): void {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
  }

  private index(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  insert(e: Enemy): void {
    let cx = Math.floor(e.x / this.cell);
    let cy = Math.floor(e.y / this.cell);
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    this.buckets[this.index(cx, cy)].push(e);
  }

  // Isi `out` dengan musuh yang berada dalam radius r dari (x, y).
  queryCircle(x: number, y: number, r: number, out: Enemy[]): void {
    out.length = 0;
    const r2 = r * r;
    let minx = Math.floor((x - r) / this.cell);
    let maxx = Math.floor((x + r) / this.cell);
    let miny = Math.floor((y - r) / this.cell);
    let maxy = Math.floor((y + r) / this.cell);
    if (minx < 0) minx = 0;
    if (miny < 0) miny = 0;
    if (maxx >= this.cols) maxx = this.cols - 1;
    if (maxy >= this.rows) maxy = this.rows - 1;
    for (let cy = miny; cy <= maxy; cy++) {
      for (let cx = minx; cx <= maxx; cx++) {
        const bucket = this.buckets[this.index(cx, cy)];
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i];
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) out.push(e);
        }
      }
    }
  }
}
