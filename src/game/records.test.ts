import { describe, it, expect } from 'vitest'
import {
    submitScore,
    getRecords,
    getBestScore,
    getRankForScore,
    getScoreSnapshot,
    getPlayCount,
    incrementPlayCount,
} from './records'

describe('submitScore', () => {
    it('first score lands at rank 1 and is a new best', () => {
        const result = submitScore(100, 1)
        expect(result.rank).toBe(1)
        expect(result.isNewBest).toBe(true)
        expect(result.records).toHaveLength(1)
    })

    it('keeps records sorted descending by score', () => {
        submitScore(50, 1)
        submitScore(200, 2)
        submitScore(100, 3)
        expect(getRecords().map(r => r.score)).toEqual([200, 100, 50])
    })

    it('reports rank at the inserted position', () => {
        submitScore(300, 1)
        submitScore(100, 1)
        const result = submitScore(200, 1)
        expect(result.rank).toBe(2)
        expect(result.isNewBest).toBe(false)
    })

    it('trims the board to 10 entries and rejects scores below the cut', () => {
        for (let i = 1; i <= 10; i++) submitScore(i * 100, 1)
        const below = submitScore(1, 1)
        expect(below.rank).toBeNull()
        expect(getRecords()).toHaveLength(10)
        expect(getBestScore()).toBe(1000)
    })

    it('a zero score on an empty board is not a new best', () => {
        const result = submitScore(0, 0)
        expect(result.isNewBest).toBe(false)
    })
})

describe('getRankForScore', () => {
    it('ranks against a snapshot without mutating storage', () => {
        submitScore(300, 1)
        submitScore(100, 1)
        const snapshot = getScoreSnapshot()
        expect(getRankForScore(400, snapshot)).toBe(1)
        expect(getRankForScore(200, snapshot)).toBe(2)
        expect(getRankForScore(50, snapshot)).toBe(3)
        expect(getRecords()).toHaveLength(2)
    })
})

describe('play count', () => {
    it('starts at zero and increments persistently', () => {
        expect(getPlayCount()).toBe(0)
        expect(incrementPlayCount()).toBe(1)
        expect(incrementPlayCount()).toBe(2)
        expect(getPlayCount()).toBe(2)
    })
})
