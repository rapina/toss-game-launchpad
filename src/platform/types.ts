import type { SaveResult } from '../game/records'

export interface PlatformAdapter {
    /** Get a stable user identifier (null if unavailable) */
    getUserId(): Promise<string | null>

    /** Submit score after game over. Returns rank info. */
    submitScore(score: number, phase: number): Promise<SaveResult>

    /** Open the leaderboard UI. Returns false if handled natively (no need to show in-app). */
    openLeaderboard(): Promise<boolean>

    /** Whether the platform has a native leaderboard (skip in-app leaderboard screen) */
    hasNativeLeaderboard: boolean

    /** Request app review (no-op on platforms without native review) */
    requestReview(): Promise<void>
}
