let randomCallCount = 0
let randomState = 0
let seeded = false

function xmur3(str: string) {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
        h = (h << 13) | (h >>> 19)
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507)
        h = Math.imul(h ^ (h >>> 13), 3266489909)
        return (h ^= h >>> 16) >>> 0
    }
}

export function setLogicRandomSeed(seed: string | number | null | undefined) {
    if (seed === null || seed === undefined || seed === '') {
        seeded = false
        randomState = 0
        randomCallCount = 0
        return
    }
    const normalized = String(seed)
    seeded = true
    randomState = xmur3(normalized)()
    randomCallCount = 0
}

export function logicRandom(): number {
    randomCallCount += 1
    if (!seeded) return Math.random()
    randomState = (randomState + 0x6d2b79f5) >>> 0
    let t = randomState
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function getLogicRandomCallCount(): number {
    return randomCallCount
}

export function getLogicRandomState(): number {
    return randomState >>> 0
}
