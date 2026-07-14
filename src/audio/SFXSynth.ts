/**
 * Procedural SFX via Web Audio API — no assets required.
 * Short synthesized tones for game events.
 */

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
    if (ctx) return ctx
    try {
        const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext
        ctx = new AC()
        return ctx
    } catch { return null }
}

/** Resume context (must be called after user gesture on some browsers). */
export function unlockAudio() {
    const c = getCtx()
    if (c && c.state === 'suspended') void c.resume()
}

function blip(freq: number, duration = 0.08, type: OscillatorType = 'sine', volume = 0.15, attack = 0.005): void {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    const now = c.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(c.destination)
    osc.start(now)
    osc.stop(now + duration + 0.01)
}

/** Quick coin click — chip placement / button feedback. */
export function sfxClick() {
    blip(880, 0.04, 'square', 0.08)
}

/** Chip drop thunk — subtle low tap. */
export function sfxChip() {
    blip(260, 0.09, 'triangle', 0.12)
    setTimeout(() => blip(180, 0.06, 'triangle', 0.08), 20)
}

/** Chip impact on a portrait — heavier low thump + metallic snap. */
export function sfxHit() {
    const c = getCtx()
    if (!c) return
    // Low body thump (fast pitch drop)
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    const now = c.currentTime
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.32, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain).connect(c.destination)
    osc.start(now)
    osc.stop(now + 0.2)
    // Short noise snap on top
    const bufSize = Math.floor(c.sampleRate * 0.05)
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3) * 0.35
    }
    const src = c.createBufferSource()
    const flt = c.createBiquadFilter()
    flt.type = 'highpass'
    flt.frequency.value = 1500
    src.buffer = buf
    src.connect(flt).connect(c.destination)
    src.start(now)
}

/** Hand win — rising 3-note cheerful chime. */
export function sfxWin() {
    blip(523, 0.10, 'triangle', 0.14)     // C
    setTimeout(() => blip(659, 0.10, 'triangle', 0.14), 90)   // E
    setTimeout(() => blip(784, 0.20, 'triangle', 0.16), 180)  // G
}

/** Hand lose — descending muted thud. */
export function sfxLose() {
    blip(260, 0.14, 'sawtooth', 0.12)
    setTimeout(() => blip(196, 0.20, 'sawtooth', 0.10), 120)
}

/** Player defeat — bass slam + descending ominous drone. For match-over, not per-hand. */
export function sfxPlayerDefeat() {
    const c = getCtx()
    if (!c) return
    const now = c.currentTime
    // Deep sub-bass thud
    const osc1 = c.createOscillator()
    const g1 = c.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(90, now)
    osc1.frequency.exponentialRampToValueAtTime(35, now + 0.8)
    g1.gain.setValueAtTime(0.0, now)
    g1.gain.linearRampToValueAtTime(0.35, now + 0.02)
    g1.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
    osc1.connect(g1).connect(c.destination)
    osc1.start(now); osc1.stop(now + 1.3)
    // Descending ominous drone (minor third)
    const osc2 = c.createOscillator()
    const g2 = c.createGain()
    const flt = c.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = 900
    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(220, now + 0.1)
    osc2.frequency.exponentialRampToValueAtTime(110, now + 1.5)
    g2.gain.setValueAtTime(0.0, now + 0.1)
    g2.gain.linearRampToValueAtTime(0.10, now + 0.25)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 1.8)
    osc2.connect(flt).connect(g2).connect(c.destination)
    osc2.start(now + 0.1); osc2.stop(now + 1.9)
    // Noise sting at the slam (short rasp)
    const bufSize = Math.floor(c.sampleRate * 0.15)
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
        const env = Math.pow(1 - i / bufSize, 3)
        data[i] = (Math.random() * 2 - 1) * env * 0.25
    }
    const nsrc = c.createBufferSource()
    const nflt = c.createBiquadFilter()
    nflt.type = 'lowpass'
    nflt.frequency.value = 1200
    nsrc.buffer = buf
    nsrc.connect(nflt).connect(c.destination)
    nsrc.start(now)
}

/** NPC defeat — dramatic metallic slash + rising fanfare. */
export function sfxDefeat() {
    const c = getCtx()
    if (!c) return
    // Slash: noise burst
    const bufSize = Math.floor(c.sampleRate * 0.25)
    const buf = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
        const env = Math.pow(1 - i / bufSize, 2)
        data[i] = (Math.random() * 2 - 1) * env * 0.4
    }
    const src = c.createBufferSource()
    const flt = c.createBiquadFilter()
    flt.type = 'bandpass'
    flt.frequency.value = 2500
    flt.Q.value = 2
    src.buffer = buf
    src.connect(flt).connect(c.destination)
    src.start()
    // Fanfare: 4 rising notes
    setTimeout(() => blip(440, 0.12, 'triangle', 0.15), 150)
    setTimeout(() => blip(587, 0.12, 'triangle', 0.15), 260)
    setTimeout(() => blip(698, 0.12, 'triangle', 0.15), 370)
    setTimeout(() => blip(880, 0.30, 'triangle', 0.18), 480)
}

/** Card flip / deal. */
export function sfxCard() {
    blip(440, 0.03, 'sine', 0.06)
    setTimeout(() => blip(660, 0.03, 'sine', 0.05), 15)
}

/** Quick haptic tap (mobile). Params: pulses in ms. */
export function haptic(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern) } catch { /* ignore */ }
}
