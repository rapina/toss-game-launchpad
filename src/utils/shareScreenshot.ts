import html2canvas from 'html2canvas'

/**
 * Capture a DOM element as a PNG and share or download.
 * Watermark is rendered as HTML inside the capture area (see RankingScreen).
 */
export async function shareScreenshot(element: HTMLElement): Promise<void> {
    const canvas = await html2canvas(element, {
        backgroundColor: '#0c1824',
        scale: 2,
        useCORS: true,
        logging: false,
    })

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
    })

    const file = new File([blob], 'currency-war-score.png', { type: 'image/png' })

    // 4. Share or download
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: '화폐전쟁',
                text: '내 자산을 확인해보세요!',
            })
            return
        } catch (e) {
            if ((e as DOMException).name === 'AbortError') return
        }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'currency-war-score.png'
    a.click()
    URL.revokeObjectURL(url)
}
