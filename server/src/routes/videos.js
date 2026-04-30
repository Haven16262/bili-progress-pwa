import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  listVideos,
  getVideoByBvid,
  insertVideo,
  updateVideo,
  deleteVideo
} from '../db/queries.js'

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /api/videos — list all active videos
router.get('/', (_req, res) => {
  const videos = listVideos()
  res.json(videos)
})

const MAX_BVID = 32
const MAX_TITLE = 512
const MAX_CUSTOM_NAME = 256

// POST /api/videos — add a video to homepage
router.post('/', (req, res) => {
  const { bvid, title, progress, duration, custom_name, pinned } = req.body

  if (!bvid || typeof bvid !== 'string' || bvid.length > MAX_BVID) {
    return res.status(400).json({ error: '请提供有效的 bvid' })
  }

  const existing = getVideoByBvid(bvid)
  if (existing) {
    return res.status(409).json({ error: '该视频已在主页中' })
  }

  insertVideo({
    bvid,
    title: typeof title === 'string' ? title.slice(0, MAX_TITLE) : '',
    progress: Math.max(0, Math.min(100, Number(progress) || 0)),
    duration: Math.max(0, Number(duration) || 0),
    custom_name: typeof custom_name === 'string' ? custom_name.slice(0, MAX_CUSTOM_NAME) : '',
    pinned: pinned ? 1 : 0
  })

  res.status(201).json({ ok: true })
})

// PUT /api/videos/:id — update local fields (custom_name, pinned)
router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: '无效的 ID' })

  const fields = {}
  if (req.body.custom_name !== undefined) {
    if (typeof req.body.custom_name !== 'string' || req.body.custom_name.length > MAX_CUSTOM_NAME) {
      return res.status(400).json({ error: '自定义名称过长' })
    }
    fields.custom_name = req.body.custom_name
  }
  if (req.body.pinned !== undefined) fields.pinned = req.body.pinned ? 1 : 0

  const result = updateVideo(id, fields)
  if (!result || result.changes === 0) {
    return res.status(404).json({ error: '视频未找到' })
  }
  res.json({ ok: true })
})

// DELETE /api/videos/:id — remove video from homepage
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: '无效的 ID' })

  const result = deleteVideo(id)
  if (result.changes === 0) {
    return res.status(404).json({ error: '视频未找到' })
  }
  res.json({ ok: true })
})

export default router
