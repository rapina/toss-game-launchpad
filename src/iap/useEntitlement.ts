import { useEffect, useReducer } from 'react'
import type { IapProductId } from './types'
import { hasEntitlement, subscribeEntitlements } from './entitlements'

/** Reactive view on a single entitlement flag. Re-renders whenever it toggles. */
export function useEntitlement(id: IapProductId): boolean {
    const [, force] = useReducer((x: number) => x + 1, 0)
    useEffect(() => subscribeEntitlements(force), [])
    return hasEntitlement(id)
}
