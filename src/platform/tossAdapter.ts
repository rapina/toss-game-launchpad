import type { PlatformAdapter } from './types'
import { submitScore as localSubmitScore } from '../game/records'
import {
    getUserKeyForGame,
    submitGameCenterLeaderBoardScore,
    openGameCenterLeaderboard,
} from '@apps-in-toss/web-framework'

export const tossAdapter: PlatformAdapter = {
    hasNativeLeaderboard: true,

    async getUserId() {
        try {
            const result = await getUserKeyForGame()
            if (!result || result === 'INVALID_CATEGORY' || result === 'ERROR') {
                return null
            }
            return result.hash
        } catch {
            return null
        }
    },

    async submitScore(score: number, phase: number) {
        // Save locally as well for in-game reference
        const localResult = localSubmitScore(score, phase)

        // Submit to Toss game center leaderboard
        try {
            await submitGameCenterLeaderBoardScore({ score: String(score) })
        } catch (e) {
            console.warn('[Toss] Failed to submit leaderboard score:', e)
        }

        return localResult
    },

    async openLeaderboard() {
        await openGameCenterLeaderboard()
        return false
    },

    async requestReview() {
        try {
            const mod = await import('@apps-in-toss/web-framework') as any
            if (typeof mod.requestReview === 'function') {
                await mod.requestReview()
            }
        } catch (e) {
            console.warn('[Toss] requestReview failed:', e)
        }
    },
}
