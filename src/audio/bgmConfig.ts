export type TrackId = 'title' | 'game'

export interface TrackConfig {
    src: string
    volume: number
}

/** Add tracks per game — drop the mp3 in public/audio/ and register it here. */
export const TRACKS: Record<TrackId, TrackConfig> = {
    title: { src: '/audio/title.mp3', volume: 0.25 },
    game: { src: '/audio/game.mp3', volume: 0.3 },
}

export const CROSSFADE_MS = 1000
export const DUCK_MS = 300
export const DUCK_VOLUME = 0.15
