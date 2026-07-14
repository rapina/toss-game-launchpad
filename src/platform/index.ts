import type { PlatformAdapter } from './types'

let _adapter: PlatformAdapter | null = null

export async function getPlatformAdapter(): Promise<PlatformAdapter> {
    if (_adapter) return _adapter

    if (__PLATFORM__ === 'toss') {
        const { tossAdapter } = await import('./tossAdapter')
        _adapter = tossAdapter
    } else {
        const { defaultAdapter } = await import('./defaultAdapter')
        _adapter = defaultAdapter
    }

    return _adapter
}

export type { PlatformAdapter } from './types'
