// Arena: background di-render SEKALI ke offscreen canvas (cache), lalu di-blit
// tiap frame. Lantai batu gelap-hangat dominan; rumput hanya sedikit (tengah + tepi).
import { CONFIG } from './config';
import { getImage } from './assets';

// Ubah hex (#rrggbb) -> [r,g,b] 0..255.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// RNG ber-seed (mulberry32) -> hasil petak rumput selalu sama tiap load.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Versi tile yang digelapkan / didesaturasi / diberi tint (dihitung sekali).
function tintTile(img: HTMLImageElement, brightness: number, saturation: number, tintHex: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  const it = g.getImageData(0, 0, c.width, c.height);
  const d = it.data;
  const t = hexToRgb(tintHex);
  const tr = t[0] / 255;
  const tg = t[1] / 255;
  const tb = t[2] / 255;
  for (let i = 0; i < d.length; i += 4) {
    const r0 = d[i];
    const g0 = d[i + 1];
    const b0 = d[i + 2];
    const gray = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
    let r = gray + (r0 - gray) * saturation;
    let gg = gray + (g0 - gray) * saturation;
    let b = gray + (b0 - gray) * saturation;
    r = r * brightness * tr;
    gg = gg * brightness * tg;
    b = b * brightness * tb;
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  g.putImageData(it, 0, 0);
  return c;
}

// Bangun background statis: lantai batu gelap + cincin arena + sedikit rumput + vignette.
export function buildArena(): HTMLCanvasElement {
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;
  const bg = CONFIG.background;
  const { cx, cy } = CONFIG.arena;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  // Palet tile yang sudah diolah (sekali hitung).
  const stoneImg = getImage('tile_stone_seamless');
  const floorPat = g.createPattern(tintTile(stoneImg, bg.floorBrightness, bg.floorSaturation, bg.floorTint), 'repeat')!;
  const grassPat = g.createPattern(
    tintTile(getImage('tile_grass_seamless'), bg.grassBrightness, bg.grassSaturation, bg.grassTint),
    'repeat',
  )!;

  // 1. Lantai dasar batu (dominan layar).
  g.fillStyle = floorPat;
  g.fillRect(0, 0, W, H);

  // 2. Plaza ritual: piringan batu lebih terang + bibir 2.5D + retakan + lumut.
  const { plazaR, plazaThickness, platformR, platformThickness } = CONFIG.arena;
  const plazaPat = g.createPattern(tintTile(stoneImg, bg.plazaBrightness, bg.plazaSaturation, bg.plazaTint), 'repeat')!;
  const platPat = g.createPattern(tintTile(stoneImg, bg.platformBrightness, bg.plazaSaturation, bg.platformTint), 'repeat')!;

  // 2a. Dinding plaza (kesan ketebalan): disc digeser ke bawah + digelapkan.
  g.save();
  g.beginPath();
  g.arc(cx, cy + plazaThickness, plazaR, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = bg.plazaWall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, W, H);
  g.restore();

  // Bayangan lembut di luar tepi plaza.
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 5;
  g.beginPath(); g.arc(cx, cy + 2, plazaR + 1, 0, Math.PI * 2); g.stroke();

  // 2b. Permukaan plaza + gradasi cahaya + variasi ubin + retakan + lumut.
  g.save();
  g.beginPath();
  g.arc(cx, cy, plazaR, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = plazaPat;
  g.fillRect(0, 0, W, H);
  const plg = g.createRadialGradient(cx, cy, plazaR * 0.12, cx, cy, plazaR);
  plg.addColorStop(0, 'rgba(150,190,230,0.18)');
  plg.addColorStop(0.6, 'rgba(90,130,180,0.05)');
  plg.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = plg;
  g.fillRect(0, 0, W, H);
  const prng = mulberry32(bg.edgeSeed ^ 0x51ed);
  for (let i = 0; i < 6; i++) {
    const a = prng() * Math.PI * 2;
    const rr = prng() * plazaR * 0.8;
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
    g.fillRect(cx + Math.cos(a) * rr - 8, cy + Math.sin(a) * rr - 6, 16, 12);
  }
  g.strokeStyle = bg.crackColor;
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const a = prng() * Math.PI * 2;
    const rr = plazaR * (0.35 + prng() * 0.55);
    let x = cx + Math.cos(a) * rr;
    let y = cy + Math.sin(a) * rr;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (prng() - 0.5) * 14;
      y += (prng() - 0.5) * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const a = prng() * Math.PI * 2;
    const rr = plazaR - 4 - prng() * 10;
    g.fillStyle = bg.mossColor;
    g.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2 + (i % 2), 2);
  }
  g.restore();

  // 2c. Bibir atas plaza (highlight) + garis gelap.
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, plazaR, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(180,210,240,0.3)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, plazaR - 1, Math.PI * 1.08, Math.PI * 1.92); g.stroke();

  // 3. Petak rumput tak beraturan di tepi/sudut (di luar cincin).
  const spots = edgeSpots(W, H);
  const rng = mulberry32(bg.edgeSeed);
  const count = Math.min(bg.edgePatches, spots.length);
  for (let i = 0; i < count; i++) {
    const p = spots[i];
    drawGrassBlob(g, grassPat, W, H, p.x, p.y, rng);
  }

  // 4. Platform tengah (tempat karakter) — bibir 2.5D + pola bintang rune.
  g.save();
  g.beginPath();
  g.arc(cx, cy + platformThickness, platformR, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = bg.plazaWall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, 0, W, H);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy + 1, platformR + 1, 0, Math.PI * 2); g.stroke();

  g.save();
  g.beginPath();
  g.arc(cx, cy, platformR, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = platPat;
  g.fillRect(0, 0, W, H);
  const pg = g.createRadialGradient(cx, cy, platformR * 0.1, cx, cy, platformR);
  pg.addColorStop(0, 'rgba(170,210,245,0.22)');
  pg.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = pg;
  g.fillRect(0, 0, W, H);
  g.restore();

  // Pola oktagon + bintang 8 rune (statis; denyut glow digambar per frame).
  g.strokeStyle = 'rgba(120,200,240,0.5)';
  g.lineWidth = 1.5;
  const pr = platformR - 16;
  const sr = platformR - 10;
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * pr;
    const y = cy + Math.sin(a) * pr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = ((i * 3) / 8) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * sr;
    const y = cy + Math.sin(a) * sr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.stroke();

  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, platformR, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(190,220,250,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, platformR - 1, Math.PI * 1.05, Math.PI * 1.95); g.stroke();

  // 5. Rumpun rumput kecil tersebar (hindari plaza).
  const trng = mulberry32(bg.edgeSeed ^ 0x9e3779b9);
  for (let i = 0; i < bg.tufts; i++) {
    const tx = trng() * W;
    const ty = trng() * H;
    if (Math.hypot(tx - cx, ty - cy) < plazaR + 6) continue;
    drawTuft(g, tx, ty, trng);
  }

  // 6. Vignette halus di tepi.
  const R = Math.hypot(W / 2, H / 2);
  const grad = g.createRadialGradient(cx, cy, R * bg.vignetteInner, cx, cy, R);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${bg.vignetteStrength})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  return c;
}

