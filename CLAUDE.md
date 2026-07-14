# CLAUDE.md

Guidance for Claude Code / agent sessions working in this repository.

## What This Is

A **portrait-mobile game shell template**. It ships the
platform plumbing — Toss (Apps-in-Toss/Granite) + Android (Capacitor) builds,
ads, IAP, leaderboard, audio, i18n, local records — so a new game only has to
implement gameplay. The screen flow is fixed:

```text
title -> game -> ranking -> (retry -> game | menu -> title)
```

`GDD.md` is the canonical design document for the game built on this shell.
When a change meaningfully shifts design, update `GDD.md` in the same turn.

## Read First

- `GDD.md` — game design intent (create it from the stub when starting a game)
- `NEW_GAME.md` — one-time setup checklist for a freshly copied template
- `src/game/types.ts` — the GameRuntime contract between shell and game

## Commands

```bash
npm run dev              # Vite dev server
npx tsc -b               # Type-check only — run after most code changes
npm test                 # Vitest unit tests — run after logic changes.
                         # A Stop hook re-runs these and blocks the turn
                         # from ending while they are red.
npm run smoke            # Headless run of the game; fails on console errors.
                         # Run after gameplay changes. Outputs smoke.png +
                         # smoke-result.json (both gitignored).
npm run build            # Full web build

npm run android:deploy   # Build + install to attached Android device
npm run android:release  # Bump version + release AAB
npm run toss:dev         # Toss / Granite dev
npm run toss:build       # Toss AIT build

npm run new-game -- --id com.studio.x --name "X" --slug x --display "엑스"
                         # One-time identity rewrite after copying the template
```

## Architecture

### Shell (reusable — extend, don't fork)

- `src/App.tsx` — screen routing, adapter init, interstitial cadence, banner slot.
- `src/appConfig.ts` — per-game flags: `showAdBanner`, `interstitialEveryNGames`,
  design resolution, `STORAGE_PREFIX` (never change after release).
- `src/platform/` — PlatformAdapter: user id, leaderboard, review. Toss/default.
- `src/ads/` — AdAdapter: banner / interstitial / rewarded. AdMob, TossAds, web dummy.
- `src/iap/` — IapAdapter + entitlements (`remove_ads` hides the banner automatically).
- `src/audio/` — BGM crossfade manager, SFX synth, volume settings.
- `src/i18n/` — i18next, 4 locales (ko/en/zh/ja), per-domain translation files.
- `src/components/MobileFrame.tsx` — 9:16 frame + banner slot.
- `src/game/records.ts` — local top-10 records + play count.
- `src/game/logicRng.ts` — seeded RNG for reproducible runs.

### Game (replace per game)

- `src/game/SampleGame.ts` — example GameRuntime. Replace with the real game;
  keep the `GameRuntime` interface from `src/game/types.ts`.
- `src/components/GameScreen.tsx` — mounts the runtime; swap the constructor here.
- `src/screens/TitleScreen.tsx`, `src/screens/RankingScreen.tsx` — restyle per game.
- `src/i18n/translations.ts` — shell strings; add per-domain files for game content.

## Working Rules

- **Game logic goes through `GameRuntime`** (`src/game/types.ts`). The shell only
  knows `mount / destroy / getDebugState` and the `onGameOver(GameResult)`
  callback. Don't call platform/ad code from inside the runtime — surface a
  callback through GameScreen instead.
- **All gameplay randomness must use `logicRandom()`** from `src/game/logicRng.ts`
  so `?seed=N` reproduces a run (the smoke test depends on this).
- **Adding a screen**: extend the `Screen` union in `App.tsx`, the
  `SCREEN_TRACK` map in `src/hooks/useBGM.ts`, and translations.
- **Adding a rewarded-ad surface**: extend `RewardedAdPurpose` in
  `src/ads/types.ts`, then add the unit/group ids in `defaultAd.ts` and `tossAd.ts`.
- **Adding an IAP product**: extend `IapProductId` in `src/iap/types.ts` and the
  SKU tables in `src/iap/constants.ts`.
- **Never change `STORAGE_PREFIX`** after a game ships — it orphans player data.
- **Pure logic gets unit tests.** Rules, scoring, economy, state machines —
  anything expressible without Pixi/DOM — lives in plain modules under
  `src/game/` with a co-located `*.test.ts`. Existing tests
  (`records.test.ts`, `logicRng.test.ts`, `translations.test.ts`) show the
  house pattern. When you add a translation-domain file, mirror the
  locale-parity test for it.
- House style: 4-space indent, no semicolons in TS/TSX, named exports for utilities.

## Verification Loop (agents: do this before reporting done)

1. `npx tsc -b` — must pass after any code change.
2. `npm test` — must pass after any logic change; add/update tests in the same
   turn as the code they cover. A Stop hook (`scripts/test-gate.mjs`) re-runs
   the suite when you try to end the turn and blocks you while it is red — do
   not disable the hook or delete failing tests to get past it; fix the code
   or fix the test's expectation if the design genuinely changed.
3. `npm run smoke` — after gameplay/runtime changes. It boots the dev server,
   plays a seeded run headlessly, and fails on any console/page error.
   Inspect `smoke-result.json` (final state, GameResult) and `smoke.png`
   (visual snapshot) when debugging.
4. `npm run build` — when assets, CSS, Capacitor or Vite config changed.

CI (`.github/workflows/ci.yml`) runs tsc + unit tests + smoke on every push,
so anything skipped locally fails on GitHub.

The smoke driver blind-clicks the canvas. If the game needs smarter input
(menus, drag gestures), extend the driver loop in `scripts/smoke.mjs` — keep
the `__gameState.over` termination contract.

## Platform Notes

- Platform selection is compile-time: `VITE_PLATFORM=toss` → `__PLATFORM__ === 'toss'`
  picks the Toss adapters; otherwise Capacitor/AdMob (native) or web dummies.
- Ad unit ids: `src/ads/defaultAd.ts` ships AdMob **test ids** — swap before
  release. `src/ads/tossAd.ts` ships `TODO_` placeholders.
- IAP SKUs: `src/iap/constants.ts` ships `TODO_` placeholders.
- The banner slot is reserved by `APP_CONFIG.showAdBanner`; the `remove_ads`
  entitlement hides it at runtime.

## Asset Slots

- `public/audio/title.mp3`, `game.mp3` — BGM tracks (registered in `src/audio/bgmConfig.ts`)
- `public/fonts/` — Galmuri pixel fonts (preloaded in `src/main.tsx`)
- `public/favicon-*.png`, `icon-*.png`, `apple-touch-icon.png` — web icons
- `android/app/src/main/res/mipmap-*/` — launcher icons (`scripts/gen_app_icon.py` resizes)
- `src/assets/` — game art (portraits, scenes, UI); create per game
