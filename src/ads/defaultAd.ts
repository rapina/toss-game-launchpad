import type { AdAdapter, RewardedAdPurpose } from './types'
import { AD_BANNER_HEIGHT } from './constants'

// ─── Google AdMob standard test IDs ───
// https://developers.google.com/admob/android/test-ads
// Safe to ship in pre-release builds — they always return fill, never
// impact real revenue reporting, and never trigger policy violations.
// Swap to production unit IDs before store release.
const BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'          // banner
const INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'    // interstitial
const REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'        // rewarded video

function rewardedUnitFor(purpose: RewardedAdPurpose | undefined): string {
    switch (purpose) {
        // Add a case per game-specific purpose, each with its own unit id.
        case 'default':
        default: return REWARDED_ID
    }
}

let admobModule: any = null
let interstitialLoaded = false

async function getAdMob() {
    if (admobModule) return admobModule
    try {
        const mod = await import('@capacitor-community/admob')
        admobModule = mod.AdMob
        return admobModule
    } catch {
        return null
    }
}

export const defaultAdAdapter: AdAdapter = {
    bannerHeight: AD_BANNER_HEIGHT,

    async initialize() {
        const AdMob = await getAdMob()
        if (!AdMob) return

        try {
            await AdMob.initialize({
                initializeForTesting: false,
            })
            console.log('[AdMob] Initialized')
        } catch (e) {
            console.warn('[AdMob] Init failed:', e)
        }
    },

    attachBanner(container: HTMLElement) {
        // Capacitor AdMob uses native banner overlay, not DOM
        // The container reserves space; native banner renders on top
        ;(async () => {
            const AdMob = await getAdMob()
            if (!AdMob) return

            try {
                const { BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob')
                await AdMob.showBanner({
                    adId: BANNER_ID,
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.BOTTOM_CENTER,
                    isTesting: false,
                })
                console.log('[AdMob] Banner shown')
            } catch (e) {
                console.warn('[AdMob] Banner failed:', e)
            }
        })()

        return () => {
            getAdMob().then(AdMob => AdMob?.hideBanner()).catch(() => {})
        }
    },

    preloadInterstitial() {
        interstitialLoaded = false
        ;(async () => {
            const AdMob = await getAdMob()
            if (!AdMob) return

            try {
                await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: false })
                interstitialLoaded = true
                console.log('[AdMob] Interstitial preloaded')
            } catch (e) {
                console.warn('[AdMob] Interstitial preload failed:', e)
            }
        })()
    },

    async showInterstitial() {
        if (!interstitialLoaded) return
        const AdMob = await getAdMob()
        if (!AdMob) return

        try {
            interstitialLoaded = false
            await AdMob.showInterstitial()
            console.log('[AdMob] Interstitial shown')
        } catch (e) {
            console.warn('[AdMob] Interstitial show failed:', e)
        }
    },

    preloadRewardedAd(purpose?: RewardedAdPurpose) {
        const adId = rewardedUnitFor(purpose)
        ;(async () => {
            const AdMob = await getAdMob()
            if (!AdMob) return
            try {
                await AdMob.prepareRewardVideoAd({ adId, isTesting: false })
                console.log('[AdMob] Rewarded preloaded:', purpose ?? 'default')
            } catch (e) {
                console.warn('[AdMob] Rewarded preload failed:', e)
            }
        })()
    },

    async showRewardedAd(purpose?: RewardedAdPurpose) {
        const AdMob = await getAdMob()
        if (!AdMob) return false
        const adId = rewardedUnitFor(purpose)
        try {
            const mod = await import('@capacitor-community/admob')
            const { RewardAdPluginEvents } = mod
            await AdMob.prepareRewardVideoAd({ adId, isTesting: false })
            let earned = false
            const listener = await AdMob.addListener(
                RewardAdPluginEvents.Rewarded,
                () => { earned = true },
            )
            try {
                await AdMob.showRewardVideoAd()
            } finally {
                try { listener.remove() } catch { /* ignore */ }
            }
            return earned
        } catch (e) {
            console.warn('[AdMob] Rewarded failed:', e)
            return false
        }
    },
}
