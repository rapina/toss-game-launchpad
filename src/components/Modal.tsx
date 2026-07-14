import { useTranslation } from 'react-i18next'

interface Props {
    title?: string
    message: string
    onClose: () => void
}

export default function Modal({ title, message, onClose }: Props) {
    const { t } = useTranslation()
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                {title && <div className="modal-title">{title}</div>}
                <p className="modal-message">{message}</p>
                <button className="btn btn-primary modal-btn" onClick={onClose}>
                    {t('common.ok')}
                </button>
            </div>
        </div>
    )
}
