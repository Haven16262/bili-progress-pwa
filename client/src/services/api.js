const BASE = '/api'
const token = () => localStorage.getItem('token')

const headers = () => ({
  'Content-Type': 'application/json',
  ...(token() ? { Authorization: `Bearer ${token()}` } : {})
})

export const api = {
  login: (password) =>
    fetch(`${BASE}/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ password }) }).then(r => r.json()),

  getVideos: () =>
    fetch(`${BASE}/videos`, { headers: headers() }).then(r => r.json()),

  addVideo: (video) =>
    fetch(`${BASE}/videos`, { method: 'POST', headers: headers(), body: JSON.stringify(video) }).then(r => r.json()),

  updateVideo: (id, data) =>
    fetch(`${BASE}/videos/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(r => r.json()),

  deleteVideo: (id) =>
    fetch(`${BASE}/videos/${id}`, { method: 'DELETE', headers: headers() }).then(r => r.json()),

  triggerSync: () =>
    fetch(`${BASE}/sync`, { method: 'POST', headers: headers() }).then(r => r.json()),

  getRecentHistory: () =>
    fetch(`${BASE}/bilibili/recent`, { headers: headers() }).then(r => r.json()),

  updateSessdata: (sessdata) =>
    fetch(`${BASE}/auth/sessdata`, { method: 'PUT', headers: headers(), body: JSON.stringify({ sessdata }) }).then(r => r.json()),

  getSettings: () =>
    fetch(`${BASE}/settings`, { headers: headers() }).then(r => r.json()),

  updateSettings: (settings) =>
    fetch(`${BASE}/settings`, { method: 'PUT', headers: headers(), body: JSON.stringify(settings) }).then(r => r.json()),

  getSyncStatus: () =>
    fetch(`${BASE}/sync/status`, { headers: headers() }).then(r => r.json())
}
