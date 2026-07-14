import { useEffect, useRef } from 'react'
import { bgm } from '../audio/BGMManager'
import { sfx } from '../audio/SFXManager'
import { type TrackId } from '../audio/bgmConfig'

type Screen = 'title' | 'game' | 'ranking'

/** null → keep whatever track is already playing. Extend when adding screens. */
const SCREEN_TRACK: Record<Screen, TrackId | null> = {
    'title': 'title',
    'game': 'game',
    'ranking': null,
}

/**
 * Switch BGM track based on current screen.
 * Registers a one-time pointerdown listener to unlock AudioContext.
 */
export function useBGM(screen: Screen): void {
    const unlockRef = useRef(false)

    // Autoplay unlock on first user gesture
    useEffect(() => {
        if (unlockRef.current) return

        const handleGesture = async () => {
            if (unlockRef.current) return
            unlockRef.current = true
            await bgm.unlock()
            sfx.init()

            const track = SCREEN_TRACK[screen]
            if (track) bgm.play(track)

            document.removeEventListener('pointerdown', handleGesture, true)
        }

        document.addEventListener('pointerdown', handleGesture, true)
        return () => document.removeEventListener('pointerdown', handleGesture, true)
    }, [screen])

    // Switch track on screen change (after unlock)
    useEffect(() => {
        if (!unlockRef.current) return
        const track = SCREEN_TRACK[screen]
        if (track) bgm.play(track)
    }, [screen])
}

/**
 * Duck/unduck BGM when game is paused.
 */
export function useBGMDuck(paused: boolean): void {
    useEffect(() => {
        if (paused) {
            bgm.duck()
        } else {
            bgm.unduck()
        }
    }, [paused])
}
