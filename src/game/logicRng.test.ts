import { describe, it, expect } from 'vitest'
import { setLogicRandomSeed, logicRandom, getLogicRandomCallCount } from './logicRng'

function drawSequence(n: number): number[] {
    return Array.from({ length: n }, () => logicRandom())
}

describe('logicRandom', () => {
    it('same seed reproduces the same sequence (smoke-test contract)', () => {
        setLogicRandomSeed('42')
        const first = drawSequence(10)
        setLogicRandomSeed('42')
        const second = drawSequence(10)
        expect(second).toEqual(first)
    })

    it('different seeds produce different sequences', () => {
        setLogicRandomSeed('a')
        const a = drawSequence(10)
        setLogicRandomSeed('b')
        const b = drawSequence(10)
        expect(b).not.toEqual(a)
    })

    it('numeric and string forms of the same seed are equivalent', () => {
        setLogicRandomSeed(7)
        const numeric = drawSequence(5)
        setLogicRandomSeed('7')
        const stringy = drawSequence(5)
        expect(stringy).toEqual(numeric)
    })

    it('values stay within [0, 1)', () => {
        setLogicRandomSeed('range')
        for (const v of drawSequence(1000)) {
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })

    it('tracks call count and resets it on reseed', () => {
        setLogicRandomSeed('count')
        drawSequence(3)
        expect(getLogicRandomCallCount()).toBe(3)
        setLogicRandomSeed('count')
        expect(getLogicRandomCallCount()).toBe(0)
    })
})
