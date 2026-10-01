// Simulasi headless untuk uji balance (tanpa rendering). Meniru mekanik inti:
// auto-fire, kontak musuh + invincibility singkat, skill, wave, boss, nyawa, heal.
// Catatan: ini MODEL angka (memakai CONFIG + PlayerState + upgrade/synergy yang
// sama), bukan mesin game penuh (tanpa collision peluru, separation, dsb).
import { CONFIG, diffPreset } from '../game/config';
import { PlayerState } from '../game/playerState';
import { rollChoices } from '../game/upgrades/registry';
import { newlyActivated } from '../game/upgrades/synergy';
import { waveCount, waveDef, waveHpMult, waveDmgMult, waveBoss } from '../game/waves';

// Deklarasi minimal agar tidak perlu @types/node.
declare const process: { argv: string[] };
const VERBOSE = process.argv[3] === 'v';

const DT = 1 / 30; // detik per langkah
const CX = CONFIG.arena.cx;
const CY = CONFIG.arena.cy;
const PLAYER_HALF = CONFIG.player.displayWidth * 0.4;

interface Dash {
  intervalMs: number;
  telegraphMs: number;
  speed: number;
  durationMs: number;
}
interface Phase2 {
  hpPct: number;
  speedMult: number;
  summonIntervalMs: number;
  summonType: string;
  summonCount: number;
}
interface Def {
  hp: number;
  speed: number;
  dmg: number;
  width: number;
  weight: number;
  dash?: Dash;
  splitInto?: string;
  splitCount?: number;
  boss?: boolean;
  phase2?: Phase2;
}

const TYPES = CONFIG.enemy.types as unknown as Record<string, Def>;

interface E {
  def: Def;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  boss: boolean;
  contactCd: number;
  dashCd: number;
  tel: number;
  dashMs: number;
  burnMs: number;
  burnDps: number;
  enraged: boolean;
  summonCd: number;
}

function makeEnemy(def: Def, x: number, y: number, hpMult: number, dmgMult: number): E {
  const maxHp = Math.round(def.hp * hpMult);
  return {
    def,
    x,
    y,
    hp: maxHp,
    maxHp,
    dmg: def.dmg * dmgMult,
    speed: def.speed,
    boss: !!def.boss,
    contactCd: 0,
    dashCd: def.dash ? def.dash.intervalMs / 1000 : 0,
    tel: 0,
    dashMs: 0,
    burnMs: 0,
    burnDps: 0,
    enraged: false,
    summonCd: 0,
  };
}

function distTo(a: E): number {
  const dx = a.x - CX;
  const dy = a.y - CY;
  return Math.hypot(dx, dy);
}

// Musuh terdekat dalam jangkauan (selain yang ada di `skip`).
function nearest(es: E[], range: number, skip: E[]): E | null {
  let best: E | null = null;
  let bd = range * range;
  for (const e of es) {
    if (e.hp <= 0 || skip.indexOf(e) >= 0) continue;
    const dx = e.x - CX;
    const dy = e.y - CY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bd) {
      bd = d2;
      best = e;
    }
  }
  return best;
}

// k musuh terdekat dalam jangkauan.
function nearestK(es: E[], range: number, k: number): E[] {
  const inRange = es.filter((e) => e.hp > 0 && distTo(e) <= range);
  inRange.sort((a, b) => distTo(a) - distTo(b));
  return inRange.slice(0, k);
}

// Musuh terdekat dari sebuah titik.
function nearestToPoint(es: E[], x: number, y: number, radius: number, skip: E[]): E | null {
  let best: E | null = null;
  let bd = radius * radius;
  for (const e of es) {
    if (e.hp <= 0 || skip.indexOf(e) >= 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bd) {
      bd = d2;
      best = e;
    }
  }
  return best;
}

// Terapkan damage ke musuh; tangani kematian (+pecah slime). Mengembalikan jumlah kill.
function applyDamage(es: E[], e: E, dmg: number, kills: () => void): void {
  e.hp -= dmg;
  if (e.hp <= 0) {
    kills();
    if (e.def.splitInto && !e.def.boss) {
      const mini = TYPES[e.def.splitInto];
      const n = e.def.splitCount ?? 2;
      for (let i = 0; i < n; i++) es.push(makeEnemy(mini, e.x, e.y, 1, 1));
    }
  }
}

