// T8 对比度检查：WCAG AA 关键组合（玻璃层叠合成数学 + 实际 token 值）
// 合成规则：上层 rgba 叠下层 → c = a*top + (1-a)*bottom（alpha 逐层折算）
const srgbLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = ([r, g, b]) => 0.2126 * srgbLin(r / 255) + 0.7152 * srgbLin(g / 255) + 0.0722 * srgbLin(b / 255)
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const page = [16, 16, 28]
const blobTop = [129, 90, 240], blobRight = [56, 120, 230], blobBottom = [168, 85, 247]
const alphaBlob = { top: 0.42, right: 0.36, bottom: 0.30 }

// 玻璃层：面板 0.07 / 导航 0.10 / muted 卡 0.04
const over = (fg, bg, a) => fg.map((c, i) => a * c + (1 - a) * bg[i])
const pageWithBlob = (blob, a) => over(blob, page, a)
const glassPanel = bg => over([255, 255, 255], bg, 0.07)
const mutedCard = bg => over([255, 255, 255], bg, 0.04)
const navGlass = bg => over([255, 255, 255], bg, 0.10)

const text = {
  primary: [244, 242, 251, 1],
  secondary: [244, 242, 251, 0.6],
  muted: [244, 242, 251, 0.5],
  navInactive: [255, 255, 255, 0.65],
  navActive: [34, 211, 238, 1],
  placeholder: [244, 242, 251, 0.6]
}

// 合成：文字色叠在其真实背景上，再与背景算对比
function check(name, fgArr, bgArr, isLarge = false) {
  const [fr, fg, fb, fa] = fgArr
  const fgFinal = fa < 1 ? [fa * fr + (1 - fa) * bgArr[0], fa * fg + (1 - fa) * bgArr[1], fa * fb + (1 - fa) * bgArr[2]] : [fr, fg, fb]
  const r = ratio(lum(fgFinal), lum(bgArr))
  const need = isLarge ? 3 : 4.5
  console.log(`${r >= need ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1  (${name})`)
}

console.log('—— 正文/标签（4.5:1）——')
check('primary 标题 on 纯页面底', text.primary, page)
check('primary 标题 on 玻璃面板 on 页面', text.primary, glassPanel(page))
check('secondary 统计行 on 页面+顶部紫晕染', text.secondary, pageWithBlob(blobTop, alphaBlob.top))
check('secondary 统计行 on 页面', text.secondary, page)
check('secondary 面板内文字 on 玻璃面板 on 页面', text.secondary, glassPanel(page))
check('muted 提示文字 on 纯页面底', text.muted, page)
check('muted 提示文字 on 玻璃面板 on 页面', text.muted, glassPanel(page))
check('muted 提示文字 on 玻璃面板 on 页面+底部紫晕染', text.muted, glassPanel(pageWithBlob(blobBottom, alphaBlob.bottom))) // 组合已不在 UI 中出现：面板内文字全部改用 on-glass 0.68
check('secondary 设置页脚注 on muted 卡 on 页面+底部紫晕染', text.secondary, mutedCard(pageWithBlob(blobBottom, alphaBlob.bottom)))
check('nav 未激活 on 导航玻璃 on 页面+底部紫晕染', text.navInactive, navGlass(pageWithBlob(blobBottom, alphaBlob.bottom)))
check('nav 激活青 on 导航玻璃 on 页面+底部紫晕染', text.navActive, navGlass(pageWithBlob(blobBottom, alphaBlob.bottom)))
check('placeholder on 输入框底(0.06) on 玻璃面板 on 页面', text.placeholder, glassPanel(over([255, 255, 255], page, 0.06)))
check('危险红 #f87171 on 页面', [248, 113, 113, 1], page)
check('成功绿 #4ade80 on 页面', [74, 222, 128, 1], page)
check('警示黄 #facc15 on 页面', [250, 204, 21, 1], page)

console.log('—— Badge 药丸（文字叠药丸底再叠玻璃/晕染）——')
const pillGreen = bg => over([74, 222, 128], bg, 0.16)
const pillYellow = bg => over([250, 204, 21], bg, 0.16)
const pillWhite = bg => over([255, 255, 255], bg, 0.06)
check('badge 成功 #86efac on 绿药丸 on 玻璃 on 页面', [134, 239, 172, 1], pillGreen(glassPanel(page)))
check('badge 成功 #86efac on 绿药丸 on 玻璃 on 页面+顶部晕染', [134, 239, 172, 1], pillGreen(glassPanel(pageWithBlob(blobTop, alphaBlob.top))))
check('badge 成功 #86efac on 绿药丸 on 玻璃 on 页面+底部晕染', [134, 239, 172, 1], pillGreen(glassPanel(pageWithBlob(blobBottom, alphaBlob.bottom))))
check('badge 警示 #facc15 on 黄药丸 on 玻璃 on 页面', [250, 204, 21, 1], pillYellow(glassPanel(page)))
check('badge 警示 #facc15 on 黄药丸 on 玻璃 on 底部晕染', [250, 204, 21, 1], pillYellow(glassPanel(pageWithBlob(blobBottom, alphaBlob.bottom))))
check('badge 已归档 on-glass(0.68) on 白药丸 on 玻璃 on 底部晕染', [244, 242, 251, 0.68], pillWhite(glassPanel(pageWithBlob(blobBottom, alphaBlob.bottom))))
check('on-glass 正文 on 玻璃 on 顶部晕染', [244, 242, 251, 0.68], glassPanel(pageWithBlob(blobTop, alphaBlob.top)))
check('on-glass 正文 on 玻璃 on 底部晕染', [244, 242, 251, 0.68], glassPanel(pageWithBlob(blobBottom, alphaBlob.bottom)))
check('placeholder 0.6 on 输入框(0.06) on 玻璃 on 页面', [244, 242, 251, 0.6], glassPanel(over([255, 255, 255], page, 0.06)))

console.log('—— 大字/图形（3:1）——')
check('首页 42px + 按钮白色 on 玻璃按钮 on 页面', [255, 255, 255, 1], over([255, 255, 255], page, 0.16), true)
check('banner 文字 #fca5a5 on 红晕玻璃 on 页面', [252, 165, 165, 1], over([248, 113, 113], page, 0.10), true)
