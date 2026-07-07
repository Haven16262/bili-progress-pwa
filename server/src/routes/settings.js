import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getAllSettings, setSetting } from '../db/queries.js'

const router = Router()
router.use(requireAuth)

// GET /api/settings — get all settings except sessdata value (never expose it)
router.get('/', (_req, res) => {
  const settings = getAllSettings()
  // Never return the raw sessdata to the frontend — only a boolean flag
  const sessdataValue = settings.sessdata
  delete settings.sessdata
  delete settings.columns_per_row
  // Expose only whether SESSDATA is configured, never its value
  settings.sessdata_set = !!(sessdataValue && sessdataValue.length > 0)
  res.json(settings)
})

export default router
