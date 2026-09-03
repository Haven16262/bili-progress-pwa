// T7 验证脚本：液体玻璃落地后的断点截图 + 横向溢出检查 + CPU throttle 滚动实测
// 用法：node plans/ui-refresh/verify-t7.mjs（需先 npm run build && npm run preview）
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = 'plans/ui-refresh/screenshots'
mkdirSync(OUT, { recursive: true })

const BASE = process.env.PREVIEW_URL || 'http://localhost:4173'

// —— 被测视频：覆盖 4 个液色分级（<30 cyan / 30-59 blue / 60-89 violet / 90+ purple）——
const videos = [
  { id: 1, bvid: 'BV1a', title: 'Rust 所有权 · 第 3 讲', progress: 94, custom_name: '', archived: 0 },
  { id: 2, bvid: 'BV1b', title: '现代宇宙学 Ep.7', progress: 62, custom_name: '', archived: 0 },
  { id: 3, bvid: 'BV1c', title: 'Linux 内核导读', progress: 38, custom_name: '', archived: 0 },
  { id: 4, bvid: 'BV1d', title: '数据库系统 15-445', progress: 21, custom_name: '', archived: 0 },
  { id: 5, bvid: 'BV1e', title: '线性代数应该这样学', progress: 50, custom_name: '线代', archived: 0 },
  { id: 6, bvid: 'BV1f', title: '编译原理 · 龙书精讲', progress: 87, custom_name: '', archived: 0 },
  ...Array.from({ length: 34 }, (_, i) => ({
    id: 7 + i, bvid: `BV2${String(i).padStart(2, '0')}`,
    title: `性能测试视频 ${i + 1}`, progress: (i * 13) % 100, custom_name: '', archived: 0
  }))
]

const MOCKS = [
  ['**/api/auth/verify', { ok: true }],
  ['**/api/sync/status', { hasProblem: false, status: 'success', message: '更新 4 个视频', at: null }],
  ['**/api/videos', videos],
  ['**/api/videos/completed', []],
  ['**/api/settings', { sessdata_set: true }]
]

function mockApi(context) {
  return context.route('**/api/**', async route => {
    const url = route.request().url()
    for (const [pattern, body] of MOCKS) {
      if (url.includes(pattern.replace('**', ''))) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      }
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
}

// 横向溢出：html/body 层面必须无溢出（mobile 网格的横向滚动是 .home-grid-scroll 容器内行为）
async function checkOverflow(page, label) {
  const r = await page.evaluate(() => {
    const html = document.documentElement
    const main = document.querySelector('main')
    return {
      htmlSW: html.scrollWidth, innerW: window.innerWidth,
      mainSW: main?.scrollWidth ?? 0, mainCW: main?.clientWidth ?? 0
    }
  })
  const ok = r.htmlSW <= r.innerW + 1
  console.log(`  [${label}] html.scrollWidth=${r.htmlSW} innerW=${r.innerW} main.scrollW=${r.mainSW}/${r.mainCW} → ${ok ? 'OK' : 'OVERFLOW ✗'}`)
  return ok
}

const VIEWPORTS = [
  { w: 320, h: 568 }, { w: 375, h: 667 }, { w: 768, h: 1024 },
  { w: 1024, h: 768 }, { w: 1440, h: 900 }
]

const browser = await chromium.launch()
let allOk = true

for (const { w, h } of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await mockApi(context)
  await context.addInitScript(() => localStorage.setItem('token', 'test-token'))
  const page = await context.newPage()

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200) // 等 fill-up 动画 + stagger 完成
  await page.screenshot({ path: `${OUT}/home-${w}.png` })
  const okHome = await checkOverflow(page, `home ${w}`)

  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/settings-${w}.png` })
  const okSettings = await checkOverflow(page, `settings ${w}`)

  allOk = allOk && okHome && okSettings
  await context.close()
}

// —— CPU 4× throttle 滚动实测（375 宽，40 个视频）——
{
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  await mockApi(context)
  await context.addInitScript(() => localStorage.setItem('token', 'test-token'))
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const stats = await page.evaluate(() => new Promise(resolve => {
    const frames = []
    let last = performance.now()
    const main = document.querySelector('main')
    const start = performance.now()
    const DURATION = 4000
    function step(now) {
      frames.push(now - last)
      last = now
      const t = (now - start) / DURATION
      if (t >= 1) {
        const sorted = [...frames].sort((a, b) => a - b)
        resolve({
          count: frames.length,
          avg: frames.reduce((s, f) => s + f, 0) / frames.length,
          p95: sorted[Math.floor(sorted.length * 0.95)],
          max: sorted[sorted.length - 1],
          over33: frames.filter(f => f > 33).length // 掉到 30fps 以下的帧数
        })
        return
      }
      // 来回扫滚，强制每帧 layout+paint+composite
      const range = main.scrollHeight - main.clientHeight
      main.scrollTop = range * (0.5 - 0.5 * Math.cos(t * Math.PI * 6))
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }))

  const fps = (1000 / stats.avg).toFixed(1)
  console.log(`\nCPU 4x throttle scroll (375×667, ${videos.length} cups):`)
  console.log(`  frames=${stats.count} avg=${stats.avg.toFixed(1)}ms → ${fps} fps, p95=${stats.p95.toFixed(1)}ms, max=${stats.max.toFixed(1)}ms, >33ms帧=${stats.over33}`)
  console.log(`  判定：${stats.over33 <= stats.count * 0.05 && Number(fps) >= 30 ? '不掉帧 ✓' : '需关注 ✗'}`)
  await context.close()
}

await browser.close()
console.log(`\n溢出检查汇总：${allOk ? '全部通过 ✓' : '存在溢出 ✗'}`)
