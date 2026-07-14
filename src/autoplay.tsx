import { createRoot } from 'react-dom/client'

/**
 * Headless-verification entry: mounts GameScreen alone with a seeded RNG so a
 * run is reproducible. Driven by scripts/smoke.mjs (or open manually at
 * /autoplay.html?seed=1). The final GameResult lands in globalThis.__gameResult
 * and live runtime state in globalThis.__gameState.
 */
const qs = new URLSearchParams(window.location.search)
const { setLogicRandomSeed } = await import('./game/logicRng')
setLogicRandomSeed(qs.get('seed'))

await import('./index.css')
const { default: GameScreen } = await import('./components/GameScreen')

createRoot(document.getElementById('root')!).render(
    <GameScreen
        onGameOver={(result) => {
            ;(globalThis as unknown as Record<string, unknown>).__gameResult = result
        }}
        onExit={() => { window.location.reload() }}
    />,
)
