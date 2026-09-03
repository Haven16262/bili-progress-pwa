// T8 真实渲染对比度测量（稳健版）：
//   浅字深底 → fg = 文字框 99% 分位亮度（字芯）；bg = 同面板背景补丁中位数亮度
import { chromium } from 'playwright'

const srgbLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = ([r, g, b]) => 0.2126 * srgbLin(r / 255) + 0.7152 * srgbLin(g / 255) + 0.0722 * srgbLin(b / 255)
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const videos = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, bvid: 'BV' + i, title: '测试视频 ' + (i + 1), progress: (i * 13) % 100, custom_name: '', archived: 0
}))
const completed = [
  { id: 99, title: 'x', custom_name: '', archived: 1 },
  { id: 100, title: 'y', custom_name: '', archived: 0 }
]

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 375, height: 667 } })
// 单 handler URL 分发（避免多 route 的逆序匹配坑）
await ctx.route('**/api/**', r => {
  const u = r.request().url()
  let body = { ok: true, sessdata_set: true }
  if (u.includes('/videos/completed')) body = completed
  else if (u.includes('/videos')) body = videos
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
await ctx.addInitScript(() => localStorage.setItem('token', 't'))
const page = await ctx.newPage()

async function lumsOfClip(clip) {
  const buf = await page.screenshot({ clip })
  return page.evaluate(async b64 => {
    const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, img.width, img.height).data
    const lums = []
    for (let i = 0; i < d.length; i += 4) {
      lums.push(0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255))
    }
    return lums
  }, buf.toString('base64'))
}

async function measure(label, textSelector, bgOffset = { dx: 0, dy: 22 }) {
  const el = page.locator(textSelector).first()
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const box = await el.boundingBox()
  const fgLums = await lumsOfClip({ x: box.x, y: box.y, width: box.width, height: box.height })
  fgLums.sort((a, b) => a - b)
  const fgL = fgLums[Math.floor(fgLums.length * 0.99)] // 亮端 = 字芯（浅字）
  const bgLums = await lumsOfClip({ x: box.x + bgOffset.dx, y: box.y + box.height + bgOffset.dy, width: 12, height: 6 })
  bgLums.sort((a, b) => a - b)
  const bgL = bgLums[Math.floor(bgLums.length * 0.5)]
  const r = ratio(fgL, bgL)
  console.log(`${r >= 4.5 ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  ${label}`)
}

await page.goto('http://localhost:4173/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

await measure('SESSDATA 说明 (on-glass 0.68, 顶部晕染)', '.settings-card__desc')
await measure('「当前设备独立设置」hint (on-glass)', '.settings-card__hint')

await page.evaluate(() => {
  const main = document.querySelector('main')
  document.querySelector('.settings-details').open = true
  main.scrollTop = main.scrollHeight
})
await page.waitForTimeout(400)
// badge 背景补丁：药丸内部右侧（纯背景无文字）
async function measureBadge(label, selector) {
  const el = page.locator(selector).first()
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  const box = await el.boundingBox()
  const fgLums = await lumsOfClip({ x: box.x, y: box.y, width: box.width, height: box.height })
  fgLums.sort((a, b) => a - b)
  const fgL = fgLums[Math.floor(fgLums.length * 0.99)]
  const bgLums = await lumsOfClip({ x: box.x + box.width - 9, y: box.y + 2, width: 6, height: box.height - 4 })
  bgLums.sort((a, b) => a - b)
  const bgL = bgLums[Math.floor(bgLums.length * 0.5)]
  const r = ratio(fgL, bgL)
  console.log(`${r >= 4.5 ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  ${label}`)
}

await measureBadge('已归档 badge (on-glass, 底部晕染)', '.badge--muted')
await measureBadge('「已看完」badge (绿字, 底部晕染)', '.badge--success')

await measure('导航未激活「主页」label (0.65, 底部晕染)', '.nav-link:not(.nav-link--active) .nav-label', { dx: 8, dy: 20 })

await page.evaluate(() => { document.querySelector('main').scrollTop = 0 })
await page.waitForTimeout(400)
await measure('SESSDATA 输入框 placeholder (0.6)', '.settings-input', { dx: 8, dy: 10 })

await b.close()
