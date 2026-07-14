import type { IapProductId } from './types'

import { STORAGE_PREFIX } from '../appConfig'

const STORAGE_KEY = `${STORAGE_PREFIX}.iap.entitlements.v1`

type EntitlementMap = Partial<Record<IapProductId, true>>
type Listener = () => void

const listeners = new Set<Listener>()

function read(): EntitlementMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed as EntitlementMap
        return {}
    } catch {
        return {}
    }
}

function write(map: EntitlementMap) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
        /* quota / private mode — silent */
    }
    listeners.forEach(l => { try { l() } catch { /* ignore */ } })
}

export function hasEntitlement(id: IapProductId): boolean {
    return read()[id] === true
}

export function grantEntitlement(id: IapProductId) {
    const cur = read()
    if (cur[id] === true) return
    cur[id] = true
    write(cur)
}

export function revokeEntitlement(id: IapProductId) {
    const cur = read()
    if (!cur[id]) return
    delete cur[id]
    write(cur)
}

/** Merge a fresh snapshot — used after restore. Only adds/removes the supplied ids. */
export function syncEntitlements(snapshot: Partial<Record<IapProductId, boolean>>) {
    const cur = read()
    let changed = false
    for (const [id, owned] of Object.entries(snapshot) as [IapProductId, boolean][]) {
        if (owned && cur[id] !== true) { cur[id] = true; changed = true }
        if (!owned && cur[id] === true) { delete cur[id]; changed = true }
    }
    if (changed) write(cur)
}

export function subscribeEntitlements(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
}
