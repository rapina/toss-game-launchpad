# toss-game-launchpad

Sputnik Workshop 포트레이트 모바일 게임 셸 템플릿.
Toss(Apps-in-Toss) + Android(Capacitor) 출시 인프라(광고/IAP/리더보드/오디오/i18n)를
그대로 재사용하고, 게임 로직만 `GameRuntime` 인터페이스로 갈아끼운다.

- 새 게임 시작: **NEW_GAME.md** 체크리스트를 따른다.
- 에이전트 세션 규칙: **CLAUDE.md**.
- 씬 구조: `title → game → ranking`.

```bash
npm install
npm run dev      # 개발 서버
npm run smoke    # 헤드리스 스모크 테스트 (샘플 게임 완주 + 콘솔 에러 검사)
```
