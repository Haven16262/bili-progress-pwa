import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cron from 'node-cron'
import authRoutes from './routes/auth.js'
import videoRoutes from './routes/videos.js'
import syncRoutes from './routes/sync.js'
import settingsRoutes from './routes/settings.js'
import bilibiliRoutes from './routes/bilibili.js'
import { runSync } from './services/sync.js'
import { getSetting, insertSyncLog, setSetting } from './db/queries.js'
import { decryptSessdata } from './services/crypto.js'

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy — required when behind nginx / Cloudflare Tunnel
app.set('trust proxy', 1)

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://*.bilibili.com", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}))

// Permissions-Policy — restrict browser features (helmet 8 dropped this)
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=()')
  next()
})

// CORS — only allow the frontend origin
app.use(cors({
  origin: ['https://bili.havencode.page', 'https://havencode.page', 'http://localhost:5173'],
  credentials: true
}))

app.use(express.json({ limit: '1mb' }))

// General rate limit for all API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api', apiLimiter)

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/bilibili', bilibiliRoutes)

// Health check
app.get('/api/ping', (_req, res) => res.json({ ok: true }))

// Catch-all for unmatched API paths — return 404 JSON instead of index.html
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API 端点不存在' })
})

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

// Global error handler — prevent stack traces from leaking to clients
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  res.status(500).json({ error: '服务器内部错误' })
})

// ── Cron: daily sync at 3:07 AM ──
cron.schedule('7 3 * * *', async () => {
  console.log('[cron] 开始每日同步...')
  try {
    const result = await runSync()
    console.log('[cron]', result.ok ? result : result.error)
  } catch (err) {
    console.error('[cron] 同步异常:', err.message)
    try {
      insertSyncLog('failed', '定时同步异常，请查看服务器日志')
      setSetting('last_sync_status', '定时同步异常，请查看同步日志')
      setSetting('last_sync_at', new Date().toISOString())
    } catch (logErr) {
      console.error('[cron] 无法写入同步日志:', logErr)
    }
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`)
  const sess = decryptSessdata(getSetting('sessdata'))
  console.log(sess
    ? '[cron] 每日同步已安排 (每天 03:07)'
    : '[cron] 每日同步已安排 (每天 03:07) — 等待 SESSDATA 配置')
})
