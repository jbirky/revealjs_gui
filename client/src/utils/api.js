let _getToken = async () => null
export function setTokenGetter(fn) { _getToken = fn }

const _fetch = globalThis.fetch.bind(globalThis)
async function authFetch(url, options = {}) {
  const token = await _getToken()
  const headers = { ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return _fetch(url, { ...options, headers })
}

const BASE = '/api'

export const api = {
  getPresentations: () => authFetch(`${BASE}/presentations`).then(r => r.json()),
  getPresentation: (id) => authFetch(`${BASE}/presentations/${id}`).then(r => r.json()),
  createPresentation: (data) => authFetch(`${BASE}/presentations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.message || b.error || 'Create failed'); return b }),
  updatePresentation: (id, data) => authFetch(`${BASE}/presentations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deletePresentation: (id) => authFetch(`${BASE}/presentations/${id}`, { method: 'DELETE' }).then(r => r.json()),
  duplicatePresentation: (id) => authFetch(`${BASE}/presentations/${id}/duplicate`, { method: 'POST' }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.message || b.error || 'Duplicate failed'); return b }),
  uploadFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return authFetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json())
  },
  uploadFileToPresentation: (presentationId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return authFetch(`/api/presentations/${presentationId}/upload`, { method: 'POST', body: fd }).then(r => r.json())
  },
  getUploads: (presentationId) => authFetch(`${BASE}/presentations/${presentationId}/uploads`).then(r => r.json()),
  getGithubConfig: () => authFetch(`${BASE}/github/config`).then(r => r.json()),
  saveGithubConfig: (data) => authFetch(`${BASE}/github/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  pushToGithub: (id, message) => authFetch(`${BASE}/presentations/${id}/github/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(async r => {
    const body = await r.json()
    if (!r.ok) throw new Error(body.error || 'Push failed')
    return body
  }),

  // Templates
  getTemplates: () => authFetch(`${BASE}/templates`).then(r => r.json()),
  getTemplate: (id) => authFetch(`${BASE}/templates/${id}`).then(r => r.json()),
  createTemplate: (data) => authFetch(`${BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  updateTemplate: (id, data) => authFetch(`${BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteTemplate: (id) => authFetch(`${BASE}/templates/${id}`, { method: 'DELETE' }).then(r => r.json()),
  saveAsTemplate: (id, title) => authFetch(`${BASE}/presentations/${id}/save-as-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }).then(r => r.json()),

  // Version History
  saveSnapshot: (id, name) => authFetch(`${BASE}/presentations/${id}/snapshot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
  }).then(r => r.json()),
  getSnapshots: (id) => authFetch(`${BASE}/presentations/${id}/snapshots`).then(r => r.json()),
  restoreSnapshot: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/restore/${snapshotId}`, { method: 'POST' }).then(r => r.json()),
  deleteSnapshot: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}`, { method: 'DELETE' }).then(r => r.json()),

  // Rclone / Proton Drive
  getRcloneStatus: () => authFetch(`${BASE}/rclone/status`).then(r => r.json()),
  configureRclone: (data) => authFetch(`${BASE}/rclone/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b }),
  syncToRemote: (data) => authFetch(`${BASE}/rclone/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b }),
  syncSingleToRemote: (data) => authFetch(`${BASE}/rclone/sync-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b }),

  // Git history
  getGitHistory: (id) => authFetch(`${BASE}/presentations/${id}/github/history`).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),
  getGitVersion: (id, sha) => authFetch(`${BASE}/presentations/${id}/github/version/${sha}`).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // User / plan
  getMe: () => authFetch(`${BASE}/me`).then(r => r.json()),

  // Share links
  enableShare: (id) => authFetch(`${BASE}/presentations/${id}/share`, { method: 'POST' }).then(r => r.json()),
  disableShare: (id) => authFetch(`${BASE}/presentations/${id}/share`, { method: 'DELETE' }).then(r => r.json()),
  getShareStatus: (id) => authFetch(`${BASE}/presentations/${id}/share`).then(r => r.json()),

  // Billing
  createCheckout: () => authFetch(`${BASE}/billing/checkout`, { method: 'POST' }).then(r => r.json()),
  createPortal: () => authFetch(`${BASE}/billing/portal`, { method: 'POST' }).then(r => r.json()),
  getBillingStatus: () => authFetch(`${BASE}/billing/status`).then(r => r.json()),
  cancelSubscription: () => authFetch(`${BASE}/billing/cancel`, { method: 'POST' }).then(r => r.json()),
  resumeSubscription: () => authFetch(`${BASE}/billing/resume`, { method: 'POST' }).then(r => r.json()),
}