interface RunResult {
  win: boolean;
  wave: number;
  lives: number;
  bossDur: number;
}

// Jalankan satu run penuh dengan bot tertentu ('none' = tanpa upgrade, 'random' = acak).
function runOnce(bot: 'none' | 'random'): RunResult {
  const ps = new PlayerState();
  ps.reset();
  const D = diffPreset();
  const spawnInterval = CONFIG.wave.spawnIntervalMs / 1000;
  const contactCdMax = CONFIG.enemy.contactCooldownMs / 1000;
  const hitInv = CONFIG.player.hitInvincibleMs / 1000;
  const lifeInv = CONFIG.player.invincibleMs / 1000;
  const healPctWave = CONFIG.wave.waveClearHealPct * D.waveHeal;

  let waveReached = 0;
  let bossDurTotal = 0;
  let bossDurCount = 0;

  for (let w = 0; w < waveCount(); w++) {
    if (ps.lives <= 0) break;
    const wd = waveDef(w);
    const budget = Math.round(wd.budget * D.spawnCount);
    const hpMult = waveHpMult(w) * D.enemyHp;
    const dmgMult = waveDmgMult(w) * D.enemyDmg;
    const comp = wd.comp;
    const keys = Object.keys(comp);
    const compTotal = keys.reduce((s, k) => s + comp[k], 0);
    const pickType = (): Def => {
      let r = Math.random() * compTotal;
      for (const k of keys) {
        r -= comp[k];
        if (r <= 0) return TYPES[k];
      }
      return TYPES[keys[0]];
    };
    const spawnAt = (def: Def): void => {
      const a = Math.random() * Math.PI * 2;
      es.push(makeEnemy(def, CX + Math.cos(a) * 340, CY + Math.sin(a) * 340, hpMult, dmgMult));
    };

    const es: E[] = [];
    let boss: E | null = null;
    const bossDef = waveBoss(w) as unknown as Def | null;
    const bossStart = { t: 0, dur: -1 };
    if (bossDef) {
      boss = makeEnemy(bossDef, CX, CY - 420, hpMult, dmgMult);
      es.push(boss);
    }

    let spawned = 0;
    let spawnT = 0;
    let fireT = 0;
    let bladeT = 0;
    let lightT = 0;
    let meteorT = 0;
    let healT = 0;
    let t = CONFIG.wave.startDelayMs / 1000; // fase banner
    bossStart.t = t;
    const kill = (): void => {};

    while (ps.lives > 0 && t < 600) {
      if (spawned < budget) {
        spawnT -= DT;
        if (spawnT <= 0) {
          spawnAt(pickType());
          spawned++;
          spawnT = spawnInterval;
        }
      }
      if (ps.invincibleMs > 0) ps.invincibleMs -= DT * 1000;

      // Auto-fire (hitscan ke musuh terdekat).
      fireT -= DT;
      if (fireT <= 0 && es.length) {
        fireT = ps.fireIntervalMs / 1000;
        const crit = 1 + ps.critChance * (ps.critMult - 1);
        const targets = ps.bulletCount + ps.pierceCount + ps.bounceCount;
        for (const e of nearestK(es, CONFIG.weapon.range, targets)) applyDamage(es, e, ps.damage * crit, kill);
      }

      // Bounce Blade.
      if (ps.bounceBladeLevel > 0) {
        bladeT -= DT;
        if (bladeT <= 0) {
          bladeT = CONFIG.upgrades.bounce_blade.intervalMs / 1000;
          const crit = 1 + ps.critChance * (ps.critMult - 1);
          for (const e of nearestK(es, 260, ps.bladeCount * 2)) applyDamage(es, e, ps.bladeDamage * crit, kill);
        }
      }

      // Lightning (+ chain + synergy).
      if (ps.lightningLevel > 0) {
        lightT -= DT;
        if (lightT <= 0) {
          const first = nearest(es, CONFIG.upgrades.lightning.range, []);
          if (first) {
            lightT = CONFIG.upgrades.lightning.intervalMs / 1000;
            const crit = 1 + ps.critChance * (ps.critMult - 1);
            let dmg = ps.lightningDamage * crit;
            const used: E[] = [];
            let cur: E | null = first;
            for (let i = 0; i <= ps.lightningChain && cur; i++) {
              if (!cur) break;
              used.push(cur);
              applyDamage(es, cur, dmg, kill);
              if (ps.has('storm_fire')) {
                cur.burnDps = CONFIG.synergy.stormFire.burnDps;
                cur.burnMs = CONFIG.synergy.stormFire.burnMs;
              }
              if (ps.has('vital_storm')) ps.hp = Math.min(ps.maxHp, ps.hp + CONFIG.synergy.vitalStorm.healPerHit);
              dmg *= CONFIG.upgrades.lightning.chainFalloff;
              const prev = cur;
              cur = nearestToPoint(es, prev.x, prev.y, CONFIG.upgrades.lightning.chainRadius, used);
            }
          } else lightT = 0;
        }
      }

      // Meteor.
      if (ps.meteorLevel > 0) {
        meteorT -= DT;
        if (meteorT <= 0) {
          meteorT = ps.meteorIntervalMs / 1000;
          const crit = 1 + ps.critChance * (ps.critMult - 1);
          for (let i = 0; i < ps.meteorCount; i++) {
            const alive = es.filter((e) => e.hp > 0);
            if (!alive.length) break;
            const tgt = alive[Math.floor(Math.random() * alive.length)];
            for (const e of es) {
              if (e.hp > 0 && Math.hypot(e.x - tgt.x, e.y - tgt.y) <= CONFIG.upgrades.meteor.radius) applyDamage(es, e, ps.meteorDamage * crit, kill);
            }
          }
        }
      }

      // Heal aura.
      if (ps.healAuraLevel > 0) {
        healT -= DT;
        if (healT <= 0) {
          healT = ps.healAuraIntervalMs / 1000;
          ps.hp = Math.min(ps.maxHp, ps.hp + ps.maxHp * CONFIG.upgrades.heal_aura.healPct);
        }
      }


      // Gerak + burn + boss + kontak.
      for (const e of es) {
        if (e.hp <= 0) continue;
        if (e.burnMs > 0) {
          e.burnMs -= DT * 1000;
          e.hp -= e.burnDps * DT;
        }
        const dx = CX - e.x;
        const dy = CY - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const stop = PLAYER_HALF + e.def.width * 0.5;
        const dash = e.def.dash;
        if (dash) {
          if (e.dashMs > 0) {
            e.dashMs -= DT * 1000;
            e.x += (dx / d) * dash.speed * DT;
            e.y += (dy / d) * dash.speed * DT;
          } else if (e.tel > 0) {
            e.tel -= DT * 1000;
            if (e.tel <= 0) e.dashMs = dash.durationMs;
          } else {
            e.dashCd -= DT;
            if (e.dashCd <= 0) {
              e.dashCd = dash.intervalMs / 1000;
              e.tel = dash.telegraphMs;
            } else if (d > stop) {
              e.x += (dx / d) * e.speed * DT;
              e.y += (dy / d) * e.speed * DT;
            }
          }
        } else if (d > stop) {
          e.x += (dx / d) * e.speed * DT;
          e.y += (dy / d) * e.speed * DT;
        }

        const p2 = e.def.phase2;
        if (e.boss && p2 && !e.enraged && e.hp <= e.maxHp * p2.hpPct) {
          e.enraged = true;
          e.speed *= p2.speedMult;
          e.summonCd = p2.summonIntervalMs / 1000;
        }
        if (e.boss && e.enraged && p2) {
          e.summonCd -= DT;
          if (e.summonCd <= 0) {
            e.summonCd = p2.summonIntervalMs / 1000;
            const s = TYPES[p2.summonType];
            for (let i = 0; i < p2.summonCount; i++) es.push(makeEnemy(s, e.x, e.y, hpMult, dmgMult));
          }
        }

        if (e.contactCd > 0) e.contactCd -= DT;
        if (d <= stop && e.contactCd <= 0 && ps.invincibleMs <= 0) {
          ps.hp = Math.max(0, ps.hp - e.dmg);
          e.contactCd = contactCdMax;
          ps.invincibleMs = hitInv * 1000;
        }
      }

      if (boss && boss.hp <= 0 && bossStart.dur < 0) bossStart.dur = t - bossStart.t;

      if (ps.hp <= 0) {
        if (VERBOSE) console.log(`    DIED in wave ${w + 1} at t=${t.toFixed(1)} (boss=${!!boss})`);
        ps.lives--;
        ps.hp = Math.round(ps.maxHp * CONFIG.player.reviveHpPct);
        ps.invincibleMs = lifeInv * 1000;
        for (let i = es.length - 1; i >= 0; i--) if (!es[i].boss) es.splice(i, 1);
      }

      for (let i = es.length - 1; i >= 0; i--) if (es[i].hp <= 0) es.splice(i, 1);
      if (spawned >= budget && es.length === 0) break;
      t += DT;
    }

    if (ps.lives <= 0) break;
    waveReached = w + 1;
    if (bossStart.dur >= 0) {
      bossDurTotal += bossStart.dur;
      bossDurCount++;
    }
    ps.hp = Math.min(ps.maxHp, ps.hp + ps.maxHp * healPctWave);
    if (VERBOSE) {
      console.log(`  w${w + 1} clear: hp ${ps.hp.toFixed(0)}/${ps.maxHp.toFixed(0)} lives ${ps.lives} dmg ${ps.damage.toFixed(0)} int ${ps.fireIntervalMs.toFixed(0)}ms bullets ${ps.bulletCount} pierce ${ps.pierceCount}`);
    }
    if (w < waveCount() - 1 && bot === 'random') {
      const choice = rollChoices(ps, 3);
      if (choice.length) {
        const pick = choice[Math.floor(Math.random() * choice.length)];
        const lvl = ps.levelOf(pick.id) + 1;
        ps.setLevel(pick.id, lvl);
        pick.apply(ps, lvl);
        newlyActivated(ps);
      }
    }
  }

  return {
    win: waveReached === waveCount() && ps.lives > 0,
    wave: waveReached,
    lives: ps.lives,
    bossDur: bossDurCount ? bossDurTotal / bossDurCount : 0,
  };
}


