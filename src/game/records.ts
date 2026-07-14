import { STORAGE_PREFIX } from '../appConfig'

const STORAGE_KEY = `${STORAGE_PREFIX}-records`
const PLAY_COUNT_KEY = `${STORAGE_PREFIX}-play-count`
const MAX_RECORDS = 10

export interface GameRecord {
    score: number
    phase: number
    date: number // timestamp
}

export interface SaveResult {
    rank: number | null // 1-based rank, null if didn't make the board
    isNewBest: boolean
    records: GameRecord[]
}

function loadRecords(): GameRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
    } catch {
        return []
    }
}

function saveRecords(records: GameRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function getRecords(): GameRecord[] {
    return loadRecords()
}

export function getBestScore(): number {
    const records = loadRecords()
    return records.length > 0 ? records[0].score : 0
}

/**
 * Returns a snapshot of record scores for live rank tracking during gameplay.
 * Just the score values, sorted descending.
 */
export function getScoreSnapshot(): number[] {
    return loadRecords().map(r => r.score)
}

/**
 * Given a score and a pre-loaded snapshot, returns 1-based rank.
 * Returns snapshot.length + 1 if below all records.
 */
export function getRankForScore(score: number, snapshot: number[]): number {
    for (let i = 0; i < snapshot.length; i++) {
        if (score >= snapshot[i]) return i + 1
    }
    return snapshot.length + 1
}

/** Get total play count (persisted across sessions) */
export function getPlayCount(): number {
    try {
        return parseInt(localStorage.getItem(PLAY_COUNT_KEY) ?? '0', 10) || 0
    } catch {
        return 0
    }
}

/** Increment and persist play count. Returns the new count. */
export function incrementPlayCount(): number {
    const count = getPlayCount() + 1
    try {
        localStorage.setItem(PLAY_COUNT_KEY, String(count))
    } catch { /* quota exceeded — non-critical */ }
    return count
}

export function submitScore(score: number, phase: number): SaveResult {
    const records = loadRecords()
    const wasEmpty = records.length === 0
    const prevBest = wasEmpty ? 0 : records[0].score

    const entry: GameRecord = { score, phase, date: Date.now() }

    // Insert in sorted position (descending by score)
    let rank: number | null = null
    let inserted = false
    for (let i = 0; i < records.length; i++) {
        if (score >= records[i].score) {
            records.splice(i, 0, entry)
            rank = i + 1
            inserted = true
            break
        }
    }

    if (!inserted && records.length < MAX_RECORDS) {
        records.push(entry)
        rank = records.length
    }

    // Trim to max
    if (records.length > MAX_RECORDS) {
        records.length = MAX_RECORDS
    }

    // If we inserted but got trimmed out
    if (rank !== null && rank > MAX_RECORDS) {
        rank = null
    }

    saveRecords(records)

    return {
        rank,
        isNewBest: score > prevBest || (wasEmpty && score > 0),
        records,
    }
}
