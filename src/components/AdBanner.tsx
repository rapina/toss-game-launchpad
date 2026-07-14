import { useEffect, useRef } from 'react'
import type { AdAdapter } from '../ads'
import { AD_BANNER_HEIGHT } from '../ads/constants'
import { useEntitlement } from '../iap'

interface Props {
    adapter: AdAdapter | null
}

export default function AdBanner({ adapter }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const adsRemoved = useEntitlement('remove_ads')

    useEffect(() => {
        if (adsRemoved) return
        if (!containerRef.current || !adapter) return
        const cleanup = adapter.attachBanner(containerRef.current)
        return () => { cleanup?.() }
    }, [adapter, adsRemoved])

    if (adsRemoved) return null

    return (
        <div
            ref={containerRef}
            className="ad-banner"
            style={{ width: '100%', height: AD_BANNER_HEIGHT }}
        />
    )
}
