import { useState, useEffect, useCallback } from 'react'
import i18n from './i18n'
import { App as CapApp } from '@capacitor/app'
import MobileFrame from './components/MobileFrame'
import TitleScreen from './screens/TitleScreen'
import GameScreen from './components/GameScreen'
import RankingScreen from './screens/RankingScreen'
import AdBanner from './components/AdBanner'
import Modal from './components/Modal'
import { useBGM } from './hooks/useBGM'
import { bgm } from './audio/BGMManager'
import { getPlatformAdapter, type PlatformAdapter } from './platform'
import { getAdAdapter, type AdAdapter } from './ads'
import { getIapAdapter, type IapAdapter } from './iap'
import { incrementPlayCount } from './game/records'
import type { GameResult } from './game/types'
import { APP_CONFIG } from './appConfig'

type Screen = 'title' | 'game' | 'ranking'

export default function App() {
    const [screen, setScreen] = useState<Screen>('title')
    const [platform, setPlatform] = useState<PlatformAdapter | null>(null)
    const [adAdapter, setAdAdapter] = useState<AdAdapter | null>(null)
    const [, setIapAdapter] = useState<IapAdapter | null>(null)
    const [lastResult, setLastResult] = useState<GameResult | null>(null)
    const [modal, setModal] = useState<{ title?: string; message: string } | null>(null)
    useBGM(screen)

    // Initialize platform + ad + IAP adapters
    useEffect(() => {
        getPlatformAdapter().then(setPlatform)
        getAdAdapter().then(async (adapter) => {
            await adapter.initialize()
            setAdAdapter(adapter)
        })
        getIapAdapter().then(async (adapter) => {
            await adapter.initialize()
            setIapAdapter(adapter)
        })
    }, [])

    // Suspend/resume audio on app background/foreground
    useEffect(() => {
        const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                bgm.resume()
            } else {
                bgm.suspend()
            }
        })
        return () => { listener.then(l => l.remove()) }
    }, [])

    // Preload full-screen ad inventory so game-over surfaces show instantly.
    useEffect(() => {
        if (!adAdapter) return
        adAdapter.preloadInterstitial()
        adAdapter.preloadRewardedAd('default')
    }, [adAdapter])

    const handleGameOver = useCallback((result: GameResult) => {
        setLastResult(result)
        const plays = incrementPlayCount()
        const every = APP_CONFIG.interstitialEveryNGames
        if (adAdapter && every > 0 && plays % every === 0) {
            adAdapter.showInterstitial().finally(() => setScreen('ranking'))
            return
        }
        setScreen('ranking')
    }, [adAdapter])

    const openRanking = useCallback(async () => {
        if (platform?.hasNativeLeaderboard) {
            try {
                await platform.openLeaderboard()
                return
            } catch {
                setModal({ title: i18n.t('error.title'), message: i18n.t('error.leaderboard') })
                return
            }
        }
        setLastResult(null)
        setScreen('ranking')
    }, [platform])

    const renderScreen = () => {
        switch (screen) {
            case 'title':
                return (
                    <TitleScreen
                        onPlay={() => setScreen('game')}
                        onRanking={openRanking}
                    />
                )

            case 'game':
                return (
                    <GameScreen
                        key={`game-${Date.now()}`}
                        onGameOver={handleGameOver}
                        onExit={() => setScreen('title')}
                    />
                )

            case 'ranking':
                return platform ? (
                    <RankingScreen
                        result={lastResult}
                        platform={platform}
                        onRetry={() => setScreen('game')}
                        onMenu={() => setScreen('title')}
                    />
                ) : null
        }
    }

    return (
        <MobileFrame>
            {renderScreen()}
            {modal && (
                <Modal
                    title={modal.title}
                    message={modal.message}
                    onClose={() => setModal(null)}
                />
            )}
            {APP_CONFIG.showAdBanner && <AdBanner adapter={adAdapter} />}
        </MobileFrame>
    )
}
