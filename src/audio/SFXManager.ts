/**
 * Synthesized SFX manager — Web Audio API oscillator-based.
 *
 * No audio files needed. Each sound is generated on-the-fly:
 * - Merge pop: snappy ascending "ding" that pitches up with wobble level
 * - Collision bump: soft short thud on significant impacts
 */

import { loadAudioSettings } from './audioSettings'

class SFXManager {
    private ctx: AudioContext | null = null
    private masterGain: GainNode | null = null
    private _volume = 1
    private _muted = false

    init(): void {
        if (this.ctx) return
        try {
            this.ctx = new AudioContext()
            this.masterGain = this.ctx.createGain()
            // Restore saved settings
            const saved = loadAudioSettings()
            this._volume = saved.sfxVolume
            this._muted = saved.sfxMuted
            this.masterGain.gain.value = this._muted ? 0 : this._volume
            this.masterGain.connect(this.ctx.destination)
        } catch {
            // Web Audio unavailable
        }
    }

    setVolume(v: number): void {
        this._volume = Math.max(0, Math.min(1, v))
        if (this.masterGain) this.masterGain.gain.value = this._muted ? 0 : this._volume
    }

    getVolume(): number { return this._volume }

    setMuted(muted: boolean): void {
        this._muted = muted
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this._volume
    }

    isMuted(): boolean { return this._muted }

    /**
     * Metallic coin merge sound. Higher level → deeper, richer ring.
     *
     * Layered inharmonic partials simulate a struck metal coin:
     * fundamental + 2.76x + 5.4x (non-integer ratios = metallic timbre).
     */
    playMergePop(level: number): void {
        if (!this.ctx || !this.masterGain) return
        try {
            const t = this.ctx.currentTime
            const baseFreq = 800 + level * 60
            const dur = 0.25 + level * 0.02

            // Partials with inharmonic ratios — gives metallic bell character
            const partials = [
                { ratio: 1,    vol: 0.22, decay: dur },
                { ratio: 2.76, vol: 0.10, decay: dur * 0.6 },
                { ratio: 5.4,  vol: 0.05, decay: dur * 0.35 },
            ]

            for (const p of partials) {
                const osc = this.ctx.createOscillator()
                const gain = this.ctx.createGain()
                osc.type = 'sine'
                osc.frequency.setValueAtTime(baseFreq * p.ratio, t)
                // Slight downward pitch bend for natural feel
                osc.frequency.exponentialRampToValueAtTime(baseFreq * p.ratio * 0.98, t + p.decay)
                gain.gain.setValueAtTime(p.vol, t)
                gain.gain.exponentialRampToValueAtTime(0.001, t + p.decay)
                osc.connect(gain)
                gain.connect(this.masterGain!)
                osc.start(t)
                osc.stop(t + p.decay + 0.01)
                osc.onended = () => { osc.disconnect(); gain.disconnect() }
            }

            // Noise burst for the initial "click" attack
            this.playNoiseClick(t, 0.08, 0.06)
        } catch {
            // silent fallback
        }
    }

    /**
     * Coin collision clink — short metallic tap.
     *
     * High-frequency sine burst with noise transient,
     * simulating two metal coins striking each other.
     */
    playCollisionBump(): void {
        if (!this.ctx || !this.masterGain) return
        try {
            const t = this.ctx.currentTime

            // High metallic ping — very short
            const osc1 = this.ctx.createOscillator()
            const gain1 = this.ctx.createGain()
            osc1.type = 'sine'
            osc1.frequency.setValueAtTime(2800 + Math.random() * 600, t)
            osc1.frequency.exponentialRampToValueAtTime(1800, t + 0.06)
            gain1.gain.setValueAtTime(0.10, t)
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
            osc1.connect(gain1)
            gain1.connect(this.masterGain)
            osc1.start(t)
            osc1.stop(t + 0.08)

            // Secondary partial for metallic color
            const osc2 = this.ctx.createOscillator()
            const gain2 = this.ctx.createGain()
            osc2.type = 'sine'
            osc2.frequency.setValueAtTime(4200 + Math.random() * 400, t)
            gain2.gain.setValueAtTime(0.04, t)
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
            osc2.connect(gain2)
            gain2.connect(this.masterGain)
            osc2.start(t)
            osc2.stop(t + 0.05)

            osc1.onended = () => { osc1.disconnect(); gain1.disconnect() }
            osc2.onended = () => { osc2.disconnect(); gain2.disconnect() }

            // Short noise click for the impact transient
            this.playNoiseClick(t, 0.03, 0.04)
        } catch {
            // silent fallback
        }
    }

    /**
     * Short burst of filtered noise — simulates the "click" transient
     * when metal strikes metal.
     */
    private playNoiseClick(startTime: number, vol: number, dur: number): void {
        if (!this.ctx || !this.masterGain) return

        const bufferSize = Math.ceil(this.ctx.sampleRate * dur)
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) // decaying noise
        }

        const src = this.ctx.createBufferSource()
        src.buffer = buffer

        // Highpass filter to keep only the metallic "tick"
        const hp = this.ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 3000

        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(vol, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur)

        src.connect(hp)
        hp.connect(gain)
        gain.connect(this.masterGain)
        src.start(startTime)
        src.stop(startTime + dur + 0.01)
        src.onended = () => { src.disconnect(); hp.disconnect(); gain.disconnect() }
    }
}

export const sfx = new SFXManager()
