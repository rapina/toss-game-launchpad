import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Preload Galmuri so PixiJS Text doesn't cache glyphs with a fallback font
// before the web font is ready.
async function preloadFonts() {
    try {
        await Promise.all([
            document.fonts.load('11px Galmuri11'),
            document.fonts.load('bold 11px Galmuri11'),
            document.fonts.load('bold 14px Galmuri14'),
        ])
    } catch { /* best effort — fall back silently */ }
}

preloadFonts().finally(() => {
    createRoot(document.getElementById('root')!).render(<App />)
})
