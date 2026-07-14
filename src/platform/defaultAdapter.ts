import type { PlatformAdapter } from './types'
import { submitScore as localSubmitScore } from '../game/records'

export const defaultAdapter: PlatformAdapter = {
    hasNativeLeaderboard: false,

    async getUserId() {
        return null
    },

    async submitScore(score: number, phase: number) {
        return localSubmitScore(score, phase)
    },

    async openLeaderboard() {
        // No native leaderboard — return true to show in-app screen
        return true
    },

    async requestReview() {
        // No-op on web/Android
    },
}
