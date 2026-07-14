export type Locale = 'ko' | 'en' | 'zh' | 'ja'

/**
 * Shell UI strings. Game content strings (rules, dialog, item names, …)
 * belong in separate per-domain files merged in i18n/index.ts — see how
 * DEAD HAND split codex/dialog/gameUi translations.
 */
export const translations: Record<Locale, Record<string, string>> = {
    ko: {
        'title.name': 'GAME TEMPLATE',
        'title.tagline': '새 게임을 시작하세요',
        'title.play': '시작',
        'title.ranking': '랭킹',
        'game.exit': '나가기',
        'ranking.title': '랭킹',
        'ranking.best': '최고 기록!',
        'ranking.empty': '아직 기록이 없습니다',
        'ranking.retry': '다시 하기',
        'ranking.menu': '메뉴로',
        'error.title': '오류',
        'error.leaderboard': '리더보드를 열 수 없습니다.',
    },
    en: {
        'title.name': 'GAME TEMPLATE',
        'title.tagline': 'Start your new game',
        'title.play': 'PLAY',
        'title.ranking': 'RANKING',
        'game.exit': 'EXIT',
        'ranking.title': 'RANKING',
        'ranking.best': 'NEW BEST!',
        'ranking.empty': 'No records yet',
        'ranking.retry': 'RETRY',
        'ranking.menu': 'MENU',
        'error.title': 'Error',
        'error.leaderboard': 'Could not open the leaderboard.',
    },
    zh: {
        'title.name': 'GAME TEMPLATE',
        'title.tagline': '开始你的新游戏',
        'title.play': '开始',
        'title.ranking': '排行榜',
        'game.exit': '退出',
        'ranking.title': '排行榜',
        'ranking.best': '新纪录！',
        'ranking.empty': '暂无记录',
        'ranking.retry': '再来一次',
        'ranking.menu': '菜单',
        'error.title': '错误',
        'error.leaderboard': '无法打开排行榜。',
    },
    ja: {
        'title.name': 'GAME TEMPLATE',
        'title.tagline': '新しいゲームを始めよう',
        'title.play': 'スタート',
        'title.ranking': 'ランキング',
        'game.exit': '終了',
        'ranking.title': 'ランキング',
        'ranking.best': '新記録！',
        'ranking.empty': 'まだ記録がありません',
        'ranking.retry': 'リトライ',
        'ranking.menu': 'メニューへ',
        'error.title': 'エラー',
        'error.leaderboard': 'リーダーボードを開けませんでした。',
    },
}
