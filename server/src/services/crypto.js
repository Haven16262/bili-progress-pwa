import crypto from 'crypto'

const SESSDATA_PREFIX = 'v1:'
const ALGORITHM = 'aes-256-gcm'

function getKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return crypto.createHash('sha256').update('sessdata-enc:' + secret).digest()
}

export function encryptSessdata(plaintext) {
  const key = getKey()
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return SESSDATA_PREFIX + [nonce, encrypted, tag].map(b => b.toString('base64url')).join(':')
}

export function decryptSessdata(encoded) {
  if (!encoded || !encoded.startsWith(SESSDATA_PREFIX)) {
    // Not encrypted (legacy data) — return as-is
    return encoded
  }
  try {
    const key = getKey()
    const parts = encoded.slice(SESSDATA_PREFIX.length).split(':')
    if (parts.length !== 3) return null
    const [nonce, ciphertext, tag] = parts.map(s => Buffer.from(s, 'base64url'))
    const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
