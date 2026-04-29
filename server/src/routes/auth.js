import { Router } from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { signToken, requireAuth } from '../middleware/auth.js'
import { getSetting, setSetting } from '../db/queries.js'

const router = Router()

// Rate limit login: max 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请 15 分钟后再试' }
})

// POST /api/auth/login — verify app password, return JWT
router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body
  if (!password || typeof password !== 'string' || password.length > 128) {
    return res.status(400).json({ error: '请输入密码' })
  }

  const correct = process.env.APP_PASSWORD || 'changeme123'

  // Constant-time comparison to prevent timing attacks
  const bufA = Buffer.from(password)
  const bufB = Buffer.from(correct)
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return res.status(403).json({ error: '密码错误' })
  }

  const token = signToken()
  res.json({ token })
})

// GET /api/auth/verify — check if JWT is still valid
router.get('/verify', requireAuth, (_req, res) => {
  res.json({ ok: true })
})

// PUT /api/auth/sessdata — update Bilibili SESSDATA cookie
router.put('/sessdata', requireAuth, (req, res) => {
  const { sessdata } = req.body
  if (!sessdata || typeof sessdata !== 'string') {
    return res.status(400).json({ error: '请提供有效的 SESSDATA' })
  }
  if (sessdata.length > 1024) {
    return res.status(400).json({ error: 'SESSDATA 长度超出限制' })
  }
  setSetting('sessdata', sessdata.trim())
  res.json({ ok: true })
})

export default router
