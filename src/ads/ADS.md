# Ads Integration Guide

Ad integration notes for games built on this template.

## Structure

```text
src/ads/
  constants.ts   # AD_BANNER_HEIGHT, INTERSTITIAL_INTERVAL
  types.ts       # AdAdapter interface + RewardedAdPurpose union
  index.ts       # Platform adapter selection (__PLATFORM__)
  tossAd.ts      # Toss In-App Ads adapter
  defaultAd.ts   # Capacitor / AdMob adapter
  webAd.ts       # Web fallback adapter (dummy modal)
```

## Ad Surfaces

- **Banner**: persistent bottom banner in `MobileFrame`. Toggled per game via
  `APP_CONFIG.showAdBanner`; hidden at runtime by the `remove_ads` entitlement.
- **Interstitial**: shown by `App.tsx` every `APP_CONFIG.interstitialEveryNGames`
  finished games.
- **Rewarded**: `showRewardedAd(purpose)` → `Promise<boolean>` (reward earned).
  The template ships a single `'default'` purpose — extend `RewardedAdPurpose`
  in `types.ts` per game (e.g. `'revive' | 'double_reward'`) and add the
  matching ids in both adapters.

## Toss In-App Ads

Register ad groups in the Apps-in-Toss console, then replace the `TODO_`
constants in `tossAd.ts`:

| Purpose | Format | Constant |
|---|---|---|
| Banner | Banner | `BANNER_AD_GROUP_ID` |
| Rewarded (default) | Full-screen / rewarded | `REWARDED_AD_GROUP_ID` |

Toss does not provide a reward callback for every full-screen format. Where
`userEarnedReward` never fires, the adapter treats sufficient impression time
(3s min-watch) as the reward condition — see `showRewardedAd` in `tossAd.ts`.
There is no standalone Toss interstitial: `preloadInterstitial` /
`showInterstitial` are no-ops on Toss, and interstitial-style inventory goes
through the rewarded path.

## AdMob (Android)

Current values in `defaultAd.ts` are **Google's official test IDs** — safe to
ship in pre-release builds, must be replaced before store release:

| Purpose | Constant | Test ID |
|---|---|---|
| Banner | `BANNER_ID` | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial | `INTERSTITIAL_ID` | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `REWARDED_ID` | `ca-app-pub-3940256099942544/5224354917` |
| App ID | `AndroidManifest.xml` | `ca-app-pub-3940256099942544~3347511713` |

## Rewarded Ad Behavior

- Preload rewarded inventory during app startup (`App.tsx` does this).
- After a rewarded ad finishes or fails, immediately preload the next instance
  (the Toss adapter re-warms automatically in `finish()`).
- Reward only when the platform reports a reward event or the adapter's
  fallback impression rule is satisfied.
- If a reward is not granted, keep the gated feature locked or on cooldown.
- Show loading UI while a non-preloaded `showRewardedAd` call pends.

## Toss Guidelines

- Do not force repeated refreshes.
- Do not block payment or authentication flows with ads.
- Do not alter SDK click / impression event structure.
- Keep ad container width matched to screen width.
- Banner height is reserved at 96px (`AD_BANNER_HEIGHT`).

## Layout Contract

`MobileFrame` reserves a fixed bottom ad slot when `APP_CONFIG.showAdBanner`
is true:

```text
MobileFrame
  content area  # title / game / ranking screens
  ad-banner     # 96px, flex-shrink: 0
```

Game UI should not assume the full viewport height is available — the playable
content area lives above the banner.

## Production Checklist

- [ ] Toss banner ad group id configured (`tossAd.ts`).
- [ ] Toss rewarded ad group id configured (`tossAd.ts`).
- [ ] Replace AdMob unit test IDs with production IDs (`defaultAd.ts`).
- [ ] Replace AdMob app ID in `AndroidManifest.xml`.
- [ ] Test banner, interstitial, reward, failure and preload behavior on a real Android device.
- [ ] Verify Toss console QR / device testing flow before release.
