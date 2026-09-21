import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import http from 'node:http'
import express from 'express'
import { getDb } from '../src/db/init.js'
import { signToken } from '../src/middleware/auth.js'
import videosRouter from '../src/routes/videos.js'
import { insertVideo, getVideoByBvid, listVideos, listCompletedVideos } from '../src/db/queries.js'

// 真实路由测试：挂载生产用的 videos router（含 requireAuth），
// token 用 vitest.config.js 注入的测试 JWT_SECRET 由 signToken() 签发。

let server
let baseUrl
let token

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/videos', videosRouter)
  server = http.createServer(app)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  token = signToken()
})

afterAll(async () => {
  await new Promise(resolve => server.close(resolve))
})

beforeEach(() => {
  getDb().exec('DELETE FROM videos')
})

function seedVideo(bvid, overrides = {}) {
  insertVideo({
    bvid,
    title: overrides.title || '测试视频',
    progress: overrides.progress ?? 50,
    duration: 300,
    custom_name: overrides.custom_name || '',
    pinned: overrides.pinned || 0
  })
  return getVideoByBvid(bvid)
}

async function callDelete(path, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers })
  let body = null
  try { body = await res.json() } catch { /* 无 JSON body */ }
  return { status: res.status, body }
}

function authHeaders() {
  return { Authorization: `Bearer ${token}` }
}

describe('DELETE /api/videos/:id — 真实路由（含 requireAuth）', () => {
  test('已存在的 id → 200，且该行从 listVideos 与 listCompletedVideos 中彻底消失', async () => {
    // progress=100 → 同时出现在首页列表与「已观看完视频」列表
    const row = seedVideo('BV_DEL_OK', { progress: 100 })

    expect(listVideos().map(v => v.id)).toContain(row.id)
    expect(listCompletedVideos().map(v => v.id)).toContain(row.id)

    const res = await callDelete(`/api/videos/${row.id}`, authHeaders())

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(getVideoByBvid('BV_DEL_OK')).toBeUndefined()
    expect(listVideos().map(v => v.id)).not.toContain(row.id)
    expect(listCompletedVideos().map(v => v.id)).not.toContain(row.id)
  })

  test('不存在的 id → 404，且不影响其它行', async () => {
    const keep = seedVideo('BV_KEEP')

    const res = await callDelete('/api/videos/99999', authHeaders())

    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
    expect(getVideoByBvid('BV_KEEP')).toBeTruthy()
    expect(listVideos().map(v => v.id)).toContain(keep.id)
  })

  for (const raw of ['0', '-1', '1.5', 'abc']) {
    test(`非法 id "${raw}" → 400，且不删除任何行`, async () => {
      const keep = seedVideo('BV_INVALID_KEEP')

      const res = await callDelete(`/api/videos/${raw}`, authHeaders())

      expect(res.status).toBe(400)
      expect(res.body.error).toBeTruthy()
      expect(listVideos().map(v => v.id)).toContain(keep.id)
    })
  }

  test('无 token → 401，且视频仍在库中', async () => {
    const row = seedVideo('BV_AUTH_REQUIRED')

    const res = await callDelete(`/api/videos/${row.id}`)

    expect(res.status).toBe(401)
    expect(getVideoByBvid('BV_AUTH_REQUIRED')).toBeTruthy()
  })
})
