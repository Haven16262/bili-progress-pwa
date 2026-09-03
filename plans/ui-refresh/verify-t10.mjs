// T10 验证：桌面导航限宽居中 + 手机端像素级不变
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const OUT = 'plans/ui-refresh/screenshots'
mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:4173'

const videos = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1, bvid: 'BV' + i, title: '测试视频 ' + (i + 1), progress: (i * 13) % 100, custom_name: '', archived: 0
}))

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 375, height: 667 } })
await ctx.route('**/api/**', r => {
  const u = r.request().url()
  let body = { ok: true }
  if (u.includes('/videos')) body = videos
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
await ctx.addInitScript(() => localStorage.setItem('token', 't'))
const page = await ctx.newPage()

async function shotAndCheck(width, height, path) {
  await page.setViewportSize({ width, height })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path })
  const nav = await page.evaluate(() => {
    const r = document.querySelector('.nav-bar').getBoundingClientRect()
    return { left: r.left, right: r.right, width: r.width, vw: innerWidth }
  })
  const centered = Math.abs(nav.left - (nav.vw - nav.width) / 2) < 1
  console.log(`  ${width}px: nav 宽=${nav.width}px left=${nav.left.toFixed(1)} 居中=${centered ? '✓' : '✗'}`)
  return centered
}

// 桌面：1024 / 1440（覆盖 screenshots/）
console.log('桌面导航几何：')
const ok1024 = await shotAndCheck(1024, 768, `${OUT}/home-1024.png`)
const ok1440 = await shotAndCheck(1440, 900, `${OUT}/home-1440.png`)

// 手机 768：截图临时文件 + 与改前 home-768.png 像素级对比
await shotAndCheck(768, 1024, '/tmp/home-768-t10.png')

await b.close()

// node 侧像素对比
import { chromium as _c } from 'playwright'
const b2 = await _c.launch()
const p2 = await b2.newPage()
const diff = await p2.evaluate(async ({ oldB64, newB64 }) => {
  const load = async b64 => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    return g.getImageData(0, 0, img.width, img.height).data
  }
  const a = await load(oldB64), n = await load(newB64)
  if (a.length !== n.length) return -1
  let diffPx = 0
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - n[i]) + Math.abs(a[i + 1] - n[i + 1]) + Math.abs(a[i + 2] - n[i + 2]) > 6) diffPx++
  }
  return diffPx
}, {
  oldB64: readFileSync(`${OUT}/home-768.png`).toString('base64'),
  newB64: readFileSync('/tmp/home-768-t10.png').toString('base64')
})
await b2.close()

console.log(`≤768px 与改前像素差异: ${diff} 像素 ${diff === 0 ? '→ 完全一致 ✓' : '→ 有差异 ✗'}`)
console.log(`汇总: 桌面居中=${ok1024 && ok1440 ? '✓' : '✗'}，手机不变=${diff === 0 ? '✓' : '✗'}`)
