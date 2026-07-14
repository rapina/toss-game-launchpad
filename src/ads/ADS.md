# Ads Integration Guide

Ad integration for **DEAD HAND**, the Texas Hold'em prison roguelike.

## Structure

```text
src/ads/
  constants.ts   # AD_BANNER_HEIGHT, shared ad constants
  types.ts       # AdAdapter interface
  index.ts       # Platform adapter selection
  tossAd.ts      # Toss In-App Ads adapter
  defaultAd.ts   # Capacitor / AdMob adapter
  webAd.ts       # Web fallback adapter
```

## Ad Purposes

- **Banner**: persistent bottom banner in `MobileFrame`.
- **Third Eye**: rewarded full-screen ad for a cheating / information feature.
- **Endless unlock**: rewarded ad gate for entering Endless mode when the entitlement is not owned.

## Toss In-App Ads 2.0

| Purpose | Format | Constant | ID |
|---|---|---|---|
| Banner | Banner | `BANNER_AD_GROUP_ID` | `ait.v2.live.b2f0565ad8074d3b` |
| Third Eye | Full-screen / rewarded fallback | `THIRD_EYE_AD_GROUP_ID` | `ait.v2.live.5bbf5d06abbf4703` |
| Endless unlock | Rewarded | `ENDLESS_UNLOCK_AD_GROUP_ID` | `ait.v2.live.4adff3878b1149e5` |

Toss does not provide a separate universal rewarded full-screen format for every use case. Where the SDK lacks a reward callback, the adapter treats sufficient impression time as the reward condition.

## AdMob Android

Current values are Google test IDs and must be replaced before store release.

| Purpose | Constant | Test ID |
|---|---|---|
| Banner | `BANNER_ID` | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial | `INTERSTITIAL_ID` | `ca-app-pub-3940256099942544/1033173712` |
| Third Eye rewarded | `THIRD_EYE_REWARDED_ID` | `ca-app-pub-3940256099942544/5354046379` |
| Endless unlock rewarded | `ENDLESS_UNLOCK_REWARDED_ID` | `ca-app-pub-3940256099942544/5224354917` |
| App ID | `AndroidManifest.xml` | `ca-app-pub-3940256099942544~3347511713` |

## Rewarded Ad Behavior

- Preload Third Eye and Endless ads during app startup where possible.
- After a rewarded ad finishes or fails, immediately attempt to preload the next instance.
- Reward only when the platform reports a reward event or the adapter's fallback impression rule is satisfied.
- If a reward is not granted, keep the original feature locked or on cooldown.
- Show loading UI while waiting for preload / show calls.

## Toss Guidelines

- Do not force repeated refreshes.
- Do not block payment or authentication flows with ads.
- Do not alter SDK click / impression event structure.
- Keep ad container width matched to screen width.
- Banner height is reserved at 96px in this project.

## Layout Contract

`MobileFrame` reserves a fixed bottom ad slot:

```text
MobileFrame
  content area  # game / title / reward screens
  ad-banner     # 96px, flex-shrink: 0
```

Game UI should not assume the full viewport height is available. The playable 9:16 content area lives above the banner.

## Production Checklist

- [x] Toss banner ID configured.
- [x] Toss Third Eye full-screen ID configured.
- [x] Toss Endless rewarded ID configured.
- [ ] Replace AdMob Third Eye test ID with production rewarded ID.
- [ ] Replace AdMob Endless test ID with production rewarded ID.
- [ ] Replace AdMob app ID with production app ID.
- [ ] Test banner, full-screen, reward, failure, and preload behavior on a real Android device.
- [ ] Verify Toss console QR / device testing flow before release.
