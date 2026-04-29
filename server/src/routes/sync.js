import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getLatestSyncLog } from '../db/queries.js'
import { runSync } from '../services/sync.js'

const router = Router()
router.use(requireAuth)

// POST /api/sync — manually trigger sync
router.post('/', async (_req, res) => {
  try {
    const result = await runSync()
    res.json(result)
  } catch {
    res.status(500).json({ error: '同步服务异常，请稍后重试' })
  }
})

// GET /api/sync/status — get last sync status
router.get('/status', (_req, res) => {
  const log = getLatestSyncLog()
  if (!log) {
    return res.json({ status: 'never', message: '尚未执行过同步', at: null, hasProblem: false })
  }
  res.json({
    status: log.status,
    message: log.message,
    at: log.created_at,
    hasProblem: log.status === 'failed'
  })
})

export default router
