const BASE = '/api'

export const api = {
  getPresentations: () => fetch(`${BASE}/presentations`).then(r => r.json()),
  getPresentation: (id) => fetch(`${BASE}/presentations/${id}`).then(r => r.json()),
  createPresentation: (data) => fetch(`${BASE}/presentations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updatePresentation: (id, data) => fetch(`${BASE}/presentations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deletePresentation: (id) => fetch(`${BASE}/presentations/${id}`, { method: 'DELETE' }).then(r => r.json()),
  duplicatePresentation: (id) => fetch(`${BASE}/presentations/${id}/duplicate`, { method: 'POST' }).then(r => r.json()),
  uploadFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json())
  },
  getGithubConfig: () => fetch(`${BASE}/github/config`).then(r => r.json()),
  saveGithubConfig: (data) => fetch(`${BASE}/github/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  pushToGithub: (id) => fetch(`${BASE}/presentations/${id}/github/push`, {
    method: 'POST',
  }).then(async r => {
    const body = await r.json()
    if (!r.ok) throw new Error(body.error || 'Push failed')
    return body
  }),
}
