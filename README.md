# toss-game-launchpad

포트레이트(9:16) 모바일 게임을 **Toss(Apps-in-Toss)와 Android(Google Play)에 동시 출시**하기 위한
셸 템플릿. 광고·인앱결제·리더보드·오디오·다국어·빌드 파이프라인 등 플랫폼 인프라를 전부 내장하고,
게임 로직만 `GameRuntime` 인터페이스로 갈아끼우는 구조다.

```text
씬 구조:  title ──▶ game ──▶ ranking ──▶ (retry → game | menu → title)
```

## 기술 스택

| 영역 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 언어 | TypeScript | ~5.6 | 전체 코드 (4-space, 세미콜론 없음) |
| UI 셸 | React | 18 | 씬 라우팅, 오버레이, 버튼 등 DOM UI |
| 게임 렌더링 | Pixi.js | 8 | 캔버스 게임 스테이지 (WebGL/WebGPU) |
| 빌드 | Vite | 6 | 개발 서버 + 번들 (`__PLATFORM__` 컴파일 타임 분기) |
| Android | Capacitor | 8 | WebView 네이티브 래핑, Gradle 빌드 |
| Android 광고 | @capacitor-community/admob | 8 | 배너/전면/리워드 |
| Toss | @apps-in-toss/web-framework (Granite) | 2.x | 로그인, 게임센터 리더보드, TossAds, IAP |
| 다국어 | i18next + react-i18next | 26 / 17 | ko / en / zh / ja |
| 검증 | playwright-core | 1.x | 헤드리스 스모크 테스트 (`scripts/smoke.mjs`) |
| 폰트 | Galmuri11 / Galmuri14 | — | 픽셀 폰트 (DOM + Pixi 공용, `src/main.tsx`에서 프리로드) |

## 빠른 시작 (새 게임 만들기)

```bash
# 1) 템플릿 복제
git clone https://github.com/rapina/toss-game-launchpad.git my-new-game
cd my-new-game
rm -rf .git && git init

# 2) 아이덴티티 일괄 치환 — appId, 앱 이름, Toss appName, 표시명
npm run new-game -- --id com.studio.mygame --name "MY GAME" --slug mygame --display "내 게임"

# 3) 셸 동작 확인
npm install
npx tsc -b          # 타입 체크
npm run smoke       # 샘플 게임 헤드리스 완주 → SMOKE OK 확인
npm run dev         # 브라우저에서 직접 확인
```

