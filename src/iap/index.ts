import type { IapAdapter } from './types'

let _adapter: IapAdapter | null = null

export async function getIapAdapter(): Promise<IapAdapter> {
    if (_adapter) return _adapter

    if (__PLATFORM__ === 'toss') {
        const { tossIapAdapter } = await import('./tossIap')
        _adapter = tossIapAdapter
    } else {
        const { defaultIapAdapter } = await import('./defaultIap')
        _adapter = defaultIapAdapter
    }

    return _adapter
}

export type { IapAdapter, IapProduct, IapProductId, IapPurchaseResult } from './types'
export { hasEntitlement, subscribeEntitlements } from './entitlements'
export { useEntitlement } from './useEntitlement'
