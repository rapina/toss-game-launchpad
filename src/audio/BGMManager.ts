import { TRACKS, CROSSFADE_MS, DUCK_MS, DUCK_VOLUME, type TrackId } from './bgmConfig'
import { loadAudioSettings } from './audioSettings'

class BGMManager {
    private ctx: AudioContext | null = null
    private masterGain: GainNode | null = null
    private buffers = new Map<TrackId, AudioBuffer>()
    private sources = new Map<TrackId, AudioBufferSourceNode>()
    private gains = new Map<TrackId, GainNode>()
    private currentTrack: TrackId | null = null
    private unlocked = false
    private isDucked = false
    private _volume = 1
    private _muted = false

    /** Create AudioContext (call from user gesture) */
    init(): void {
        if (this.ctx) return
        this.ctx = new AudioContext()
        this.masterGain = this.ctx.createGain()
        this.masterGain.connect(this.ctx.destination)
        // Restore saved settings
        const saved = loadAudioSettings()
        this._volume = saved.bgmVolume
        this._muted = saved.bgmMuted
        this.masterGain.gain.value = this._muted ? 0 : this._volume
    }

    /** Set master volume (0–1). Applies on top of per-track volumes. */
    setVolume(v: number): void {
        this._volume = Math.max(0, Math.min(1, v))
        if (this.masterGain) {
            this.masterGain.gain.value = this._muted ? 0 : this._volume
        }
    }

    getVolume(): number { return this._volume }

    /** Toggle mute on/off */
    setMuted(muted: boolean): void {
        this._muted = muted
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : this._volume
        }
    }

    isMuted(): boolean { return this._muted }

    /** Resume AudioContext if suspended by autoplay policy */
    async unlock(): Promise<void> {
        if (this.unlocked) return
        if (!this.ctx) this.init()
        if (this.ctx!.state === 'suspended') {
            await this.ctx!.resume()
        }
        this.unlocked = true
    }

    /** Preload a track's audio buffer */
    private async load(id: TrackId): Promise<AudioBuffer | null> {
        if (this.buffers.has(id)) return this.buffers.get(id)!
        if (!this.ctx) return null

        try {
            const res = await fetch(TRACKS[id].src)
            if (!res.ok) return null
            const arrayBuf = await res.arrayBuffer()
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf)
            this.buffers.set(id, audioBuf)
            return audioBuf
        } catch {
            console.warn(`[BGM] Failed to load ${id}`)
            return null
        }
    }

    /** Play a track, crossfading from current */
    async play(id: TrackId): Promise<void> {
        if (!this.ctx || !this.masterGain) return
        if (id === this.currentTrack) return

        const prev = this.currentTrack
        this.currentTrack = id

        // Fade out previous
        if (prev) {
            const prevGain = this.gains.get(prev)
            const prevSource = this.sources.get(prev)
            if (prevGain && prevSource) {
                const now = this.ctx.currentTime
                prevGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_MS / 1000)
                // Schedule cleanup — guard against a newer source for the same track id
                // having replaced this one in the map (which would happen if the user
                // switches tracks and comes back within the crossfade window).
                setTimeout(() => {
                    try { prevSource.stop() } catch { /* ignore */ }
                    if (this.sources.get(prev) === prevSource) this.sources.delete(prev)
                    if (this.gains.get(prev) === prevGain) this.gains.delete(prev)
                }, CROSSFADE_MS + 50)
            }
        }

        // Load and start new track
        const buf = await this.load(id)
        if (!buf) return
        // If track changed while loading, bail
        if (this.currentTrack !== id) return

        // If an older source for this same id is still fading out from a prior
        // switch, kill it now so we don't double-play the same track.
        const stale = this.sources.get(id)
        if (stale) {
            try { stale.stop() } catch { /* ignore */ }
            this.sources.delete(id)
            this.gains.delete(id)
        }

        const source = this.ctx.createBufferSource()
        source.buffer = buf
        source.loop = true

        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(0, this.ctx.currentTime)

        const targetVol = this.isDucked ? DUCK_VOLUME : TRACKS[id].volume
        gain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + CROSSFADE_MS / 1000)

        source.connect(gain)
        gain.connect(this.masterGain)
        source.start()

        this.sources.set(id, source)
        this.gains.set(id, gain)
    }

    /** Lower volume (e.g. game paused) */
    duck(): void {
        if (!this.ctx || this.isDucked) return
        this.isDucked = true
        const gain = this.currentTrack ? this.gains.get(this.currentTrack) : null
        if (gain) {
            gain.gain.linearRampToValueAtTime(DUCK_VOLUME, this.ctx.currentTime + DUCK_MS / 1000)
        }
    }

    /** Restore volume */
    unduck(): void {
        if (!this.ctx || !this.isDucked) return
        this.isDucked = false
        const gain = this.currentTrack ? this.gains.get(this.currentTrack) : null
        if (gain && this.currentTrack) {
            gain.gain.linearRampToValueAtTime(
                TRACKS[this.currentTrack].volume,
                this.ctx.currentTime + DUCK_MS / 1000
            )
        }
    }

    /** Suspend audio (app goes to background) */
    suspend(): void {
        this.ctx?.suspend()
    }

    /** Resume audio (app comes to foreground) */
    resume(): void {
        this.ctx?.resume()
    }
}

export const bgm = new BGMManager()
