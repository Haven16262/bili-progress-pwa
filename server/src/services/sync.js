import {
  fetchAllHistory,
  fetchRecentHistory,
  fetchVideoPages,
  navInfo,
  computeGlobalProgress,
  computeEpisodeProgress
} from './bilibili.js'
import {
  getSetting,
  setSetting,
  getAllBvids,
  syncVideoFields,
  updateProgress100Count,
  archiveVideo,
  insertSyncLog,
  getPageCache,
  setPageCache,
  getProgress100Map,
  getProgress100DateMap,
  getManuallyCompletedBvids
} from '../db/queries.js'
import { decryptSessdata } from './crypto.js'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days

let syncing = false

// ── SESSDATA helpers ──

function getSessdata() {
  return decryptSessdata(getSetting('sessdata'))
}

export async function validateSession() {
  const sessdata = getSessdata()
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

// ── Page info cache helper ──

async function getPagesInfo(bvid, sessdata, pageCache) {
  // 1. In-memory (this sync run)
  if (pageCache.has(bvid)) return pageCache.get(bvid)

  // 2. SQLite cache (7-day TTL)
  const cached = getPageCache(bvid)
  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age < CACHE_TTL_MS) {
      // Negative cache: single-P video → return null semantics
      if (cached.pageCount <= 1) {
        pageCache.set(bvid, null)
        return null
      }
      const info = { pages: cached.pages, totalDuration: cached.totalDuration }
      pageCache.set(bvid, info)
      return info
    }
  }

  // 3. Fetch from B站
  const info = await fetchVideoPages(bvid, sessdata)
  if (info) {
    setPageCache(bvid, info.pages, info.totalDuration)
  } else {
    // Cache the negative result (single-P) to avoid re-fetching for 7 days
    setPageCache(bvid, [], 0)
  }
  pageCache.set(bvid, info)
  return info
}

// ── Sync helpers ──

function logFailure(msg, statusMsg, syncLogMsg) {
  insertSyncLog('failed', syncLogMsg)
  setSetting('last_sync_status', statusMsg)
  setSetting('last_sync_at', new Date().toISOString())
  return { ok: false, error: msg }
}

/**
 * Main sync: pull B站 history, update local DB, handle archiving.
 */
export async function runSync() {
  if (syncing) {
    return { ok: false, locked: true }
  }
  syncing = true

  try {
    const sessdata = getSessdata()
    if (!sessdata) {
      return logFailure('未配置 SESSDATA', '同步失败：未配置 SESSDATA', '同步失败：未配置 SESSDATA')
    }

  // 1. Verify session
  let nav
  try {
    nav = await navInfo(sessdata)
    if (!nav.isLogin) {
      throw new Error('SESSDATA 无效，登录状态已过期')
    }
  } catch (err) {
    return logFailure(
      'SESSDATA 验证失败，请在设置页面更新 B 站 Cookie',
      '同步失败：SESSDATA 验证失败，请更新 Cookie',
      `同步失败：Cookie 验证失败 — ${err.message}`
    )
  }

  // 2. Pre-load local bvids for early-termination during history fetch
  const localBvids = new Set(getAllBvids())

  // 3. Fetch all history from B站 (stops early when all local bvids found)
  let history
  try {
    history = await fetchAllHistory(sessdata, { localBvids })
  } catch (err) {
    return logFailure(
      '无法获取 B 站数据，请确认 SESSDATA 有效并稍后重试',
      '同步失败：无法获取 B 站数据，请稍后重试',
      `同步失败：获取历史记录出错 — ${err.message}`
    )
  }

  // 4. Pre-load remaining local data for efficient lookups
  const progress100Map = getProgress100Map()  // bvid → progress_100_count
  const progress100DateMap = getProgress100DateMap()  // bvid → progress_100_date
  const manuallyCompletedSet = new Set(getManuallyCompletedBvids())
  const pageCache = new Map()
  const today = new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'
  let updatedCount = 0
  let archivedCount = 0

  // 5. Process each B站 history entry that exists locally
  for (const video of history) {
    if (!localBvids.has(video.bvid)) continue

    // Skip manually-completed videos — they're handled in a separate pass below
    if (manuallyCompletedSet.has(video.bvid)) continue

    let progressPct
    let effectiveDuration

    const pagesInfo = await getPagesInfo(video.bvid, sessdata, pageCache)
    const global = computeGlobalProgress(pagesInfo, video.cid, video.progress)
    if (global) {
      progressPct = global.progressPct
      effectiveDuration = global.totalDuration
    } else {
      progressPct = computeEpisodeProgress(video.progress, video.duration)
      effectiveDuration = video.duration
    }

    syncVideoFields(video.bvid, {
      title: video.title,
      progress: progressPct,
      duration: effectiveDuration
    })

    // Handle archiving (calendar-day gating: same day → skip tick)
    if (progressPct >= 100) {
      const lastDate = progress100DateMap.get(video.bvid) || null
      if (lastDate !== today) {
        const newCount = (progress100Map.get(video.bvid) || 0) + 1
        updateProgress100Count(video.bvid, newCount, today)
        progress100Map.set(video.bvid, newCount)
        progress100DateMap.set(video.bvid, today)

        if (newCount >= 3) {
          archiveVideo(video.bvid)
          archivedCount++
        }
      }
    } else {
      if ((progress100Map.get(video.bvid) || 0) > 0) {
        updateProgress100Count(video.bvid, 0, null)
        progress100Map.set(video.bvid, 0)
        progress100DateMap.set(video.bvid, null)
      }
    }

    updatedCount++
  }

  // 5b. Manually-completed videos: advance archive countdown independently
  //     These videos are skipped from B站 data refresh above; their progress
  //     stays at 100 (set by markVideoCompleted) and we just count ticks.
  //     Calendar-day gating: same day → skip tick.
  for (const bvid of manuallyCompletedSet) {
    const lastDate = progress100DateMap.get(bvid) || null
    if (lastDate !== today) {
      const newCount = (progress100Map.get(bvid) || 0) + 1
      updateProgress100Count(bvid, newCount, today)
      progress100Map.set(bvid, newCount)
      progress100DateMap.set(bvid, today)

      if (newCount >= 3) {
        archiveVideo(bvid)
        archivedCount++
      }
    }
  }

  // 6. Log success
  const msg = `同步完成：更新 ${updatedCount} 个视频`
    + (archivedCount > 0 ? `，归档 ${archivedCount} 个已完成视频` : '')

  insertSyncLog('success', msg)
  setSetting('last_sync_status', msg)
  setSetting('last_sync_at', new Date().toISOString())

  return {
    ok: true,
    totalFetched: history.length,
    updated: updatedCount,
    archived: archivedCount
  }
  } finally {
    syncing = false
  }
}

/**
 * Get recent B站 history, filtered to show only videos NOT already on homepage.
 */
export async function getAddCandidates() {
  const sessdata = getSessdata()
  if (!sessdata) {
    throw new Error('未配置 SESSDATA')
  }

  const recent = await fetchRecentHistory(sessdata, 20)
  const localBvids = new Set(getAllBvids())
  const filtered = recent.filter(v => !localBvids.has(v.bvid))
  const pageCache = new Map()

  const candidates = []
  for (const v of filtered) {
    let progressPct = computeEpisodeProgress(v.progress, v.duration)
    let totalDuration = v.duration

    try {
      const pagesInfo = await getPagesInfo(v.bvid, sessdata, pageCache)
      const global = computeGlobalProgress(pagesInfo, v.cid, v.progress)
      if (global) {
        progressPct = global.progressPct
        totalDuration = global.totalDuration
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
