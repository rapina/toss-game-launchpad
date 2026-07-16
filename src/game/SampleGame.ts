import { Application, Graphics, Text } from 'pixi.js'
import { APP_CONFIG } from '../appConfig'
import { logicRandom } from './logicRng'
import type { GameCallbacks, GameRuntime } from './types'

const GAME_SECONDS = 20
const TARGET_RADIUS = 36
const POINTS_PER_HIT = 10

/**
 * Minimal example runtime: tap the circle as many times as possible before
 * the timer runs out. Replace this file with the real game — keep the
 * GameRuntime contract so the shell, autoplay harness and smoke test keep
 * working unchanged.
 *
 * All gameplay randomness goes through logicRandom() so a run is reproducible
 * with ?seed=N (autoplay.html / scripts/smoke.mjs rely on this).
 */
export class SampleGame implements GameRuntime {
    private app: Application | null = null
    private callbacks: GameCallbacks | null = null
    private target: Graphics | null = null
    private timerText: Text | null = null
    private scoreText: Text | null = null
    private score = 0
    private timeLeft = GAME_SECONDS
    private over = false
    private destroyed = false
    private resizeObs: ResizeObserver | null = null

    async mount(container: HTMLElement, callbacks: GameCallbacks): Promise<void> {
        this.callbacks = callbacks

        const app = new Application()
        await app.init({
            width: APP_CONFIG.designWidth,
            height: APP_CONFIG.designHeight,
            backgroundColor: 0x101821,
            antialias: true,
            resolution: Math.min(window.devicePixelRatio || 1, 3),
            autoDensity: true,
        })
        // mount() may race destroy() when React unmounts during init.
        if (this.destroyed) {
            app.destroy(true, { children: true })
            return
        }
        this.app = app

        container.appendChild(app.canvas)
        // Uniform-scale letterbox: the design scene must never stretch,
        // whatever aspect the host container has (arcade, desktop, tablet).
        const fit = () => {
            const cw = container.clientWidth
            const ch = container.clientHeight
            if (!cw || !ch) return
            const scale = Math.min(cw / APP_CONFIG.designWidth, ch / APP_CONFIG.designHeight)
            app.canvas.style.width = `${APP_CONFIG.designWidth * scale}px`
            app.canvas.style.height = `${APP_CONFIG.designHeight * scale}px`
        }
        fit()
        this.resizeObs = new ResizeObserver(fit)
        this.resizeObs.observe(container)

        this.scoreText = new Text({
            text: 'SCORE 0',
            style: { fill: 0xe8d9a0, fontSize: 22, fontFamily: 'Galmuri14, monospace' },
        })
        this.scoreText.position.set(16, 14)
        app.stage.addChild(this.scoreText)

        this.timerText = new Text({
            text: String(GAME_SECONDS),
            style: { fill: 0x9ab0c4, fontSize: 22, fontFamily: 'Galmuri14, monospace' },
        })
        this.timerText.anchor.set(1, 0)
        this.timerText.position.set(APP_CONFIG.designWidth - 16, 14)
        app.stage.addChild(this.timerText)

        const target = new Graphics().circle(0, 0, TARGET_RADIUS).fill(0xd4a830)
        target.eventMode = 'static'
        target.cursor = 'pointer'
        target.on('pointerdown', () => this.onHit())
        app.stage.addChild(target)
        this.target = target
        this.moveTarget()

        let elapsed = 0
        app.ticker.add((ticker) => {
            if (this.over) return
            elapsed += ticker.deltaMS
            const left = Math.max(0, GAME_SECONDS - elapsed / 1000)
            this.timeLeft = left
            if (this.timerText) this.timerText.text = String(Math.ceil(left))
            if (left <= 0) this.endGame()
        })
    }

    private onHit(): void {
        if (this.over) return
        this.score += POINTS_PER_HIT
        if (this.scoreText) this.scoreText.text = `SCORE ${this.score}`
        this.callbacks?.onScoreChange?.(this.score)
        this.moveTarget()
    }

    private moveTarget(): void {
        if (!this.target) return
        const pad = TARGET_RADIUS + 20
        this.target.position.set(
            pad + logicRandom() * (APP_CONFIG.designWidth - pad * 2),
            pad + 60 + logicRandom() * (APP_CONFIG.designHeight - pad * 2 - 60),
        )
    }

    private endGame(): void {
        if (this.over) return
        this.over = true
        if (this.target) this.target.eventMode = 'none'

        const overText = new Text({
            text: 'GAME OVER',
            style: { fill: 0xff4438, fontSize: 36, fontFamily: 'Galmuri14, monospace' },
        })
        overText.anchor.set(0.5)
        overText.position.set(APP_CONFIG.designWidth / 2, APP_CONFIG.designHeight / 2)
        this.app?.stage.addChild(overText)

        this.callbacks?.onGameOver({ score: this.score, phase: 0 })
    }

    destroy(): void {
        this.destroyed = true
        this.resizeObs?.disconnect()
        this.resizeObs = null
        if (!this.app) return
        this.app.destroy(true, { children: true })
        this.app = null
        this.target = null
        this.timerText = null
        this.scoreText = null
    }

    getDebugState(): Record<string, unknown> {
        return {
            over: this.over,
            score: this.score,
            timeLeft: Math.round(this.timeLeft * 10) / 10,
        }
    }
}
