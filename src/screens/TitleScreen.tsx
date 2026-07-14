import { useTranslation } from 'react-i18next'
import { setLocale, getLocale, SUPPORTED } from '../i18n'

interface Props {
    onPlay(): void
    onRanking(): void
}

export default function TitleScreen({ onPlay, onRanking }: Props) {
    const { t } = useTranslation()

    const cycleLocale = () => {
        const cur = SUPPORTED.indexOf(getLocale())
        setLocale(SUPPORTED[(cur + 1) % SUPPORTED.length])
    }

    return (
        <div className="screen title-screen">
            <div className="title-logo">
                <h1>{t('title.name')}</h1>
                <p className="title-tagline">{t('title.tagline')}</p>
            </div>
            <div className="title-menu">
                <button className="btn btn-primary title-btn" onClick={onPlay}>
                    {t('title.play')}
                </button>
                <button className="btn title-btn" onClick={onRanking}>
                    {t('title.ranking')}
                </button>
                <button className="btn btn-small" onClick={cycleLocale}>
                    {getLocale().toUpperCase()}
                </button>
            </div>
            <div className="title-version">v{__APP_VERSION__}</div>
        </div>
    )
}
