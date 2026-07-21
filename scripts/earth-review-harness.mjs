/**
 * 공용 "지구 평가" 하네스 (Earth Review harness).
 *
 * 왜 있는가. 공개 후 무르의 실제 플레이(=지구 평가)를 돌리는 검토자가 매번 하네스를
 * 처음부터 새로 짰다(PROCESS_LOG 4번째 재발). 그 임시 도구들은 iframe 안을 페이지
 * 스크립트(page.evaluate / iframe.contentWindow)로 들여다봤고, 아케이드 포털이 게임을
 * sandbox="allow-scripts" 불투명 출처 iframe에서 돌리기 때문에 그 접근이 SecurityError로
 * 막혀 44종 판정 중 2종에서 멈췄다. 그래서 사람 손 검증 없이 게임이 공개됐다.
 *
 * 이 하네스는 이미 각자 작동하던 두 조각을 합친다. 새로 짜지 않는다.
 *
 *   1. 포털 접근      arcade/scripts/smoke-player.mjs 의 패턴. 공개 포털을 /play/<slug>로
 *                     열고, 러너 iframe을 Playwright Frame(CDP 레벨)으로 잡는다. CDP는
 *                     불투명 출처를 통과하므로 runner.evaluate(__gameState)로 상태를 읽고
 *                     page.mouse 절대좌표로 포인터를 넣을 수 있다.
 *   2. 사람 모델      launchpad/scripts/play-harness.mjs 의 프로필/노이즈/자체 점검.
 *                     직관·숙련·자연 프로필, 정규 노이즈, 그리고 "주입한 오차가 실제로
 *                     그만큼 뽑혔는지" 스스로 재는 자체 점검을 그대로 재사용한다.
 *
 * 게임마다 다른 것은 상태 읽기(readState)와 입력 결정(plan)뿐이다. 그 둘은 어댑터로
 * 분리한다(smoke-driver와 같은 패턴). 어댑터는 earth-review-adapters/<slug>.mjs.
 *
 * ── 정직한 한계 ──────────────────────────────────────────────────────────────
 * 이 하네스는 __gameState를 읽어 플레이한다. 따라서 "플레이 가능성"(사람 모델이 실제
 * 공개 빌드에서 끝까지 가는가)은 잡지만, "가독성"(화면이 모래처럼 읽히는가)은 못 잡는다.
 * 상태값이 멀쩡해도 화면은 못 읽힐 수 있다. 그래서 판정이 넘어가는 주요 순간마다
 * 스크린샷을 남겨, 사람/비전 검토가 가독성을 따로 보게 한다. 스크린샷 없이 초록이라고
 * 가독성까지 통과한 것이 아니다.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { launchBrowser, makeNoise, selfCheck, stats } from './play-harness.mjs'

// page.mouse.click 한 번을 디스패치하는 데 드는 대략의 시간. 리듬 어댑터가 손이
// 떨어질 순간을 이만큼 앞당겨 스케줄한다. 실측 오차가 지정 시그마에 붙도록 보정한다.
const CLICK_LATENCY_MS = 30

/**
 * 러너 iframe을 CDP Frame으로 잡는다. smoke-player.mjs 와 동일한 방식.
 * sandbox 불투명 출처라도 CDP 프레임 트리에는 보인다.
 */
async function waitForRunner(page, runnerPath, timeoutMs = 30_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        const runner = page.frames().find((frame) => frame.url().includes(runnerPath))
        if (runner) return runner
        await delay(50)
    }
    throw new Error(`runner iframe did not connect (${runnerPath})`)
}

