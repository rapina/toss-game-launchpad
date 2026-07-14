import type { AdAdapter, RewardedAdPurpose } from './types'
import { AD_BANNER_HEIGHT } from './constants'
import { TossAds, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'

// ─── Toss ad groups owned by this project ───
// Register ad groups in the Apps-in-Toss console and paste the issued ids here.
// 전면(interstitial-style) inventory also goes through the rewarded path —
// `userEarnedReward` never fires for 전면; reward is granted via
// impression + min-watch timing in showRewardedAd below.
const BANNER_AD_GROUP_ID = 'TODO_TOSS_BANNER_AD_GROUP_ID'
const REWARDED_AD_GROUP_ID = 'TODO_TOSS_REWARDED_AD_GROUP_ID'

function rewardedGroupFor(purpose: RewardedAdPurpose | undefined): string {
    switch (purpose) {
        // Add a case per game-specific purpose, each with its own ad group id.
        case 'default':
        default:
            return REWARDED_AD_GROUP_ID
    }
}

/** Per-purpose preload state: true once Toss reports 'loaded' and not yet consumed. */
const rewardedReady: Record<RewardedAdPurpose, boolean> = {
    default: false,
}
/** Guards against overlapping preload calls for the same purpose. */
const rewardedLoading: Record<RewardedAdPurpose, boolean> = {
    default: false,
}

export const tossAdAdapter: AdAdapter = {
    bannerHeight: AD_BANNER_HEIGHT,

    async initialize() {
        if (!TossAds.initialize.isSupported()) {
            console.warn('[TossAd] TossAds not supported in this environment')
            return
        }

        return new Promise<void>((resolve) => {
            TossAds.initialize({
                callbacks: {
                    onInitialized: () => {
                        console.log('[TossAd] SDK initialized')
                        resolve()
                    },
                    onInitializationFailed: (error: Error) => {
                        console.error('[TossAd] SDK init failed:', error)
                        resolve()
                    },
                },
            })
        })
    },

    attachBanner(container: HTMLElement) {
        if (!TossAds.attachBanner.isSupported()) return null

        const result = TossAds.attachBanner(BANNER_AD_GROUP_ID, container, {
            theme: 'dark',
            tone: 'blackAndWhite',
            variant: 'expanded',
            callbacks: {
                onAdFailedToRender: (payload: { error: { code: number; message: string } }) => {
                    console.warn('[TossAd] Banner render failed:', payload.error.message)
                },
                onNoFill: () => {
                    console.warn('[TossAd] No fill for banner')
                },
            },
        })

        return () => result.destroy()
    },

    // No standalone Toss interstitial group — full-screen inventory goes
    // through the rewarded path. These two methods are retained as no-ops so
    // the AdAdapter interface is consistent across adapters; callers go
    // through preloadRewardedAd / showRewardedAd instead.
    preloadInterstitial() { /* no-op */ },
    showInterstitial() { return Promise.resolve() },

    preloadRewardedAd(purpose?: RewardedAdPurpose) {
        if (!loadFullScreenAd.isSupported?.()) return
        const key: RewardedAdPurpose = purpose ?? 'default'
        if (rewardedReady[key] || rewardedLoading[key]) return
        const adGroupId = rewardedGroupFor(key)
        rewardedLoading[key] = true
        loadFullScreenAd({
            options: { adGroupId },
            onEvent: (event) => {
                if (event.type === 'loaded') {
                    rewardedReady[key] = true
                    rewardedLoading[key] = false
                    console.log('[TossAd] Rewarded preloaded:', key)
                }
            },
            onError: (err) => {
                rewardedLoading[key] = false
                console.warn('[TossAd] Rewarded preload failed:', key, err)
            },
        })
    },

    showRewardedAd(purpose?: RewardedAdPurpose) {
        if (!showFullScreenAd.isSupported?.()) return Promise.resolve(false)
        const key: RewardedAdPurpose = purpose ?? 'default'
        const adGroupId = rewardedGroupFor(key)
        return new Promise<boolean>((resolve) => {
            let earned = false
            let sawImpression = false
            let impressionTimeMs = 0
            let settled = false
            const finish = (val: boolean) => {
                if (settled) return
                settled = true
                console.log('[TossAd] Rewarded finish:', val, { purpose: key, adGroupId, earned, sawImpression })
                // Re-warm for the next usage (fire-and-forget).
                tossAdAdapter.preloadRewardedAd(key)
                resolve(val)
            }
            const MIN_WATCH_MS = 3000

            const doShow = () => {
                rewardedReady[key] = false
                showFullScreenAd({
                    options: { adGroupId },
                    onEvent: (event) => {
                        console.log('[TossAd] Rewarded event:', event.type)
                        if (event.type === 'impression') {
                            sawImpression = true
                            impressionTimeMs = Date.now()
                        }
                        if (event.type === 'userEarnedReward') earned = true
                        if (event.type === 'dismissed' || event.type === 'failedToShow') {
                            const watchedMs = sawImpression ? Date.now() - impressionTimeMs : 0
                            const interstitialFallback = sawImpression && watchedMs >= MIN_WATCH_MS
                            finish(earned || interstitialFallback)
                        }
                    },
                    onError: (err) => {
                        console.warn('[TossAd] Rewarded show error:', err)
                        finish(earned)
                    },
                })
            }

            // Fast path: ad already preloaded → show immediately.
            if (rewardedReady[key]) {
                doShow()
                return
            }
            // Otherwise load now, then show. Callers typically surface a
            // loading indicator while this promise pends.
            loadFullScreenAd({
                options: { adGroupId },
                onEvent: (loadEvent) => {
                    if (loadEvent.type !== 'loaded') return
                    doShow()
                },
                onError: (err) => {
                    console.warn('[TossAd] Rewarded on-demand load failed:', err)
                    finish(false)
                },
            })
        })
    },
}
