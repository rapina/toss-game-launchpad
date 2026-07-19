/**
 * 아케이드 포털 CSP 아래 실기 확인 (공용).
 *
 *   node scripts/csp-portal-check.mjs
 *
 * 왜 있는가. 포털은 게임을 sandbox iframe 안에서 돌리면서 CSP를 건다. 로컬
 * `npm run dev`에는 CSP가 없다. 그래서 CSP에서만 죽는 결함은 검토자가 개발
 * 서버로 아무리 오래 플레이해도 보이지 않고, 포털에 올라간 뒤에야 드러난다.
 * 두 번 그렇게 됐다.
 *
 *   - 메질: 번들러가 남긴 eval이 script-src에 막혀 게임이 아예 뜨지 않았다.
 *   - 쇳물 가시: 런타임에 주입하던 <style>이 style-src 'self'에 막혀, 스타일
 *     없는 오버레이가 캔버스를 덮고 포인터를 전부 삼켰다. 검토는 그 빌드를
 *     통과시켰다. 개발 서버에는 CSP가 없었기 때문이다.
 *
 * 두 결함 모두 게임의 규칙을 하나도 몰라도 잡힌다. 스타일시트가 실제로 붙었는가,
 * CSP 위반 로그가 있는가, 캔버스가 떴는가, 오류가 없는가면 충분하다. 그래서 이
 * 검사는 launchpad에 있다. 게임마다 다시 짜면 다시 안 짜는 게임이 생긴다.
 *
 * 게임이 더 볼 것이 있으면 `scripts/csp-portal.game.mjs`에서 훅을 내보낸다.
 * 없으면 공용 검사만 돌고, 그것만으로도 위 두 결함은 막힌다.
 *
 *   export async function inspect(frame) { ... }   // 추가 관측값
 *   export function judge(observed) { ... }        // { 이름: boolean }
 *   export async function act(page, frame, box) {} // 실기 입력
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launchBrowser } from './play-harness.mjs'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist-arcade')
const out = join(root, 'verification')
const PORT = Number(process.env.CSP_PORT ?? 4191)

// 포털의 CSP를 흉내내지 않고 아케이드 저장소에서 그대로 읽어온다. 흉내낸 CSP는
// 진짜와 갈라지는 순간 조용히 쓸모없어진다.
const ARCADE_VERCEL = resolve(root, '../../../arcade/vercel.json')

if (!existsSync(dist)) {
  throw new Error('[csp] dist-arcade가 없다. 먼저 npm run build:arcade를 돌려라.')
}

function portalCsp() {
  if (!existsSync(ARCADE_VERCEL)) {
    throw new Error(`[csp] 아케이드 설정을 찾지 못했다: ${ARCADE_VERCEL}`)
  }
  const config = JSON.parse(readFileSync(ARCADE_VERCEL, 'utf8'))
  for (const rule of config.headers ?? []) {
    const header = (rule.headers ?? []).find((h) => h.key === 'Content-Security-Policy')
    if (header && /style-src/.test(header.value)) return header.value
  }
  throw new Error('[csp] arcade/vercel.json에서 CSP를 찾지 못했다')
}

const CSP = portalCsp()
const release = JSON.parse(readFileSync(join(dist, 'release.json'), 'utf8'))
if (!release.style) {
  throw new Error('[csp] release.json에 스타일시트가 없다. 오버레이 CSS가 번들되지 않았다.')
}

const hookPath = join(root, 'scripts', 'csp-portal.game.mjs')
const hooks = existsSync(hookPath) ? await import(pathToFileURL(hookPath).href) : {}

// runner.js와 마찬가지로 부트스트랩은 외부 모듈 파일이다. 인라인 <script>는
// 포털의 script-src 'self'에 막힌다.
const HOST_HTML = `<!doctype html><html><head><title>csp runner</title></head><body>
<div id="stage"></div>
<script type="module" src="/boot.mjs"></script></body></html>`

const BOOT_JS = `
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = ${JSON.stringify(`/__game-assets/${release.style}`)}
document.head.append(link)
await new Promise((r) => { link.onload = r; link.onerror = r })
const mod = await import(${JSON.stringify(`/__game-assets/${release.entry}`)})
const stage = document.getElementById('stage')
stage.style.width = '390px'
stage.style.height = '844px'
globalThis.__events = []
globalThis.__game = (mod.mountGame ?? mod.default)({
  root: stage,
  assetBaseUrl: '/',
  locale: 'ko',
  seed: '1',
  host: { emit: (e) => globalThis.__events.push(e) },
})
globalThis.__mounted = true
`

const PARENT_HTML = `<!doctype html><html><head><title>portal</title></head><body>
<iframe id="frame" src="/runner.html" sandbox="allow-scripts" width="390" height="844" frameborder="0"></iframe>
</body></html>`

const report404 = []
const MIME = {
  '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css',
  '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml',
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  // 포털과 동일하게 모든 응답에 CSP를 건다.
  const headers = {
    'Content-Security-Policy': CSP,
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  }
  if (url.pathname === '/') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(PARENT_HTML)
  }
  // 하네스 호스트 페이지에는 파비콘이 없다. 게임과 무관한 404 잡음을 없앤다.
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204, headers)
    return res.end()
  }
  if (url.pathname === '/boot.mjs') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' })
    return res.end(BOOT_JS)
  }
  if (url.pathname === '/runner.html') {
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(HOST_HTML)
  }
  if (!url.pathname.startsWith('/__game-assets/')) {
    report404.push(url.pathname)
    res.writeHead(404, headers)
    return res.end('not found')
  }
  const target = join(dist, normalize(url.pathname.slice('/__game-assets/'.length)).replace(/^([/\\])+/, ''))
  if (!target.startsWith(dist) || !existsSync(target)) {
    report404.push(url.pathname)
    res.writeHead(404, headers)
    return res.end('not found')
  }
  res.writeHead(200, { ...headers, 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' })
  createReadStream(target).pipe(res)
})

await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const report = {
  csp: CSP, style: release.style, entry: release.entry,
  hooked: Object.keys(hooks).length > 0,
  cspViolations: [], checks: {}, errors: [],
}
let exitCode = 0
const browser = await launchBrowser()

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'ko-KR' })
  page.on('console', (m) => {
    const text = m.text()
    if (/Content Security Policy/i.test(text)) report.cspViolations.push(text.slice(0, 200))
    else if (m.type() === 'error') report.errors.push(text.slice(0, 200))
  })
  page.on('pageerror', (e) => report.errors.push(String(e).slice(0, 200)))

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
  const frame = await (await page.waitForSelector('#frame')).contentFrame()
  await frame.waitForFunction(() => globalThis.__mounted === true, null, { timeout: 20000 })
  await frame.waitForSelector('canvas', { timeout: 20000 })

  // 1. 스타일이 실제로 붙었는가. 주입본이 막히던 시절에는 styleSheets가 0이었고
  //    모든 계산값이 브라우저 기본값이었다. 게임을 몰라도 판정할 수 있다.
  report.checks.style = await frame.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect() ?? null
    return {
      styleSheets: document.styleSheets.length,
      // cssRules는 읽지 않는다. 포털과 같은 sandbox iframe은 불투명 출처라
      // 접근이 SecurityError로 막히고, 규칙이 멀쩡해도 0으로 보인다.
      // (이 검사를 처음 짰을 때 그 0에 걸려 위양성이 났다.)
      //
      // 대신 규칙이 실제로 그려졌는지를 계산된 값으로 본다. 시트가 막히면
      // 모든 div가 position:static에 배경이 투명한 기본값으로 남는다. 그게
      // 쇳물 가시에서 오버레이가 캔버스를 삼킨 바로 그 상태다.
      styledElements: [...document.querySelectorAll('#stage *')].filter((el) => {
        if (el.getAttribute('style')) return false // 인라인은 증거가 아니다
        const cs = getComputedStyle(el)
        return cs.position !== 'static' || cs.pointerEvents === 'none'
      }).length,
      canvasWidth: rect?.width ?? 0,
      canvasHeight: rect?.height ?? 0,
    }
  })

  if (typeof hooks.act === 'function') {
    const box = await (await frame.waitForSelector('canvas')).boundingBox()
    report.checks.play = await hooks.act(page, frame, box)
  }
  if (typeof hooks.inspect === 'function') {
    report.checks.game = await hooks.inspect(frame)
  }

  report.missing = [...new Set(report404)]
  mkdirSync(out, { recursive: true })
  await page.screenshot({ path: join(out, 'csp-portal-play.png') })

  const s = report.checks.style
  report.checks.pass = {
    stylesheetLoaded: s.styleSheets > 0,
    // 시트는 받았는데 그려진 흔적이 없으면 CSP가 적용을 막은 것이다.
    styleRulesApplied: s.styledElements > 0,
    canvasLaidOut: s.canvasWidth > 0 && s.canvasHeight > 0,
    noStyleCspViolation: report.cspViolations.length === 0,
    noErrors: report.errors.length === 0,
    noMissingAssets: report.missing.length === 0,
    ...(typeof hooks.judge === 'function' ? hooks.judge(report.checks) : {}),
  }
  report.pass = Object.values(report.checks.pass).every(Boolean)
  if (!report.pass) exitCode = 1
} catch (error) {
  report.errors.push(String(error).slice(0, 400))
  report.pass = false
  exitCode = 1
} finally {
  await browser.close().catch(() => {})
  server.close()
}

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'csp-portal-result.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
console.log(report.pass ? 'CSP PORTAL OK' : 'CSP PORTAL FAILED')
process.exit(exitCode)
