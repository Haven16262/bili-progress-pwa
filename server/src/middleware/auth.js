import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { getSetting, setSetting } from '../db/queries.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required')
  process.exit(1)
}
const JWT_EXPIRY = '30d'

function getTokenVersion() {
  let v = getSetting('token_version')
  if (!v) {
    v = '1'
    setSetting('token_version', v)
  }
  return parseInt(v)
}

export function signToken() {
  return jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
      tv: getTokenVersion()
    },
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
    const payload = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] })
    if (typeof payload.tv !== 'number' || payload.tv !== getTokenVersion()) {
      return res.status(401).json({ error: '认证令牌已失效，请重新输入密码' })
    }
    next()
  } catch {
    return res.status(401).json({ error: '认证令牌无效或已过期，请重新输入密码' })
  }
}

export function revokeAllTokens() {
  const v = getTokenVersion() + 1
  setSetting('token_version', String(v))
  return v
}
