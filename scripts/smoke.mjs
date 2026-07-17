/**
 * Smoke test — boots the dev server, runs the game headlessly and reports
 * whether a full run completes without console errors.
 *
 *   node scripts/smoke.mjs [seed] [timeoutMs]
 *
 * What it does:
 *   1. starts `npm run dev` on port 4173
 *   2. opens /autoplay.html?seed=<seed> (GameScreen only, seeded RNG)
 *   3. clicks around the canvas until globalThis.__gameState.over is true
 *   4. saves a screenshot to smoke.png, prints a JSON summary
 *
 * Exit code 0 = game mounted, finished a run, zero page/console errors.
 * Designed to be run by coding agents after every gameplay change.
 * Requires a local Chrome install (or set CHROME=<path to chrome.exe>).
 */
import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// 검증 증거를 코드 상태에 바인딩한다: 잠금 게이트(prepare-editorial.mjs)가
// 같은 방식으로 해시를 재계산해 소스가 바뀐 뒤의 낡은 증거를 거부한다.
function sourceHash(root = '.') {
    const files = []
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name)
            if (entry.isDirectory()) walk(full)
            else if (entry.isFile()) files.push(full)
        }
    }
    for (const dir of ['src', 'public']) if (existsSync(join(root, dir))) walk(join(root, dir))
    for (const file of ['index.html', 'package.json', 'vite.config.ts']) if (existsSync(join(root, file))) files.push(join(root, file))
    const hash = createHash('sha256')
    for (const file of files.sort()) {
        hash.update(file)
        hash.update('\n')
        hash.update(readFileSync(file))
        hash.update('\n')
    }
    return hash.digest('hex')
}
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'

const DEV_PORT = 4173
const SEED = process.argv[2] || '1'
const TIMEOUT_MS = Number(process.argv[3] || '90000')
const URL = `http://127.0.0.1:${DEV_PORT}/autoplay.html?seed=${encodeURIComponent(SEED)}`

async function killProcessTree(proc) {
    if (!proc?.pid) return
    if (process.platform === 'win32') {
        await new Promise((resolve) => {
            const killer = spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore', shell: true })
            killer.on('exit', resolve)
            killer.on('error', resolve)
        })
        return
    }
    // `dev` is spawned detached, so it leads its own process group. Signal the
    // whole group (negative pid) — a bare proc.kill only hits the `sh -c`
    // wrapper and leaves vite/esbuild alive, whose open stdio pipes keep this
    // process from ever exiting (the CI hang this script used to cause).
    try {
        process.kill(-proc.pid, 'SIGKILL')
    } catch {
        try { proc.kill('SIGKILL') } catch { /* already gone */ }
    }
}

async function waitForServer() {
    const started = Date.now()
    while (Date.now() - started < 60000) {
        try {
            const r = await fetch(`http://127.0.0.1:${DEV_PORT}/`)
            if (r.ok) return
        } catch { /* not up yet */ }
        await delay(500)
    }
    throw new Error('dev server did not start in time')
}

async function launchBrowser() {
    const opts = { headless: true, args: ['--disable-gpu', '--no-sandbox'] }
    if (process.env.CHROME) {
        return chromium.launch({ ...opts, executablePath: process.env.CHROME })
    }
    try {
        return await chromium.launch({ ...opts, channel: 'chrome' })
    } catch {
        return chromium.launch({
            ...opts,
            executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        })
    }
}

async function main() {
    const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(DEV_PORT), '--force'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        shell: true,
        // Own process group so killProcessTree can take down vite + its
        // children in one signal (see killProcessTree). No effect on Windows.
        detached: process.platform !== 'win32',
    })
    let devLog = ''
    dev.stdout.on('data', (b) => { devLog += String(b) })
    dev.stderr.on('data', (b) => { devLog += String(b) })

    const consoleErrors = []
    const pageErrors = []

    try {
        await waitForServer()
        const browser = await launchBrowser()
        const page = await browser.newPage({ viewport: { width: 450, height: 800 } })
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text())
        })
        page.on('pageerror', (err) => pageErrors.push(String(err)))

        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForSelector('canvas', { timeout: 30000 })

        // Blind-click around the canvas until the run ends. Games with menus /
        // multi-step input may need a smarter driver — extend here per game.
        const started = Date.now()
        let state = null
        while (Date.now() - started < TIMEOUT_MS) {
            const box = await page.locator('canvas').boundingBox().catch(() => null)
            if (box) {
                const x = box.x + box.width * (0.1 + Math.random() * 0.8)
                const y = box.y + box.height * (0.1 + Math.random() * 0.8)
                await page.mouse.click(x, y).catch(() => {})
            }
            state = await page.evaluate(() => globalThis.__gameState ?? null)
            if (state?.over) break
            await delay(150)
        }
        // GameScreen defers onGameOver briefly for the runtime's game-over
        // presentation — wait it out so __gameResult is populated.
        await delay(1500)
        const result = await page.evaluate(() => globalThis.__gameResult ?? null)
        await page.screenshot({ path: 'smoke.png' }).catch(() => {})
        await browser.close()

        const summary = {
            seed: SEED,
            sourceHash: sourceHash(),
            mounted: state !== null,
            finished: Boolean(state?.over),
            finalState: state,
            gameResult: result,
            consoleErrors,
            pageErrors,
        }
        writeFileSync('smoke-result.json', JSON.stringify(summary, null, 2), 'utf-8')
        console.log(JSON.stringify(summary, null, 2))

        if (!summary.mounted) {
            console.error('FAIL: game never exposed __gameState (mount failed?)')
            console.error(devLog.split(/\r?\n/).slice(-30).join('\n'))
            return 1
        }
        if (pageErrors.length > 0 || consoleErrors.length > 0) {
            console.error('FAIL: page/console errors during the run')
            return 1
        }
        if (!summary.finished) {
            console.error('FAIL: run did not reach game over within timeout')
            return 1
        }
        console.log('SMOKE OK')
        return 0
    } finally {
        await killProcessTree(dev)
    }
}

// Always exit explicitly. The dev server keeps stdio pipes open even after it
// is signalled, so relying on natural event-loop drain would hang the process
// forever (previously stalled CI for ~2h before it was cancelled).
main()
    .then((code) => process.exit(code))
    .catch((e) => {
        console.error(e?.stack || String(e))
        process.exit(1)
    })
