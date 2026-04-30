import { Router } from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { signToken, requireAuth, revokeAllTokens } from '../middleware/auth.js'
import { getSetting, setSetting } from '../db/queries.js'
import { encryptSessdata } from '../services/crypto.js'

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

  const correct = process.env.APP_PASSWORD
  if (!correct) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  // Constant-time comparison — pad both to 128 bytes so length doesn't leak
  const maxLen = 128
  const bufA = Buffer.alloc(maxLen, 0)
  const bufB = Buffer.alloc(maxLen, 0)
  Buffer.from(password).copy(bufA)
  Buffer.from(correct).copy(bufB)
  if (!crypto.timingSafeEqual(bufA, bufB)) {
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
  setSetting('sessdata', encryptSessdata(sessdata.trim()))
  res.json({ ok: true })
})

// POST /api/auth/revoke — invalidate all existing tokens
router.post('/revoke', requireAuth, (req, res) => {
  const { password } = req.body
  const correct = process.env.APP_PASSWORD
  if (!correct) {
    return res.status(500).json({ error: '服务器配置错误' })
  }

  // Verify current password before revoking
  const maxLen = 128
  const bufA = Buffer.alloc(maxLen, 0)
  const bufB = Buffer.alloc(maxLen, 0)
  Buffer.from(password || '').copy(bufA)
  Buffer.from(correct).copy(bufB)
  if (!crypto.timingSafeEqual(bufA, bufB)) {
    return res.status(403).json({ error: '密码错误' })
  }

  const v = revokeAllTokens()
  // Issue a new token so the current session stays alive
  const token = signToken()
  res.json({ token, tokenVersion: v })
})

export default router
