import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.TEST_DB || path.join(__dirname, '..', '..', 'data.db')

if (process.env.TEST_DB && process.env.NODE_ENV !== 'test') {
  console.warn('[init] TEST_DB is set but NODE_ENV is not "test" — using test database in non-test environment')
}

let db

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
    // WAL checkpoint every hour — prevents WAL from growing unboundedly
    // when a long-lived connection blocks autocheckpoint's TRUNCATE phase.
    setInterval(() => {
      db.pragma('wal_checkpoint(TRUNCATE)')
    }, 60 * 60 * 1000)
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

  // Migrations: add columns that may not exist in older data.db
  const cols = db.pragma('table_info(videos)').map(c => c.name)
  if (!cols.includes('manually_completed')) {
    db.exec('ALTER TABLE videos ADD COLUMN manually_completed INTEGER NOT NULL DEFAULT 0')
  }
  if (!cols.includes('progress_100_date')) {
    db.exec('ALTER TABLE videos ADD COLUMN progress_100_date TEXT')
  }

  // Seed default settings if not present
  const seed = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  seed.run('sessdata', '')
  // columns_per_row is client-side per device type; no longer seeded
  seed.run('last_sync_status', '')
  seed.run('last_sync_at', '')
}
