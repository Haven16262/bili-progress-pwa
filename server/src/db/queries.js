import { getDb } from './init.js'

// ── Videos ──

export function listVideos() {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM videos
    WHERE archived = 0
    ORDER BY pinned DESC, progress DESC
  `).all()
}

export function getVideoByBvid(bvid) {
  const db = getDb()
  return db.prepare('SELECT * FROM videos WHERE bvid = ?').get(bvid)
}

export function insertVideo(video) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO videos (bvid, title, progress, duration, custom_name, pinned)
    VALUES (@bvid, @title, @progress, @duration, @custom_name, @pinned)
  `)
  return stmt.run(video)
}

export function updateVideo(id, fields) {
  const db = getDb()
  const allowed = ['custom_name', 'pinned', 'archived', 'progress_100_count']
  const sets = []
  const vals = {}
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = @${key}`)
      vals[key] = fields[key]
    }
  }
  if (sets.length === 0) return null
  vals.id = id
  sets.push("updated_at = datetime('now')")
  return db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = @id`).run(vals)
}

export function syncVideoFields(bvid, fields) {
  const db = getDb()
  // Only updates B站-source fields: title, progress, duration, last_synced_at
  // Does NOT touch custom_name, pinned, archived which are local authority
  return db.prepare(`
    UPDATE videos SET
      title = @title,
      progress = @progress,
      duration = @duration,
      last_synced_at = datetime('now'),
      updated_at = datetime('now')
    WHERE bvid = @bvid
  `).run({ ...fields, bvid })
}

export function updateProgress100Count(bvid, count) {
  const db = getDb()
  return db.prepare(`
    UPDATE videos SET progress_100_count = ?, updated_at = datetime('now') WHERE bvid = ?
  `).run(count, bvid)
}

export function archiveVideo(bvid) {
  const db = getDb()
  return db.prepare(`
    UPDATE videos SET archived = 1, updated_at = datetime('now') WHERE bvid = ?
  `).run(bvid)
}

export function deleteVideo(id) {
  const db = getDb()
  return db.prepare('DELETE FROM videos WHERE id = ?').run(id)
}

export function getAllBvids() {
  const db = getDb()
  return db.prepare('SELECT bvid FROM videos').all().map(r => r.bvid)
}

// ── Settings ──

export function getSetting(key) {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

export function setSetting(key, value) {
  const db = getDb()
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

export function getAllSettings() {
  const db = getDb()
  return Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
  )
}

// ── Page Cache ──

export function getPageCache(bvid) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM page_cache WHERE bvid = ?').get(bvid)
  if (!row) return null
  return {
    pageCount: row.page_count,
    totalDuration: row.total_duration,
    pages: JSON.parse(row.pages_json),
    cachedAt: row.cached_at
  }
}

export function setPageCache(bvid, pages, totalDuration) {
  const db = getDb()
  return db.prepare(`
    INSERT OR REPLACE INTO page_cache (bvid, page_count, total_duration, pages_json, cached_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(bvid, pages.length, totalDuration, JSON.stringify(pages))
}

// ── Sync Log ──

export function insertSyncLog(status, message) {
  const db = getDb()
  return db.prepare('INSERT INTO sync_log (status, message) VALUES (?, ?)').run(status, message)
}

export function getLatestSyncLog() {
  const db = getDb()
  return db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1').get()
}
