// Orkestrasi utama: game loop, wave system, tembak otomatis, collision, HUD, upgrade.
import { CONFIG, diffPreset, type Difficulty } from './config';
import { qualityTick, quality } from './quality';
import { easeOutBack } from './anim';
import { getImage, getTinted } from './assets';
import { drawFit } from './draw';
import { buildArena } from './arena';
import { RuneField } from './runes';
import { initVisual, initAmbient, updateAmbient, drawAmbient, drawLight, drawDecor, getDecor, type Decor } from './visual';
import { Player } from './player';
import { PlayerState } from './playerState';
import { Enemy, type EnemyDef } from './enemy';
import { Bullet } from './bullet';
import { Blade } from './blade';
import { Meteor } from './meteor';
import { Effect } from './effect';
import { SpatialGrid } from './spatial';
import { play } from './audio';
import { UpgradeScreen } from './ui/upgradeScreen';
import { drawFade, drawButton, drawTitle, titlePlayRect, pauseLayout, drawPause } from './ui/menu';
import { loadSave, saveGame, type SaveData } from './save';
import { rollChoices, getUpgrade, UPGRADES } from './upgrades/registry';
import type { UpgradeDef } from './upgrades/types';
import { newlyActivated, SYNERGIES } from './upgrades/synergy';
import { waveCount, waveDef, waveHpMult, waveDmgMult, pickWaveType, waveBoss } from './waves';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

type State = 'title' | 'banner' | 'playing' | 'upgrade' | 'victory' | 'gameover';

const EMPTY_IDS: number[] = [];

// Komparator Y-sorting (modul-level agar tidak buat closure tiap frame).
interface Sortable {
  baseY: number;
}
const sortByY = (a: Sortable, b: Sortable): number => a.baseY - b.baseY;

export class Game {
  private arena: HTMLCanvasElement;
  private playerState = new PlayerState();
  private player = new Player(this.playerState);
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private blades: Blade[] = [];
  private meteors: Meteor[] = [];
  private effects: Effect[] = [];
  private upgradeScreen = new UpgradeScreen();
  private runes = new RuneField();
  private grid = new SpatialGrid(CONFIG.view.width, CONFIG.view.height, 48);
  private query: Enemy[] = [];

  private timeSec = 0;
  private state: State = 'title';
  private fps = 60;

  private waveIndex = 0;
  private waveBudget = 0;
  private spawnedThisWave = 0;
  private killedThisWave = 0;
  private spawnTimerMs = 0;
  private bannerTimerMs = 0;

  private fireTimerMs = 0;
  private healTimerMs = 0;
  private bladeTimerMs = 0;
  private lightningTimerMs = 0;
  private meteorTimerMs = 0;

  private synergyBannerMs = 0;
  private synergyBannerName = '';

  private shakeMs = 0;
  private shakeMag = 0;
  private hitStopMs = 0;
  private hitStopCdMs = 0;
  private slowMoMs = 0;
  private bossRef: Enemy | null = null;
  private bossEnraged = false;
  private bossSummonTimerMs = 0;
  private vignette: CanvasGradient | null = null;
  private camPunchMs = 0;
  private bossStepMs = 0;
  private sortBuf: (Enemy | Player | Decor)[] = [];
  private hpShown = 1; // rasio HP yang "menyusul" (ekor bar)
  private heartsPulseMs = 0;
  private qualityLevel = 0;

  private retryRect = { x: 0, y: 0, w: 0, h: 0 }; // tombol utama (RETRY / PLAY AGAIN)
  private menuRect = { x: 0, y: 0, w: 0, h: 0 }; // tombol MENU di layar akhir
  private pauseRect = { x: 0, y: 0, w: 0, h: 0 };
  private debugWaveSel = 1;

  private paused = false;
  private pressedId: string | null = null;
  private fadeAlpha = 0;
  private fadeDir = 0; // 1 = menggelap, -1 = menerang
  private pendingAction: (() => void) | null = null;
  private totalKills = 0;
  private save!: SaveData;

  constructor() {
    this.save = loadSave();
    this.applySettings();
    this.arena = buildArena();
    initVisual();
    initAmbient();
    this.toTitle();
  }

  // Terapkan setting tersimpan ke runtime (Effects mematikan/menyalakan fx).
  private applySettings(): void {
    CONFIG.fx.enabled = this.save.settings.effects;
    CONFIG.difficulty.current = this.save.settings.difficulty;
  }

  // Ganti preset kesulitan (EASY -> NORMAL -> HARD) + simpan.
  private cycleDifficulty(): void {
    const order = CONFIG.difficulty.order as Difficulty[];
    const i = order.indexOf(this.save.settings.difficulty);
    this.save.settings.difficulty = order[(i + 1) % order.length];
    this.applySettings();
    saveGame(this.save);
    play('ui_click');
  }

  // Kembali ke title screen.
  private toTitle(): void {
    for (const e of this.enemies) e.active = false;
    for (const b of this.bullets) b.active = false;
    for (const b of this.blades) b.active = false;
    for (const m of this.meteors) m.active = false;
    for (const f of this.effects) f.active = false;
    this.playerState.reset();
    this.player.reset();
    this.upgradeScreen.close();
    this.paused = false;
    this.waveIndex = 0;
    this.waveBudget = 0;
    this.spawnedThisWave = 0;
    this.killedThisWave = 0;
    this.totalKills = 0;
    this.synergyBannerMs = 0;
    this.bossRef = null;
    this.bossEnraged = false;
    this.state = 'title';
  }

  // Mulai run baru (dipanggil dari PLAY / RETRY / RESTART).
  private startRun(): void {
    this.save.totalRuns++;
    saveGame(this.save);
    this.paused = false;
    this.reset();
  }

  // Simpan best score saat run berakhir.
  private onRunEnd(victory: boolean): void {
    const reached = victory ? waveCount() : this.waveIndex + 1;
    if (reached > this.save.bestWave) this.save.bestWave = reached;
    if (this.totalKills > this.save.bestKills) this.save.bestKills = this.totalKills;
    saveGame(this.save);
  }

  // ----- Transisi fade -----

  private transitionTo(action: () => void): void {
    if (this.fadeDir !== 0) return;
    this.fadeDir = 1;
    this.pendingAction = action;
  }

  private updateFade(dtMs: number): void {
    if (this.fadeDir === 0) return;
    this.fadeAlpha += (this.fadeDir * dtMs) / CONFIG.ui.fadeMs;
    if (this.fadeDir === 1 && this.fadeAlpha >= 1) {
      this.fadeAlpha = 1;
      const a = this.pendingAction;
      this.pendingAction = null;
      this.fadeDir = -1;
      if (a) a();
    } else if (this.fadeDir === -1 && this.fadeAlpha <= 0) {
      this.fadeAlpha = 0;
      this.fadeDir = 0;
    }
  }

  reset(): void {
    for (const e of this.enemies) e.active = false;
    for (const b of this.bullets) b.active = false;
    for (const b of this.blades) b.active = false;
    for (const m of this.meteors) m.active = false;
    for (const f of this.effects) f.active = false;
    this.playerState.reset();
    this.player.reset();
    this.upgradeScreen.close();
    this.paused = false;
    this.totalKills = 0;
    this.timeSec = 0;
    this.fireTimerMs = 0;
    this.healTimerMs = 0;
    this.bladeTimerMs = 0;
    this.lightningTimerMs = 0;
    this.meteorTimerMs = 0;
    this.synergyBannerMs = 0;
    this.synergyBannerName = '';
    this.shakeMs = 0;
    this.shakeMag = 0;
    this.hitStopMs = 0;
    this.hitStopCdMs = 0;
    this.slowMoMs = 0;
    this.bossRef = null;
    this.bossEnraged = false;
    this.bossSummonTimerMs = 0;
    this.debugWaveSel = 1;
    this.startWave(0);
    // Debug: spawn sekaligus banyak musuh untuk uji performa.
    for (let i = 0; i < CONFIG.debug.enemyStress; i++) this.spawnStressEnemy();
  }

  // Mulai wave ke-index (0-based). Selalu lewat fase 'banner' (teks "WAVE X").
  private startWave(index: number): void {
    this.waveIndex = index;
    this.waveBudget = Math.round(waveDef(index).budget * diffPreset().spawnCount);
    this.spawnedThisWave = 0;
    this.killedThisWave = 0;
    this.spawnTimerMs = 0;
    this.bannerTimerMs = CONFIG.wave.startDelayMs;
    this.state = 'banner';
    this.camPunchMs = CONFIG.fx.camera.punchMs; // camera punch saat wave mulai
    this.runes.shockwave(); // gelombang kejut cahaya dari pusat
    this.bossRef = null;
    this.bossEnraged = false;
    this.bossSummonTimerMs = 0;
    const boss = waveBoss(index);
    if (boss) this.spawnBoss(boss);
  }

