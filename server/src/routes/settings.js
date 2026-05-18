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
  // columns_per_row is now managed client-side per device type
  delete settings.columns_per_row
  res.json(settings)
})

// PUT /api/settings — columns_per_row is now managed client-side per device type
router.put('/', (_req, res) => {
  res.json({ ok: true })
})

export default router
