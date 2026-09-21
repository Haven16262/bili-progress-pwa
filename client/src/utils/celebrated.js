/**
 * 「该视频在本设备已庆祝过 100%」的持久化（localStorage）。
 * 每视频每设备只播一次庆祝动效；存储不可用/损坏时一律按「已庆祝」处理
 * ——宁可不播，也不要每次刷新都播（用户明确说过「每次都出现会烦」）。
 */
const KEY = 'celebrated_100_ids'

function readIds() {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

/** @returns {boolean} true = 已庆祝过（含读取失败时的降级情形） */
export function hasCelebrated(id) {
  if (id == null) return false
  try {
    return readIds().includes(id)
  } catch {
    return true
  }
}

/**
 * 记「已庆祝」。调用方应先 hasCelebrated() 再调用本函数。
 * @returns {boolean} true = 已落盘；false = 存储不可用（此时**不应**播放，否则每次刷新都会重播）
 */
export function markCelebrated(id) {
  if (id == null) return true
  try {
    const ids = readIds()
    if (!ids.includes(id)) {
      ids.push(id)
      localStorage.setItem(KEY, JSON.stringify(ids))
    }
    return true
  } catch {
    return false
  }
}

/** 清掉已不在列表中的 id，防数组无限增长（归档、删除后自然被剪掉） */
export function pruneCelebrated(activeIds) {
  try {
    const ids = readIds()
    const active = new Set(activeIds)
    const pruned = ids.filter(id => active.has(id))
    if (pruned.length !== ids.length) localStorage.setItem(KEY, JSON.stringify(pruned))
  } catch { /* ignore */ }
}