  // Boss masuk dari atas layar, discale oleh wave multiplier.
  private spawnBoss(def: EnemyDef): void {
    const e = this.acquireEnemy();
    const stopDist = CONFIG.player.displayWidth * 0.4 + def.width * 0.5;
    e.spawn(
      def,
      CONFIG.arena.cx,
      CONFIG.enemy.bossSpawnY,
      CONFIG.arena.cx,
      CONFIG.arena.cy,
      stopDist,
      waveHpMult(this.waveIndex),
      waveDmgMult(this.waveIndex),
    );
    this.bossRef = e;
  }

  // ----- Loop -----

  update(dtMs: number): void {
    if (dtMs > 0) this.fps = this.fps * 0.9 + (1000 / dtMs) * 0.1;
    if (this.shakeMs > 0) this.shakeMs -= dtMs;
    if (this.hitStopCdMs > 0) this.hitStopCdMs -= dtMs;
    if (this.camPunchMs > 0) this.camPunchMs -= dtMs;
    this.qualityLevel = qualityTick(dtMs, this.fps);
    // HP bar "ekor" (nilai menyusul pelan).
    const hr = this.playerState.maxHp > 0 ? this.playerState.hp / this.playerState.maxHp : 1;
    if (hr < this.hpShown) this.hpShown = Math.max(hr, this.hpShown - dtMs / 600);
    else this.hpShown = hr;
    if (this.heartsPulseMs > 0) this.heartsPulseMs -= dtMs;
    this.updateFade(dtMs);

    // Title: hanya animasi latar.
    if (this.state === 'title') {
      this.timeSec += dtMs / 1000;
      for (const f of this.effects) if (f.active) f.update(dtMs);
      return;
    }
    // Pause: gameplay dibekukan (fade tetap jalan).
    if (this.paused) return;

    // Hit-stop: freeze total singkat (crit / boss mati).
    if (this.hitStopMs > 0) {
      this.hitStopMs -= dtMs;
      return;
    }
    // Slow-motion saat boss mati.
    let dt = dtMs;
    if (this.slowMoMs > 0) {
      this.slowMoMs -= dtMs;
      dt = dtMs * CONFIG.fx.slowMoScale;
    }

    this.timeSec += dt / 1000;
    if (this.synergyBannerMs > 0) this.synergyBannerMs -= dtMs;

    if (this.state === 'banner') {
      this.bannerTimerMs -= dtMs;
      if (this.bannerTimerMs <= 0) this.state = 'playing';
    } else if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'upgrade') {
      this.upgradeScreen.update(dtMs);
    }

