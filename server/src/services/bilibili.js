import crypto from 'crypto'

const BILI_HOST = 'https://api.bilibili.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// WBI signing table (fixed)
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 52, 44, 34
]

// Cached WBI keys
let wbiKeys = null

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
    // Map known codes to safe messages
    if (json.code === -400 || json.code === -403 || json.code === -404) {
      throw new Error('B站 API 拒绝访问，请确认 Cookie 权限')
    }
    if (json.code === 22002) {
      throw new Error('指定的视频不存在')
    }
    throw new Error(`B站 API 返回错误 (code=${json.code})`)
  }

  return json.data
}

// ── WBI Signing ──

function extractWbiKeys(imgUrl, subUrl) {
  const imgKey = imgUrl.split('/').pop().split('.')[0]
  const subKey = subUrl.split('/').pop().split('.')[0]
  return { imgKey, subKey }
}

function getMixinKey(raw) {
  let result = ''
  for (const idx of MIXIN_KEY_ENC_TAB) {
    if (idx < raw.length) result += raw[idx]
  }
  return result
}

function signParams(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey)
  const wts = Math.floor(Date.now() / 1000)
  const all = { ...params, wts }

  // Sort keys alphabetically
  const sorted = Object.keys(all).sort().map(k => `${k}=${encodeURIComponent(all[k])}`).join('&')
  const wRid = crypto.createHash('md5').update(sorted + mixinKey).digest('hex')

  return { wts, w_rid: wRid }
}

async function ensureWbiKeys(sessdata) {
  if (!wbiKeys) {
    const nav = await navInfo(sessdata)
    wbiKeys = extractWbiKeys(nav.wbi_img.img_url, nav.wbi_img.sub_url)
  }
  return wbiKeys
}

async function signedBiliGet(path, params, sessdata) {
  const keys = await ensureWbiKeys(sessdata)
  const signed = signParams(params, keys.imgKey, keys.subKey)
  return biliGet(path, { ...params, ...signed }, sessdata)
}

// ── API Endpoints ──

// Verify login and get nav info (used for WBI key extraction)
export async function navInfo(sessdata) {
  return biliGet('/x/web-interface/nav', {}, sessdata)
}

// Fetch watch history (cursor-based, fetches all pages)
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
      // Only process archive (regular video) type
      if (item.history && item.history.business === 'archive' && item.history.bvid) {
        allVideos.push({
          bvid: item.history.bvid,
          cid: item.history.cid || 0,          // current episode cid
          title: item.title || '',
          progress: item.progress || 0,        // seconds watched on current cid
          duration: item.duration || 0,        // duration of current cid (not total)
          view_at: item.view_at || 0           // unix timestamp
        })
      }
    }

    // Check if there are more pages
    if (!data.cursor || data.cursor.is_end) break
    cursor = {
      max: data.cursor.max || '',
      view_at: data.cursor.view_at || 0,
      business: data.cursor.business || 'archive'
    }
  }

  return allVideos
}

// Fetch recent history only (first page) — for "+" button
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

// Fetch video detail (for enriched metadata)
export async function fetchVideoDetail(bvid, sessdata) {
  return biliGet('/x/web-interface/view', { bvid }, sessdata)
}

/**
 * Fetch all pages for a video.
 * Returns { pages, totalDuration } where pages is [{ cid, duration }]
 * Returns null for single-page videos (no global calculation needed).
 * Pages are ordered by page number ascending.
 */
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
