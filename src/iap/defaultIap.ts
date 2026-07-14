import type { IapAdapter, IapProduct, IapPurchaseResult } from './types'

/**
 * Placeholder adapter used outside the Toss environment.
 * Google Play (Capacitor) implementation slots in here later.
 * Until then the shop reports unavailable and renders a "준비 중" empty state.
 */
export const defaultIapAdapter: IapAdapter = {
    available: false,
    async initialize() { /* no-op */ },
    async listProducts(): Promise<IapProduct[]> { return [] },
    async purchase(): Promise<IapPurchaseResult> {
        return { ok: false, error: '이 플랫폼에서는 아직 상점이 열리지 않았어요.' }
    },
    async restore() { /* no-op */ },
}
