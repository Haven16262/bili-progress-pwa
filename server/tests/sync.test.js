import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

// ── Pure function tests (no DB needed) ──
import { computeGlobalProgress, computeEpisodeProgress } from '../src/services/bilibili.js'

// ============================================================
// computeGlobalProgress
// ============================================================

describe('computeGlobalProgress', () => {
  const multiPageInfo = {
    pages: [
      { cid: 1, duration: 100 },
      { cid: 2, duration: 200 },
      { cid: 3, duration: 300 }
    ],
    totalDuration: 600
  }

  test('多P正常 — cid 在第2个分P，已观看50秒', () => {
    const result = computeGlobalProgress(multiPageInfo, 2, 50)
    expect(result).not.toBeNull()
    expect(result.progressPct).toBe(25) // (100 + 50) / 600 = 25%
    expect(result.totalDuration).toBe(600)
  })

  test('多P正常 — cid 在第1个分P', () => {
    const result = computeGlobalProgress(multiPageInfo, 1, 50)
    expect(result.progressPct).toBe(8.33)
  })

  test('多P正常 — cid 在最后一个分P', () => {
    const result = computeGlobalProgress(multiPageInfo, 3, 200)
    expect(result.progressPct).toBe(83.33)
  })

  test('cid 不在 pages 中 → 返回 null', () => {
    const result = computeGlobalProgress(multiPageInfo, 999, 50)
    expect(result).toBeNull()
  })

  test('totalDuration = 0 → 返回 0%', () => {
    const info = { pages: [{ cid: 1, duration: 100 }], totalDuration: 0 }
    const result = computeGlobalProgress(info, 1, 50)
    expect(result.progressPct).toBe(0)
    expect(result.totalDuration).toBe(0)
  })

  test('pagesInfo 为 null → 返回 null', () => {
    expect(computeGlobalProgress(null, 1, 50)).toBeNull()
  })

  test('cid 为 0 / falsy → 返回 null', () => {
    expect(computeGlobalProgress(multiPageInfo, 0, 50)).toBeNull()
  })

  test('单P video (分P数=1) — 看完应返回 100%', () => {
    const info = { pages: [{ cid: 1, duration: 300 }], totalDuration: 300 }
    const result = computeGlobalProgress(info, 1, 300)
    expect(result.progressPct).toBe(100)
  })
})

// ============================================================
// computeEpisodeProgress
// ============================================================

describe('computeEpisodeProgress', () => {
  test('正常 — 50/200 = 25%', () => {
    expect(computeEpisodeProgress(50, 200)).toBe(25)
  })

  test('看完 — 300/300 = 100%', () => {
    expect(computeEpisodeProgress(300, 300)).toBe(100)
  })

  test('duration = 0 → 返回 0', () => {
    expect(computeEpisodeProgress(50, 0)).toBe(0)
  })

  test('progress = 0 → 返回 0%', () => {
    expect(computeEpisodeProgress(0, 100)).toBe(0)
  })

  test('单P回退 — fetchVideoPages 返回 null 时走此分支', () => {
    expect(computeEpisodeProgress(75, 150)).toBe(50)
  })

  test('四舍五入到两位小数', () => {
    expect(computeEpisodeProgress(100, 300)).toBe(33.33)
  })
})

// ============================================================
// Archive counting — integration tests with in-memory SQLite
// ============================================================

// Strategy: mock the DB init module so ALL consumers (queries, sync)
// get our in-memory test DB. Then mock only the B站 API layer.

let testDb

vi.mock('../src/db/init.js', () => ({
  getDb: () => testDb
}))

vi.mock('../src/services/crypto.js', () => ({
  decryptSessdata: vi.fn(() => 'fake-sessdata')
}))

vi.mock('../src/services/bilibili.js', async () => {
  const actual = await vi.importActual('../src/services/bilibili.js')
  return {
    ...actual,
    navInfo: vi.fn(),
    fetchAllHistory: vi.fn(),
    fetchVideoPages: vi.fn()
  }
})