/**
 * 접근 전략. 하네스 본체는 이 인터페이스로만 iframe을 만진다.
 *
 *   cdp          진짜 고침. 러너를 CDP Frame으로 잡고 그 안에서 상태를 읽고,
 *                page.mouse 절대좌표로 포인터를 넣는다. sandbox를 통과한다.
 *   pageScript   이빨 대조용. 임시 하네스들이 쓰던 방식 그대로. 부모 페이지의
 *                page.evaluate 로 __gameState를 읽으려 하지만 그건 iframe 안에 있어
 *                부모 창에는 없다(undefined). iframe 안으로 파고들려 하면 불투명 출처가
 *                SecurityError로 막는다. 그래서 상태를 영영 못 읽고 멈춘다.
 */
export const CDP_ACCESS = {
    name: 'cdp',
    async readState({ runner }, expr) {
        return runner.evaluate(expr)
    },
    async canvasBox({ runner }) {
        // Frame locator 의 boundingBox 는 부모 페이지 좌표계로 돌려준다.
        return runner.locator('canvas').first().boundingBox().catch(() => null)
    },
    async tap({ page }, x, y) {
        await page.mouse.click(x, y)
    },
}

export const PAGE_SCRIPT_ACCESS = {
    name: 'page-script',
    async readState({ page }, expr) {
        // 부모 문서에서 평가된다. 게임의 __gameState 는 sandbox iframe 창의 것이라
        // 여기서는 undefined 다. 임시 하네스가 2/44 에서 멈춘 바로 그 지점.
        const own = await page.evaluate(expr).catch(() => null)
        if (own) return own
        // iframe 창으로 파고드는 변형도 시도해 SecurityError 를 증거로 남긴다.
        return page
            .evaluate(() => {
                const frame = document.querySelector('#game-frame')
                // 불투명 출처: contentWindow 접근 자체가 SecurityError.
                return frame?.contentWindow?.__gameState ?? null
            })
            .catch((error) => ({ __accessError: String(error).slice(0, 160) }))
    },
    async canvasBox({ page }) {
        // 부모 문서에는 canvas 가 없고(캔버스는 iframe 안), frameLocator 로 파고들면
        // 불투명 출처라 레이아웃을 못 읽는다. 그래서 포인터를 어디에 넣을지 모른다.
        return page
            .frameLocator('#game-frame')
            .locator('canvas')
            .first()
            .boundingBox({ timeout: 1500 })
            .catch(() => null)
    },
    async tap({ page }, x, y) {
        await page.mouse.click(x, y)
    },
}