// Petak rumput tak beraturan: gabungan beberapa lingkaran kecil (clipped).
function drawGrassBlob(
  g: CanvasRenderingContext2D,
  pat: CanvasPattern,
  W: number,
  H: number,
  bx: number,
  by: number,
  rng: () => number,
): void {
  const bg = CONFIG.background;
  const n = 4 + Math.floor(rng() * 3);
  g.save();
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng();
    const rr = bg.edgePatchMin + rng() * (bg.edgePatchMax - bg.edgePatchMin);
    const dist = rng() * 14;
    const x = bx + Math.cos(a) * dist;
    const y = by + Math.sin(a) * dist;
    g.moveTo(x + rr, y);
    g.arc(x, y, rr, 0, Math.PI * 2);
  }
  g.clip();
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);
  g.restore();
}

// Rumpun rumput kecil: beberapa kotak piksel hijau gelap.
function drawTuft(g: CanvasRenderingContext2D, x: number, y: number, rng: () => number): void {
  const n = 3 + Math.floor(rng() * 4);
  g.fillStyle = CONFIG.background.tuftColor;
  for (let i = 0; i < n; i++) {
    const px = Math.round(x + (rng() - 0.5) * 10);
    const py = Math.round(y + (rng() - 0.5) * 8);
    const s = 2 + Math.floor(rng() * 2);
    g.fillRect(px, py, s, s);
  }
}

// Posisi kandidat petak rumput (sudut & tepi, semuanya di luar cincin arena).
function edgeSpots(W: number, H: number): { x: number; y: number }[] {
  return [
    { x: 26, y: 34 },
    { x: W - 26, y: 34 },
    { x: 26, y: H - 34 },
    { x: W - 26, y: H - 34 },
    { x: W / 2, y: 24 },
    { x: W / 2, y: H - 24 },
    { x: 34, y: H * 0.31 },
    { x: W - 34, y: H * 0.31 },
    { x: 34, y: H * 0.71 },
    { x: W - 34, y: H * 0.71 },
  ];
}

// (Cincin putus-putus lama diganti RuneField di src/game/runes.ts.)