    // Efek selalu berjalan agar memudar dengan mulus walau game pause.
    for (const f of this.effects) if (f.active) f.update(dtMs);
  }

  private addShake(mag: number, ms: number): void {
    if (!CONFIG.fx.enabled) return;
    if (mag > this.shakeMag || this.shakeMs <= 0) {
      this.shakeMag = mag;
      this.shakeMs = ms;
    }
  }

  // Hit-stop singkat dengan jeda minimal agar tidak patah-patah.
  private triggerHitStop(): void {
    if (!CONFIG.fx.enabled || this.hitStopCdMs > 0) return;
    this.hitStopMs = Math.max(this.hitStopMs, CONFIG.fx.hitStopMs);
    this.hitStopCdMs = CONFIG.fx.hitStopCdMs;
  }

  private updatePlaying(dtMs: number): void {
    this.rebuildGrid();
    updateAmbient(dtMs);
    this.runes.update(dtMs);
    this.player.update(dtMs);
    this.updateWaveSpawn(dtMs);
    this.updateFiring(dtMs);
    this.updateHealAura(dtMs);
    this.updateBladeThrow(dtMs);
    this.updateLightning(dtMs);
    this.updateMeteorSpawn(dtMs);
    this.updateEnemies(dtMs);
    this.updateBullets(dtMs);
    this.updateBlades(dtMs);
    this.updateMeteors(dtMs);
    this.updateBoss(dtMs);
    if (this.playerState.hp <= 0) {
      this.loseLife();
      return;
    }
    this.checkWaveClear();
  }

  // HP habis: kehilangan 1 nyawa. Bila masih ada nyawa: ledakan membunuh semua
  // musuh biasa, HP pulih 50%, kebal 2 detik. Bila habis: Game Over.
  private loseLife(): void {
    this.playerState.lives--;
    this.playerState.invincibleMs = CONFIG.player.invincibleMs;
    this.playerState.hp = Math.round(this.playerState.maxHp * CONFIG.player.reviveHpPct);
    this.player.reset();

    for (const e of this.enemies) {
      if (!e.active || e.def.boss) continue;
      this.killEnemy(e, false); // tanpa memecah slime
    }
    if (CONFIG.fx.enabled) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 20 + Math.random() * 50;
        this.acquireEffect().spawnExplosion(this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r, CONFIG.effects.explosion.size, 360);
      }
      this.acquireEffect().spawnRing(this.player.x, this.player.y, 16, 120, 450, CONFIG.effects.ring.color);
    }
    // Hati berdenyut + pecahan hati di HUD.
    this.heartsPulseMs = 700;
    if (CONFIG.fx.enabled) {
      const size = CONFIG.hud.iconSize;
      const gap = 4;
      const margin = CONFIG.hud.margin;
      const total = CONFIG.player.lives;
      const hx = CONFIG.view.width - margin - total * (size + gap) + gap + this.playerState.lives * (size + gap);
      const hy = CONFIG.view.height - margin - size / 2;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        this.acquireEffect().spawnParticle(hx, hy, Math.cos(a) * 40, Math.sin(a) * 40 - 30, 3, 600, '#e23b3b');
      }
    }
    this.addShake(CONFIG.fx.shake.bossKill.mag, CONFIG.fx.shake.bossKill.ms);
    this.hitStopMs = Math.max(this.hitStopMs, CONFIG.fx.hitStopMs);

    if (this.playerState.lives <= 0) {
      this.onRunEnd(false);
      this.state = 'gameover';
      play('gameover');
    } else {
      play('life_lost');
    }
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.enemies) if (e.active) this.grid.insert(e);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.state === 'title') {
      drawTitle(ctx, this.timeSec, this.save.bestWave, this.save.bestKills, this.pressedId === 'play');
      drawFade(ctx, this.fadeAlpha);
      return;
    }

    ctx.save();
    // Clip ke area bermain: tidak ada yang tampil di border/pillarbox.
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.view.width, CONFIG.view.height);
    ctx.clip();
    // Camera punch (zoom singkat) di sekitar pusat arena.
    const camCfg = CONFIG.fx.camera;
    if (camCfg.enabled && this.camPunchMs > 0) {
      const k = this.camPunchMs / camCfg.punchMs;
      const s = 1 + (camCfg.punchScale - 1) * k;
      ctx.translate(CONFIG.arena.cx, CONFIG.arena.cy);
      ctx.scale(s, s);
      ctx.translate(-CONFIG.arena.cx, -CONFIG.arena.cy);
    }
    if (this.shakeMs > 0) {
      const k = Math.min(1, this.shakeMs / 200);
      ctx.translate((Math.random() - 0.5) * 2 * this.shakeMag * k, (Math.random() - 0.5) * 2 * this.shakeMag * k);
    }

    ctx.drawImage(this.arena, 0, 0);
    this.runes.draw(ctx, this.timeSec); // cincin rune ritual (di atas plaza)
    drawAmbient(ctx, this.timeSec); // debu/kunang-kunang (di belakang aktor)
    drawLight(ctx, this.player.x, this.player.y, 260, 0.35); // cahaya hangat

    // Pass bayangan (semua bayangan di dasar, di bawah semua sprite).
    for (const b of this.bullets) if (b.active) b.drawShadow(ctx);
    for (const e of this.enemies) if (e.active) e.drawShadow(ctx, this.timeSec);
    for (const m of this.meteors) if (m.active) m.drawShadow(ctx);
    this.player.drawShadow(ctx);

    // Aktor diurutkan berdasarkan Y (player + musuh + dekorasi).
    this.buildSort();
    for (const it of this.sortBuf) {
      if ((it as Decor).isDecor) drawDecor(ctx, it as Decor);
      else if (it === this.player) this.player.draw(ctx, this.timeSec);
      else (it as Enemy).draw(ctx, this.timeSec);
    }

    // Proyektil & efek di atas (punya ketinggian).
    for (const b of this.blades) if (b.active) b.draw(ctx);
    for (const b of this.bullets) if (b.active) b.draw(ctx, this.timeSec);
    for (const m of this.meteors) if (m.active) m.draw(ctx, this.timeSec);
    for (const f of this.effects) if (f.active) f.draw(ctx);

    this.drawHud(ctx);
    if (this.bossRef && this.bossRef.active) this.drawBossBar(ctx);
    if (this.state === 'banner') this.drawWaveBanner(ctx);
    if (this.synergyBannerMs > 0) this.drawSynergyBanner(ctx);
    ctx.restore();

    // Garis tepi area bermain (tipis) agar batas terlihat rapi.
    ctx.strokeStyle = CONFIG.view.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CONFIG.view.width - 2, CONFIG.view.height - 2);

    if (CONFIG.fx.enabled) this.drawVignette(ctx);
    if (this.state === 'upgrade') this.upgradeScreen.render(ctx);
    if (this.state === 'gameover') this.drawGameOver(ctx);
    if (this.state === 'victory') this.drawVictory(ctx);
    if (this.paused) drawPause(ctx, this.save.settings, (id) => this.pressedId === id);
    if (CONFIG.debug.showFps) this.drawFps(ctx);
    if (CONFIG.debug.waveTools) this.drawDebug(ctx);
    drawFade(ctx, this.fadeAlpha);
  }

  // Kumpulkan aktor ke buffer (dipakai ulang) lalu sort by baseY in-place.
  private buildSort(): void {
    const b = this.sortBuf;
    b.length = 0;
    for (const e of this.enemies) if (e.active) b.push(e);
    b.push(this.player);
    if (CONFIG.fx.decor) {
      for (const d of getDecor()) b.push(d);
    }
    b.sort(sortByY);
  }

  // Dipanggil main saat ukuran view berubah (resize / ganti orientasi).
  onViewChanged(): void {
    this.arena = buildArena();
    this.grid = new SpatialGrid(CONFIG.view.width, CONFIG.view.height, 48);
    this.player.x = CONFIG.arena.cx;
    this.player.y = CONFIG.arena.cy;
    for (const e of this.enemies) if (e.active) e.retarget(CONFIG.arena.cx, CONFIG.arena.cy);
    this.vignette = null; // gradient lama perlu dibuat ulang
  }

  // Vignette merah berdenyut saat HP < threshold.
  private drawVignette(ctx: CanvasRenderingContext2D): void {
    const ratio = this.playerState.hp / this.playerState.maxHp;
    const v = CONFIG.fx.vignette;
    if (ratio >= v.threshold) return;
    if (!this.vignette) {
      const cx = CONFIG.arena.cx;
      const cy = CONFIG.arena.cy;
      const innerR = CONFIG.view.width * 0.36;
      const outerR = Math.hypot(CONFIG.view.width / 2, CONFIG.view.height / 2);
      const g = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
      g.addColorStop(0, 'rgba(140,0,0,0)');
      g.addColorStop(1, 'rgba(170,0,0,1)');
      this.vignette = g;
    }
    const pulse = 0.5 + 0.5 * Math.sin((this.timeSec / v.pulseSec) * Math.PI * 2);
    const severity = ratio <= 0 ? 1 : (v.threshold - ratio) / v.threshold;
    ctx.globalAlpha = (v.minAlpha + (v.maxAlpha - v.minAlpha) * severity) * (0.6 + 0.4 * pulse);
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
    ctx.globalAlpha = 1;
  }

  // Bar HP boss besar + nama di atas layar.
  private drawBossBar(ctx: CanvasRenderingContext2D): void {
    const b = this.bossRef;
    if (!b) return;
    const cfg = CONFIG.enemy.bossBar;
    const W = CONFIG.view.width;
    const bx = (W - cfg.width) / 2;
    const by = cfg.y;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 6, by - cfg.nameFont - 16, cfg.width + 12, cfg.height + cfg.nameFont + 22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `${cfg.nameFont}px "Press Start 2P"`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const nm = b.def.bossName ?? 'BOSS';
    ctx.strokeText(nm, W / 2, by - 4);
    ctx.fillStyle = '#ffd24d';
    ctx.fillText(nm, W / 2, by - 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 2, by - 2, cfg.width + 4, cfg.height + 4);
    ctx.fillStyle = '#3a1010';
    ctx.fillRect(bx, by, cfg.width, cfg.height);
    const r = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = this.bossEnraged ? '#ff5a4d' : '#e23b3b';
    ctx.fillRect(bx, by, cfg.width * r, cfg.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, cfg.width, cfg.height);
  }

  onPointerDown(x: number, y: number): void {
    if (this.state !== 'title' && CONFIG.debug.waveTools && this.handleDebugDown(x, y)) return;
    this.pressedId = null;
    if (this.state === 'title') {
      if (this.inRect(titlePlayRect(), x, y)) this.pressedId = 'play';
      return;
    }
    if (this.state === 'upgrade') {
      this.upgradeScreen.onPointerDown(x, y);
      return;
    }
    if (this.state === 'gameover' || this.state === 'victory') {
      if (this.inRect(this.retryRect, x, y)) this.pressedId = 'retry';
      else if (this.inRect(this.menuRect, x, y)) this.pressedId = 'menu';
      return;
    }
    if (this.paused) {
      const L = pauseLayout();
      if (this.inRect(L.resume, x, y)) this.pressedId = 'resume';
      else if (this.inRect(L.restart, x, y)) this.pressedId = 'restart';
      else if (this.inRect(L.menu, x, y)) this.pressedId = 'menu';
      else if (this.inRect(L.effects, x, y)) this.pressedId = 'effects';
      else if (this.inRect(L.vibration, x, y)) this.pressedId = 'vibration';
      else if (this.inRect(L.sound, x, y)) this.pressedId = 'sound';
      else if (this.inRect(L.difficulty, x, y)) this.pressedId = 'difficulty';
      return;
    }
    // playing / banner
    if (this.inRect(this.pauseRect, x, y)) this.pressedId = 'pause';
  }

  onPointerUp(x: number, y: number): void {
    if (this.state === 'upgrade') {
      const def = this.upgradeScreen.onPointerUp(x, y);
      if (def) this.chooseUpgrade(def);
      this.pressedId = null;
      return;
    }
    const id = this.pressedId;
    this.pressedId = null;
    if (id === null) return;

    if (this.state === 'title') {
      if (id === 'play' && this.inRect(titlePlayRect(), x, y)) {
        play('ui_click');
        this.transitionTo(() => this.startRun());
      }
      return;
    }
    if (this.state === 'gameover' || this.state === 'victory') {
      if (id === 'retry' && this.inRect(this.retryRect, x, y)) {
        play('ui_click');
        this.transitionTo(() => this.startRun());
      } else if (id === 'menu' && this.inRect(this.menuRect, x, y)) {
        play('ui_click');
        this.transitionTo(() => this.toTitle());
      }
      return;
    }
    if (id === 'pause' && this.inRect(this.pauseRect, x, y)) {
      this.paused = true;
      play('ui_click');
      return;
    }
    if (this.paused) {
      const L = pauseLayout();
      if (id === 'resume' && this.inRect(L.resume, x, y)) {
        this.paused = false;
        play('ui_click');
      } else if (id === 'restart' && this.inRect(L.restart, x, y)) {
        play('ui_click');
        this.transitionTo(() => {
          this.paused = false;
          this.startRun();
        });
      } else if (id === 'menu' && this.inRect(L.menu, x, y)) {
        play('ui_click');
        this.transitionTo(() => this.toTitle());
      } else if (id === 'effects' && this.inRect(L.effects, x, y)) this.toggleSetting('effects');
      else if (id === 'vibration' && this.inRect(L.vibration, x, y)) this.toggleSetting('vibration');
      else if (id === 'sound' && this.inRect(L.sound, x, y)) this.toggleSetting('sound');
      else if (id === 'difficulty' && this.inRect(L.difficulty, x, y)) this.cycleDifficulty();
    }
  }

  // Toggle setting + simpan. Effects langsung memengaruhi CONFIG.fx.enabled.
  private toggleSetting(id: 'effects' | 'vibration' | 'sound'): void {
    const s = this.save.settings;
    if (id === 'effects') s.effects = !s.effects;
    else if (id === 'vibration') s.vibration = !s.vibration;
    else s.sound = !s.sound;
    this.applySettings();
    saveGame(this.save);
    play('ui_click');
  }

  // Dipanggil main saat tab tidak aktif / resize: pause paksa.
  pauseForFocusLoss(): void {
    if (this.state === 'playing' || this.state === 'banner') this.paused = true;
  }

  // Tombol Back Android: buka/tutup Pause. true = ditangani.
  onBackButton(): boolean {
    if (this.paused) {
      this.paused = false;
      return true;
    }
    if (this.state === 'playing' || this.state === 'banner') {
      this.paused = true;
      return true;
    }
    return false;
  }

  // Getar ringan (hanya native + setting Vibration menyala).
  private vibrate(style: ImpactStyle): void {
    if (!this.save.settings.vibration) return;
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.impact({ style });
  }

  private inRect(r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }


  // ----- Wave spawn -----

  private updateWaveSpawn(dtMs: number): void {
    if (this.spawnedThisWave >= this.waveBudget) return;
    this.spawnTimerMs -= dtMs;
    if (this.spawnTimerMs > 0) return;
    this.spawnAtEdge(pickWaveType(this.waveIndex));
    this.spawnedThisWave++;
    this.spawnTimerMs = CONFIG.wave.spawnIntervalMs;
  }

  // Spawn di luar tepi layar dari sudut acak, dengan multiplier wave.
  private spawnAtEdge(def: EnemyDef): void {
    const ang = Math.random() * Math.PI * 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const halfW = CONFIG.view.width / 2;
    const halfH = CONFIG.view.height / 2;
    const m = def.width * 0.5 + CONFIG.enemy.spawnMarginPad; // tepat di luar tepi terlihat
    const tx = Math.abs(dx) > 1e-6 ? (halfW + m) / Math.abs(dx) : Infinity;
    const ty = Math.abs(dy) > 1e-6 ? (halfH + m) / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);
    const x = CONFIG.arena.cx + dx * t;
    const y = CONFIG.arena.cy + dy * t;
    this.spawnEnemy(def, x, y, waveHpMult(this.waveIndex), waveDmgMult(this.waveIndex));
  }

  private spawnStressEnemy(): void {
    const x = Math.random() * CONFIG.view.width;
    const y = Math.random() * CONFIG.view.height;
    this.spawnEnemy(this.pickType(), x, y, 1, 1);
  }

  private spawnEnemy(def: EnemyDef, x: number, y: number, hpMult: number, dmgMult: number): void {
    const stopDist = CONFIG.player.displayWidth * 0.4 + def.width * 0.5;
    const d = diffPreset();
    this.acquireEnemy().spawn(def, x, y, CONFIG.arena.cx, CONFIG.arena.cy, stopDist, hpMult * d.enemyHp, dmgMult * d.enemyDmg);
  }

  // Tipe acak berbobot (dipakai debug stress, bukan wave).
  private pickType(): EnemyDef {
    const types = Object.values(CONFIG.enemy.types) as unknown as EnemyDef[];
    let total = 0;
    for (const t of types) total += t.weight;
    let r = Math.random() * total;
    for (const t of types) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return types[0];
  }

  // ----- Upgrade & wave transition -----

  private openUpgrade(): void {
    const choices = rollChoices(this.playerState, CONFIG.upgrades.choiceCount);
    this.upgradeScreen.open(choices, this.playerState);
    this.state = 'upgrade';
    play('levelup');
  }

  private chooseUpgrade(def: UpgradeDef): void {
    const level = this.playerState.levelOf(def.id) + 1;
    this.playerState.setLevel(def.id, level);
    def.apply(this.playerState, level);
    play('ui_click');
    this.upgradeScreen.close();
    const act = newlyActivated(this.playerState);
    if (act.length) this.showSynergy(act[act.length - 1].name);
    this.player.onUpgrade();
    if (CONFIG.fx.enabled) {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        this.acquireEffect().spawnParticle(this.player.x, this.player.y, Math.cos(a) * 45, Math.sin(a) * 45 - 30, 3, 500, '#ffe066');
      }
    }
    this.runes.flashUpgrade(this.upgradeFlashColor(def.tags));
    this.startWave(this.waveIndex + 1);
  }

  // Warna flash rune sesuai tag upgrade.
  private upgradeFlashColor(tags: string[]): string {
    const cols = CONFIG.arena.upgradeColors as Record<string, string>;
    for (const t of tags) if (cols[t]) return cols[t];
    return CONFIG.arena.runeColor;
  }

  private showSynergy(name: string): void {
    this.synergyBannerMs = CONFIG.synergy.bannerMs;
    this.synergyBannerName = name;
    play('synergy');
  }

  private checkWaveClear(): void {
    if (this.spawnedThisWave < this.waveBudget) return;
    for (const e of this.enemies) if (e.active) return;
    // Heal otomatis di akhir tiap wave (nilai di config).
    const heal = this.playerState.maxHp * CONFIG.wave.waveClearHealPct * diffPreset().waveHeal;
    this.playerState.hp = Math.min(this.playerState.maxHp, this.playerState.hp + heal);
    if (this.waveIndex >= waveCount() - 1) {
      this.onRunEnd(true);
      this.state = 'victory';
      play('victory');
    } else {
      this.openUpgrade();
    }
  }


  // ----- Musuh -----

  private updateEnemies(dtMs: number): void {
    const pr = CONFIG.player.displayWidth * 0.4;
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.update(dtMs);
      if (e.hp <= 0) {
        this.killEnemy(e); // bisa mati karena burn (DoT)
        continue;
      }
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < pr + e.def.width * 0.5 && e.contactCdMs <= 0 && this.playerState.invincibleMs <= 0) {
        this.player.damage(e.dmg);
        e.contactCdMs = CONFIG.enemy.contactCooldownMs;
        this.addShake(CONFIG.fx.shake.playerHit.mag, CONFIG.fx.shake.playerHit.ms);
        this.vibrate(ImpactStyle.Light);
        this.runes.flashHit();
        play('player_hit');
      }
    }
    this.separateEnemies();
  }

  // Separation sederhana: dorong musuh yang menumpuk agar tidak satu titik.
  private separateEnemies(): void {
    const d0 = CONFIG.enemy.separationDist;
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.active) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 0 || d2 >= d0 * d0) continue;
        const d = Math.sqrt(d2);
        const push = (d0 - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }


  // ----- Tembak otomatis -----

  private updateFiring(dtMs: number): void {
    this.fireTimerMs -= dtMs;
    if (this.fireTimerMs > 0) return;
    const target = this.nearestEnemy(CONFIG.weapon.range);
    if (!target) {
      this.fireTimerMs = 0; // siap menembak begitu ada target
      return;
    }
    this.fireTimerMs = this.playerState.fireIntervalMs;
    const base = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const st = this.playerState;
    const n = st.bulletCount;
    const spread = CONFIG.upgrades.multishot.spreadRad;
    const start = base - (spread * (n - 1)) / 2;
    const speed = st.bulletSpeed;
    for (let i = 0; i < n; i++) {
      const crit = Math.random() < st.critChance;
      const dmg = st.damage * (crit ? st.critMult : 1);
      this.acquireBullet().spawn(
        this.player.x,
        this.player.y,
        start + spread * i,
        speed,
        dmg,
        crit,
        st.pierceCount,
        st.bounceCount,
      );
    }
    // Muzzle flash + busur tebasan.
    if (CONFIG.fx.enabled) {
      const m = CONFIG.effects.hitSpark;
      this.acquireEffect().spawnSpark(this.player.x + Math.cos(base) * 16, this.player.y - CONFIG.fx.bulletHeight + Math.sin(base) * 16, m.size * 0.7, 120);
      if (CONFIG.fx.slash) {
        this.acquireEffect().spawnSlash(this.player.x, this.player.y - CONFIG.fx.bulletHeight, base, 26, CONFIG.fx.anim.slashMs);
      }
    }
    this.player.recoil(base);
    this.runes.flashShoot();
    play('shoot');
  }

  // Pulsa heal aura: sembuhkan % max HP berkala + tampilkan vfx_aura.
  private updateHealAura(dtMs: number): void {
    const interval = this.playerState.healAuraIntervalMs;
    if (!isFinite(interval)) return;
    this.healTimerMs -= dtMs;
    if (this.healTimerMs > 0) return;
    this.healTimerMs = interval;
    const c = CONFIG.upgrades.heal_aura;
    this.playerState.hp = Math.min(this.playerState.maxHp, this.playerState.hp + this.playerState.maxHp * c.healPct);
    if (CONFIG.fx.enabled) {
      this.acquireEffect().spawnAura(this.player.x, this.player.y, 10, c.radius, 500);
      const n = Math.round(8 * quality.particles);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.acquireEffect().spawnParticle(this.player.x + Math.cos(a) * 12, this.player.y + 8, Math.cos(a) * 8, -30 - Math.random() * 25, 3, 700, '#5ad06a');
      }
    }
    play('heal');
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD2 = range * range;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  // ----- Peluru -----

  private updateBullets(dtMs: number): void {
    const dt = dtMs / 1000;
    const m = CONFIG.bullet.basic.outMargin;
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    const qr = CONFIG.bullet.basic.hitQueryRadius;
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -m || b.x > W + m || b.y < -m || b.y > H + m) {
        b.active = false;
        continue;
      }
      this.grid.queryCircle(b.x, b.y, qr, this.query);
      for (const e of this.query) {
        if (e.hp <= 0 || b.hasHit(e.id)) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.def.width * 0.5 + b.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        this.applyBulletHit(e, b);
        break;
      }
    }
  }

  // Satu peluru kena satu musuh: lanjut (pierce/bounce) atau mati.
  private applyBulletHit(e: Enemy, b: Bullet): void {
    this.damageEnemy(e, b.damage, b.critical, b.x, b.y, b.vx, b.vy);
    b.addHit(e.id);
    if (b.bounceLeft > 0) {
      b.bounceLeft--;
      const next = this.nearestEnemyTo(b.x, b.y, CONFIG.upgrades.bounce_bullet.searchRadius, b.hits());
      if (next) b.aim(Math.atan2(next.y - b.y, next.x - b.x));
      // Ricochet Pierce: tidak kehilangan damage saat memantul.
      if (!this.playerState.has('ricochet_pierce')) {
        b.damage *= 1 - CONFIG.upgrades.bounce_bullet.damageLossPerBounce;
      }
    } else if (b.pierceLeft > 0) {
      b.pierceLeft--;
    } else {
      b.active = false;
    }
  }

  // Kurangi HP musuh + efek kena; matikan musuh bila HP habis.
  private damageEnemy(e: Enemy, dmg: number, critical: boolean, hx: number, hy: number, vx: number, vy: number): void {
    if (!e.active) return;
    e.hp -= dmg;
    e.flashMs = CONFIG.enemy.hitFlashMs;
    e.hitSquashMs = CONFIG.fx.anim.enemyHitSquashMs;
    // Golem/boss tahan knockback.
    if (!e.def.knockbackResist && (vx !== 0 || vy !== 0)) {
      const d = Math.hypot(vx, vy) || 1;
      e.x += (vx / d) * CONFIG.enemy.knockback;
      e.y += (vy / d) * CONFIG.enemy.knockback;
    }
    if (CONFIG.fx.enabled) {
      const s = CONFIG.effects.hitSpark;
      this.acquireEffect().spawnSpark(hx, hy, s.size, s.lifeMs);
      this.acquireEffect().spawnRing(hx, hy, 3, 16, 200, '#ffe9a8');
      const t = CONFIG.effects.dmgText;
      this.acquireEffect().spawnText(hx, hy - 8, String(Math.round(dmg)), critical ? t.criticColor : t.normalColor, t.lifeMs);
    }
    if (critical) this.triggerHitStop(); // hit-stop singkat saat crit
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy, allowSplit = true): void {
    if (!e.active) return;
    e.active = false;
    if (!e.def.boss) {
      this.killedThisWave++;
      this.totalKills++;
    }
    if (CONFIG.fx.enabled) {
      this.spawnDeathParticles(e.x, e.y, e.def.color);
      const sm = CONFIG.effects.smokePuff;
      this.acquireEffect().spawnSmoke(e.x, e.y, sm.size, sm.lifeMs);
      this.enemyDeathFx(e);
    }
    if (e === this.bossRef) {
      this.onBossDeath(e);
      return;
    }
    // Slime pecah jadi slime kecil (opsional, di config).
    const splitId = e.def.splitInto;
    if (splitId && allowSplit) {
      const types = CONFIG.enemy.types as unknown as Record<string, EnemyDef>;
      const mini = types[splitId];
      if (mini) {
        const n = e.def.splitCount ?? 2;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 16;
          this.spawnEnemy(mini, e.x + off, e.y, 1, 1);
        }
      }
    }
    play('enemy_die');
  }

  // Efek kematian berbeda per jenis musuh (render saja).
  private enemyDeathFx(e: Enemy): void {
    if (e.def.boss) return; // boss ditangani di onBossDeath
    const anim = e.def.anim;
    if (anim === 'hop') {
      // Slime: gepeng jadi cakram lalu memudar.
      this.acquireEffect().spawnFlatten(e.def.key, e.x, e.y, e.def.width, 380);
      return;
    }
    if (anim === 'fly') {
      // Bat: berputar jatuh dengan bayangan membesar.
      const img = getImage(e.def.key);
      const w = e.def.width;
      this.acquireEffect().spawnShard(e.def.key, e.x, e.y, 0, 0, w, w * (img.naturalHeight / img.naturalWidth), (Math.random() - 0.5) * 40, -180, 7, e.y + 14, 700);
      return;
    }
    if (anim === 'run') {
      // Demon: pecah jadi ember/api.
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 80;
        this.acquireEffect().spawnEmber(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 3, 400 + Math.random() * 250, i % 2 ? '#ffb24d' : '#d4514f');
      }
      return;
    }
    // Golem / lain: pecah jadi kepingan (bila diizinkan kualitas) atau fade.
    if (quality.shards) this.spawnShards(e.def.key, e.x, e.y, e.def.width, e.y + 16, CONFIG.fx.anim.shardCount);
    else this.acquireEffect().spawnFlatten(e.def.key, e.x, e.y, e.def.width, 320);
  }

  // Potong sprite jadi beberapa keping yang terlempar (source rect).
  private spawnShards(imgKey: string, x: number, y: number, width: number, groundY: number, count: number): void {
    const img = getImage(imgKey);
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const cols = 3;
    const rows = Math.max(1, Math.ceil(count / cols));
    let made = 0;
    for (let r = 0; r < rows && made < count; r++) {
      for (let c = 0; c < cols && made < count; c++) {
        const sx = Math.floor((c / cols) * nw);
        const sy = Math.floor((r / rows) * nh);
        const sw = Math.floor(nw / cols);
        const sh = Math.floor(nh / rows);
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 90;
        this.acquireEffect().spawnShard(
          imgKey,
          x,
          y,
          sx,
          sy,
          (sw * width) / nw,
          (sh * width) / nw,
          Math.cos(a) * sp,
          -120 - Math.random() * 120,
          (Math.random() - 0.5) * 10,
          groundY,
          800 + Math.random() * 400,
        );
        made++;
      }
    }
  }

  // Boss mati: ledakan besar + hit-stop + slow-motion.
  private onBossDeath(b: Enemy): void {
    this.bossRef = null;
    this.bossEnraged = false;
    this.totalKills++;
    play('boss_die');
    if (CONFIG.fx.enabled) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = 20 + Math.random() * 40;
        this.acquireEffect().spawnExplosion(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, CONFIG.effects.explosion.size, 360);
      }
      this.acquireEffect().spawnRing(b.x, b.y, 20, b.def.width * 1.4, 500, CONFIG.effects.ring.color);
      for (let i = 0; i < 4; i++) {
        this.acquireEffect().spawnSmoke(
          b.x + (Math.random() - 0.5) * 60,
          b.y + (Math.random() - 0.5) * 60,
          CONFIG.effects.smokePuff.size,
          CONFIG.effects.smokePuff.lifeMs,
        );
      }
      if (quality.shards) this.spawnShards(b.def.key, b.x, b.y, b.def.width, b.y + b.def.width * 0.3, CONFIG.fx.anim.shardCount + 2);
    }
    this.addShake(CONFIG.fx.shake.bossKill.mag, CONFIG.fx.shake.bossKill.ms);
    this.vibrate(ImpactStyle.Heavy);
    this.hitStopMs = Math.max(this.hitStopMs, CONFIG.fx.hitStopMs);
    this.slowMoMs = CONFIG.fx.slowMoMs;
    this.camPunchMs = CONFIG.fx.camera.punchMs;
  }

  // Musuh terdekat dari (x,y) dalam radius, selain id di daftar `exclude`.
  private nearestEnemyTo(x: number, y: number, radius: number, exclude: number[]): Enemy | null {
    this.grid.queryCircle(x, y, radius, this.query);
    let best: Enemy | null = null;
    let bestD2 = radius * radius;
    for (const e of this.query) {
      if (e.hp <= 0 || exclude.indexOf(e.id) >= 0) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  private randomEnemyInRange(range: number): Enemy | null {
    this.grid.queryCircle(this.player.x, this.player.y, range, this.query);
    let count = 0;
    for (const e of this.query) if (e.hp > 0) count++;
    if (count === 0) return null;
    let pick = Math.floor(Math.random() * count);
    for (const e of this.query) {
      if (e.hp <= 0) continue;
      if (pick === 0) return e;
      pick--;
    }
    return null;
  }

  private spawnDeathParticles(x: number, y: number, color: string): void {
    const cfg = CONFIG.effects.deathParticles;
    for (let i = 0; i < cfg.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = cfg.speed * (0.4 + Math.random() * 0.9);
      const life = cfg.lifeMs * (0.6 + Math.random() * 0.6);
      this.acquireEffect().spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, cfg.size, life, color);
    }
  }

  // ----- Bounce Blade -----

  private updateBladeThrow(dtMs: number): void {
    if (this.playerState.bounceBladeLevel <= 0) return;
    this.bladeTimerMs -= dtMs;
    if (this.bladeTimerMs > 0) return;
    const c = CONFIG.upgrades.bounce_blade;
    this.bladeTimerMs = c.intervalMs;
    const n = this.playerState.bladeCount;
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + (i * Math.PI * 2) / n;
      this.acquireBlade().spawn(this.player.x, this.player.y, a, c.speed, this.playerState.bladeDamage, c.lifeMs);
    }
    play('blade');
  }

  private updateBlades(dtMs: number): void {
    const c = CONFIG.upgrades.bounce_blade;
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    for (const bl of this.blades) {
      if (!bl.active) continue;
      bl.update(dtMs, W, H, c.wallPad);
      this.grid.queryCircle(bl.x, bl.y, bl.radius + 24, this.query);
      for (const e of this.query) {
        if (e.hp <= 0 || bl.hasHit(e.id)) continue;
        const dx = e.x - bl.x;
        const dy = e.y - bl.y;
        const rr = e.def.width * 0.5 + bl.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        const crit = Math.random() < this.playerState.critChance;
        const dmg = bl.damage * (crit ? this.playerState.critMult : 1);
        this.damageEnemy(e, dmg, crit, bl.x, bl.y, 0, 0);
        bl.addHit(e.id);
        const next = this.nearestEnemyTo(bl.x, bl.y, c.searchRadius, bl.hits());
        if (next) bl.aim(Math.atan2(next.y - bl.y, next.x - bl.x), c.speed);
        break;
      }
    }
  }

  // ----- Lightning -----

  private updateLightning(dtMs: number): void {
    if (this.playerState.lightningLevel <= 0) return;
    this.lightningTimerMs -= dtMs;
    if (this.lightningTimerMs > 0) return;
    const first = this.randomEnemyInRange(CONFIG.upgrades.lightning.range);
    if (!first) {
      this.lightningTimerMs = 0; // coba lagi begitu ada target
      return;
    }
    this.lightningTimerMs = CONFIG.upgrades.lightning.intervalMs;
    this.castLightning(first);
  }

  private castLightning(first: Enemy): void {
    const c = CONFIG.upgrades.lightning;
    const st = this.playerState;
    let dmg = st.lightningDamage;
    const used: number[] = [first.id];
    this.strikeHit(first, first.x, c.skyY, first.x, first.y, dmg);
    let cx = first.x;
    let cy = first.y;
    const chain = st.lightningChain;
    for (let i = 0; i < chain; i++) {
      dmg *= c.chainFalloff;
      const next = this.nearestEnemyTo(cx, cy, c.chainRadius, used);
      if (!next) break;
      used.push(next.id);
      this.strikeHit(next, cx, cy, next.x, next.y, dmg);
      cx = next.x;
      cy = next.y;
    }
    play('lightning');
  }

  private strikeHit(e: Enemy, fromX: number, fromY: number, toX: number, toY: number, dmg: number): void {
    this.damageEnemy(e, dmg, false, e.x, e.y, 0, 0);
    if (CONFIG.fx.enabled) {
      this.acquireEffect().spawnBolt(fromX, fromY, toX, toY, CONFIG.upgrades.lightning.boltMs);
      this.acquireEffect().spawnLightningHit(e.x, e.y);
      // Cabang tipis acak.
      this.acquireEffect().spawnBolt(fromX + (Math.random() - 0.5) * 34, fromY, toX + (Math.random() - 0.5) * 24, toY, CONFIG.upgrades.lightning.boltMs);
    }
    // Storm Fire: musuh terbakar.
    if (this.playerState.has('storm_fire')) {
      const sf = CONFIG.synergy.stormFire;
      e.applyBurn(sf.burnDps, sf.burnMs);
    }
    // Vital Storm: heal tiap sambaran.
    if (this.playerState.has('vital_storm')) {
      this.playerState.hp = Math.min(this.playerState.maxHp, this.playerState.hp + CONFIG.synergy.vitalStorm.healPerHit);
    }
  }

  // ----- Meteor -----

  private updateMeteorSpawn(dtMs: number): void {
    if (this.playerState.meteorLevel <= 0) return;
    this.meteorTimerMs -= dtMs;
    if (this.meteorTimerMs > 0) return;
    this.meteorTimerMs = this.playerState.meteorIntervalMs;
    const n = this.playerState.meteorCount;
    for (let i = 0; i < n; i++) {
      const target = this.randomEnemyAnywhere();
      const x = target ? target.x : CONFIG.arena.cx + (Math.random() - 0.5) * 200;
      const y = target ? target.y : CONFIG.arena.cy + (Math.random() - 0.5) * 200;
      this.acquireMeteor().spawn(x, y);
    }
  }

  private randomEnemyAnywhere(): Enemy | null {
    this.grid.queryCircle(CONFIG.arena.cx, CONFIG.arena.cy, 400, this.query);
    let count = 0;
    for (const e of this.query) if (e.hp > 0) count++;
    if (count === 0) return null;
    let pick = Math.floor(Math.random() * count);
    for (const e of this.query) {
      if (e.hp <= 0) continue;
      if (pick === 0) return e;
      pick--;
    }
    return null;
  }

  private updateMeteors(dtMs: number): void {
    for (const m of this.meteors) {
      if (!m.active) continue;
      const exploded = m.update(dtMs);
      if (exploded) this.meteorExplode(m);
    }
  }

  private meteorExplode(m: Meteor): void {
    const c = CONFIG.upgrades.meteor;
    const dmg = this.playerState.meteorDamage;
    this.grid.queryCircle(m.x, m.y, c.radius, this.query);
    for (let i = 0; i < this.query.length; i++) {
      const e = this.query[i];
      if (e.hp <= 0) continue;
      this.damageEnemy(e, dmg, false, e.x, e.y, 0, 0);
    }
    play('explode');
    if (CONFIG.fx.enabled) {
      const rc = CONFIG.effects.ring;
      this.acquireEffect().spawnRing(m.x, m.y, c.radius * 0.4, c.radius * 1.4, rc.lifeMs, rc.color);
      this.acquireEffect().spawnSmoke(m.x, m.y, CONFIG.effects.smokePuff.size, CONFIG.effects.smokePuff.lifeMs);
      this.addShake(CONFIG.fx.shake.explosion.mag, CONFIG.fx.shake.explosion.ms);
      const ne = Math.round(10 * quality.particles);
      for (let i = 0; i < ne; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 90;
        this.acquireEffect().spawnEmber(m.x, m.y, Math.cos(a) * sp, Math.sin(a) * sp - 30, 3, 500 + Math.random() * 300, i % 2 ? '#ffb24d' : '#ff7a2d');
      }
      if (CONFIG.fx.decals) this.acquireEffect().spawnDecal(m.x, m.y, c.radius * 1.2, 3000);
    }
    // Storm Fire: petir tambahan di area ledakan.
    if (this.playerState.has('storm_fire')) {
      const first = this.nearestEnemyTo(m.x, m.y, c.radius + 60, EMPTY_IDS);
      if (first) this.castLightning(first);
    }
  }

  // ----- Boss: fase 2 (mengamuk + memanggil slime) -----

  private updateBoss(dtMs: number): void {
    const b = this.bossRef;
    if (!b) return;
    if (!b.active) {
      this.bossRef = null;
      return;
    }
    // Getar langkah ringan khusus boss.
    this.bossStepMs -= dtMs;
    if (this.bossStepMs <= 0) {
      this.bossStepMs = 1200;
      this.addShake(1.3, 90);
    }
    const p2 = b.def.phase2;
    if (!p2) return;
    if (!this.bossEnraged && b.hp <= b.maxHp * p2.hpPct) {
      this.bossEnraged = true;
      b.speedMul = p2.speedMult;
      this.bossSummonTimerMs = p2.summonIntervalMs;
      this.addShake(CONFIG.fx.shake.explosion.mag, CONFIG.fx.shake.explosion.ms);
      play('boss_enrage');
    }
    if (!this.bossEnraged) return;
    this.bossSummonTimerMs -= dtMs;
    if (this.bossSummonTimerMs > 0) return;
    this.bossSummonTimerMs = p2.summonIntervalMs;
    const types = CONFIG.enemy.types as unknown as Record<string, EnemyDef>;
    const sum = types[p2.summonType];
    if (!sum) return;
    for (let i = 0; i < p2.summonCount; i++) {
      const a = (i / p2.summonCount) * Math.PI * 2;
      this.spawnEnemy(sum, b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 60, waveHpMult(this.waveIndex), waveDmgMult(this.waveIndex));
    }
  }

  // ----- HUD & overlay -----

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const { margin, iconSize, barWidth, barHeight, pauseSize, waveBarWidth, waveBarHeight } = CONFIG.hud;
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;

    // HP: ikon hati + bar merah.
    drawFit(ctx, getImage('ui_icon_life'), margin + iconSize / 2, margin + iconSize / 2, iconSize, iconSize);
    const bx = margin + iconSize + 4;
    const by = margin + 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 2, by - 2, barWidth + 4, barHeight + 4);
    ctx.fillStyle = '#3a1010';
    ctx.fillRect(bx, by, barWidth, barHeight);
    const ratio = Math.max(0, this.playerState.hp / this.playerState.maxHp);
    // Ekor kuning yang menyusul pelan (damage feedback).
    if (this.hpShown > ratio) {
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(bx + barWidth * ratio, by, barWidth * (this.hpShown - ratio), barHeight);
    }
    // Berdenyut saat HP rendah.
    const low = ratio < 0.3 ? 0.6 + 0.4 * Math.abs(Math.sin(this.timeSec * 6)) : 1;
    ctx.fillStyle = `rgba(226,59,59,${low})`;
    ctx.fillRect(bx, by, barWidth * ratio, barHeight);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, barWidth, barHeight);

    // Tombol pause kanan atas (area sentuh 44x44).
    const pcx = W - margin - pauseSize / 2;
    const pcy = margin + pauseSize / 2;
    drawFit(ctx, getImage('ui_icon_pause'), pcx, pcy, pauseSize, pauseSize);
    this.pauseRect = { x: pcx - 22, y: pcy - 22, w: 44, h: 44 };

    // Deretan ikon upgrade yang dimiliki (dengan angka level di pojok).
    this.drawUpgradeRow(ctx, margin, CONFIG.hud.upIconY, CONFIG.hud.upIconSize);

    // Bar "Wave X / N" kiri bawah; isi = progres kill wave berjalan.
    const wbx = margin;
    const wby = H - margin - waveBarHeight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#fff';
    ctx.fillText(`WAVE ${this.waveIndex + 1} / ${waveCount()}`, wbx, wby - 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(wbx - 2, wby - 2, waveBarWidth + 4, waveBarHeight + 4);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(wbx, wby, waveBarWidth, waveBarHeight);
    const wr = this.waveBudget > 0 ? this.killedThisWave / this.waveBudget : 0;
    ctx.fillStyle = '#e0a020';
    ctx.fillRect(wbx, wby, waveBarWidth * Math.min(1, wr), waveBarHeight);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(wbx, wby, waveBarWidth, waveBarHeight);

    // Nyawa (kanan bawah).
    this.drawLives(ctx);
  }

  // 3 hati kanan bawah; nyawa yang hilang tampil sebagai hati gelap.
  private drawLives(ctx: CanvasRenderingContext2D): void {
    const size = CONFIG.hud.iconSize;
    const gap = 4;
    const margin = CONFIG.hud.margin;
    const total = CONFIG.player.lives;
    const startX = CONFIG.view.width - margin - total * (size + gap) + gap;
    const y = CONFIG.view.height - margin - size;
    for (let i = 0; i < total; i++) {
      const x = startX + i * (size + gap) + size / 2;
      const cy = y + size / 2;
      if (i < this.playerState.lives) {
        const pulse = this.heartsPulseMs > 0 ? 1 + Math.sin((1 - this.heartsPulseMs / 700) * Math.PI) * 0.25 : 1;
        drawFit(ctx, getImage('ui_icon_life'), x, cy, size * pulse, size * pulse);
      } else {
        drawFit(ctx, getTinted('ui_icon_life', '#3a3f4a'), x, cy, size, size);
      }
    }
  }

  // Teks "WAVE X" besar di tengah sebelum wave mulai.
  private drawWaveBanner(ctx: CanvasRenderingContext2D): void {
    const W = CONFIG.view.width;
    const total = CONFIG.wave.startDelayMs;
    const t = Math.min(1, (total - this.bannerTimerMs) / 220); // muncul cepat
    const pop = easeOutBack(t);
    const scale = 0.6 + 0.4 * pop;
    const fade = Math.min(1, this.bannerTimerMs / 250);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(W / 2, CONFIG.view.height * 0.38);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${CONFIG.wave.bannerFont}px "Press Start 2P"`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#ffe066';
    const txt = `WAVE ${this.waveIndex + 1}`;
    ctx.strokeText(txt, 0, 0);
    ctx.fillText(txt, 0, 0);
    if (waveBoss(this.waveIndex)) {
      ctx.font = `${Math.round(CONFIG.wave.bannerFont * 0.6)}px "Press Start 2P"`;
      ctx.fillStyle = '#ff5a4d';
      ctx.strokeText('BOSS INCOMING!', 0, 30);
      ctx.fillText('BOSS INCOMING!', 0, 30);
    }
    ctx.restore();
  }

  // Deretan ikon upgrade yang dimiliki, dengan angka level di pojok kanan-bawah.
  private drawUpgradeRow(ctx: CanvasRenderingContext2D, startX: number, startY: number, size: number): void {
    const gap = CONFIG.hud.upIconGap;
    const W = CONFIG.view.width;
    let x = startX;
    let y = startY;
    for (const u of UPGRADES) {
      const lv = this.playerState.levelOf(u.id);
      if (lv <= 0) continue;
      if (x + size > W - 4) {
        x = startX;
        y += size + gap;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y, size, size);
      drawFit(ctx, getImage(u.icon), x + size / 2, y + size / 2, size - 4, size - 4);
      ctx.font = '6px "Press Start 2P"';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.strokeText(String(lv), x + size - 1, y + size - 1);
      ctx.fillStyle = '#ffe14d';
      ctx.fillText(String(lv), x + size - 1, y + size - 1);
      x += size + gap;
    }
  }

  // Banner emas "SYNERGY: ...!" saat synergy baru aktif.
  private drawSynergyBanner(ctx: CanvasRenderingContext2D): void {
    const W = CONFIG.view.width;
    const a = Math.min(1, this.synergyBannerMs / 300);
    const y = 96;
    const badge = CONFIG.synergy.badgeSize;
    ctx.globalAlpha = a;
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const txt = `SYNERGY: ${this.synergyBannerName}!`;
    const tw = ctx.measureText(txt).width;
    const totalW = badge + 6 + tw;
    const startX = W / 2 - totalW / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(startX - 8, y - 15, totalW + 16, 30);
    drawFit(ctx, getImage('ui_badge_synergy'), startX + badge / 2, y, badge, badge);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#ffd24d';
    ctx.strokeText(txt, startX + badge + 6, y);
    ctx.fillText(txt, startX + badge + 6, y);
    ctx.globalAlpha = 1;
  }

  // Ringkasan upgrade & synergy pada layar Game Over/Victory.
  private drawRunSummary(ctx: CanvasRenderingContext2D, centerY: number): void {
    const W = CONFIG.view.width;
    const size = 24;
    const gap = 4;
    const perRow = Math.max(1, Math.floor((W - 16) / (size + gap)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#cfd6e6';
    ctx.fillText('UPGRADES', W / 2, centerY - 56);

    const owned = UPGRADES.filter((u) => this.playerState.levelOf(u.id) > 0);
    let idx = 0;
    let row = 0;
    const iconTop = centerY - 40;
    while (idx < owned.length) {
      const rowItems = Math.min(perRow, owned.length - idx);
      const rowW = rowItems * (size + gap) - gap;
      let x = W / 2 - rowW / 2;
      const y = iconTop + row * (size + gap);
      for (let k = 0; k < rowItems; k++) {
        const u = owned[idx + k];
        const lv = this.playerState.levelOf(u.id);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x, y, size, size);
        drawFit(ctx, getImage(u.icon), x + size / 2, y + size / 2, size - 4, size - 4);
        ctx.font = '6px "Press Start 2P"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.strokeText(String(lv), x + size - 1, y + size - 1);
        ctx.fillStyle = '#ffe14d';
        ctx.fillText(String(lv), x + size - 1, y + size - 1);
        x += size + gap;
      }
      idx += rowItems;
      row++;
    }
    if (owned.length === 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = '#8891a5';
      ctx.fillText('none', W / 2, iconTop + 8);
      row = 1;
    }

    const synY = iconTop + row * (size + gap) + 12;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#ffd24d';
    ctx.fillText('SYNERGIES', W / 2, synY);
    ctx.font = '7px "Press Start 2P"';
    const syn = SYNERGIES.filter((s) => this.playerState.has(s.id));
    if (syn.length === 0) {
      ctx.fillStyle = '#8891a5';
      ctx.fillText('none', W / 2, synY + 14);
    } else {
      ctx.fillStyle = '#ffe9a8';
      for (let i = 0; i < syn.length; i++) ctx.fillText(syn[i].name, W / 2, synY + 14 + i * 12);
    }
  }

  private drawGameOver(ctx: CanvasRenderingContext2D): void {
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    const banner = getImage('ui_banner_gameover');
    const bw = CONFIG.gameover.bannerWidth;
    const bh = bw * (banner.naturalHeight / banner.naturalWidth);
    ctx.drawImage(banner, cx - bw / 2, cy - 190 - bh / 2, bw, bh);

    this.drawEndStats(ctx, cy - 92, this.waveIndex + 1, this.totalKills);
    this.drawRunSummary(ctx, cy - 10);
    this.drawEndButtons(ctx, cy + 150, 'RETRY');
  }

  // Wave tercapai + total kill pada layar akhir.
  private drawEndStats(ctx: CanvasRenderingContext2D, y: number, wave: number, kills: number): void {
    const W = CONFIG.view.width;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "Press Start 2P"';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    const t1 = `WAVE ${wave} / ${waveCount()}`;
    const t2 = `KILLS ${kills}`;
    ctx.fillStyle = '#ffe9a8';
    ctx.strokeText(t1, W / 2, y);
    ctx.fillText(t1, W / 2, y);
    ctx.fillStyle = '#cfd6e6';
    ctx.strokeText(t2, W / 2, y + 16);
    ctx.fillText(t2, W / 2, y + 16);
  }

  // Dua tombol bawah: tombol utama (RETRY / PLAY AGAIN) + MENU.
  private drawEndButtons(ctx: CanvasRenderingContext2D, y: number, primaryLabel: string): void {
    const W = CONFIG.view.width;
    const bw = 150;
    const bh = 56;
    const gap = 12;
    const x0 = (W - (bw * 2 + gap)) / 2;
    this.retryRect = { x: x0, y, w: bw, h: bh };
    this.menuRect = { x: x0 + bw + gap, y, w: bw, h: bh };
    drawButton(ctx, this.retryRect, primaryLabel, 11, this.pressedId === 'retry');
    drawButton(ctx, this.menuRect, 'MENU', 12, this.pressedId === 'menu');
  }

  private drawFps(ctx: CanvasRenderingContext2D): void {
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${Math.round(this.fps)} FPS`, CONFIG.view.width - 8, 42);
    ctx.fillStyle = 'rgba(120,220,255,0.75)';
    ctx.fillText(`Q${this.qualityLevel}`, CONFIG.view.width - 8, 54);
  }

  private drawVictory(ctx: CanvasRenderingContext2D): void {
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    const banner = getImage('ui_banner_victory');
    const bw = CONFIG.gameover.bannerWidth;
    const bh = bw * (banner.naturalHeight / banner.naturalWidth);
    ctx.drawImage(banner, cx - bw / 2, cy - 190 - bh / 2, bw, bh);

    this.drawEndStats(ctx, cy - 92, waveCount(), this.totalKills);
    this.drawRunSummary(ctx, cy - 10);
    this.drawEndButtons(ctx, cy + 150, 'PLAY AGAIN');
  }

  // ----- Debug tools (lompat wave & beri upgrade) -----

  private debugButtons(): { x: number; y: number; w: number; h: number; label: string; action: () => void }[] {
    const h = 16;
    const b: { x: number; y: number; w: number; h: number; label: string; action: () => void }[] = [];
    let x = 8;
    const yA = 44;
    b.push({ x, y: yA, w: 22, h, label: '<', action: () => { this.debugWaveSel = Math.max(1, this.debugWaveSel - 1); } });
    x += 26;
    b.push({ x, y: yA, w: 22, h, label: '>', action: () => { this.debugWaveSel = Math.min(waveCount(), this.debugWaveSel + 1); } });
    x += 30;
    b.push({ x, y: yA, w: 40, h, label: 'JUMP', action: () => this.jumpWave(this.debugWaveSel - 1) });

    // Dua baris tombol upgrade (semua upgrade terdaftar).
    const labels = ['DMG', 'ASPD', 'HP', 'MSHOT', 'AURA', 'PSPD', 'CRIT', 'PRC', 'BNC', 'BLDE', 'LGT', 'MTR'];
    const perRow = 6;
    const bw = 34;
    const gap = 4;
    for (let i = 0; i < UPGRADES.length; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      b.push({
        x: 8 + col * (bw + gap),
        y: 66 + row * (h + 2),
        w: bw,
        h,
        label: labels[i] ?? UPGRADES[i].id.slice(0, 4).toUpperCase(),
        action: () => this.grantUpgrade(UPGRADES[i].id),
      });
    }
    return b;
  }

  private drawDebug(ctx: CanvasRenderingContext2D): void {
    const btns = this.debugButtons();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '6px "Press Start 2P"';
    for (const btn of btns) {
      ctx.fillStyle = 'rgba(40,44,64,0.9)';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      ctx.strokeStyle = '#7fd0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
    }
  }

  private handleDebugDown(x: number, y: number): boolean {
    for (const btn of this.debugButtons()) {
      if (this.inRect(btn, x, y)) {
        btn.action();
        return true;
      }
    }
    return false;
  }

  private jumpWave(index: number): void {
    const i = Math.max(0, Math.min(waveCount() - 1, index));
    for (const e of this.enemies) e.active = false;
    for (const b of this.bullets) b.active = false;
    this.upgradeScreen.close();
    play('ui_click');
    this.startWave(i);
  }

  private grantUpgrade(id: string): void {
    const def = getUpgrade(id);
    if (!def) return;
    const level = this.playerState.levelOf(id) + 1;
    if (level > def.maxLevel) return;
    this.playerState.setLevel(id, level);
    def.apply(this.playerState, level);
    const act = newlyActivated(this.playerState);
    if (act.length) this.showSynergy(act[act.length - 1].name);
    this.runes.flashUpgrade(this.upgradeFlashColor(def.tags));
    play('ui_click');
  }

  // ----- Object pooling -----

  private acquireEnemy(): Enemy {
    for (const e of this.enemies) if (!e.active) return e;
    const e = new Enemy();
    this.enemies.push(e);
    return e;
  }

  private acquireBullet(): Bullet {
    for (const b of this.bullets) if (!b.active) return b;
    const b = new Bullet();
    this.bullets.push(b);
    return b;
  }

  private acquireBlade(): Blade {
    for (const b of this.blades) if (!b.active) return b;
    const b = new Blade();
    this.blades.push(b);
    return b;
  }

  private acquireMeteor(): Meteor {
    for (const m of this.meteors) if (!m.active) return m;
    const m = new Meteor();
    this.meteors.push(m);
    return m;
  }

  private acquireEffect(): Effect {
    for (const f of this.effects) if (!f.active) return f;
    if (this.effects.length >= CONFIG.fx.particles.max) return this.effects[0]; // batasi pool
    const f = new Effect();
    this.effects.push(f);
    return f;
  }
}

