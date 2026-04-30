const BILI_HOST = 'https://api.bilibili.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// ── Helpers ──

function cookieString(sessdata) {
  return `SESSDATA=${sessdata}`
}

async function biliGet(path, params = {}, sessdata) {
  const url = new URL(path, BILI_HOST)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': UA,
      Cookie: cookieString(sessdata),
      Referer: 'https://www.bilibili.com/'
    }
  })

  if (!res.ok) {
    throw new Error(`B站 API 请求失败: HTTP ${res.status}`)
  }

  const json = await res.json()
  if (json.code === -101) {
    throw new Error('SESSDATA 已过期或无效，请在设置页更新 Cookie')
  }
  if (json.code !== 0) {
    if (json.code === -400 || json.code === -403 || json.code === -404) {
      throw new Error('B站 API 拒绝访问，请确认 Cookie 权限')
    }
    if (json.code === 22002) {
      throw new Error('指定的视频不存在')
    }
    console.warn('[bilibili] Unknown API error code:', json.code, 'path:', path)
    throw new Error('B站 API 返回未知错误')
  }

  return json.data
}

/**
 * Calculate global progress for a multi-part video.
 * pagesInfo: { pages: [{ cid, duration }], totalDuration }
 * Returns { progressPct, totalDuration } or null if the cid is not found.
 */
export function computeGlobalProgress(pagesInfo, cid, currentProgress) {
  if (!pagesInfo || !cid) return null

  const idx = pagesInfo.pages.findIndex(p => p.cid === cid)
  if (idx < 0) return null

  const previousDuration = pagesInfo.pages
    .slice(0, idx)
    .reduce((sum, p) => sum + p.duration, 0)

  const watched = previousDuration + currentProgress
  const pct = pagesInfo.totalDuration > 0
    ? Math.round((watched / pagesInfo.totalDuration) * 10000) / 100
    : 0

  return { progressPct: pct, totalDuration: pagesInfo.totalDuration }
}

/**
 * Simple per-episode progress calculation (fallback for single-page videos).
 */
export function computeEpisodeProgress(progress, duration) {
  if (duration <= 0) return 0
  return Math.round((progress / duration) * 10000) / 100
}

// ── API Endpoints ──

export async function navInfo(sessdata) {
  return biliGet('/x/web-interface/nav', {}, sessdata)
}

export async function fetchAllHistory(sessdata) {
  const allVideos = []
  let cursor = { max: '', view_at: 0, business: 'archive' }

  while (true) {
    const params = {
      type: 'all',
      ps: 30,
      max: String(cursor.max),
      view_at: String(cursor.view_at),
      business: cursor.business
    }

    const data = await biliGet('/x/web-interface/history/cursor', params, sessdata)

    if (!data.list || data.list.length === 0) break

    for (const item of data.list) {
      if (item.history && item.history.business === 'archive' && item.history.bvid) {
        allVideos.push({
          bvid: item.history.bvid,
          cid: item.history.cid || 0,
          title: item.title || '',
          progress: item.progress || 0,
          duration: item.duration || 0,
          view_at: item.view_at || 0
        })
      }
    }

    if (!data.cursor || data.cursor.is_end) break
    cursor = {
      max: data.cursor.max || '',
      view_at: data.cursor.view_at || 0,
      business: data.cursor.business || 'archive'
    }
  }

  return allVideos
}

export async function fetchRecentHistory(sessdata, count = 30) {
  const data = await biliGet('/x/web-interface/history/cursor', {
    type: 'archive',
    ps: Math.min(count, 30)
  }, sessdata)

  if (!data.list) return []

  return data.list
    .filter(item => item.history && item.history.business === 'archive' && item.history.bvid)
    .map(item => ({
      bvid: item.history.bvid,
      cid: item.history.cid || 0,
      title: item.title || '',
      cover: item.cover || '',
      author_name: item.author_name || '',
      progress: item.progress || 0,
      duration: item.duration || 0,
      view_at: item.view_at || 0
    }))
}

async function fetchVideoDetail(bvid, sessdata) {
  return biliGet('/x/web-interface/view', { bvid }, sessdata)
}

export async function fetchVideoPages(bvid, sessdata) {
  const data = await fetchVideoDetail(bvid, sessdata)
  if (!data || !Array.isArray(data.pages) || data.pages.length <= 1) {
    return null
  }
  return {
    pages: data.pages.map(p => ({ cid: p.cid, duration: p.duration || 0 })),
    totalDuration: data.pages.reduce((sum, p) => sum + (p.duration || 0), 0)
  }
}
