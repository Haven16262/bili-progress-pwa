const BASE = '/api'

function token() {
  return localStorage.getItem('token')
}

// ── Unified request wrapper ──

class ApiError extends Error {
  constructor(status, body) {
    const message = typeof body?.error === 'string'
      ? body.error
      : `请求失败 (${status})`
    super(message)
    this.status = status
    this.body = body
  }
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...options.headers
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, { error: '无法连接服务器' })
  }

  // 401 → clear token so PasswordGate reappears
  if (res.status === 401) {
    // Only clear auth token — never touch columns_* keys
    localStorage.removeItem('token')
    throw new ApiError(401, { error: '登录已过期，请重新输入密码' })
  }

  // Parse body (may be empty for 204 etc.)
  let body
  const ct = res.headers.get('content-type')
  if (ct && ct.includes('application/json')) {
    try { body = await res.json() } catch { /* empty */ }
  }

  if (!res.ok) {
    throw new ApiError(res.status, body || { error: `请求失败 (${res.status})` })
  }

  return body
}

export const api = {
  login: (password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  verifyToken: () =>
    request('/auth/verify'),

  getVideos: () =>
    request('/videos'),

  addVideo: (video) =>
    request('/videos', { method: 'POST', body: JSON.stringify(video) }),

  updateVideo: (id, data) =>
    request(`/videos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteVideo: (id) =>
    request(`/videos/${id}`, { method: 'DELETE' }),

  triggerSync: () =>
    request('/sync', { method: 'POST' }),

  getRecentHistory: () =>
    request('/bilibili/recent'),

  updateSessdata: (sessdata) =>
    request('/auth/sessdata', { method: 'PUT', body: JSON.stringify({ sessdata }) }),

  getSettings: () =>
    request('/settings'),

  getSyncStatus: () =>
    request('/sync/status'),

  markVideoCompleted: (id) =>
    request(`/videos/${id}/complete`, { method: 'POST' }),

  getCompletedVideos: () =>
    request('/videos/completed'),
}
