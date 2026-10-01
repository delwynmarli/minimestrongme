# MiniMe StrongMe

Hyper-casual **rogue-like tower defense** for web & Android (portrait). A single character
stands at the center of the arena and auto-fires at enemies; after each wave you pick 1 of 3
random upgrade cards. Upgrade combos create different **synergies** every run (10 waves, 2 bosses).

- Full design: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
- Android guide (beginner): [`docs/ANDROID_GUIDE.md`](docs/ANDROID_GUIDE.md)

## Tech

- **TypeScript (strict) + HTML5 Canvas 2D + Vite** — no big game engine, no backend, no UI framework.
- **Capacitor** to package it as an Android app.
- All assets are local (`public/assets/`, `public/fonts/`) — **works offline**, no hotlinks.

## Requirements

- Node.js 18+ (20/22+ recommended) and npm.
- For Android: Android Studio + bundled JDK (see `docs/ANDROID_GUIDE.md`).

## Run (web)

```bash
npm install          # install dependencies
npm run dev          # run in the browser (open the printed URL; use device/phone mode)
npm run build        # type-check + production build into dist/
npm run preview      # preview the production build
```

Logical resolution is **360 wide** with an adaptive height (560–800) based on the screen ratio;
scale-to-fit with letterbox. Sharp pixel art (`imageSmoothingEnabled = false`).

## Balance simulation

Headless bot (no rendering) to test difficulty:

```bash
npm run sim          # 200 runs/bot for the easy/normal/hard presets
npm run sim 300      # 300 runs/bot
npm run sim 1 v      # 1 run + per-wave verbose log
```

## Android build (Capacitor)

```bash
npm run build:android   # build web + cap sync (copy into the Android project)
npm run open:android    # open Android Studio
```

Open `android/` in Android Studio, then **Run** to a phone (USB debugging) / emulator.
Full steps (USB debugging, keystore, signed APK/AAB release, Google Play prep, on-device
performance testing) are in [`docs/ANDROID_GUIDE.md`](docs/ANDROID_GUIDE.md).

## Project structure

```
index.html            # canvas entry point
src/
  main.ts             # bootstrap: scale-to-fit, loop, pointer input, Back button (native)
  game/
    config.ts         # ALL balance numbers + difficulty presets + fx flags
    game.ts           # loop, waves, spawn, collision, HUD, screens (title/pause/upgrade/over)
    view.ts           # adaptive viewport (360 x dynamic height)
    player.ts enemy.ts bullet.ts blade.ts meteor.ts effect.ts runes.ts
    arena.ts visual.ts anim.ts quality.ts draw.ts            # rendering & effects
    playerState.ts save.ts spatial.ts assets.ts audio.ts waves.ts
    upgrades/         # registry, synergy, types (data-driven)
    ui/               # menu.ts, upgradeScreen.ts
  sim/run.ts          # headless balance simulation
public/
  assets/             # original art (DO NOT modify) — see the asset table in docs
  fonts/              # Press Start 2P (local)
docs/                 # GAME_DESIGN.md, ANDROID_GUIDE.md
android/              # Android project (Capacitor)
assets/               # icon & splash sources for @capacitor/assets
```

## Quick configuration

- **Balance:** everything lives in `src/game/config.ts` — enemy HP/damage/speed, wave data
  (`wave.data`), `player`, `weapon`, upgrade strength (`upgrades`), synergies, and `difficulty` presets.
- **Difficulty presets:** `easy` / `normal` / `hard` (multipliers). Change from the **Pause → DIFFICULTY**
  screen (saved), or edit `difficulty.presets` in `config.ts`.
- **Effects / performance:** flags in `CONFIG.fx` (`shadows`, `lighting`, `ambient`, `hopAnim`, `runes`,
  `slash`, `bladeBlur`, `shards`, `decals`, `particles.max`, `quality`). Quality scales down
  automatically when FPS drops.
- **Debug:** `CONFIG.debug` — `showFps` (FPS overlay + quality level `Q`), `assetCheck` (asset gallery),
  `waveTools` (jump-wave / grant-upgrade buttons), `enemyStress` (many-enemy stress test), `autoSim` (time speed-up).

## Asset rules

The PNG files in `public/assets/` are the **original assets** — do not redraw, replace, or overwrite them.
Use them as-is (fit-in-box, keep aspect ratio). Sizes and usage are documented in `docs/GAME_DESIGN.md`.

## Release notes

- **Do not commit** keystores (`.keystore`/`.jks`) or passwords.
- `node_modules/`, `dist/`, and `android/app/build/` are already ignored by `.gitignore`.
- The current appId is `com.minimestrongme.app` (for testing). For Google Play, switch to a domain you own
  (e.g. `com.yourname.minimestrongme`) **before** publishing — the appId cannot be changed after release.

