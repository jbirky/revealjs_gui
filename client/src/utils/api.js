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
  uploadFileToPresentation: (presentationId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`/api/presentations/${presentationId}/upload`, { method: 'POST', body: fd }).then(r => r.json())
  },
  getGithubConfig: () => fetch(`${BASE}/github/config`).then(r => r.json()),
  saveGithubConfig: (data) => fetch(`${BASE}/github/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  pushToGithub: (id, message) => fetch(`${BASE}/presentations/${id}/github/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(async r => {
    const body = await r.json()
    if (!r.ok) throw new Error(body.error || 'Push failed')
    return body
  }),

  // Templates
  getTemplates: () => fetch(`${BASE}/templates`).then(r => r.json()),
  getTemplate: (id) => fetch(`${BASE}/templates/${id}`).then(r => r.json()),
  createTemplate: (data) => fetch(`${BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateTemplate: (id, data) => fetch(`${BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteTemplate: (id) => fetch(`${BASE}/templates/${id}`, { method: 'DELETE' }).then(r => r.json()),
  saveAsTemplate: (id, title) => fetch(`${BASE}/presentations/${id}/save-as-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }).then(r => r.json()),

  // Version History
  saveSnapshot: (id, name) => fetch(`${BASE}/presentations/${id}/snapshot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
  }).then(r => r.json()),
  getSnapshots: (id) => fetch(`${BASE}/presentations/${id}/snapshots`).then(r => r.json()),
  restoreSnapshot: (id, snapshotId) => fetch(`${BASE}/presentations/${id}/restore/${snapshotId}`, { method: 'POST' }).then(r => r.json()),
  deleteSnapshot: (id, snapshotId) => fetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}`, { method: 'DELETE' }).then(r => r.json()),

  // Rclone / Proton Drive
  getRcloneStatus: () => fetch(`${BASE}/rclone/status`).then(r => r.json()),
  configureRclone: (data) => fetch(`${BASE}/rclone/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b }),
  syncToRemote: (data) => fetch(`${BASE}/rclone/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b }),
  syncSingleToRemote: (data) => fetch(`${BASE}/rclone/sync-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b }),

  // Share links
  enableShare: (id) => fetch(`${BASE}/presentations/${id}/share`, { method: 'POST' }).then(r => r.json()),
  disableShare: (id) => fetch(`${BASE}/presentations/${id}/share`, { method: 'DELETE' }).then(r => r.json()),
  getShareStatus: (id) => fetch(`${BASE}/presentations/${id}/share`).then(r => r.json()),
}
