import { useState, useEffect, useRef, useCallback } from 'react'

/** Base interval (ms) per character */
export const BASE_INTERVAL = 35
/** Pause characters and their delay multiplier */
export const PAUSE_CHARS: Record<string, number> = {
    '.': 8,
    ',': 4,
    '!': 8,
    '?': 8,
    '…': 10,
    '~': 4,
    ':': 4,
    ';': 4,
}

export function useTypewriter(text: string) {
    const [charCount, setCharCount] = useState(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const countRef = useRef(0)
    const done = charCount >= text.length

    const scheduleNext = useCallback((idx: number, fullText: string) => {
        if (idx >= fullText.length) return

        const char = fullText[idx]
        const delay = PAUSE_CHARS[char] ? BASE_INTERVAL * PAUSE_CHARS[char] : BASE_INTERVAL

        timerRef.current = setTimeout(() => {
            const next = idx + 1
            countRef.current = next
            setCharCount(next)
            scheduleNext(next, fullText)
        }, delay)
    }, [])

    useEffect(() => {
        setCharCount(0)
        countRef.current = 0
        scheduleNext(0, text)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [text, scheduleNext])

    const skipToEnd = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        setCharCount(text.length)
        countRef.current = text.length
    }, [text])

    return { displayText: text.slice(0, charCount), done, skipToEnd }
}
