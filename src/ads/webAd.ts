import type { AdAdapter, RewardedAdPurpose } from './types'
import { AD_BANNER_HEIGHT } from './constants'

/**
 * Pure-web adapter — no SDK, no native bridge. Banner/interstitial are no-ops;
 * `showRewardedAd` pops a styled DOM modal that grants the reward on confirm.
 * Used for local dev / browser previews where neither Toss nor AdMob is loaded.
 */
export const webAdAdapter: AdAdapter = {
    bannerHeight: AD_BANNER_HEIGHT,
    async initialize() { /* no-op */ },
    attachBanner() { return null },
    preloadInterstitial() { /* no-op */ },
    async showInterstitial() { /* no-op */ },
    preloadRewardedAd(_purpose?: RewardedAdPurpose) { /* no-op: dummy modal has no load step */ },
    showRewardedAd(_purpose?: RewardedAdPurpose) {
        return showDummyRewardedModal()
    },
}

function showDummyRewardedModal(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const overlay = document.createElement('div')
        overlay.className = 'dummy-ad-overlay'
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.78)',
            zIndex: '99999', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Galmuri11, sans-serif',
        } as CSSStyleDeclaration)

        const panel = document.createElement('div')
        Object.assign(panel.style, {
            background: '#1a1d24', border: '2px solid #5a6472', borderRadius: '10px',
            padding: '28px 24px', width: 'min(360px, 86vw)',
            color: '#f0e4c8', textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        } as CSSStyleDeclaration)

        const title = document.createElement('div')
        title.textContent = '더미 광고 (웹 빌드)'
        Object.assign(title.style, {
            fontSize: '16px', fontWeight: '700', marginBottom: '10px', color: '#ffd84d',
        } as CSSStyleDeclaration)

        const body = document.createElement('div')
        body.textContent = '실제 빌드에서는 리워드 광고가 재생됩니다. 확인을 누르면 광고를 끝까지 시청한 것으로 처리되어 보상이 지급됩니다.'
        Object.assign(body.style, {
            fontSize: '12px', lineHeight: '1.6', marginBottom: '20px', color: '#d4c4a8',
        } as CSSStyleDeclaration)

        const btnRow = document.createElement('div')
        Object.assign(btnRow.style, {
            display: 'flex', gap: '10px', justifyContent: 'center',
        } as CSSStyleDeclaration)

        const mkBtn = (label: string, primary: boolean, onClick: () => void) => {
            const b = document.createElement('button')
            b.textContent = label
            Object.assign(b.style, {
                padding: '10px 18px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: '700',
                border: primary ? '2px solid #ffd84d' : '2px solid #5a6472',
                background: primary ? '#ffd84d' : 'transparent',
                color: primary ? '#1a1d24' : '#d4c4a8',
            } as CSSStyleDeclaration)
            b.onclick = onClick
            return b
        }

        const cleanup = (result: boolean) => {
            overlay.remove()
            resolve(result)
        }

        btnRow.appendChild(mkBtn('취소', false, () => cleanup(false)))
        btnRow.appendChild(mkBtn('확인 (보상 수령)', true, () => cleanup(true)))

        panel.appendChild(title)
        panel.appendChild(body)
        panel.appendChild(btnRow)
        overlay.appendChild(panel)
        document.body.appendChild(overlay)
    })
}
