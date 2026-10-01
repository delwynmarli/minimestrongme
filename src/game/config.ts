// Semua angka balance & pengaturan ada di sini. Jangan hardcode angka di tempat lain.
export const CONFIG = {
  view: {
    width: 360, // lebar logis tetap
    height: 640, // tinggi default (di-override runtime oleh view.ts)
    heightMin: 560, // clamp tinggi logis minimum
    heightMax: 800, // clamp tinggi logis maksimum
    letterbox: '#241f1a', // warna isi area border/pillarbox (lantai gelap)
    border: 'rgba(210,185,150,0.35)', // garis tepi area bermain
  },

  // debug.assetCheck = tampilkan galeri aset (bukan game). showFps = overlay FPS.
  // enemyStress = spawn N musuh di awal untuk uji performa (0 = mati).
  // waveTools = tombol kecil untuk lompat wave & memberi upgrade.
  // autoSim = percepat waktu (substep) untuk uji balance.
  debug: { showFps: true, assetCheck: false, enemyStress: 0, waveTools: false, autoSim: false, autoSimSpeed: 5 },

  // fx = master switch semua efek (matikan untuk HP spek rendah).
  fx: {
    enabled: true,
    hitStopMs: 40, // freeze singkat saat crit / boss mati
    hitStopCdMs: 200, // jeda minimal antar hit-stop agar tidak patah-patah
    slowMoMs: 500, // slow-motion saat boss mati
    slowMoScale: 0.35,
    // ---- Visual 2.5D (semua bisa dimatikan) ----
    shadows: true, // bayangan di tanah
    lighting: true, // cahaya hangat + glow additive
    ambient: true, // partikel debu/kunang-kunang
    hopAnim: true, // animasi karakter (hop/sway/napas)
    runes: true, // animasi cincin rune (plaza)
    decor: true, // dekorasi tepi (batu/semak)
    depthScale: { enabled: true, top: 0.92, bottom: 1.08 }, // skala perspektif halus
    camera: { enabled: true, punchScale: 1.03, punchMs: 260 }, // camera punch wave/boss
    shadowAlpha: 0.35,
    ambientCount: 26,
    bulletHeight: 9, // peluru digambar terangkat dari tanah
    // ---- Enhance animasi ----
    slash: true, // busur tebasan saat menembak
    bladeBlur: true, // motion blur bilah
    shards: true, // kepingan pecah golem/boss
    decals: true, // bekas gosong meteor
    particles: { max: 300 }, // batas jumlah partikel (pool)
    quality: { windowMs: 2000, downFps: 45, upFps: 58, maxLevel: 3 }, // kualitas adaptif
    // Parameter animasi karakter (gated oleh fx.hopAnim).
    anim: {
      breathe: 0.02, // player "bernapas"
      leanDeg: 5, // player miring saat menembak
      hopHeight: 7, // lompatan slime
      hopSpeed: 7,
      flyHeight: 14, // tinggi melayang bat
      flapSpeed: 16, // kepakan sayap bat
      swayDeg: 3, // golem/boss bergoyang
      swaySpeed: 0.9,
      runTiltDeg: 8, // demon miring saat lari/dash
      stepSpeed: 6, // hentakan langkah golem/boss
      // --- tambahan enhance ---
      idleSkew: 2.5, // ayunan "jubah" player (skewX derajat)
      playerHitSquashPx: 0.18, // squash saat player kena damage
      playerPop: 0.14, // pop skala saat upgrade dipilih
      playerPopMs: 400, // durasi pop player
      enemySpawnMs: 260, // durasi spawn-in (easeOutBack)
      enemyHitSquashPx: 0.22, // squash musuh saat kena pukul
      enemyHitSquashMs: 160, // durasi squash saat kena pukul
      shardCount: 6, // jumlah kepingan pecah golem/boss
      slashMs: 120, // durasi busur tebasan
      springStiffness: 200, // spring lean player (overshoot)
      springDamping: 13,
      leanKick: 520, // impuls lean saat menembak (derajat/detik)
    },
    shake: {
      playerHit: { mag: 3, ms: 150 },
      explosion: { mag: 4, ms: 200 },
      bossKill: { mag: 8, ms: 500 },
    },
    vignette: { threshold: 0.3, minAlpha: 0.0, maxAlpha: 0.45, pulseSec: 0.6 },
  },
  time: { maxDtMs: 50 }, // clamp delta-time

  arena: {
    cx: 180, // runtime (view.centerX)
    cy: 320, // runtime (view.centerY)
    // Plaza ritual (pusat)
    plazaR: 150, // radius piringan plaza batu
    plazaThickness: 8, // bibir tepi (2.5D)
    platformR: 52, // radius platform tengah (tempat karakter)
    platformThickness: 6,
    // Cincin rune (dekoratif; BUKAN jangkauan tembak)
    runeOuterR: 135,
    runeOuterCount: 24,
    runeOuterSpeed: 0.157, // rad/detik (≈ satu putaran 40 detik)
    runeInnerR: 70,
    runeInnerCount: 12,
    runeInnerSpeed: -0.09, // arah berlawanan, lebih lambat
    runeColor: '#4fd2ff', // cyan
    runeColorDeep: '#1b6ea0', // aksen biru tua
    runeGlowPeriodSec: 3, // siklus denyut glow
    runeGlowMin: 0.5,
    runeGlowMax: 1,
    runeMarkLen: 6, // panjang tanda rune luar
    runeGlyphR: 5, // radius glyph rune tengah
    // Interaktif (ms)
    runeShootFlashMs: 90,
    runeHitFlashMs: 150,
    runeUpgradeFlashMs: 500,
    shockwaveMs: 520,
    platformShakePx: 3,
    // Warna flash upgrade per tag.
    upgradeColors: { projectile: '#4fd2ff', elemental: '#ff9a3c', defense: '#5ad06a', stat: '#ffd24d' },
  },

  // Tampilan background arena (digambar sekali ke offscreen). Angka mudah diatur.
  background: {
    // Lantai dasar batu (dominan layar): gelap + hangat, saturasi rendah.
    floorBrightness: 1.0, // pengali terang lantai
    floorSaturation: 0.55, // 1 = warna asli, 0 = abu-abu
    floorTint: '#a08c72', // tint hangat coklat-abu (multiply)
    // Plaza ritual: batu lebih terang + sedikit kebiruan (abu-biru hangat).
    plazaBrightness: 1.7,
    plazaSaturation: 0.45,
    plazaTint: '#aebfd2',
    plazaWall: '#39424e', // pita dinding ketebalan
    platformBrightness: 2.1,
    platformTint: '#c6d6e8',
    crackColor: 'rgba(18,24,32,0.45)',
    mossColor: '#3c5c2f',
    // Rumput: diredam (saturasi turun ~40%, digelapkan ~20-25%).
    grassBrightness: 0.78,
    grassSaturation: 0.55,
    grassTint: '#93a878',
    grassCenterDarken: 0.18, // bayangan di lingkaran rumput tengah
    // Petak rumput tak beraturan di tepi/sudut (di luar cincin).
    edgePatches: 7, // jumlah petak (maks 10 posisi tersedia)
    edgePatchMin: 12, // radius blob min
    edgePatchMax: 28, // radius blob max
    edgeSeed: 1337, // seed tetap → hasil selalu sama
    // Rumpun rumput kecil (piksel hijau gelap) tersebar.
    tufts: 26,
    tuftColor: '#2f4a26',
    // Vignette halus di tepi (sekitar 15% terluar lebih gelap).
    vignetteInner: 0.72, // mulai gelap dari 72% radius
    vignetteStrength: 0.5,
    // Overlay gelap pada bg_title.png agar tidak terlalu terang/hijau.
    titleDim: 0.3,
  },

  player: {
    x: 180,
    y: 320,
    maxHp: 100,
    displayWidth: 40, // player.png tampil lebar 40
    bobAmp: 2, // naik-turun 2 px
    bobSpeed: 3.2, // rad/detik
    squashAmt: 0.05,
    flashMs: 120,
    recoilPx: 3, // dorongan balik kecil saat menembak
    recoilMs: 110,
    lives: 3, // nyawa per run
    invincibleMs: 2000, // kebal setelah kehilangan nyawa
    reviveHpPct: 0.5, // HP dipulihkan 50% setelah kehilangan nyawa
    hitInvincibleMs: 500, // kebal singkat tiap kali terkena damage (anti-kerumunan)
  },

  weapon: {
    fireIntervalMs: 400,
    range: 220,
  },

  bullet: {
    basic: { speed: 260, damage: 14, displayWidth: 16, outMargin: 40, hitQueryRadius: 40 },
  },

  enemy: {
    types: {
      slime: {
        hp: 20, speed: 40, dmg: 5, width: 30, key: 'enemy_slime', color: '#57c85a', weight: 3,
        splitInto: 'slime_mini', splitCount: 2, anim: 'hop', // opsional: pecah jadi 2 slime kecil
      },
      slime_mini: { hp: 8, speed: 55, dmg: 2, width: 18, key: 'enemy_slime', color: '#7fd98a', weight: 0, anim: 'hop' },
      bat: { hp: 10, speed: 65, dmg: 3, width: 40, key: 'enemy_bat', color: '#9b6bd6', weight: 2, anim: 'fly' },
      demon: {
        hp: 45, speed: 44, dmg: 7, width: 32, key: 'enemy_demon', color: '#d4514f', weight: 1, anim: 'run',
        // tiap 4 detik: berhenti + kedip merah 0.4 detik, lalu dash cepat.
        dash: { intervalMs: 4000, telegraphMs: 400, speed: 200, durationMs: 600 },
      },
      golem: { hp: 130, speed: 25, dmg: 11, width: 44, key: 'enemy_golem', color: '#8a8f98', weight: 1, knockbackResist: true, anim: 'sway' },
      boss_mini: {
        hp: 650, speed: 22, dmg: 4, width: 96, key: 'enemy_boss_golem', color: '#c8843c', weight: 0,
        boss: true, bossName: 'STONE TYRANT', knockbackResist: true, anim: 'sway',
      },
      boss_final: {
        hp: 1700, speed: 24, dmg: 4, width: 110, key: 'enemy_boss_golem', color: '#c8843c', weight: 0,
        boss: true, bossName: 'ANCIENT GOLEM', knockbackResist: true, anim: 'sway',
        phase2: { hpPct: 0.5, speedMult: 1.5, summonIntervalMs: 5000, summonType: 'slime', summonCount: 3 },
      },
    },
    spawnMarginPad: 6, // jarak tambahan di luar tepi (di atas setengah sprite terbesar)
    contactCooldownMs: 600, // cooldown damage kontak per musuh
    knockback: 8, // px dorongan saat kena tembakan
    hitFlashMs: 80,
    separationDist: 22, // jarak ideal antar musuh
    bobAmp: 2,
    bobSpeed: 6,
    hpBarWidth: 22,
    hpBarHeight: 3,
    bossSpawnY: -100, // boss masuk dari atas layar
    bossBar: { width: 300, height: 12, y: 84, nameFont: 9 },
  },

  // Data wave: budget (total musuh) + komposisi tipe (bobot). Index 0 = wave 1.
  wave: {
    total: 10,
    startDelayMs: 1500, // jeda + teks "WAVE X"
    spawnIntervalMs: 1500, // musuh di-spawn bertahap selama wave
    hpMultPerWave: 0.05, // HP musuh naik tiap wave (linear, tidak eksponensial)
    dmgMultPerWave: 0.03, // damage musuh naik tiap wave
    waveClearHealPct: 0.22, // heal 22% max HP di akhir tiap wave (mudah diatur)
    bannerFont: 24,
    data: [
      { budget: 8, comp: { slime: 1 } }, // 1
      { budget: 11, comp: { slime: 3, bat: 2 } }, // 2 (bat mulai)
      { budget: 13, comp: { slime: 2, bat: 2, demon: 1 } }, // 3 (demon mulai)
      { budget: 15, comp: { slime: 2, bat: 2, demon: 1 } }, // 4
      { budget: 13, comp: { slime: 1, bat: 1, demon: 1 }, boss: 'boss_mini' }, // 5 MINI-BOSS
      { budget: 19, comp: { slime: 1, bat: 2, demon: 1, golem: 1 } }, // 6 (golem mulai)
      { budget: 22, comp: { slime: 1, bat: 3, demon: 1, golem: 1 } }, // 7
      { budget: 25, comp: { slime: 1, bat: 3, demon: 2, golem: 1 } }, // 8
      { budget: 28, comp: { slime: 1, bat: 3, demon: 2, golem: 1 } }, // 9
      { budget: 28, comp: { slime: 1, bat: 3, demon: 2, golem: 2 }, boss: 'boss_final' }, // 10 BOSS
    ] as { budget: number; comp: Record<string, number>; boss?: string }[],
  },

  // Nilai per-level tiap upgrade (dipakai upgrades/registry.ts).
  upgrades: {
    choiceCount: 3,
    damage: { perLevel: 0.25 }, // +25% damage / level
    attack_speed: { perLevel: 0.2 }, // +20% attack speed / level
    max_hp: { perLevel: 20, healPerLevel: 20 }, // +20 max HP & heal 20 / level
    multishot: { perLevel: 1, spreadRad: 0.14 }, // +1 peluru, sebaran kipas
    heal_aura: {
      intervalMs: 8000, // pulsa tiap 8 detik
      intervalPerLevelMs: 800, // turun 0.8 detik / level
      minIntervalMs: 2000,
      healPct: 0.08, // heal 8% max HP
      radius: 90, // radius tampil vfx_aura
    },
    crit: { perLevel: 0.1, critMult: 2 }, // +10% crit / level, crit = damage x2
    proj_speed: { perLevel: 0.15 }, // +15% kecepatan peluru / level
    piercing: { perLevel: 1 }, // peluru tembus +1 musuh / level
    bounce_bullet: { perLevel: 1, damageLossPerBounce: 0.1, searchRadius: 220 }, // memantul +1 / level, damage -10% per pantulan
    bounce_blade: {
      intervalMs: 3000, // lempar tiap 3 detik
      baseBlades: 1,
      bladesPerLevel: 1, // +1 bilah / level
      damage: 12,
      damagePerLevel: 8,
      lifeMs: 3000, // hidup 3 detik
      speed: 150,
      spinRate: 9, // rad/detik (visual)
      displayWidth: 26,
      wallPad: 8, // jarak pantul dari tepi layar
      searchRadius: 220, // radius cari musuh berikutnya
    },
    lightning: {
      intervalMs: 2500, // sambar tiap 2.5 detik
      damage: 14,
      chainBase: 2, // merantai ke 2 musuh terdekat
      chainPerLevel: 1,
      chainFalloff: 0.7, // 70% damage tiap lompatan
      range: 260, // jangkauan sambar musuh acak (dari player)
      chainRadius: 95, // radius cari musuh berikut
      boltMs: 120, // tampil 120 ms
      jitter: 6,
      skyY: -12,
    },
    meteor: {
      intervalMs: 6000, // tiap 6 detik
      intervalPerLevelMs: 700, // turun per level
      minIntervalMs: 3000,
      baseCount: 3, // 3 meteor
      countPerLevel: 1, // +1 / level
      damage: 25,
      damagePerLevel: 12,
      radius: 40, // radius ledakan
      markMs: 600, // penanda 0.6 detik
      fallMs: 380, // durasi jatuh
      spawnOffsetX: 70, // meteor datang dari atas-kanan
      spawnOffsetY: 90,
      explosionMs: 320,
      displayWidth: 36,
    },
  },

  // Sistem synergy (upgrades/synergy.ts). Angka balance ada di sini.
  synergy: {
    bannerMs: 1500,
    badgeSize: 22,
    choiceWeightBonus: 2, // peluang kartu pembuka synergy dinaikkan
    stormFire: { burnDps: 6, burnMs: 3000, extraChain: 1 },
    fanOfBlades: { extraBlades: 1 },
    vitalStorm: { healPerHit: 1 },
    glassCannon: { critMult: 3 },
  },


  // Tata letak layar pilih upgrade.
  ui: {
    fadeMs: 200, // durasi fade transisi antar layar
    panelHeight: 270,
    titleFont: 12,
    cardWidth: 100,
    cardHeight: 168,
    cardGap: 10,
    cardTopGap: 38,
    iconBox: 46,
    nameFont: 7,
    descFont: 6,
    levelFont: 6,
    appearStaggerMs: 80,
    appearDurMs: 360,
    pressScale: 0.95,
    slideUpPx: 40,
  },

  effects: {
    hitSpark: { size: 20, lifeMs: 160 },
    deathParticles: { count: 9, size: 4, lifeMs: 450, speed: 70 },
    smokePuff: { size: 28, lifeMs: 420 },
    burn: { size: 16 },
    explosion: { size: 56 },
    ring: { lifeMs: 300, color: '#ffb060' },
    lightningHit: { size: 36, lifeMs: 200 },
    dmgText: { lifeMs: 600, criticColor: '#ffe14d', normalColor: '#ffffff' },
    bulletTrail: { ghosts: 3, spacing: 10, alpha: 0.35 },
  },

  hud: {
    margin: 8,
    iconSize: 20,
    barWidth: 120,
    barHeight: 14,
    pauseSize: 24,
    waveBarWidth: 150,
    waveBarHeight: 12,
    upIconSize: 24,
    upIconGap: 3,
    upIconY: 30,
  },

  gameover: {
    bannerWidth: 300,
  },

  // Preset kesulitan global (multiplier di atas angka dasar di atas).
  // Diubah dari layar setting (tersimpan lewat save.ts). Default: normal.
  difficulty: {
    current: 'normal',
    order: ['easy', 'normal', 'hard'],
    presets: {
      easy: { enemyHp: 0.9, enemyDmg: 0.85, spawnCount: 0.95, waveHeal: 1.3, playerHp: 1.1, playerDmg: 1.0 },
      normal: { enemyHp: 1.0, enemyDmg: 1.0, spawnCount: 1.0, waveHeal: 1.0, playerHp: 1.0, playerDmg: 1.0 },
      hard: { enemyHp: 1.3, enemyDmg: 1.45, spawnCount: 1.12, waveHeal: 0.35, playerHp: 0.9, playerDmg: 1.0 },
    },
  },
};

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyPreset {
  enemyHp: number;
  enemyDmg: number;
  spawnCount: number;
  waveHeal: number;
  playerHp: number;
  playerDmg: number;
}

// Preset kesulitan yang sedang aktif.
export function diffPreset(): DifficultyPreset {
  return CONFIG.difficulty.presets[CONFIG.difficulty.current as Difficulty];
}


