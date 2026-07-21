// grainsplit 지구 평가 어댑터 (Earth Review adapter).
//
// 게임마다 다른 것은 상태 읽기와 입력 결정뿐이다. 그 둘만 여기 둔다. 포털 접근·
// 사람 모델·자체 점검·스크린샷은 공용 하네스(earth-review-harness.mjs)가 한다.
//
// grainsplit 은 리듬/박자 게임이다. 통나무가 되튈 때(recoil) 봉우리에서 쐐기를 박아야
// 결이 갈라진다. 화면의 초록 링이 성공 창을 보여주고, errorMs 가 봉우리(0)까지의
// 부호 있는 타이밍 오차다. 사람은 봉우리(0)를 노리지만 손이 정확히 0에 떨어지지는
// 않는다 → N(0, timingSigmaMs) 만큼 빗나간 지점에서 탭한다. 그 오차가 곧 판정을
// 가른다. 어려운 밴드일수록 성공 창이 좁아(±140ms → ±56ms) 같은 손떨림이라도
// 뒤로 갈수록 더 자주 실패한다. 그래서 프로필별 완주율이 갈린다.
//
// 종료는 두 갈래 모두 정당하다: 14통나무를 다 가르거나(complete), 실패 예산 3을
// 다 쓰거나(wedgesGone). 어느 쪽이든 over===true 에 도달하면 "완주 또는 정당한
// 게임오버"다. 임시 하네스는 여기까지 못 가고 초반에 멈췄다.

const TOTAL_LOGS = 14
const FAILURE_BUDGET = 3

export default {
    slug: 'grainsplit',
    runnerVersion: 'v1',
    viewport: { width: 390, height: 844 },
    timeoutMs: 180_000,
    progressMax: TOTAL_LOGS,

    // 러너 iframe 안에서 평가된다. sandbox 불투명 출처라도 CDP Frame 은 통과한다.
    readState: () => globalThis.__gameState ?? null,

    isReady: (state) => Boolean(state),
    isFinished: (state) => state?.over === true,
    progress: (state) => Number(state?.logIndex ?? 0),
    completed: (state) => state?.over === true,

    overReason(state) {
        if (!state?.over) return null
        if (Number(state.failures ?? 0) >= FAILURE_BUDGET) return 'wedgesGone (failure budget spent)'
        if (Number(state.logIndex ?? 0) >= TOTAL_LOGS) return 'complete (all logs split)'
        return 'over'
    },

    // 판정이 넘어가는 순간의 화면을 남긴다: 밴드가 바뀔 때와 종료. 가독성은
    // 상태로 못 잡으므로 이 캡처가 사람/비전 검토의 몫이다.
    milestone(state) {
        if (state?.over) return 'over'
        if (state?.started) return `band-${state.band}`
        if (state?.phase === 'title') return 'title'
        return null
    },

    // 실측 판정 오차 추적용 서명. 새 탭이 판정되면 값이 바뀐다.
    tapSignature(state) {
        if (!Number.isFinite(Number(state?.lastTapErrorMs))) return null
        return `${state.logIndex}:${state.splits}:${state.failures}:${state.lastTapErrorMs}`
    },

    /**
     * 한 번의 입력 결정. 사람 모델 노이즈(noise), 판 사이 기억(mem), 그리고 타이밍
     * 예산(timing: 상태값이 얼마나 오래됐는지 staleMs, 클릭 지연 clickLatencyMs)을 받는다.
     *
     * errorMs 는 봉우리(0)까지의 부호 있는 위상 오차이고, 실시간으로 1ms 당 1ms 씩
     * 오른다(엔진이 phaseMs 에 dtMs 를 더한다). 그래서 "지금 errorMs 가 e 다"를 알면
     * 손이 offset 에 떨어지려면 (offset - e)ms 뒤에 눌러야 한다는 걸 곧바로 계산할 수
     * 있다. 이 예측 덕분에 CDP 왕복 지연을 임계 경로에서 빼고, 로컬 타이머로만 기다렸다
     * 누른다. 사람은 봉우리(0)를 노리지만 손은 timingMs 만큼 빗나간 offset 에 떨어진다.
     */
    plan(state, noise, mem, timing = {}) {
        if (state.over) return { waitMs: 120 }

        // 타이틀·가이드 정지 화면: 가운데를 눌러 판을 연다.
        if (state.phase === 'title' || state.started === false) {
            mem.armed = false
            return { tap: true, xFrac: 0.5, yFrac: 0.62, waitMs: 260 }
        }

        // 판정이 나는 중(쐐기가 튕기거나 갈라지는 중)엔 기다린다.
        if (state.outcome !== null) {
            mem.armed = false
            return { waitMs: 20 }
        }

        const stale = Number(timing.staleMs ?? 0)
        const click = Number(timing.clickLatencyMs ?? 30)
        // 읽은 값은 stale 만큼 오래됐다. 지금 이 순간의 errorMs 는 그만큼 더 커져 있다.
        const nowErr = Number(state.errorMs) + stale

        // 봉우리에 한참 못 미친(이른) 구간에서 무장하고, 이번 사이클에 노릴 지점을 뽑는다.
        if (!mem.armed && nowErr < -80) {
            mem.armed = true
            mem.offsetMs = noise.timingMs()
        }

        if (mem.armed) {
            // 손이 offset 에 떨어지기까지 남은 시간에서 클릭 지연을 미리 뺀다.
            const waitBeforeMs = mem.offsetMs - nowErr - click
            if (waitBeforeMs >= -4 && waitBeforeMs < 500) {
                mem.armed = false
                return { tap: true, xFrac: 0.5, yFrac: 0.62, waitBeforeMs: Math.max(0, waitBeforeMs), waitMs: 60 }
            }
            if (waitBeforeMs < -4) {
                // 이미 노린 지점을 지나쳤다(샘플이 늦었다). 이번 사이클은 접고 다음을 노린다.
                mem.armed = false
                return { waitMs: 16 }
            }
        }

        return { waitMs: 10 }
    },

    // 여러 판을 나눠 돌릴 프로필. 손떨림의 폭(timingSigmaMs)만 다르다.
    // 밴드 성공 창이 ±140→±56ms 이므로 sigma 가 크면 뒤 밴드에서 무너진다.
    profiles: [
        { name: 'intuitive', runs: 3, timingSigmaMs: 55, reactionMs: [220, 45], seedBase: 7100 },
        { name: 'skilled', runs: 3, timingSigmaMs: 26, reactionMs: [185, 32], seedBase: 7200 },
        { name: 'natural', runs: 3, timingSigmaMs: 40, reactionMs: [205, 40], seedBase: 7300 },
    ],
}
