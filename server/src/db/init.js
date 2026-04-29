import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'data.db')

let db

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bvid TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      progress REAL NOT NULL DEFAULT 0,
      duration INTEGER NOT NULL DEFAULT 0,
      custom_name TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      progress_100_count INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS page_cache (
      bvid TEXT PRIMARY KEY,
      page_count INTEGER NOT NULL DEFAULT 0,
      total_duration INTEGER NOT NULL DEFAULT 0,
      pages_json TEXT NOT NULL DEFAULT '[]',
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Seed default settings if not present
  const seed = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  seed.run('sessdata', '')
  seed.run('columns_per_row', '3')
  seed.run('last_sync_status', '')
  seed.run('last_sync_at', '')
}
