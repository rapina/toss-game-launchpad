/**
 * 뷰포트 / 캔버스 해상도 / 게임 오버 잘림 게이트 (템플릿 정본).
 *
 *   node scripts/viewport-smoke.mjs
 *
 * 게임 이름에 의존하지 않는다. 설계 해상도와 지원 로케일은 모두
 * `game.manifest.json`에서 읽으므로 템플릿을 복사한 게임이 그대로 쓴다.
 *
 * 검사하는 것:
 *   1) 기하 패스 — 캔버스가 프레임 안에 온전히 들어가는가, 균일 배율
 *      레터박스가 유지되는가(원이 원으로 보이는가), 백킹 스토어가
 *      devicePixelRatio 아래로 고정되지 않는가, 페이지 넘침과 콘솔 오류가 없는가.
 *   2) 잘림 패스 — 한 판을 게임 오버까지 몰고 간 뒤, 결과 화면의 주요 UI가
 *      뷰포트 경계 안에 있는가.
 *
 * ── 이 잘림 패스가 생긴 이유 (sequence 13 사이클 유출 사고) ──────────────
 * 게임 오버 화면이 "영어 로케일에서만" 잘려 운영까지 나갔다. 요약 텍스트가
 * 사이트 헤더 밑으로 밀리고 다시하기 버튼이 화면 밖으로 사라졌다.
 * 그때까지의 뷰포트 검증이 이 결함을 못 잡은 이유는 두 가지다.
 *   - 게임을 "단독 크기"로만 재고, 운영에서 실제로 도는 아케이드 포털
 *     형상(상단 헤더를 뺀 유효 높이)으로는 한 번도 재지 않았다.
 *   - "한국어"만 확인했다. 영어 문자열이 더 길어 레이아웃이 달라지는데도
 *     영어 화면은 아무도 보지 않았다.
 * 그래서 이 정본은 로케일 두 개 × 형상 두 개를 모두 돌고, 결과 화면까지
 * 실제로 진행시킨 뒤에 경계를 잰다. 둘 중 하나라도 넘치면 종료 코드 1이다.
 * ────────────────────────────────────────────────────────────────────────
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { sourceHash } from './source-hash.mjs'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.VIEWPORT_PORT ?? 4187)
// 증거가 쌓이는 곳. 게이트를 저장소에 손대지 않고 시험할 때만 환경변수로 돌린다.
const OUT = process.env.VIEWPORT_OUT ?? 'verification'
const ENTRY = process.env.VIEWPORT_ENTRY ?? '/autoplay.html?seed=5'

/**
 * 아케이드 포털 상단 헤더 높이(px).
 *
 * 근거: `arcade/public/assets/player.css`의 `.player-header`가
 *   `min-height: calc(68px + env(safe-area-inset-top))`
 * 이고, 전역 `* { box-sizing: border-box }` 때문에 `border-bottom: 2px`는
 * 이 높이 안에 포함된다. safe-area inset은 헤드리스 브라우저에서 0이다.
 * 포털 본문은 `body { grid-template-rows: auto minmax(0, 1fr) }`이므로
 * 게임 iframe이 받는 높이는 정확히 "뷰포트 높이 - 헤더 높이"다.
 *
 * 참고: 폭 600px 이하에서는 `.player-stage`의 패딩이 0이라 가로는 그대로
 * 전부 쓴다. 넓은 화면에서는 패딩 18px과 `max-width: 560px`이 더 붙지만,
 * 잘림을 만드는 지배적인 항은 헤더 높이라서 여기서는 헤더만 모델링한다.
 */
const ARCADE_HEADER_PX = 68

const manifest = JSON.parse(readFileSync('game.manifest.json', 'utf-8'))
const DESIGN = {
    w: manifest.display?.designWidth ?? 390,
    h: manifest.display?.designHeight ?? 844,
}
/** 매니페스트가 선언한 로케일 전부. 사고가 영어에서 났으므로 ko만 도는 것은 금지. */
const LOCALES = manifest.supportedLocales?.length ? manifest.supportedLocales : ['ko', 'en']
/** 한 판을 끝까지 미는 데 허용할 시간. 매니페스트의 세션 상한을 그대로 따른다. */
const RUN_BUDGET_MS = (manifest.session?.maxSeconds ?? 180) * 1000

