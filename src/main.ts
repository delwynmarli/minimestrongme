import { CONFIG } from './game/config';
import { loadAssets, getImage, hasImage, ASSET_PATHS, failed } from './game/assets';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const W = CONFIG.view.width;
const H = CONFIG.view.height;

// Scale-to-fit 360x640 dengan letterbox & devicePixelRatio.
function applyTransform(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const s = Math.min(canvas.width / W, canvas.height / H);
  const ox = (canvas.width - W * s) / 2;
  const oy = (canvas.height - H * s) / 2;
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', () => { applyTransform(); drawCheck(); });

// Layar sementara: galeri semua aset (ukuran asli dibaca dari file).
function drawCheck(): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  applyTransform();
  ctx.fillStyle = '#1b1f2a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = '10px "Press Start 2P"';
  ctx.textBaseline = 'top';
  ctx.fillText(`ASSETS ${ASSET_PATHS.length - failed.length}/${ASSET_PATHS.length}`, 8, 8);
  const cols = 6, cell = 56;
  ASSET_PATHS.forEach((p, i) => {
    const name = p.split('/').pop()!.replace('.png', '');
    const x = 8 + (i % cols) * (cell + 0), y = 30 + Math.floor(i / cols) * (cell + 0);
    if (hasImage(name)) {
      const img = getImage(name);
      const k = Math.min((cell - 6) / img.naturalWidth, (cell - 6) / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      ctx.drawImage(img, x + (cell - w) / 2, y + (cell - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#c00'; ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
      ctx.fillStyle = '#fff'; ctx.fillText('X', x + 24, y + 22);
    }
  });
  if (failed.length) {
    ctx.fillStyle = '#f66'; ctx.font = '7px "Press Start 2P"';
    failed.slice(0, 6).forEach((f, i) => ctx.fillText('MISSING ' + f, 8, 480 + i * 12));
  }
}

async function start(): Promise<void> {
  applyTransform();
  await loadAssets();
  console.table(ASSET_PATHS.map((p) => {
    const n = p.split('/').pop()!.replace('.png', '');
    return hasImage(n) ? { file: p, size: `${getImage(n).naturalWidth}x${getImage(n).naturalHeight}` } : { file: p, size: 'MISSING' };
  }));
  drawCheck();
}
start();
