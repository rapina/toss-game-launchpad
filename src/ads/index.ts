import type { AdAdapter } from './types'

let _adapter: AdAdapter | null = null

export async function getAdAdapter(): Promise<AdAdapter> {
    if (_adapter) return _adapter

    if (__PLATFORM__ === 'toss') {
        const { tossAdAdapter } = await import('./tossAd')
        _adapter = tossAdAdapter
    } else {
        // Pure-web (no Capacitor native bridge) → dummy modal adapter.
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) {
            const { webAdAdapter } = await import('./webAd')
            _adapter = webAdAdapter
        } else {
            const { defaultAdAdapter } = await import('./defaultAd')
            _adapter = defaultAdAdapter
        }
    }

    return _adapter
}

export type { AdAdapter } from './types'
