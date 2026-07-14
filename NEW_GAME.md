# NEW_GAME.md — 새 게임 시작 체크리스트

템플릿을 복사한 직후 위에서 아래로 순서대로 진행한다.
코드 안에서 해야 하는 항목은 에이전트(Claude Code)에게 맡길 수 있고,
콘솔/대시보드 항목은 사람이 직접 해야 한다.

## 1. 프로젝트 초기화 (코드)

```bash
# 1) 템플릿 복사
cp -r toss-game-launchpad my-new-game && cd my-new-game
rm -rf .git && git init

# 2) 아이덴티티 일괄 치환 (appId / 앱 이름 / Toss appName / 표시명)
npm run new-game -- --id com.sputnik.mygame --name "MY GAME" --slug mygame --display "내 게임"

# 3) 셸이 그대로 도는지 확인
npm install
npx tsc -b
npm run smoke        # 샘플 게임이 헤드리스로 한 판 완주하면 OK
```

## 2. 게임 설계 (문서)

- [ ] `GDD.md` 작성 — 장르, 코어 루프, 점수 규칙, 진행도, 수익화 지점.
      이후 모든 에이전트 세션이 이 문서를 기준으로 작업한다.

## 3. 게임 구현 (코드 — 에이전트 위임 가능)

- [ ] `src/game/<MyGame>.ts` — `GameRuntime`(src/game/types.ts) 구현.
      랜덤은 반드시 `logicRandom()` 사용 (스모크 테스트의 재현성 전제).
- [ ] `src/components/GameScreen.tsx` — `new SampleGame()`을 새 런타임으로 교체.
- [ ] `src/game/SampleGame.ts` 삭제.
- [ ] `src/appConfig.ts` — 배너 사용 여부, 전면광고 주기, 디자인 해상도.
- [ ] `src/i18n/translations.ts` — 타이틀명/문구 교체. 게임 콘텐츠 문자열은
      별도 파일로 분리해서 `i18n/index.ts`에서 병합.
- [ ] `TitleScreen` / `RankingScreen` / `index.css` 테마 리스타일.
- [ ] 필요 시 리워드 광고 표면(`RewardedAdPurpose`)과 IAP 상품(`IapProductId`) 확장.

## 4. 에셋 (코드 + 생성 도구)

- [ ] `public/audio/title.mp3`, `game.mp3` 교체 (`src/audio/bgmConfig.ts`에 등록).
- [ ] 앱 아이콘 원본 1024px 제작 → `scripts/gen_app_icon.py`로 밀도별 생성
      (android mipmap + 웹 favicon/icon 세트).
- [ ] 스토어용 스크린샷/그래픽 (Google Play 기능 그래픽 1024x500, Toss 600px 아이콘).

## 5. Android 릴리스 준비 (콘솔 + 로컬 시크릿)

- [ ] 키스토어 생성 → `android/keystore.properties` 작성 (gitignore 됨):
      `keyAlias / keyPassword / storeFile / storePassword`
- [ ] AdMob 앱 등록 → **앱 ID**를 `android/app/src/main/AndroidManifest.xml`의
      `com.google.android.gms.ads.APPLICATION_ID`에 반영 (현재 테스트 ID).
- [ ] AdMob 유닛 생성 → `src/ads/defaultAd.ts`의 배너/전면/리워드 ID 교체
      (현재 구글 공식 테스트 ID — 출시 전 필수 교체).
- [ ] Google Play Console 앱 등록, 내부 테스트 트랙 업로드:
      `npm run android:release` → `android/app/build/outputs/bundle/release/`

## 6. Toss (Apps-in-Toss) 릴리스 준비 (콘솔)

- [ ] Toss 콘솔에 앱 등록 → 발급된 값으로:
      - `granite.config.ts` — `appName`, `brand.displayName`, `brand.icon` URL
      - `.granite/app.json` — `appName`
- [ ] 광고 그룹 생성(배너/전면·리워드) → `src/ads/tossAd.ts`의 `TODO_` ID 교체.
- [ ] 게임센터 리더보드 사용 시 콘솔에서 활성화 (tossAdapter가 점수 제출).
- [ ] IAP 상품 등록(NON_CONSUMABLE) → `src/iap/constants.ts`의 `TOSS_SKU` 교체.
- [ ] `npm run toss:build` → `.ait` 산출물 업로드.

## 7. 출시 전 최종 확인

- [ ] `npx tsc -b` / `npm run build` / `npm run smoke` 모두 통과.
- [ ] Android 실기기: `npm run android:deploy` 후 배너·전면·리워드 광고 동작 확인.
- [ ] Toss 샌드박스: 로그인, 리더보드, IAP 구매/복원 확인.
- [ ] `STORAGE_PREFIX`(src/appConfig.ts)가 slug로 설정됐는지 확인 — 출시 후 변경 금지.
- [ ] 스토어 설명 작성 (`STORE_DESCRIPTIONS.md` 권장).
