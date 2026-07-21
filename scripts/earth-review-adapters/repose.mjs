// repose 지구 평가 어댑터 (Earth Review adapter).
//
// 게임마다 다른 것은 상태 읽기(readState)와 입력 결정(plan)뿐이다. 포털 접근·사람
// 모델·자체 점검·스크린샷은 공용 하네스(earth-review-harness.mjs)가 한다.
//
// repose 는 안식각 게임이다. 접시를 좌우로 기울이면(화면 어디서나 가로 위치가 곧
// 기울기 목표) 검은 모래 더미가 늦게 흘러가 봉우리가 기울기가 정하는 자리에 가서
// 선다. 종이 울리는 순간 봉우리 x 를 빛 기준선 x 에 맞추면 성공이고, 3번 흘리거나
// 44번을 다 재면 끝난다. 판정 시계는 입력과 무관하게 돈다 — 그래서 손을 대기만
// 하면 판은 반드시 정당한 게임오버(complete 또는 spill 예산 소진)에 도달한다.
//
// 입력은 한 번의 탭이다. 포인터를 x 에 내리면 그 x 가 곧 기울기 목표로 걸리고,
// 손을 떼도(탭이라 곧 뗀다) 그 자리에 그대로 남는다(모래는 되돌아오지 않는다).
// 그래서 사람 모델은 "지금 노릴 x"를 정해 그 자리에 탭을 놓고, 다음 운동 주기에
// 다시 놓는다. 봉우리는 늦게 도착하므로 지금 선이 있는 자리가 아니라 선이 갈
// 자리를 겨눈다.
//
// 종료는 두 갈래 모두 정당하다: 44번을 다 재거나(complete) 실패 예산 3을 다
// 쓰거나(spill). 어느 쪽이든 over===true 면 "정당한 게임오버"다. sandbox 불투명
// 출처 때문에 상태를 못 읽고 초반에 멈추던 임시 하네스와 달리, CDP 접근이면
// 사람 손이 끝까지 간다.

const TOTAL_JUDGMENTS = 44
const CENTER_X = 195
// 포인터 x → 기울기: tilt = (x - 195) / 171 (ReposeGame.applyPointer 와 같은 식).
const HALF_SPAN = 171
const TILT_GAIN = 0.85
// 밴드별 도착점 지도 반지름(공개 GDD 실측값). tilt → 봉우리 도착점 = 195 + R·gain·tilt.
const REST_MAP_RADIUS = [115.6, 112.7, 109.7, 106.3, 101.8]
// 모래가 늦는 시간(밴드별 실측). 선이 이만큼 뒤에 있을 자리를 겨눈다.
const LEAD_SECONDS = [1.27, 1.35, 1.48, 1.63, 1.76]

function tiltForTarget(targetX, band) {
    const R = REST_MAP_RADIUS[Math.max(0, Math.min(4, band - 1))]
    const tilt = (targetX - CENTER_X) / (R * TILT_GAIN)
    return Math.max(-1, Math.min(1, tilt))
}

function tiltToXFrac(tilt) {
    const xDesign = tilt * HALF_SPAN + CENTER_X
    return Math.max(0.04, Math.min(0.96, xDesign / 390))
}

export default {
    slug: 'repose',
    runnerVersion: 'v1',
    viewport: { width: 390, height: 844 },
    timeoutMs: 180_000,
    progressMax: TOTAL_JUDGMENTS,

    // 러너 iframe 안에서 평가된다. sandbox 불투명 출처라도 CDP Frame 은 통과한다.
    readState: () => globalThis.__gameState ?? null,

    isReady: (state) => Boolean(state),
    isFinished: (state) => state?.over === true,
    progress: (state) => Number(state?.judgments ?? 0),
    completed: (state) => state?.over === true,

    overReason(state) {
        if (!state?.over) return null
        if (state.overReason === 'complete') return 'complete (all 44 measured)'
        if (state.overReason === 'spill') return 'spill (failure budget spent)'
        return 'over'
    },

    // 판정이 넘어가는 순간의 화면을 남긴다: 밴드가 바뀔 때와 종료. 가독성은
    // 상태로 못 잡으므로 이 캡처가 사람/비전 검토의 몫이다.
    milestone(state) {
        if (state?.over) return 'over'
        if (state?.phase === 'title') return 'title'
        if (state?.phase === 'play') return `band-${state.band}`
        return null
    },

    /**
     * 한 번의 입력 결정. 사람 모델 노이즈(noise)와 판 사이 기억(mem)을 받는다.
     * 공간 게임이라 리듬 타이밍 대신 **판독 위치 오차**를 쓴다: 프로필의
     * angleSigmaDeg 를 px 단위 판독 오차로 재활용한다(intuitive ~7px, skilled ~4px).
     */
    plan(state, noise, mem) {
        if (state.over) return { waitMs: 120 }

        // 타이틀: 가운데를 눌러 판을 연다.
        if (state.phase === 'title') {
            return { tap: true, xFrac: 0.5, yFrac: 0.62, waitMs: 300 }
        }
        if (state.phase !== 'play') return { waitMs: 60 }

        const line = Number(state.lineX)
        const range = state.lineRange ?? { min: 112, max: 278 }
        const band = Number(state.band ?? 1)

        // 선 속도를 잇단 관측에서 추정한다(사람이 선이 움직이는 것을 보는 방식).
        const now = Date.now()
        let vel = mem.vel ?? 0
        if (mem.prevLine != null && mem.prevTs != null) {
            const dt = (now - mem.prevTs) / 1000
            if (dt > 0.02) {
                const inst = (line - mem.prevLine) / dt
                vel = mem.vel == null ? inst : mem.vel * 0.6 + inst * 0.4
            }
        }
        mem.prevLine = line
        mem.prevTs = now
        mem.vel = vel

        // 모래가 닿을 시각에 선이 있을 자리를 겨눈다(리드). 구간 끝에서 한 번 반사.
        const lead = LEAD_SECONDS[Math.max(0, Math.min(4, band - 1))]
        let target = line + vel * lead
        if (target > range.max) target = range.max - (target - range.max)
        if (target < range.min) target = range.min + (range.min - target)
        target = Math.max(range.min, Math.min(range.max, target))

        // 사람 판독 오차: angleSigmaDeg 를 px 로 재활용한다.
        target += noise.angleDeg()

        const tilt = tiltForTarget(target, band)
        return { tap: true, xFrac: tiltToXFrac(tilt), yFrac: 0.62, waitMs: 150 }
    },

    // 여러 판을 나눠 돌릴 프로필. 판독 위치 오차(angleSigmaDeg, px 로 재활용)만 다르다.
    profiles: [
        { name: 'intuitive', runs: 3, angleSigmaDeg: 7, magnitudeSigma: 0, reactionMs: [200, 40], seedBase: 8100 },
        { name: 'skilled', runs: 3, angleSigmaDeg: 4, magnitudeSigma: 0, reactionMs: [200, 40], seedBase: 8200 },
        { name: 'natural', runs: 3, angleSigmaDeg: 10, magnitudeSigma: 0, reactionMs: [260, 60], seedBase: 8300 },
    ],
}
