import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getAllSettings, setSetting } from '../db/queries.js'

const router = Router()
router.use(requireAuth)

// GET /api/settings — get all settings except sessdata (never expose it)
router.get('/', (_req, res) => {
  const settings = getAllSettings()
  // Never return the raw sessdata to the frontend
  delete settings.sessdata
  res.json(settings)
})

// PUT /api/settings — update settings
router.put('/', (req, res) => {
  const allowed = ['columns_per_row']
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      setSetting(key, String(req.body[key]))
    }
  }
  res.json({ ok: true })
})

export default router