이후 절차(아이콘, 광고 ID, IAP SKU, 키스토어, 콘솔 등록)는 **NEW_GAME.md** 체크리스트를 따른다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버 |
| `npx tsc -b` | 타입 체크만 (코드 수정 후 기본 검증) |
| `npm run smoke` | 헤드리스 스모크 테스트 — 아래 [스모크 테스트](#스모크-테스트) 참고 |
| `npm run build` | 웹 프로덕션 빌드 (`dist/`) |
| `npm run build:cap` | Capacitor용 빌드 (상대 경로 base) |
| `npm run android:deploy` | 디버그 빌드 → `adb install` (연결된 기기) |
| `npm run android:release` | 버전 범프 → 릴리스 AAB (`android/app/build/outputs/bundle/release/`) |
| `npm run android:release:apk` | 릴리스 APK |
| `npm run toss:dev` | Granite 개발 모드 (Toss 샌드박스 연동) |
| `npm run toss:build` | `.ait` 산출물 빌드 (Toss 콘솔 업로드용) |
| `npm run bump-version` | package.json patch 버전 + Android versionCode 증가 |
| `npm run new-game -- --id … --name … --slug … --display …` | 템플릿 아이덴티티 일괄 치환 (복제 직후 1회) |

## 디렉토리 구조

```text
├── index.html               # 앱 진입점
├── autoplay.html            # 스모크 테스트 전용 진입점 (GameScreen 단독 마운트)
├── capacitor.config.ts      # Android appId / appName
├── granite.config.ts        # Toss appName / brand / 개발 서버 설정
├── .granite/app.json        # Toss 앱 메타
├── vite.config.ts           # __APP_VERSION__ / __DEV_BUILD__ / __PLATFORM__ 주입
├── android/                 # Capacitor Android 프로젝트 (Gradle)
├── public/
│   ├── audio/               # BGM (title.mp3, game.mp3)
│   └── fonts/               # Galmuri 폰트
├── scripts/
│   ├── new-game.js          # 아이덴티티 치환 스크립트
│   ├── smoke.mjs            # 헤드리스 스모크 테스트
│   ├── bump-version.js      # 버전 범프
│   ├── android-gradle.js    # gradlew 크로스 플랫폼 래퍼
│   └── gen_app_icon.py      # 앱 아이콘 밀도별 리사이즈
└── src/
    ├── main.tsx             # React 부트스트랩 + 폰트 프리로드
    ├── App.tsx              # 씬 라우팅, 어댑터 초기화, 전면광고 주기
    ├── appConfig.ts         # ★ 게임별 설정 (배너, 광고 주기, 해상도, STORAGE_PREFIX)
    ├── autoplay.tsx         # 스모크 테스트 진입점 (시드 RNG 주입)
    ├── game/
    │   ├── types.ts         # ★ GameRuntime 계약 — 셸과 게임의 유일한 접점
    │   ├── SampleGame.ts    # 예제 런타임 (원 탭 게임) — 실제 게임으로 교체
    │   ├── logicRng.ts      # 시드 가능한 RNG (재현 가능한 런)
    │   └── records.ts       # 로컬 톱10 기록 + 플레이 카운트
    ├── components/
    │   ├── MobileFrame.tsx  # 9:16 프레임 + 배너 슬롯
    │   ├── GameScreen.tsx   # ★ 런타임 마운트 지점 (생성자 한 줄 교체)
    │   ├── AdBanner.tsx     # 배너 컨테이너 (remove_ads 구매 시 자동 숨김)
    │   └── Modal.tsx
    ├── screens/
    │   ├── TitleScreen.tsx  # 타이틀 / 시작 / 랭킹 / 언어 전환
    │   └── RankingScreen.tsx# 점수 제출 + 톱10 표시 (뷰 전용 모드 지원)
    ├── platform/            # PlatformAdapter: 유저 ID, 리더보드, 리뷰
    │   ├── types.ts / index.ts (팩토리)
    │   ├── defaultAdapter.ts# Android/웹 — 로컬 기록만
    │   └── tossAdapter.ts   # Toss 게임센터 연동
    ├── ads/                 # AdAdapter: 배너 / 전면 / 리워드
    │   ├── types.ts / index.ts / constants.ts
    │   ├── defaultAd.ts     # AdMob (현재 구글 테스트 ID)
    │   ├── tossAd.ts        # TossAds (TODO_ 플레이스홀더)
    │   └── webAd.ts         # 웹 개발용 더미
    ├── iap/                 # IapAdapter: 인앱결제 + 소유권
    │   ├── types.ts / index.ts / constants.ts (SKU 테이블)
    │   ├── tossIap.ts / defaultIap.ts
    │   └── entitlements.ts / useEntitlement.ts
    ├── audio/               # BGM 크로스페이드, SFX 신스, 볼륨 설정
    ├── i18n/                # ko/en/zh/ja — translations.ts + 도메인별 파일 병합
    ├── hooks/               # useBGM (씬→트랙 매핑), useTypewriter
    └── utils/               # shareScreenshot (html2canvas)
```

★ = 새 게임을 만들 때 반드시 만지게 되는 파일.

## 핵심 개념

### 1. GameRuntime 계약

셸과 게임 로직의 유일한 접점. `src/game/types.ts`:

```ts
interface GameRuntime {
    mount(container: HTMLElement, callbacks: GameCallbacks): Promise<void>
    destroy(): void
    getDebugState(): Record<string, unknown>   // __gameState로 노출 — 스모크 테스트가 감시
}

interface GameCallbacks {
    onGameOver(result: GameResult): void       // { score, phase }
    onScoreChange?(score: number): void
}
```

새 게임 구현 절차:

1. `src/game/MyGame.ts`에 `GameRuntime` 구현 (Pixi든 DOM이든 자유)
2. `src/components/GameScreen.tsx`의 `new SampleGame()`을 `new MyGame()`으로 교체
3. `src/game/SampleGame.ts` 삭제

규칙: 게임플레이 랜덤은 **반드시 `logicRandom()`**(`src/game/logicRng.ts`) 사용.
`?seed=N`으로 런이 재현되어야 스모크 테스트와 밸런스 검증이 성립한다.
런타임 내부에서 플랫폼/광고 코드를 직접 호출하지 말 것 — 필요하면 GameScreen을 통해 콜백으로 연결한다.

### 2. 어댑터 패턴 (플랫폼 분기)

플랫폼 선택은 **컴파일 타임**이다. `VITE_PLATFORM=toss`로 빌드하면 `__PLATFORM__ === 'toss'`가 되어
팩토리(`src/*/index.ts`)가 Toss 어댑터를 동적 import하고, 아니면 Capacitor(네이티브) 또는 웹 더미를 쓴다.

| 인터페이스 | Toss | Android/기본 | 웹 개발 |
|-----------|------|-------------|---------|
| `PlatformAdapter` | 게임센터 리더보드, 유저 키 | 로컬 기록만 | 로컬 기록만 |
| `AdAdapter` | TossAds | AdMob | 더미 모달 |
| `IapAdapter` | Toss IAP | 미구현(비활성) | 비활성 |

확장 지점:

- **리워드 광고 표면 추가** → `src/ads/types.ts`의 `RewardedAdPurpose` 유니온 확장 후
  `defaultAd.ts`(AdMob 유닛)와 `tossAd.ts`(광고 그룹)에 ID 케이스 추가
- **IAP 상품 추가** → `src/iap/types.ts`의 `IapProductId` 확장 후 `constants.ts`의 SKU 테이블 갱신
- **씬 추가** → `App.tsx`의 `Screen` 유니온, `hooks/useBGM.ts`의 `SCREEN_TRACK`, 번역 키 추가

### 3. appConfig (게임별 설정)

`src/appConfig.ts` 한 파일에 게임별 스위치가 모여 있다:

```ts
export const STORAGE_PREFIX = 'gametemplate'  // localStorage 키 프리픽스 — 출시 후 변경 금지!
export const APP_CONFIG = {
    showAdBanner: true,          // false → 하단 배너 슬롯 제거, 게임이 전체 프레임 사용
    interstitialEveryNGames: 3,  // N판마다 전면광고 (0 = 사용 안 함)
    designWidth: 400,            // Pixi 스테이지 논리 해상도 (9:16)
    designHeight: 711,
}
```

`STORAGE_PREFIX`는 기록·설정·구매내역의 localStorage 키에 쓰이므로 출시 후 바꾸면
플레이어 데이터가 전부 유실된다. `new-game` 스크립트가 slug로 자동 설정한다.

### 4. 수익화 기본 배선

- **배너**: `AdBanner`가 슬롯을 차지하고, `remove_ads` 소유권(entitlement)이 있으면 자동으로 숨는다.
- **전면**: 게임오버 시 `App.tsx`가 플레이 카운트를 세서 N판마다 표시.
- **리워드**: `adAdapter.showRewardedAd('default')` → `Promise<boolean>` (보상 지급 여부).
  앱 시작 시 프리로드되어 있어 즉시 표시된다.
- **IAP**: `useEntitlement('remove_ads')` 훅으로 어느 컴포넌트에서든 소유권 구독 가능.

## 스모크 테스트

에이전트/CI가 사람 없이 "게임이 실제로 도는지"를 판정하는 도구. `npm run smoke`:

1. Vite dev 서버를 4173 포트에 띄운다
2. 헤드리스 Chrome으로 `autoplay.html?seed=1` 접속 — `GameScreen`만 단독 마운트, RNG 시드 고정
3. 캔버스를 무작위 클릭하며 `globalThis.__gameState.over === true`까지 대기
4. `smoke.png`(스크린샷)와 `smoke-result.json`(최종 상태, GameResult, 에러 목록) 저장

**콘솔/페이지 에러가 하나라도 있으면 실패(exit 1)**. 로컬 Chrome 설치가 필요하며
경로가 다르면 `CHROME=<chrome.exe 경로>` 환경 변수로 지정한다.
메뉴 조작이나 드래그가 필요한 게임이라면 `scripts/smoke.mjs`의 클릭 루프를 게임에 맞게 확장한다
(종료 조건 `__gameState.over` 계약은 유지).

## 플랫폼 출시

### Android (Google Play)

1. 키스토어 생성 → `android/keystore.properties` 작성 (gitignore 대상)
2. AdMob 앱 등록 → `AndroidManifest.xml`의 `APPLICATION_ID` 교체 (현재 테스트 ID)
3. AdMob 유닛 생성 → `src/ads/defaultAd.ts`의 배너/전면/리워드 ID 교체
4. `npm run android:release` → AAB 업로드

### Toss (Apps-in-Toss)

1. Toss 콘솔에 앱 등록 → `granite.config.ts`(appName, displayName, icon URL), `.granite/app.json` 갱신
2. 광고 그룹 발급 → `src/ads/tossAd.ts`의 `TODO_` ID 교체
3. IAP 상품 등록(NON_CONSUMABLE) → `src/iap/constants.ts`의 `TOSS_SKU` 교체
4. 게임센터 리더보드 활성화 (점수 제출은 `tossAdapter`가 자동 처리)
5. `npm run toss:build` → `.ait` 업로드

## 다국어 / 오디오 / 에셋

- **i18n**: `src/i18n/translations.ts`는 셸 UI 문자열. 게임 콘텐츠 문자열은 도메인별 파일로 분리해
  `i18n/index.ts`의 resources 병합부에 추가한다. 언어 감지 → localStorage 저장, 타이틀에서 수동 전환.
- **BGM**: `public/audio/`에 mp3를 넣고 `src/audio/bgmConfig.ts`에 등록 →
  `hooks/useBGM.ts`의 씬 매핑에 연결. 크로스페이드/덕킹/백그라운드 일시정지 내장.
- **SFX**: `src/audio/SFXSynth.ts`가 WebAudio로 효과음을 합성 — 파일 없이 동작.
- **아이콘**: 1024px 원본 제작 후 `scripts/gen_app_icon.py`로 Android mipmap + 웹 아이콘 세트 생성.

## 문서

| 파일 | 내용 |
|------|------|
| `NEW_GAME.md` | 새 게임 시작 체크리스트 (코드 작업 + 콘솔 작업 구분) |
| `CLAUDE.md` | 에이전트(Claude Code) 세션 규칙 — 아키텍처, 작업 규칙, 검증 루프 |
| `GDD.md` | 게임 디자인 문서 스텁 — 새 게임 시작 시 먼저 채울 것 |
| `src/ads/ADS.md` | 광고 연동 상세 노트 |
