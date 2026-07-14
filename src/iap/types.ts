/** Canonical IAP product identifiers used throughout the game.
 *  Extend this union per game and add the matching SKUs in constants.ts. */
export type IapProductId = 'remove_ads'

/** Shape surfaced to the shop UI — merges platform catalog data with local entitlement state. */
export interface IapProduct {
    id: IapProductId
    sku: string
    displayName: string
    description: string
    displayAmount: string
    iconUrl: string | null
    owned: boolean
}

export interface IapPurchaseResult {
    ok: boolean
    /** Human-readable error message when ok=false. Already localized (ko). */
    error?: string
    /** Platform error code if available (USER_CANCELED / NETWORK_ERROR / ...). */
    code?: string
}

export interface IapAdapter {
    /** Whether this platform has an IAP backend attached. Shops hide themselves on `false`. */
    readonly available: boolean

    /** Run once at app start. Performs pending-order recovery. */
    initialize(): Promise<void>

    /** Fetch the product catalog, merged with local entitlement flags. */
    listProducts(): Promise<IapProduct[]>

    /** Launch the purchase flow for a product id. */
    purchase(id: IapProductId): Promise<IapPurchaseResult>

    /** Reconcile local entitlements with the platform's completed-order history. */
    restore(): Promise<void>
}
