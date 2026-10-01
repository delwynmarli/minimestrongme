// Preloader aset. Nama = nama file tanpa ekstensi, mis. getImage('player').
export const ASSET_PATHS: string[] = [
  'sprites/player.png', 'sprites/enemy_slime.png', 'sprites/enemy_bat.png', 'sprites/enemy_demon.png',
  'sprites/enemy_golem.png', 'sprites/enemy_boss_golem.png', 'sprites/bullet_basic.png', 'sprites/bullet_blade.png',
  'sprites/vfx_meteor.png', 'sprites/vfx_explosion.png', 'sprites/vfx_aura.png', 'sprites/vfx_burn.png',
  'sprites/vfx_hit_spark.png', 'sprites/vfx_smoke_puff.png', 'sprites/vfx_lightning_bolt.png', 'sprites/vfx_lightning_hit.png',
  'ui/ui_panel.png', 'ui/ui_btn_blank.png', 'ui/ui_logo_title.png', 'ui/ui_badge_synergy.png',
  'ui/ui_banner_gameover.png', 'ui/ui_banner_victory.png', 'ui/ui_icon_life.png', 'ui/ui_icon_pause.png',
  'ui/ui_icon_damage.png', 'ui/ui_icon_attack_speed.png', 'ui/ui_icon_max_hp.png', 'ui/ui_icon_multishot.png',
  'ui/ui_icon_piercing.png', 'ui/ui_icon_bounce_bullet.png', 'ui/ui_icon_lightning.png', 'ui/ui_icon_proj_speed.png',
  'ui/ui_icon_crit.png', 'ui/ui_icon_sword.png', 'ui/ui_icon_heart.png', 'ui/ui_icon_meteor.png',
  'bg/bg_title.png', 'app/app_icon.png',
  'tiles/tile_grass_seamless.png', 'tiles/tile_stone_seamless.png',
];

const images = new Map<string, HTMLImageElement>();
export const failed: string[] = [];

function nameOf(path: string): string {
  return path.split('/').pop()!.replace('.png', '');
}

function loadOne(path: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(nameOf(path), img); resolve(); };
    img.onerror = () => { failed.push(path); resolve(); };
    img.src = `./assets/${path}`;
  });
}

export async function loadAssets(): Promise<void> {
  await Promise.all([
    ...ASSET_PATHS.map(loadOne),
    document.fonts.load('12px "Press Start 2P"'),
  ]);
}

export function getImage(name: string): HTMLImageElement {
  const img = images.get(name);
  if (!img) throw new Error(`Aset tidak ditemukan: ${name}`);
  return img;
}

export function hasImage(name: string): boolean {
  return images.has(name);
}

// Versi sprite yang seluruh pikselnya diberi satu warna (dipakai untuk flash putih).
// Hasil di-cache agar tidak dihitung ulang setiap frame.
const tinted = new Map<string, HTMLCanvasElement>();

export function getTinted(name: string, color: string): HTMLCanvasElement {
  const key = `${name}|${color}`;
  const cached = tinted.get(key);
  if (cached) return cached;
  const img = getImage(name);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tinted.set(key, c);
  return c;
}
