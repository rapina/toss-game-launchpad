/**
 * 지구 평가 CLI. 공용 하네스에 게임 어댑터를 물려 공개 포털을 사람 모델로 플레이한다.
 *
 *   node scripts/earth-review.mjs <slug> [--access cdp|page-script] [--url <base>]
 *
 * 기본 대상은 공개 포털(https://laika365.vercel.app). 로컬 서브 서버로 시험하려면
 * ARCADE_URL 이나 --url 로 바꾼다. 공개 빌드가 Vercel 보호로 막혀 있으면
 * VERCEL_AUTOMATION_BYPASS_SECRET 을 주면 smoke-player 와 같은 방식으로 우회한다.
 *
 * --access page-script 는 이빨 대조용이다. 임시 하네스가 쓰던 페이지 스크립트 접근으로
 * 되돌려, 같은 사람 모델이 sandbox 불투명 출처 때문에 초반에 멈추는지 재현한다.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CDP_ACCESS, PAGE_SCRIPT_ACCESS, runEarthReview } from './earth-review-harness.mjs'

const slug = process.argv[2]
if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug ?? '')) {
    process.stderr.write('Usage: node scripts/earth-review.mjs <slug> [--access cdp|page-script] [--url <base>]\n')
    process.exit(1)
}

const accessFlag = argValue('--access') ?? 'cdp'
const access = accessFlag === 'page-script' ? PAGE_SCRIPT_ACCESS : CDP_ACCESS
const baseUrl = (argValue('--url') || process.env.ARCADE_URL || 'https://laika365.vercel.app').replace(/\/+$/, '')

const adapterPath = resolve(import.meta.dirname, 'earth-review-adapters', `${slug}.mjs`)
const { default: adapter } = await import(pathToFileURL(adapterPath).href)

const qaDir = resolve(import.meta.dirname, '..', 'earth-review')
mkdirSync(qaDir, { recursive: true })

process.stdout.write(`[earth-review] ${slug} via ${access.name} against ${baseUrl}\n`)

const summary = await runEarthReview({
    baseUrl,
    adapter,
    profiles: adapter.profiles,
    access,
    concurrency: Number(process.env.EARTH_CONCURRENCY ?? 3),
    qaDir,
})

for (const profile of summary.byProfile) {
    const sc = profile.selfCheck
    process.stdout.write(
        `  ${profile.profile.padEnd(10)} completed ${profile.completed}/${profile.runs}` +
            ` (rate ${profile.completionRate})  reached ${JSON.stringify(profile.reachedProgress)}` +
            `  timingRatio ${sc.timingRatio}  sound ${sc.sound}\n`,
    )
    for (const stop of profile.stoppedAt) {
        process.stdout.write(
            `      seed ${stop.seed}: ${stop.progress}  ${stop.overReason ?? 'no terminal'}` +
                `${stop.inputBlocked ? '  INPUT-BLOCKED' : ''}${stop.nullReads > 20 ? `  nullReads=${stop.nullReads}` : ''}` +
                `${stop.accessError ? `  accessError=${stop.accessError}` : ''}\n`,
        )
    }
}

const anyCompleted = summary.byProfile.some((profile) => profile.completed > 0)
process.stdout.write(
    `[earth-review] ${access.name}: ${anyCompleted ? 'reached terminal (playable)' : 'NO run reached a terminal'}\n`,
)

function argValue(flag) {
    const index = process.argv.indexOf(flag)
    return index >= 0 ? process.argv[index + 1] : null
}
