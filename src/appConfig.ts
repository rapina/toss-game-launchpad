/**
 * Per-game configuration.
 *
 * `scripts/new-game.js` rewrites STORAGE_PREFIX along with the app identity;
 * everything else is edited by hand (or by an agent) when building a new game.
 */

/** localStorage key prefix. Set once per game and never change after release —
 *  changing it orphans every player's records/settings/entitlements. */
export const STORAGE_PREFIX = 'gametemplate'

export const APP_CONFIG = {
    /** Reserve the bottom banner-ad slot. false → the game gets the full 9:16 frame. */
    showAdBanner: true,

    /** Show an interstitial ad every N finished games (0 = never). */
    interstitialEveryNGames: 3,

    /** Logical design resolution of the game stage (portrait 9:16). */
    designWidth: 400,
    designHeight: 711,
}