const VIEWPORTS = [
    { name: '360x800', width: 360, height: 800, dpr: 3 },
    { name: '390x844', width: 390, height: 844, dpr: 3 },
    { name: '430x932', width: 430, height: 932, dpr: 3 },
    { name: '900x760-wide', width: 900, height: 760, dpr: 2 },
]

/** 단독 실행과 아케이드 포털 안. 운영은 후자다. */
const SHAPES = [
    { name: 'standalone', headerPx: 0 },
    { name: 'portal', headerPx: ARCADE_HEADER_PX },
]

/**
 * 잘림 패스를 도는 조합. 한 판을 끝까지 미는 비용이 크므로 유효 높이가 가장
 * 빠듯한 뷰포트 하나만 쓰되, 로케일과 형상은 절대 줄이지 않는다 — 사고가
 * 정확히 그 두 축에서 났기 때문이다.
 */
const CLIP_VIEWPORT = VIEWPORTS[0]

const locales = LOCALES.map((l) => ({ tag: l, bcp47: l === 'ko' ? 'ko-KR' : l === 'en' ? 'en-US' : l }))

async function waitForServer() {
    for (let i = 0; i < 120; i++) {
        try { const r = await fetch(`http://127.0.0.1:${PORT}/`); if (r.ok) return } catch { /* not up */ }
        await delay(500)
    }
    throw new Error('dev server did not start')
}

async function launchBrowser() {
    const opts = { headless: true, args: ['--disable-gpu', '--no-sandbox'] }
    if (process.env.CHROME) return chromium.launch({ ...opts, executablePath: process.env.CHROME })
    try { return await chromium.launch({ ...opts, channel: 'chrome' }) } catch { return chromium.launch(opts) }
}

/**
 * 페이지 하나를 연다. 로케일은 브라우저 컨텍스트로 준다: 게임 런타임은
 * `navigator.language`를 보고 언어를 고르므로, 이것이 사람이 영어 기기로
 * 접속했을 때와 같은 경로다. URL 파라미터도 같이 붙여, 파라미터로 언어를
 * 받는 게임에서도 동작한다.
 */