describe('archive counting (H1 bug)', () => {
  let runSync
  let navInfo, fetchAllHistory, fetchVideoPages

  beforeAll(async () => {
    const syncMod = await import('../src/services/sync.js')
    runSync = syncMod.runSync

    const bili = await import('../src/services/bilibili.js')
    navInfo = bili.navInfo
    fetchAllHistory = bili.fetchAllHistory
    fetchVideoPages = bili.fetchVideoPages
  })

  beforeEach(() => {
    // Create a fresh in-memory DB for each test
    testDb = new Database(':memory:')
    testDb.pragma('journal_mode = WAL')
    testDb.pragma('foreign_keys = ON')

    testDb.exec(`
      CREATE TABLE videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bvid TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        progress REAL NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        custom_name TEXT NOT NULL DEFAULT '',
        pinned INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        progress_100_count INTEGER NOT NULL DEFAULT 0,
        progress_100_date TEXT,
        manually_completed INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE page_cache (
        bvid TEXT PRIMARY KEY,
        page_count INTEGER NOT NULL DEFAULT 0,
        total_duration INTEGER NOT NULL DEFAULT 0,
        pages_json TEXT NOT NULL DEFAULT '[]',
        cached_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)

    const seed = testDb.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    seed.run('sessdata', 'encrypted-fake')
    seed.run('columns_per_row', '3')
    seed.run('last_sync_status', '')
    seed.run('last_sync_at', '')

    // Reset API mocks (clear call counts too — tests accumulate across cases)
    navInfo.mockClear()
    fetchAllHistory.mockClear()
    fetchVideoPages.mockClear()

    navInfo.mockResolvedValue({ isLogin: true, mid: 12345 })
    fetchVideoPages.mockResolvedValue(null) // single-P fallback for most tests
  })

  function insertVideo(bvid, overrides = {}) {
    testDb.prepare(`
      INSERT INTO videos (bvid, title, progress, duration, progress_100_count, manually_completed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(bvid, overrides.title || 'Test', overrides.progress ?? 100, overrides.duration || 300,
      overrides.progress_100_count || 0, overrides.manually_completed || 0)
  }

  function getProgress100Count(bvid) {
    return testDb.prepare('SELECT progress_100_count FROM videos WHERE bvid = ?').get(bvid).progress_100_count
  }

  test('同日两次 runSync — progress_100_count 只应递增一次 (TASK-2 新行为，当前应 FAIL)', async () => {
    // ⚠️  This test encodes the NEW calendar-day behavior from Task 2.
    // Before Task 2 is implemented, every runSync increments the count,
    // so the second call gives count=2. This test SHOULD FAIL initially.
    insertVideo('BVtest1', { progress: 100, progress_100_count: 0 })

    // Return this video in B站 history so runSync processes it
    fetchAllHistory.mockResolvedValue([
      { bvid: 'BVtest1', cid: 1, title: 'Test', progress: 300, duration: 300 }
    ])

    // First sync — should increment to 1
    const r1 = await runSync()
    expect(r1.ok).toBe(true)
    expect(getProgress100Count('BVtest1')).toBe(1)

    // Second sync SAME DAY — NEW behavior says count should stay 1
    const r2 = await runSync()
    expect(r2.ok).toBe(true)

    // ⚠️  FAILS before Task 2: current code gives 2
    expect(getProgress100Count('BVtest1')).toBe(1)
  })

  test('跨日两次 runSync — progress_100_count 递增两次', async () => {
    insertVideo('BVcross', { progress: 100, progress_100_count: 0 })

    fetchAllHistory.mockResolvedValue([
      { bvid: 'BVcross', cid: 1, title: 'Cross-day', progress: 300, duration: 300 }
    ])

    // Day 1 — first sync
    const r1 = await runSync()
    expect(r1.ok).toBe(true)
    expect(getProgress100Count('BVcross')).toBe(1)

    // Simulate cross-day: set progress_100_date to yesterday so today's check passes
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    testDb.prepare('UPDATE videos SET progress_100_date = ? WHERE bvid = ?').run(yesterday, 'BVcross')

    // Day 2 — should increment because date differs
    const r2 = await runSync()
    expect(r2.ok).toBe(true)
    expect(getProgress100Count('BVcross')).toBe(2)
  })

  test('进度回落 → 重置计数为 0', async () => {
    // Video was at 100% last sync, but now progress dropped below 100
    insertVideo('BVdrop', { progress: 100, progress_100_count: 2 })

    fetchAllHistory.mockResolvedValue([
      { bvid: 'BVdrop', cid: 1, title: 'Dropped', progress: 50, duration: 300 }
    ])

    const r = await runSync()
    expect(r.ok).toBe(true)
    // Count should reset to 0 because progress < 100
    expect(getProgress100Count('BVdrop')).toBe(0)
  })

  test('手动完成分支 — 同日两次应只计一次 (TASK-2 新行为，当前应 FAIL)', async () => {
    insertVideo('BVmanual', { progress: 100, progress_100_count: 0, manually_completed: 1 })

    // For manually-completed videos, runSync skips B站 data refresh (section 4b).
    // The video won't appear in history results — it's handled in a separate pass.
    fetchAllHistory.mockResolvedValue([])

    // First sync
    const r1 = await runSync()
    expect(r1.ok).toBe(true)
    expect(getProgress100Count('BVmanual')).toBe(1)

    // Second sync same day
    const r2 = await runSync()
    expect(r2.ok).toBe(true)

    // ⚠️  FAILS before Task 2: current code gives 2
    expect(getProgress100Count('BVmanual')).toBe(1)
  })

  test('达到 3 次计数 → 自动归档', async () => {
    // Pre-set count to 2, this 3rd tick should trigger archive
    insertVideo('BVarch', { progress: 100, progress_100_count: 2 })

    fetchAllHistory.mockResolvedValue([
      { bvid: 'BVarch', cid: 1, title: 'Archive Me', progress: 300, duration: 300 }
    ])

    const r = await runSync()
    expect(r.ok).toBe(true)
    expect(r.archived).toBe(1)

    const vid = testDb.prepare('SELECT archived FROM videos WHERE bvid = ?').get('BVarch')
    expect(vid.archived).toBe(1)
  })

  test('M1 单P负缓存 — 第二次 runSync 不重复请求 view API', async () => {
    insertVideo('BVsingle', { progress: 50, duration: 300, progress_100_count: 0 })

    fetchAllHistory.mockResolvedValue([
      { bvid: 'BVsingle', cid: 1, title: 'Single-P Video', progress: 50, duration: 300 }
    ])

    // First runSync — should call fetchVideoPages once (for the single video)
    const r1 = await runSync()
    expect(r1.ok).toBe(true)
    expect(fetchVideoPages).toHaveBeenCalledTimes(1)

    // Second runSync — should hit the negative cache and NOT call fetchVideoPages
    fetchVideoPages.mockClear()
    const r2 = await runSync()
    expect(r2.ok).toBe(true)
    expect(fetchVideoPages).not.toHaveBeenCalled()

    // Verify the video was still updated (computeEpisodeProgress was used)
    const vid = testDb.prepare('SELECT progress FROM videos WHERE bvid = ?').get('BVsingle')
    expect(vid.progress).toBeGreaterThan(0)
  })

  test('M5 并发锁 — runSync 进行中再次调用直接返回 locked', async () => {
    insertVideo('BVlock', { progress: 100, progress_100_count: 0 })

    // Make fetchAllHistory hang so the first runSync stays "in progress"
    let releaseHang
    const hangPromise = new Promise(resolve => { releaseHang = resolve })
    fetchAllHistory.mockReturnValueOnce(hangPromise)

    // Fire first runSync (don't await — it will hang)
    const firstCall = runSync()

    // Second call should immediately return locked
    const secondResult = await runSync()
    expect(secondResult.ok).toBe(false)
    expect(secondResult.locked).toBe(true)

    // Release the first call
    releaseHang([
      { bvid: 'BVlock', cid: 1, title: 'Lock Test', progress: 300, duration: 300 }
    ])
    await firstCall

    // After first call finishes, a new call should work again
    fetchAllHistory.mockResolvedValue([
      { bvid: 'BVlock', cid: 1, title: 'Lock Test', progress: 300, duration: 300 }
    ])
    const thirdResult = await runSync()
    expect(thirdResult.ok).toBe(true)
    expect(thirdResult.locked).toBeUndefined()
  })
})
