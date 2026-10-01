# kegex — Colemak-DH trainer for split keyboards

```sh
npm install
npm run dev      # http://localhost:5317
npm test         # engine unit tests
npm run build    # typecheck + production bundle
```

## Desktop apps (Windows, Linux)

`electron/main.cjs` wraps the same build in an Electron window (no menu bar, so
a lone Alt press can't steal focus from AltGr chords). Progress lives in
localStorage under `%APPDATA%\Kegex` (Windows) or `~/.config/Kegex` (Linux),
separate from the browser version.

### Windows

Build with Windows Node (PowerShell/cmd), not from WSL: the installer and
portable targets need Wine on Linux.

```powershell
git clone https://github.com/utku-gaspak/colemak-trainer.git C:\dev\kegex
cd C:\dev\kegex
npm ci
npm run build:win
```

Output in `release/`:

| File | Use |
|---|---|
| `Kegex-Setup-<version>.exe` | Installer (per user, no admin), Start menu entry + uninstaller |
| `Kegex-<version>-portable.exe` | Single file, no install |

To rebuild later: `git pull`, then `npm run build:win`. Bump `version` in
`package.json` to change the file names. Builds are unsigned, so SmartScreen
warns on first launch (More info → Run anyway). The deprecation warnings
`npm ci` prints (`inflight`, `glob`, `rimraf`, `boolean`) come from
electron-builder's own dependencies, are build-time only, and are harmless.

### Linux (Ubuntu)

Builds on Linux or WSL, no extra tools needed:

```sh
npm ci
npm run build:linux
```

| File | Use |
|---|---|
| `kegex_<version>_amd64.deb` | **Recommended on Ubuntu.** `sudo apt install ./release/kegex_<version>_amd64.deb`, then launch "Kegex" from the app menu or run `kegex`. Remove with `sudo apt remove kegex`. |
| `Kegex-<version>-x86_64.AppImage` | Single file, no install: `chmod +x` it and run it. |

The `.deb` installs an AppArmor profile, which Ubuntu 24.04+ needs for
Electron's sandbox. The AppImage has two Ubuntu snags:

- *"AppImages require FUSE to run"*: Ubuntu 22.04+ lacks FUSE 2, so run
  `sudo apt install libfuse2t64` (`libfuse2` on 22.04).
- If it exits with a sandbox error on 24.04+, run it with `--no-sandbox`, or
  use the `.deb` instead.

## Stack

| Choice | Why |
|---|---|
| **Vite + React 19 + TypeScript (strict)** | Instant HMR, small prod bundle, typed engine. |
| **Zustand** (+ `persist`) | Selector subscriptions let each character re-render on its own: a keypress touches ~2 DOM nodes, not the whole line. Persistence to localStorage is built in. |
| **Plain CSS with theme tokens** | No runtime styling cost; light/dark via `prefers-color-scheme`. |
| **Vitest** | The engine is pure functions, so it's tested without a DOM. |
| **Electron + electron-builder** | Windows exe and Linux AppImage / .deb from the same build; Chromium keeps `event.code` / AltGr behaviour identical to the browser. |

## Layout

```
electron/main.cjs               desktop shell: app:// origin, single window, no menu bar
src/
  layout/colemakDh.ts           physical position → char / hand / finger / row; unlock order; umlauts
  input/keyMapping.ts           event.code → PhysicalKey (positional or firmware mode); AltGr chords
  input/useHardwareKeyboard.ts  window keydown listener, reads only event.code
  engine/
    session.ts                  pure typing state machine: press(state, char, t)
    keyStats.ts                 per-key EWMA latency/error, confidence, weak-key ranking
    progression.ts              promotion rules + anti-stall relaxation
    markov.ts, corpus.ts        order-2 character Markov model with backoff; English + German corpus
    wordGenerator.ts            pronounceable words from unlocked keys, focus + weak-key weighting
  state/profileStore.ts         persisted progress, stats, settings
  state/sessionStore.ts         volatile session; bridges keypresses → engine → profile
  components/                   TypingArea, SplitKeyboard, MetricsBar, ProgressPanel, Dashboard, SettingsView
```

## Input modes

Only `event.code` is ever read (never `event.key`), so the OS layout (EURkey, US-Intl dead keys)
has no effect. The only modifier the trainer uses is AltGr, for umlauts (see below).

- **Positional** (default): the board sends QWERTY-position scancodes; the app remaps (`KeyF` → `t`).
- **Firmware**: your QMK/ZMK keymap already is Colemak-DH (the `t` position sends `KeyT`). Switch in Settings.

Settings has a scancode probe if you're unsure which applies.

**Umlauts** `ä ö ü ß` are typed as a chord: AltGr + the key of the base letter (`a o u s`) by
default, matching Colemak's and EURkey's AltGr layers. On Windows, AltGr arrives as Ctrl+Alt and is
recognised as such. If your board sends them differently (e.g. a dedicated firmware key), rebind each
one under Settings → Umlauts.

## Progression

Level 1 = `a r s t h n e i`, then one key per level (`o d l u c m p f g w y b v k j x z q`), and finally
the umlauts `ä ö ü ß`. German words join the generator only once an umlaut is unlocked.
At least 30% of each lesson's words contain the newest key, so rare letters (`j z q ß`) don't stall.
A level unlocks when, over the last 20 words at that level: accuracy ≥ 95%, rhythm stability
(1 − CV of per-word WPM) ≥ 70%, and the new key has ≥ 12 clean reps at ≥ 90% smoothed accuracy.
Old weak keys never block promotion — they are re-injected instead (words containing the 3 weakest
keys get +30% selection weight). After 150 words at one level, thresholds ease step by step so a
plateau can't freeze progress. All thresholds are adjustable in Settings.
