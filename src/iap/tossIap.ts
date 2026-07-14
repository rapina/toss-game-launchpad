import { IAP } from '@apps-in-toss/web-framework'
import type { IapAdapter, IapProduct, IapProductId, IapPurchaseResult } from './types'
import { IAP_PRODUCT_ORDER, PRODUCT_FALLBACK, TOSS_SKU } from './constants'
import { grantEntitlement, hasEntitlement, syncEntitlements } from './entitlements'

// Reverse map: sku → product id. Rebuilt on demand rather than cached so edits
// to constants.ts during hot reload are picked up.
function skuToId(): Record<string, IapProductId> {
    const out: Record<string, IapProductId> = {}
    for (const id of IAP_PRODUCT_ORDER) {
        const sku = TOSS_SKU[id]
        if (sku && !sku.startsWith('TODO_')) out[sku] = id
    }
    return out
}

function idToSku(id: IapProductId): string | null {
    const sku = TOSS_SKU[id]
    if (!sku || sku.startsWith('TODO_')) return null
    return sku
}

/**
 * Drain the "paid but not granted" queue on startup.
 * Any SKU we recognise → grant the entitlement + mark the order complete.
 * Unrecognised SKUs are left alone so a future build that knows about them
 * can still finish the grant.
 */
async function recoverPendingOrders() {
    try {
        const res = await IAP.getPendingOrders()
        const orders = (res as any)?.orders ?? []
        const map = skuToId()
        for (const order of orders) {
            const productId = map[order.sku]
            if (!productId) continue
            grantEntitlement(productId)
            try {
                await IAP.completeProductGrant({ params: { orderId: order.orderId } })
                console.log('[TossIAP] Recovered pending order:', order.orderId, productId)
            } catch (e) {
                console.warn('[TossIAP] completeProductGrant failed for', order.orderId, e)
            }
        }
    } catch (e) {
        console.warn('[TossIAP] getPendingOrders failed:', e)
    }
}

async function reconcileCompletedOrders() {
    try {
        const map = skuToId()
        const seen: Partial<Record<IapProductId, boolean>> = {}
        // initialize each known product to false so refunded-only users get revoked
        for (const id of IAP_PRODUCT_ORDER) seen[id] = false

        // The published type only exposes a 0-arg overload, but the runtime
        // accepts { key } for pagination. We call `any` so both builds compile
        // and we can walk the cursor.
        const fetch = IAP.getCompletedOrRefundedOrders as unknown as
            (arg?: { key?: string | null }) => Promise<{
                hasNext: boolean
                nextKey?: string | null
                orders: { orderId: string; sku: string; status: 'COMPLETED' | 'REFUNDED'; date: string }[]
            } | undefined>

        let key: string | null | undefined = null
        while (true) {
            const res = await fetch(key != null ? { key } : undefined)
            if (!res) break
            for (const order of res.orders ?? []) {
                const productId = map[order.sku]
                if (!productId) continue
                if (order.status === 'COMPLETED') seen[productId] = true
                if (order.status === 'REFUNDED' && seen[productId] !== true) seen[productId] = false
            }
            if (!res.hasNext || !res.nextKey) break
            key = res.nextKey
        }
        syncEntitlements(seen)
    } catch (e) {
        console.warn('[TossIAP] getCompletedOrRefundedOrders failed:', e)
    }
}

async function listProducts(): Promise<IapProduct[]> {
    const map = skuToId()
    let catalog: Record<string, { displayName: string; description: string; displayAmount: string; iconUrl: string | null }> = {}
    try {
        const res: any = await IAP.getProductItemList()
        const products = res?.products ?? []
        for (const p of products) {
            catalog[p.sku] = {
                displayName: p.displayName,
                description: p.description,
                displayAmount: p.displayAmount,
                iconUrl: p.iconUrl ?? null,
            }
        }
    } catch (e) {
        console.warn('[TossIAP] getProductItemList failed:', e)
    }

    return IAP_PRODUCT_ORDER.map(id => {
        const sku = TOSS_SKU[id]
        const cat = catalog[sku]
        const fallback = PRODUCT_FALLBACK[id]
        return {
            id,
            sku,
            displayName: cat?.displayName ?? fallback.displayName,
            description: cat?.description ?? fallback.description,
            displayAmount: cat?.displayAmount ?? '',
            iconUrl: cat?.iconUrl ?? null,
            owned: hasEntitlement(id),
        }
    }).filter(p => !!map[p.sku])
}

function purchase(id: IapProductId): Promise<IapPurchaseResult> {
    const sku = idToSku(id)
    if (!sku) {
        return Promise.resolve({ ok: false, error: '상품이 등록되어 있지 않아요. 잠시 후 다시 시도해 주세요.' })
    }
    if (hasEntitlement(id)) {
        return Promise.resolve({ ok: true })
    }

    return new Promise<IapPurchaseResult>((resolve) => {
        let settled = false
        const finish = (r: IapPurchaseResult) => {
            if (settled) return
            settled = true
            try { cleanup?.() } catch { /* ignore */ }
            resolve(r)
        }

        const cleanup = IAP.createOneTimePurchaseOrder({
            options: {
                sku,
                processProductGrant: ({ orderId }) => {
                    console.log('[TossIAP] grant', id, 'order', orderId)
                    grantEntitlement(id)
                    return true
                },
            },
            onEvent: (event) => {
                if (event.type === 'success') finish({ ok: true })
            },
            onError: (error: any) => {
                const code = error?.code as string | undefined
                const msg = mapTossErrorToMessage(code, error)
                // USER_CANCELED is a silent close — still surface via code so UI
                // can suppress the error toast.
                finish({ ok: false, error: msg, code })
            },
        })
    })
}

function mapTossErrorToMessage(code: string | undefined, fallback: unknown): string {
    switch (code) {
        case 'USER_CANCELED': return '결제를 취소했어요.'
        case 'NETWORK_ERROR': return '네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
        case 'PAYMENT_PENDING': return '이전 결제가 아직 승인 중이에요. 잠시 후 다시 시도해 주세요.'
        case 'ITEM_ALREADY_OWNED': return '이미 구매한 상품이에요.'
        case 'INVALID_PRODUCT_ID': return '상품 정보를 불러올 수 없어요.'
        case 'INVALID_USER_ENVIRONMENT': return '현재 기기/계정에서는 이 상품을 구매할 수 없어요.'
        case 'KOREAN_ACCOUNT_ONLY': return 'iOS에서는 한국 계정에서만 구매할 수 있어요.'
        case 'APP_MARKET_VERIFICATION_FAILED':
        case 'TOSS_SERVER_VERIFICATION_FAILED':
            return '결제는 완료되었지만 확인에 실패했어요. 고객센터에 문의해 주세요.'
        case 'PRODUCT_NOT_GRANTED_BY_PARTNER': return '상품 지급에 실패했어요. 잠시 후 다시 시도해 주세요.'
        case 'INTERNAL_ERROR': return '내부 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
        default: {
            const msg = (fallback as any)?.message
            return typeof msg === 'string' ? msg : '결제 중 오류가 발생했어요.'
        }
    }
}

export const tossIapAdapter: IapAdapter = {
    available: true,

    async initialize() {
        await recoverPendingOrders()
        // Reconcile non-consumable entitlements from server history. Runs in the
        // background so app startup isn't gated on it.
        reconcileCompletedOrders().catch(() => { /* best effort */ })
    },

    listProducts,
    purchase,
    restore: reconcileCompletedOrders,
}
