export interface AdAdapter {
    /** Fixed banner height in CSS pixels */
    bannerHeight: number

    /** Initialize the ad SDK. Call once at app startup. */
    initialize(): Promise<void>

    /**
     * Attach a banner ad to the given DOM element.
     * Returns a cleanup function, or null if ads are unsupported.
     */
    attachBanner(container: HTMLElement): (() => void) | null

    /** Preload an interstitial ad so it's ready to show instantly. */
    preloadInterstitial(): void

    /**
     * Show a preloaded interstitial ad.
     * Returns a promise that resolves when the ad is dismissed.
     * Resolves immediately if no ad is loaded.
     */
    showInterstitial(): Promise<void>

    /**
     * Show a rewarded ad and resolve with whether the user earned the reward.
     * Resolves `false` on dismiss/failure/unsupported environment.
     *
     * `purpose` selects which ad group / unit to show — different surfaces of
     * the game can point at separately configured inventory.
     */
    showRewardedAd(purpose?: RewardedAdPurpose): Promise<boolean>

    /**
     * Warm up a rewarded ad in the background so the subsequent `showRewardedAd`
     * call displays immediately. Call at app init and after every show.
     */
    preloadRewardedAd(purpose?: RewardedAdPurpose): void
}

/** In-game surface a rewarded ad is serving. Each purpose maps to its own
 *  ad group on the platform dashboard (e.g. Toss, AdMob).
 *  Extend this union per game (e.g. 'revive' | 'double_reward') and add the
 *  matching unit/group ids in defaultAd.ts and tossAd.ts. */
export type RewardedAdPurpose = 'default'
