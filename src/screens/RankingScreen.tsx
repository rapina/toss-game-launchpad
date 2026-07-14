import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlatformAdapter } from '../platform'
import type { GameResult } from '../game/types'
import { getRecords, type GameRecord, type SaveResult } from '../game/records'

interface Props {
    /** null → view-only mode (opened from the title screen, nothing to submit). */
    result: GameResult | null
    platform: PlatformAdapter
    onRetry(): void
    onMenu(): void
}

export default function RankingScreen({ result, platform, onRetry, onMenu }: Props) {
    const { t } = useTranslation()
    const [saved, setSaved] = useState<SaveResult | null>(null)
    const [records, setRecords] = useState<GameRecord[]>(() => getRecords())

    useEffect(() => {
        if (!result) return
        let cancelled = false
        // Local records always update; the Toss adapter also pushes the score
        // to the platform leaderboard.
        platform.submitScore(result.score, result.phase).then((r) => {
            if (cancelled) return
            setSaved(r)
            setRecords(r.records)
        })
        return () => { cancelled = true }
    }, [result, platform])

    return (
        <div className="screen ranking-screen">
            <h2 className="ranking-title">{t('ranking.title')}</h2>

            {result && (
                <div className="ranking-result">
                    <div className="ranking-score">{result.score}</div>
                    {saved?.isNewBest && <div className="ranking-best">{t('ranking.best')}</div>}
                </div>
            )}

            <ol className="ranking-list">
                {records.length === 0 && <li className="ranking-empty">{t('ranking.empty')}</li>}
                {records.map((r, i) => (
                    <li
                        key={`${r.date}-${i}`}
                        className={saved?.rank === i + 1 ? 'ranking-row ranking-row-new' : 'ranking-row'}
                    >
                        <span className="ranking-rank">{i + 1}</span>
                        <span className="ranking-row-score">{r.score}</span>
                        <span className="ranking-date">{new Date(r.date).toLocaleDateString()}</span>
                    </li>
                ))}
            </ol>

            <div className="ranking-actions">
                {result && (
                    <button className="btn btn-primary" onClick={onRetry}>
                        {t('ranking.retry')}
                    </button>
                )}
                <button className="btn" onClick={onMenu}>
                    {t('ranking.menu')}
                </button>
            </div>
        </div>
    )
}