interface Agg {
  winRate: number;
  avgWave: number;
  wave7Rate: number;
  avgLives: number;
  avgBossDur: number;
}

function simulate(bot: 'none' | 'random', n: number): Agg {
  let wins = 0;
  let waveSum = 0;
  let wave7 = 0;
  let livesSum = 0;
  let durSum = 0;
  let durCount = 0;
  for (let i = 0; i < n; i++) {
    const r = runOnce(bot);
    if (r.win) wins++;
    if (r.wave >= 7) wave7++;
    waveSum += r.wave;
    livesSum += r.lives;
    if (r.bossDur > 0) {
      durSum += r.bossDur;
      durCount++;
    }
  }
  return {
    winRate: wins / n,
    avgWave: waveSum / n,
    wave7Rate: wave7 / n,
    avgLives: livesSum / n,
    avgBossDur: durCount ? durSum / durCount : 0,
  };
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

const N = Number(process.argv[2]) || 200;
const DIFFS = ['easy', 'normal', 'hard'];
console.log(`=== BALANCE SIM (${N} run/bot) ===`);
for (const d of DIFFS) {
  CONFIG.difficulty.current = d;
  const none = simulate('none', N);
  const rnd = simulate('random', N);
  console.log(`\n-- ${d.toUpperCase()} --`);
  console.log(`  no-upgrade : win ${pct(none.winRate)} | avg wave ${none.avgWave.toFixed(2)} | avg lives ${none.avgLives.toFixed(2)} | boss ${none.avgBossDur.toFixed(1)}s`);
  console.log(`  random-upg : win ${pct(rnd.winRate)} | wave7+ ${pct(rnd.wave7Rate)} | avg wave ${rnd.avgWave.toFixed(2)} | avg lives ${rnd.avgLives.toFixed(2)} | boss ${rnd.avgBossDur.toFixed(1)}s`);
}

