/**
 * 사람 모델 실기 플레이 하네스.
 *
 * 설계 검토가 실제 입력 경로로 게임을 플레이할 때 쓴다. 지금까지는 검토자가
 * 게임마다 이걸 처음부터 다시 짰고, 그래서 두 가지 대가를 치렀다.
 *
 *   느리다   판을 하나씩 순서대로 돌려 9판에 13~27분이 걸렸다.
 *   틀린다   sequence 11에서 검토자가 자기 노이즈 모델의 오차가 지정한 15%에서
 *            1.5%로 눌린 것을 뒤늦게 발견했다. 그 상태로 판정했으면 "질 수 없는
 *            게임"이라는 거짓 결론이 나갈 뻔했다.
 *
 * 그래서 두 가지를 여기서 한 번에 해결한다.
 *
 *   1. 판을 여러 브라우저 컨텍스트에 나눠 동시에 돌린다. 각 판은 여전히 실시간
 *      이므로 충실도는 그대로고, 벽시계만 줄어든다.
 *   2. 노이즈 모델을 하네스가 만들고, 주입한 오차가 실제로 그만큼 나왔는지
 *      스스로 재서 보고한다. 눌린 채로 판정하는 일이 없어야 한다.
 *
 * 게임마다 다른 것은 `act`와 `readState`뿐이다. 그 둘만 넘기면 된다.
 *
 *   import { runProfiles, gaussian } from './play-harness.mjs'
 *
 *   const result = await runProfiles({
 *     url: (seed) => `http://127.0.0.1:4188/autoplay.html?seed=${seed}`,
 *     profiles: [
 *       { name: 'intuitive', runs: 3, angleSigmaDeg: 8, magnitudeSigma: 0.15, reactionMs: [200, 40] },
 *       { name: 'skilled',   runs: 3, angleSigmaDeg: 4, magnitudeSigma: 0.075, reactionMs: [200, 40] },
 *     ],
 *     concurrency: 3,
 *     async act({ page, state, noise, box }) { ... },   // 한 번의 입력
 *     readState: () => globalThis.__gameState,          // 페이지 안에서 평가된다
 *   })
 */
import { chromium } from 'playwright-core'