async function openPage(browser, vp, shape, locale) {
    const page = await browser.newPage({
        viewport: { width: vp.width, height: Math.max(200, vp.height - shape.headerPx) },
        deviceScaleFactor: vp.dpr,
        locale: locale.bcp47,
    })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    const sep = ENTRY.includes('?') ? '&' : '?'
    await page.goto(`http://127.0.0.1:${PORT}${ENTRY}${sep}lang=${locale.tag}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('canvas', { timeout: 30000 })
    await delay(1200)
    return { page, errors }
}

/** 캔버스와 문서의 실제 배치. 모든 판정은 이 숫자에서 나온다. */
function readMetrics(page) {
    return page.evaluate(() => {
        const c = document.querySelector('canvas')
        const r = c.getBoundingClientRect()
        return {
            bufferW: c.width, bufferH: c.height,
            cssW: r.width, cssH: r.height,
            left: r.left, top: r.top, right: r.right, bottom: r.bottom,
            dpr: window.devicePixelRatio,
            docScrollW: document.documentElement.scrollWidth,
            docScrollH: document.documentElement.scrollHeight,
            innerW: window.innerWidth, innerH: window.innerHeight,
        }
    })
}

function geometryChecks(m, errors) {
    const need = Math.max(1, m.dpr)
    const ratioW = m.bufferW / m.cssW
    const ratioH = m.bufferH / m.cssH
    const aspect = (m.cssW / m.cssH) / (DESIGN.w / DESIGN.h)
    return {
        ratioW, ratioH, aspect, need,
        checks: {
            dprWidthOk: ratioW >= need - 1e-6,
            dprHeightOk: ratioH >= need - 1e-6,
            uniformAspect: Math.abs(aspect - 1) < 0.01,
            insideFrame: m.left >= -0.5 && m.top >= -0.5 && m.right <= m.innerW + 0.5 && m.bottom <= m.innerH + 0.5,
            noPageOverflow: m.docScrollW <= m.innerW + 1 && m.docScrollH <= m.innerH + 1,
            noErrors: errors.length === 0,
        },
    }
}

/**
 * 한 판을 게임 오버까지 민다. 게임이 `__forceGameOver()`를 노출하면 그것을
 * 쓰고(빠른 길), 없으면 캔버스를 실제로 탭해 판을 끝낸다. 종료된 뒤에는
 * 절대 더 누르지 않는다 — 잔여 입력이 결과 화면을 건너뛰면 잴 것이 없어진다.
 */
async function driveToGameOver(page) {
    const forced = await page.evaluate(() => {
        const f = globalThis.__forceGameOver
        if (typeof f === 'function') { f(); return true }
        return false
    })
    if (forced) {
        await delay(900)
        return await page.evaluate(() => Boolean(globalThis.__gameState?.over))
    }

    const box = await page.locator('canvas').boundingBox()
    const tap = () => page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.55)
    await tap()
    await delay(700)
    const deadline = Date.now() + RUN_BUDGET_MS
    while (Date.now() < deadline) {
        const st = await page.evaluate(() => globalThis.__gameState ?? null)
        if (st?.over) { await delay(900); return true }
        // 링/창이 열렸다고 알려주는 게임은 그때만 누르고, 그런 신호가 없는
        // 게임은 일정 간격으로 누른다. 어느 쪽이든 결국 판은 끝난다.
        if (st?.ringOpen === undefined || st.ringOpen) { await tap(); await delay(280) }
        await delay(60)
    }
    return await page.evaluate(() => Boolean(globalThis.__gameState?.over))
}

/**
 * 결과 화면의 주요 UI가 뷰포트 안에 있는가.
 *
 * 기본 판정은 캔버스 자체다. 게임 오버 오버레이(요약 텍스트, 다시하기 버튼)는
 * 설계 좌표계 안에 고정 배치되어 캔버스와 함께 레터박스되므로, 캔버스가
 * 뷰포트 안에 온전히 들어가면 결과 화면도 잘리지 않는다. 반대로 캔버스
 * 아래쪽이 뷰포트를 넘어가는 순간이 바로 이번 사고 — 다시하기 버튼이
 * 화면 밖으로 나간 상태다.
 *
 * 더해서, 게임이 `globalThis.__gameOverUiBoxes`로 결과 화면 요소의 설계 좌표
 * 박스(`{ name, x, y, w, h }`)를 노출하면 그것도 각각 검사한다. 없으면
 * `uiProbe: 'absent'`로 기록만 남긴다.
 */
async function clipCheck(page) {
    return page.evaluate(() => {
        const c = document.querySelector('canvas')
        const r = c.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        const inside = (x, y, w, h) => x >= -0.5 && y >= -0.5 && x + w <= vw + 0.5 && y + h <= vh + 0.5

        const canvasInside = inside(r.left, r.top, r.width, r.height)

        const boxes = globalThis.__gameOverUiBoxes
        if (!Array.isArray(boxes) || boxes.length === 0) {
            return { canvasInside, uiProbe: 'absent', elements: [] }
        }
        // 설계 좌표 -> 페이지 좌표. 레터박스가 균일 배율이라 축마다 따로 잰다.
        const design = globalThis.__gameDesignSize ?? { w: r.width, h: r.height }
        const sx = r.width / design.w
        const sy = r.height / design.h
        const elements = boxes.map((b) => {
            const x = r.left + b.x * sx
            const y = r.top + b.y * sy
            const w = b.w * sx
            const h = b.h * sy
            return { name: b.name, x, y, w, h, inside: inside(x, y, w, h) }
        })
        return { canvasInside, uiProbe: 'present', elements }
    })
}

const dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--force'], {
    stdio: 'pipe', shell: true, detached: process.platform !== 'win32',
})

let exitCode = 0
try {
    mkdirSync(OUT, { recursive: true })
    await waitForServer()
    const browser = await launchBrowser()
    const captures = []
    const report = {
        design: DESIGN,
        arcadeHeaderPx: ARCADE_HEADER_PX,
        locales: LOCALES,
        geometry: [],
        gameOver: [],
    }

    // ── 1) 기하 패스: 뷰포트 4개 × 형상 2개. 배치 문제라 로케일과 무관하다.
    for (const vp of VIEWPORTS) {
        for (const shape of SHAPES) {
            const locale = locales[0]
            const { page, errors } = await openPage(browser, vp, shape, locale)
            const m = await readMetrics(page)
            const g = geometryChecks(m, errors)
            const pass = Object.values(g.checks).every(Boolean)
            if (!pass) exitCode = 1
            captures.push({ path: `${OUT}/viewport-${vp.name}-${shape.name}.png`, buffer: await page.screenshot() })
            report.geometry.push({
                viewport: vp.name, shape: shape.name, effectiveHeight: Math.max(200, vp.height - shape.headerPx),
                dpr: m.dpr,
                bufferW: m.bufferW, bufferH: m.bufferH, cssW: m.cssW, cssH: m.cssH,
                canvasWidthOverCssWidth: Number(g.ratioW.toFixed(4)),
                canvasHeightOverCssHeight: Number(g.ratioH.toFixed(4)),
                requiredRatio: g.need,
                aspectRatioVsDesign: Number(g.aspect.toFixed(5)),
                errors, checks: g.checks, pass,
            })
            await page.close()
        }
    }

    // ── 2) 잘림 패스: 로케일 2개 × 형상 2개. 두 로케일 모두 캡처를 남긴다.
    for (const shape of SHAPES) {
        for (const locale of locales) {
            const vp = CLIP_VIEWPORT
            const { page, errors } = await openPage(browser, vp, shape, locale)
            const reachedOver = await driveToGameOver(page)
            const clip = await clipCheck(page)
            const offscreen = clip.elements.filter((e) => !e.inside).map((e) => e.name)
            const checks = {
                reachedGameOver: reachedOver,
                canvasInsideViewport: clip.canvasInside,
                gameOverUiInsideViewport: offscreen.length === 0,
                noErrors: errors.length === 0,
            }
            const pass = Object.values(checks).every(Boolean)
            if (!pass) exitCode = 1
            captures.push({
                path: `${OUT}/gameover-${vp.name}-${shape.name}-${locale.tag}.png`,
                buffer: await page.screenshot(),
            })
            report.gameOver.push({
                viewport: vp.name, shape: shape.name, locale: locale.tag,
                effectiveHeight: Math.max(200, vp.height - shape.headerPx),
                uiProbe: clip.uiProbe, offscreenElements: offscreen,
                errors, checks, pass,
            })
            await page.close()
        }
    }

    await browser.close()
    report.pass = [...report.geometry, ...report.gameOver].every((r) => r.pass)
    // 소스 해시를 보고서에 넣어 두면, 측정 수치가 우연히 같은 순수 렌더 변경에도
    // 캡처가 다시 써진다. 이것이 없을 때 렌더만 바뀐 사이클에서 커밋된 뷰포트
    // 이미지가 조용히 낡은 채로 남았다(연번 16에서 실제로 발생).
    report.sourceHash = sourceHash()
    const json = JSON.stringify(report, null, 2)
    // 배경 애니메이션 때문에 캡처 바이트는 실행마다 달라진다. 측정 결과가
    // 실제로 바뀔 때만 증거를 다시 써야 게시 게이트의 저장소 청결 검사를
    // 통과할 수 있다.
    const previous = existsSync(`${OUT}/viewport-result.json`)
        ? readFileSync(`${OUT}/viewport-result.json`, 'utf-8')
        : null
    if (previous !== json) {
        writeFileSync(`${OUT}/viewport-result.json`, json, 'utf-8')
        for (const { path, buffer } of captures) writeFileSync(path, buffer)
    }
    console.log(json)
    if (report.gameOver.some((r) => r.uiProbe === 'absent')) {
        console.error('note: __gameOverUiBoxes 미노출 — 결과 화면 판정은 캔버스 경계만으로 했다')
    }
    console.error(report.pass ? 'VIEWPORT OK' : 'FAIL: viewport / canvas resolution / game-over clipping gate')
    if (!report.pass) exitCode = 1
} finally {
    try { process.kill(-dev.pid, 'SIGKILL') } catch { try { dev.kill('SIGKILL') } catch { /* gone */ } }
}
process.exit(exitCode)
