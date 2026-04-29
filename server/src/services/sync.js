import {
  fetchAllHistory,
  fetchRecentHistory,
  fetchVideoPages,
  navInfo
} from './bilibili.js'
import {
  getSetting,
  setSetting,
  getAllBvids,
  getVideoByBvid,
  syncVideoFields,
  updateProgress100Count,
  archiveVideo,
  insertSyncLog,
  getAllSettings
} from '../db/queries.js'

/**
 * Validate that the current SESSDATA is still valid.
 * Returns { valid, mid } — mid is the user's B站 UID.
 */
export async function validateSession() {
  const sessdata = getSetting('sessdata')
  if (!sessdata) {
    return { valid: false, error: '未配置 SESSDATA，请在设置页填写' }
  }

  try {
    const nav = await navInfo(sessdata)
    if (nav.isLogin) {
      return { valid: true, mid: nav.mid }
    }
    return { valid: false, error: 'SESSDATA 无效（未登录状态）' }
  } catch {
    return { valid: false, error: 'SESSDATA 验证失败，请更新 Cookie' }
  }
}

/**
 * Main sync: pull B站 history, update local DB, handle archiving.
 *
 * Sync rules:
 * - Progress %: B站 is authoritative
 * - Title, pinned, archived: local DB is authoritative
 * - New bvids from B站 are NOT auto-added (user uses "+" button)
 * - Videos at 100% for 3 consecutive syncs → auto-archive
 */
export async function runSync() {
  const sessdata = getSetting('sessdata')
  if (!sessdata) {
    const msg = '同步失败：未配置 SESSDATA'
    insertSyncLog('failed', msg)
    setSetting('last_sync_status', msg)
    setSetting('last_sync_at', new Date().toISOString())
    return { ok: false, error: '未配置 SESSDATA' }
  }

  // 1. Verify session
  let nav
  try {
    nav = await navInfo(sessdata)
    if (!nav.isLogin) {
      throw new Error('SESSDATA 无效，登录状态已过期')
    }
  } catch (err) {
    const msg = `同步失败：Cookie 验证失败 — ${err.message}`
    insertSyncLog('failed', msg)
    setSetting('last_sync_status', '同步失败：SESSDATA 验证失败，请更新 Cookie')
    setSetting('last_sync_at', new Date().toISOString())
    return { ok: false, error: 'SESSDATA 验证失败，请在设置页面更新 B 站 Cookie' }
  }

  // 2. Fetch all history from B站
  let history
  try {
    history = await fetchAllHistory(sessdata)
  } catch (err) {
    const msg = `同步失败：获取历史记录出错 — ${err.message}`
    insertSyncLog('failed', msg)
    setSetting('last_sync_status', '同步失败：无法获取 B 站数据，请稍后重试')
    setSetting('last_sync_at', new Date().toISOString())
    return { ok: false, error: '无法获取 B 站数据，请确认 SESSDATA 有效并稍后重试' }
  }

  // 3. Get local bvids for filtering
  const localBvids = new Set(getAllBvids())
  let updatedCount = 0
  let archivedCount = 0
  const pageCache = new Map()

  // Helper: calculate global progress for a multi-part video
  async function calcGlobalProgress(historyItem) {
    try {
      const pagesInfo = await fetchVideoPages(historyItem.bvid, sessdata)
      pageCache.set(historyItem.bvid, pagesInfo)

      if (!pagesInfo || !historyItem.cid) return null

      const idx = pagesInfo.pages.findIndex(p => p.cid === historyItem.cid)
      if (idx < 0) return null

      const previousDuration = pagesInfo.pages
        .slice(0, idx)
        .reduce((sum, p) => sum + p.duration, 0)

      const watched = previousDuration + historyItem.progress
      const pct = pagesInfo.totalDuration > 0
        ? Math.round((watched / pagesInfo.totalDuration) * 10000) / 100
        : 0

      return { progressPct: pct, totalDuration: pagesInfo.totalDuration }
    } catch {
      // Fetch failed — fall back to simple calculation
      return null
    }
  }

  // 4. For each video in B站 history that exists locally, update progress
  for (const video of history) {
    if (!localBvids.has(video.bvid)) continue

    const local = getVideoByBvid(video.bvid)
    if (!local) continue

    let progressPct
    let effectiveDuration

    // Try global (multi-part) calculation first
    const global = await calcGlobalProgress(video)
    if (global) {
      progressPct = global.progressPct
      effectiveDuration = global.totalDuration
    } else {
      // Single-page video or fetch failed — use simple per-episode calculation
      progressPct = video.duration > 0
        ? Math.round((video.progress / video.duration) * 10000) / 100
        : 0
      effectiveDuration = video.duration
    }

    // Update B站-source fields (progress, duration, title from B站)
    syncVideoFields(video.bvid, {
      title: video.title,
      progress: progressPct,
      duration: effectiveDuration
    })

    // Handle archiving logic
    if (progressPct >= 100) {
      const newCount = (local.progress_100_count || 0) + 1
      updateProgress100Count(video.bvid, newCount)

      if (newCount >= 3) {
        archiveVideo(video.bvid)
        archivedCount++
      }
    } else {
      // Reset counter if not at 100%
      if (local.progress_100_count > 0) {
        updateProgress100Count(video.bvid, 0)
      }
    }

    updatedCount++
  }

  // 5. Log success
  const msg = `同步完成：更新 ${updatedCount} 个视频`
    + (archivedCount > 0 ? `，归档 ${archivedCount} 个已完成视频` : '')

  insertSyncLog('success', msg)
  setSetting('last_sync_status', msg)
  setSetting('last_sync_at', new Date().toISOString())

  return {
    ok: true,
    mid: nav.mid,
    totalFetched: history.length,
    updated: updatedCount,
    archived: archivedCount
  }
}

/**
 * Get recent B站 history, filtered to only show videos NOT already on homepage.
 * Used by the "+" button flow.
 */
export async function getAddCandidates() {
  const sessdata = getSetting('sessdata')
  if (!sessdata) {
    throw new Error('未配置 SESSDATA')
  }

  const recent = await fetchRecentHistory(sessdata, 20)
  const localBvids = new Set(getAllBvids())
  const filtered = recent.filter(v => !localBvids.has(v.bvid))

  // Build candidate list with corrected global progress
  const candidates = []
  for (const v of filtered) {
    let progressPct = v.duration > 0
      ? Math.round((v.progress / v.duration) * 10000) / 100
      : 0
    let totalDuration = v.duration

    // Check if multi-part video
    try {
      const pagesInfo = await fetchVideoPages(v.bvid, sessdata)
      if (pagesInfo && v.cid) {
        const idx = pagesInfo.pages.findIndex(p => p.cid === v.cid)
        if (idx >= 0) {
          const previousDuration = pagesInfo.pages
            .slice(0, idx)
            .reduce((sum, p) => sum + p.duration, 0)
          const watched = previousDuration + v.progress
          progressPct = pagesInfo.totalDuration > 0
            ? Math.round((watched / pagesInfo.totalDuration) * 10000) / 100
            : 0
          totalDuration = pagesInfo.totalDuration
        }
      }
    } catch {
      // Fall back to per-episode calculation
    }

    candidates.push({
      bvid: v.bvid,
      title: v.title,
      cover: v.cover,
      author_name: v.author_name,
      progress: progressPct,
      duration: totalDuration
    })
  }

  return candidates
}
