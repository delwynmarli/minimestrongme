import { CONFIG } from './game/config';
import { loadAssets, getImage, hasImage, ASSET_PATHS, failed } from './game/assets';
import { Game } from './game/game';
import { updateView } from './game/view';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let scale = 1;
let ox = 0;
let oy = 0;

// Scale-to-fit view logis (lebar 360, tinggi adaptif) + devicePixelRatio.
function applyTransform(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const vw = CONFIG.view.width;
  const vh = CONFIG.view.height;
  scale = Math.min(canvas.width / vw, canvas.height / vh);
  ox = (canvas.width - vw * scale) / 2;
  oy = (canvas.height - vh * scale) / 2;
  ctx.imageSmoothingEnabled = false;
}

// Bersihkan seluruh canvas; area border diisi warna lantai gelap (bukan hitam).
function beginFrame(): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = CONFIG.view.letterbox;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.imageSmoothingEnabled = false;
}

// Ubah koordinat layar (client) ke koordinat logika view.
function screenToLogic(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width / rect.width);
  const py = (clientY - rect.top) * (canvas.height / rect.height);
  return { x: (px - ox) / scale, y: (py - oy) / scale };
}

let activeGame: Game | null = null;

// Resize / ganti orientasi: hitung ulang view, transform, lalu auto-pause.
function onResize(): void {
  const changed = updateView(window.innerWidth, window.innerHeight);
  applyTransform();
  if (changed) activeGame?.onViewChanged();
  activeGame?.pauseForFocusLoss();
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) activeGame?.pauseForFocusLoss(); // auto-pause saat tab/app tidak aktif
});

// --- Fungsi debug: galeri semua aset (aktif hanya jika CONFIG.debug.assetCheck) ---
function drawGallery(): void {
  beginFrame();
  ctx.fillStyle = '#1b1f2a';
  ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
  ctx.fillStyle = '#fff';
  ctx.font = '10px "Press Start 2P"';
  ctx.textBaseline = 'top';
  ctx.fillText(`ASSETS ${ASSET_PATHS.length - failed.length}/${ASSET_PATHS.length}`, 8, 8);
  const cols = 6;
  const cell = 56;
  ASSET_PATHS.forEach((p, i) => {
    const name = p.split('/').pop()!.replace('.png', '');
    const x = 8 + (i % cols) * cell;
    const y = 30 + Math.floor(i / cols) * cell;
    if (hasImage(name)) {
      const img = getImage(name);
      const k = Math.min((cell - 6) / img.naturalWidth, (cell - 6) / img.naturalHeight);
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      ctx.drawImage(img, x + (cell - w) / 2, y + (cell - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#c00';
      ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
      ctx.fillStyle = '#fff';
      ctx.fillText('X', x + 24, y + 22);
    }
  });
  if (failed.length) {
    ctx.fillStyle = '#f66';
    ctx.font = '7px "Press Start 2P"';
    failed.slice(0, 6).forEach((f, i) => ctx.fillText('MISSING ' + f, 8, 480 + i * 12));
  }
}

// --- Jalankan game ---
function runGame(): void {
  const game = new Game();
  activeGame = game;

  // Android: tombol Back membuka/menutup Pause (hanya di perangkat native).
  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', () => {
      if (!game.onBackButton()) void App.minimizeApp();
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = screenToLogic(e.clientX, e.clientY);
    game.onPointerDown(p.x, p.y);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = screenToLogic(e.clientX, e.clientY);
    game.onPointerUp(p.x, p.y);
  });
  canvas.addEventListener('pointercancel', () => game.onPointerUp(-9999, -9999));

  let last = performance.now();
  function frame(now: number): void {
    let dt = now - last;
    last = now;
    if (dt < 0) dt = 0;
    if (dt > CONFIG.time.maxDtMs) dt = CONFIG.time.maxDtMs;
    // Auto-sim: jalankan beberapa sublangkah agar fisika tetap stabil (uji balance).
    const steps = CONFIG.debug.autoSim ? Math.max(1, CONFIG.debug.autoSimSpeed) : 1;
    for (let s = 0; s < steps; s++) game.update(dt);
    beginFrame();
    game.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function start(): Promise<void> {
  updateView(window.innerWidth, window.innerHeight);
  applyTransform();
  await loadAssets();
  if (CONFIG.debug.assetCheck) drawGallery();
  else runGame();
}
start();
