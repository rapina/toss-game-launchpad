import { STORAGE_PREFIX } from '../appConfig'

const STORAGE_KEY = `${STORAGE_PREFIX}-audio-settings`

export interface AudioSettings {
    bgmVolume: number   // 0–1
    sfxVolume: number   // 0–1
    bgmMuted: boolean
    sfxMuted: boolean
}

const DEFAULTS: AudioSettings = {
    bgmVolume: 1,
    sfxVolume: 1,
    bgmMuted: false,
    sfxMuted: false,
}

export function loadAudioSettings(): AudioSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { ...DEFAULTS }
        const parsed = JSON.parse(raw)
        return {
            bgmVolume: typeof parsed.bgmVolume === 'number' ? parsed.bgmVolume : DEFAULTS.bgmVolume,
            sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULTS.sfxVolume,
            bgmMuted: typeof parsed.bgmMuted === 'boolean' ? parsed.bgmMuted : DEFAULTS.bgmMuted,
            sfxMuted: typeof parsed.sfxMuted === 'boolean' ? parsed.sfxMuted : DEFAULTS.sfxMuted,
        }
    } catch {
        return { ...DEFAULTS }
    }
}

export function saveAudioSettings(settings: AudioSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
        // storage full or unavailable
    }
}
