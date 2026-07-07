import crypto from 'crypto'

// ⚠️  JWT_SECRET coupling: the AES-256-GCM key for SESSDATA encryption is derived
//     from JWT_SECRET via SHA-256. Rotating JWT_SECRET will silently break decryption
//     of ALL previously stored SESSDATA values — users will appear to have no SESSDATA
//     configured, and re-saving will overwrite the (now unreadable) old ciphertext.
//     See also: server/.env.example
//
//     If key rotation is ever needed: export SESSDATA plaintext → rotate secret →
//     re-encrypt and write back. This logic is NOT implemented; if it becomes
//     necessary, global-overseer must implement per WORKFLOW.md mandatory escalation.

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
