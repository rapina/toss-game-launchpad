import type { IapProductId } from './types'

/**
 * Platform SKU mapping.
 *
 * Toss: register each product as NON_CONSUMABLE in the Apps-in-Toss console,
 * then paste the issued SKUs here.
 *
 * Google Play: fill in when the Google Play adapter is implemented.
 */
export const TOSS_SKU: Record<IapProductId, string> = {
    remove_ads: 'TODO_TOSS_REMOVE_ADS_SKU',
}

export const GPLAY_SKU: Record<IapProductId, string> = {
    remove_ads: 'TODO_GPLAY_REMOVE_ADS_SKU',
}

/** Product presentation fallbacks used when the platform catalog lookup fails. */
export const PRODUCT_FALLBACK: Record<IapProductId, { displayName: string; description: string }> = {
    remove_ads: {
        displayName: 'Remove Ads',
        description: 'Permanently removes the bottom banner ad.',
    },
}

/** Ordered list of SKUs shown in the shop UI. */
export const IAP_PRODUCT_ORDER: IapProductId[] = ['remove_ads']
