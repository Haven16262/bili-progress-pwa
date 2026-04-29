import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cron from 'node-cron'
import authRoutes from './routes/auth.js'
import videoRoutes from './routes/videos.js'
import syncRoutes from './routes/sync.js'
import settingsRoutes from './routes/settings.js'
import bilibiliRoutes from './routes/bilibili.js'
import { runSync } from './services/sync.js'
import { getSetting, insertSyncLog, setSetting } from './db/queries.js'

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy — required when behind nginx / Cloudflare Tunnel
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// CORS — only allow the frontend origin
app.use(cors({
  origin: ['https://bili.havencode.page', 'https://havencode.page', 'http://localhost:5173'],
  credentials: true
}))

app.use(express.json({ limit: '1mb' }))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/bilibili', bilibiliRoutes)

// Health check
app.get('/api/ping', (_req, res) => res.json({ ok: true }))

// ── Production static serving ──
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', '..', 'client', 'dist')

if (existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback: non-API routes → index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log('[static] Serving built client from client/dist')
}

// ── Cron: daily sync at 3:07 AM ──
cron.schedule('7 3 * * *', async () => {
  console.log('[cron] 开始每日同步...')
  try {
    const result = await runSync()
    console.log('[cron]', result.ok ? result : result.error)
  } catch (err) {
    console.error('[cron] 同步异常:', err.message)
    insertSyncLog('failed', `定时同步异常: ${err.message}`)
    setSetting('last_sync_status', '定时同步异常，请查看同步日志')
    setSetting('last_sync_at', new Date().toISOString())
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`)
  const sess = getSetting('sessdata')
  console.log(sess
    ? '[cron] 每日同步已安排 (每天 03:07)'
    : '[cron] 每日同步已安排 (每天 03:07) — 等待 SESSDATA 配置')
})