async function openPortal({ browser, baseUrl, slug, runnerVersion, viewport, lang, protectionSecret }) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    if (protectionSecret) {
        await page.context().route(`${baseUrl}/**`, (route) =>
            route.continue({
                headers: { ...route.request().headers(), 'x-vercel-protection-bypass': protectionSecret },
            }),
        )
    }
    const errors = []
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text().slice(0, 200))
    })
    page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)))

    await page.goto(`${baseUrl}/play/${encodeURIComponent(slug)}?lang=${lang}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
    })
    const runner = await waitForRunner(page, `/runner/${runnerVersion}/index.html`)
    return { page, runner, errors }
}

/** 한 판. 사람 모델 하나로 공개 포털을 끝까지(또는 정당한 게임오버까지) 플레이한다. */
async function playRun({ browser, baseUrl, adapter, profile, seed, access, qaDir, protectionSecret }) {
    const { page, runner, errors } = await openPortal({
        browser,
        baseUrl,
        slug: adapter.slug,
        runnerVersion: adapter.runnerVersion,
        viewport: adapter.viewport ?? { width: 390, height: 844 },
        lang: 'ko',
        protectionSecret,
    })
    const ctx = { page, runner }
    const noise = makeNoise(profile, seed)
    const mem = { armed: false, offsetMs: 0 }
    const shots = []
    const milestonesSeen = new Set()
    const realizedTapErrors = []
    let lastTapSignature = null
    let nullReads = 0
    let inputBlocked = false
    let accessError = null
    let state = null

    const timeoutMs = adapter.timeoutMs ?? 240_000
    const startedAt = Date.now()

    try {
        // 준비 대기: 상태가 읽히기 시작할 때까지. page-script 접근이면 영영 안 읽힌다.
        while (Date.now() - startedAt < Math.min(35_000, timeoutMs)) {
            state = await access.readState(ctx, adapter.readState)
            if (state && state.__accessError) { accessError = state.__accessError; state = null }
            if (adapter.isReady(state)) break
            nullReads += 1
            await delay(60)
        }

        // 캔버스 상자는 뷰포트가 고정이라 판 내내 바뀌지 않는다. 탭마다 다시 재면
        // 왕복 지연이 붙어 타이밍 게임에서 매 탭이 늦는다(스케줄이 무의미해진다).
        // 그래서 한 번만 재서 캐시한다. page-script 접근이면 null 이 나온다.
        let box = await access.canvasBox(ctx)

        while (Date.now() - startedAt < timeoutMs) {
            const readAt = Date.now()
            state = await access.readState(ctx, adapter.readState)
            // 이 상태값은 왕복 시간만큼 오래된 것이다. 리듬 게임은 그 지연을 보정해야
            // 사람 모델이 노린 지점에 손이 떨어진다.
            const staleMs = Date.now() - readAt
            if (state && state.__accessError) { accessError = state.__accessError; state = null }
            if (!state) {
                nullReads += 1
                await delay(60)
                // 상태를 오래 못 읽으면 멈춘 것으로 본다(page-script 접근의 전형).
                if (nullReads > 120) break
                continue
            }

            // 판정이 넘어가는 순간의 화면을 남긴다(가독성은 상태로 못 잡으므로).
            const milestone = adapter.milestone?.(state)
            if (milestone && !milestonesSeen.has(milestone) && access.name === 'cdp') {
                milestonesSeen.add(milestone)
                const path = resolve(qaDir, `${adapter.slug}-${profile.name}-s${seed}-${milestone}.png`)
                await runner.locator('canvas').first().screenshot({ path }).catch(() => {})
                if (existsSync(path)) shots.push(path)
            }

            // 실측 판정 오차를 모은다(자체 점검의 뒷받침). 게임이 공표한 마지막 탭 오차.
            const sig = adapter.tapSignature?.(state)
            if (sig != null && sig !== lastTapSignature && Number.isFinite(Number(state.lastTapErrorMs))) {
                realizedTapErrors.push(Number(state.lastTapErrorMs))
                lastTapSignature = sig
            }

            if (adapter.isFinished(state)) break

            const decision = adapter.plan(state, noise, mem, { staleMs, clickLatencyMs: CLICK_LATENCY_MS })
            if (decision?.tap) {
                if (!box) box = await access.canvasBox(ctx)
                if (!box) {
                    // 포인터를 넣을 자리를 못 찾았다 → 입력이 막혔다(불투명 출처).
                    inputBlocked = true
                    await delay(120)
                    if (Date.now() - startedAt > 20_000) break
                    continue
                }
                // 정밀 타이밍: 어댑터가 "이만큼 있다가 눌러라"를 주면 로컬 타이머로만
                // 기다렸다가 누른다. 임계 경로에 CDP 왕복이 없어 지연이 안 쌓인다.
                if (decision.waitBeforeMs > 0) await delay(decision.waitBeforeMs)
                const x = box.x + box.width * (decision.xFrac ?? 0.5)
                const y = box.y + box.height * (decision.yFrac ?? 0.6)
                await access.tap(ctx, x, y)
            }
            await delay(decision?.waitMs ?? 16)
        }
    } finally {
        try { await page.close() } catch { /* noop */ }
    }

    return {
        profile: profile.name,
        seed,
        access: access.name,
        progress: adapter.progress(state),
        progressMax: adapter.progressMax,
        completed: Boolean(adapter.completed(state)),
        overReason: adapter.overReason?.(state) ?? null,
        finalState: state,
        realizedTapErrors,
        realizedTapStats: stats(realizedTapErrors.map((value) => Math.abs(value))),
        shots,
        nullReads,
        inputBlocked,
        accessError,
        errors,
        noiseDrawn: noise.drawn,
        ms: Date.now() - startedAt,
    }
}

/**
 * 여러 프로필 × 여러 판을 정해진 동시성으로 돌린다. 각 판은 자기 페이지에서
 * 실시간으로 끝까지 플레이한다. 프로필별 도달 판정 수·완주율과 자체 점검을 함께 낸다.
 */
export async function runEarthReview({
    baseUrl,
    adapter,
    profiles,
    access = CDP_ACCESS,
    concurrency = 3,
    qaDir,
    protectionSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    browser: given = null,
}) {
    mkdirSync(qaDir, { recursive: true })
    const browser = given ?? (await launchBrowser())
    const jobs = profiles.flatMap((profile) =>
        Array.from({ length: profile.runs ?? 3 }, (_, index) => ({
            profile,
            seed: (profile.seedBase ?? 7000) + index,
        })),
    )

    const results = []
    let cursor = 0
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (cursor < jobs.length) {
            const job = jobs[cursor++]
            results.push(
                await playRun({ browser, baseUrl, adapter, access, qaDir, protectionSecret, ...job }),
            )
        }
    })
    await Promise.all(workers)

    const byProfile = profiles.map((profile) => {
        const runs = results.filter((result) => result.profile === profile.name)
        const completed = runs.filter((result) => result.completed).length
        // 지정 오차 대비 실측: 게임이 공표한 실제 탭 오차의 분포가 이 프로필에
        // 주입하기로 한 시그마에 붙는가. 노이즈가 실제 게임 안에서 눌리지 않았다는
        // 증거다(drawn 값만 재는 selfCheck 보다 한 걸음 더 실제에 가깝다).
        const realizedErrors = runs.flatMap((result) => result.realizedTapErrors ?? [])
        const realizedStats = stats(realizedErrors)
        const realizedVsSpecified = {
            specifiedSigmaMs: profile.timingSigmaMs ?? null,
            observed: realizedStats,
            ratio:
                realizedStats && profile.timingSigmaMs
                    ? +(realizedStats.sd / profile.timingSigmaMs).toFixed(2)
                    : null,
        }
        return {
            profile: profile.name,
            runs: runs.length,
            completed,
            completionRate: runs.length ? +(completed / runs.length).toFixed(2) : 0,
            reachedProgress: runs.map((result) => result.progress),
            stoppedAt: runs.map((result) => ({
                seed: result.seed,
                progress: `${result.progress}/${result.progressMax}`,
                overReason: result.overReason,
                inputBlocked: result.inputBlocked,
                nullReads: result.nullReads,
                accessError: result.accessError,
            })),
            // 자체 점검: 이 프로필로 뽑힌 노이즈가 지정 오차만큼 실제로 나왔는지(주입 측).
            selfCheck: selfCheck(profile, collectDrawn(runs)),
            // 자체 점검(실측 측): 게임이 되돌려준 실제 탭 오차가 지정 시그마에 붙는가.
            realizedVsSpecified,
        }
    })

    if (!given) await browser.close()

    const summary = {
        slug: adapter.slug,
        baseUrl,
        access: access.name,
        capturedReadabilityLimit:
            'plays via __gameState → catches playability, NOT readability; see milestone screenshots for readability review',
        byProfile,
        results,
    }
    if (qaDir) {
        writeFileSync(
            resolve(qaDir, `${adapter.slug}-earth-review.${access.name}.json`),
            `${JSON.stringify(summary, null, 2)}\n`,
        )
    }
    return summary
}

function collectDrawn(runs) {
    const drawn = { angleDeg: [], magnitude: [], reactionMs: [], timingMs: [] }
    for (const run of runs) {
        for (const key of Object.keys(drawn)) drawn[key].push(...(run.noiseDrawn?.[key] ?? []))
    }
    return drawn
}