/** 시드 고정 난수. 같은 시드는 같은 손떨림을 만든다. */
export function seededRandom(seed) {
    let state = (seed >>> 0) || 1
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** 평균 0, 표준편차 1의 정규 난수(Box-Muller). */
export function gaussian(random) {
    const u = Math.max(random(), Number.EPSILON)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

export async function launchBrowser() {
    const options = { headless: true, args: ['--disable-gpu', '--no-sandbox'] }
    if (process.env.CHROME) return chromium.launch({ ...options, executablePath: process.env.CHROME })
    try {
        return await chromium.launch({ ...options, channel: 'chrome' })
    } catch {
        return chromium.launch(options)
    }
}

function makeNoise(profile, seed) {
    const random = seededRandom(seed)
    const drawn = { angleDeg: [], magnitude: [], reactionMs: [] }
    return {
        drawn,
        /** 각도 오차(도). 프로필의 angleSigmaDeg를 따른다. */
        angleDeg() {
            const value = gaussian(random) * (profile.angleSigmaDeg ?? 0)
            drawn.angleDeg.push(value)
            return value
        },
        /** 크기 오차(비율). 1을 곱하면 그대로, 1.15면 15% 크게. */
        magnitude() {
            const value = 1 + gaussian(random) * (profile.magnitudeSigma ?? 0)
            drawn.magnitude.push(value)
            return value
        },
        /** 반응 지연(ms). [평균, 표준편차]. */
        reactionMs() {
            const [mean, sigma] = profile.reactionMs ?? [200, 40]
            const value = Math.max(0, mean + gaussian(random) * sigma)
            drawn.reactionMs.push(value)
            return value
        },
        random,
    }
}

function stats(values) {
    if (values.length === 0) return null
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    return { n: values.length, mean: +mean.toFixed(4), sd: +Math.sqrt(variance).toFixed(4) }
}

/**
 * 하네스 자체 점검. 주입하라고 지정한 오차와 실제로 뽑힌 분산을 견준다.
 * 어긋나면 그 프로필의 관측치로 판정하면 안 된다.
 */
function selfCheck(profile, drawn) {
    const report = {
        profile: profile.name,
        angleDeg: { specified: profile.angleSigmaDeg ?? 0, observed: stats(drawn.angleDeg) },
        magnitude: { specified: profile.magnitudeSigma ?? 0, observed: stats(drawn.magnitude) },
        reactionMs: { specified: profile.reactionMs ?? [200, 40], observed: stats(drawn.reactionMs) },
    }
    const ratio = (observed, specified) =>
        !observed || !specified ? null : +(observed.sd / specified).toFixed(2)
    report.angleRatio = ratio(report.angleDeg.observed, report.angleDeg.specified)
    report.magnitudeRatio = ratio(report.magnitude.observed, report.magnitude.specified)
    // 표본이 작으므로 폭을 넉넉히 둔다. 눌린 경우(0.5 미만)를 잡는 것이 목적이다.
    const within = (value) => value === null || (value >= 0.5 && value <= 1.8)
    report.sound = within(report.angleRatio) && within(report.magnitudeRatio)
    return report
}

async function playOne({ browser, url, profile, seed, act, readState, maxActions, timeoutMs }) {
    const context = await browser.newContext({ viewport: { width: 420, height: 900 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

    const noise = makeNoise(profile, seed)
    const startedAt = Date.now()
    try {
        await page.goto(url(seed), { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('canvas', { timeout: 30000 })
        await page.waitForFunction(readState, null, { timeout: 30000 })

        let actions = 0
        while (actions < maxActions && Date.now() - startedAt < timeoutMs) {
            const state = await page.evaluate(readState)
            if (!state || state.over) break
            const box = await page.locator('canvas').boundingBox().catch(() => null)
            if (!box) break
            await page.waitForTimeout(noise.reactionMs())
            await act({ page, state, noise, box })
            actions += 1
        }

        const state = await page.evaluate(readState)
        return { seed, actions, state, errors, ms: Date.now() - startedAt, noiseDrawn: noise.drawn }
    } finally {
        await context.close().catch(() => {})
    }
}

/** 여러 프로필을 정해진 동시성으로 돌리고, 하네스 자체 점검을 함께 낸다. */
export async function runProfiles({
    url,
    profiles,
    act,
    readState,
    concurrency = 3,
    maxActions = 200,
    timeoutMs = 240000,
    browser: given = null,
}) {
    const browser = given ?? await launchBrowser()
    const jobs = profiles.flatMap((profile) =>
        Array.from({ length: profile.runs ?? 3 }, (_, index) => ({
            profile,
            seed: (profile.seedBase ?? 1000) + index,
        })))

    const results = []
    let cursor = 0
    // 판마다 컨텍스트를 새로 열고 닫는다. 상태가 새지 않으면서 브라우저 하나를
    // 계속 쓰므로 시작 비용은 한 번만 낸다.
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (cursor < jobs.length) {
            const job = jobs[cursor++]
            results.push({
                profile: job.profile.name,
                ...(await playOne({ browser, url, act, readState, maxActions, timeoutMs, ...job })),
            })
        }
    })
    await Promise.all(workers)

    const byProfile = profiles.map((profile) => ({
        profile: profile.name,
        runs: results.filter((result) => result.profile === profile.name),
    }))

    if (!given) await browser.close()
    return { results, byProfile, selfCheck: profiles.map((profile) => selfCheck(profile, collectDrawn(results, profile))) }
}

function collectDrawn(results, profile) {
    const drawn = { angleDeg: [], magnitude: [], reactionMs: [] }
    for (const result of results) {
        if (result.profile !== profile.name) continue
        for (const key of Object.keys(drawn)) drawn[key].push(...(result.noiseDrawn?.[key] ?? []))
    }
    return drawn
}
