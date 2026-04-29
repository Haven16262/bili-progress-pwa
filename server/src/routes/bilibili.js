import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getAddCandidates } from '../services/sync.js'

const router = Router()
router.use(requireAuth)

// GET /api/bilibili/recent — recent B站 history NOT on homepage yet
router.get('/recent', async (_req, res) => {
  try {
    const candidates = await getAddCandidates()
    res.json(candidates)
  } catch {
    // Don't leak internal error details to frontend
    res.status(500).json({ error: '获取数据失败，请检查 SESSDATA 是否有效' })
  }
})

export default router
