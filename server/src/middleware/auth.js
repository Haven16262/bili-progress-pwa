import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRY = '30d'

export function signToken() {
  return jwt.sign(
    { iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }

  try {
    jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: '认证令牌无效或已过期，请重新输入密码' })
  }
}
