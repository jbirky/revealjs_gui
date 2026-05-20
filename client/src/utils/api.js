let _getToken = async () => null
export function setTokenGetter(fn) { _getToken = fn }

const _fetch = globalThis.fetch.bind(globalThis)
async function authFetch(url, options = {}) {
  const token = await _getToken()
  const headers = { ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return _fetch(url, { ...options, headers })
}

async function safeJson(r) {
  const text = await r.text()
  try { return JSON.parse(text) }
  catch { throw new Error(r.ok ? 'Invalid JSON response' : `Request failed (${r.status})`) }
}

const BASE = '/api'

export const api = {
  getPresentations: () => authFetch(`${BASE}/presentations`).then(safeJson),
  getPresentation: (id) => authFetch(`${BASE}/presentations/${id}`).then(safeJson),
  createPresentation: (data) => authFetch(`${BASE}/presentations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.message || b.error || 'Create failed'); return b }),
  updatePresentation: (id, data) => authFetch(`${BASE}/presentations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  deletePresentation: (id) => authFetch(`${BASE}/presentations/${id}`, { method: 'DELETE' }).then(safeJson),
  duplicatePresentation: (id) => authFetch(`${BASE}/presentations/${id}/duplicate`, { method: 'POST' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.message || b.error || 'Duplicate failed'); return b }),
  uploadFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return authFetch('/api/upload', { method: 'POST', body: fd }).then(safeJson)
  },
  uploadFileToPresentation: (presentationId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return authFetch(`/api/presentations/${presentationId}/upload`, { method: 'POST', body: fd }).then(safeJson)
  },
  getGithubConfig: () => authFetch(`${BASE}/github/config`).then(safeJson),
  saveGithubConfig: (data) => authFetch(`${BASE}/github/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  pushToGithub: (id, message) => authFetch(`${BASE}/presentations/${id}/github/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(async r => {
    const body = await safeJson(r)
    if (!r.ok) throw new Error(body.error || 'Push failed')
    return body
  }),

  // Live sessions
  startLiveSession: (id) => authFetch(`${BASE}/presentations/${id}/live/start`, { method: 'POST' }).then(safeJson),
  stopLiveSession: (id, sessionId) => authFetch(`${BASE}/presentations/${id}/live/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  }).then(safeJson),
  updateLiveSlide: (sessionId, flatIndex) => _fetch(`/api/live/${sessionId}/slide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flatIndex })
  }).then(safeJson),

  // Zotero
  getZoteroConfig: () => authFetch(`${BASE}/zotero/config`).then(safeJson),
  saveZoteroConfig: (data) => authFetch(`${BASE}/zotero/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  deleteZoteroConfig: () => authFetch(`${BASE}/zotero/config`, { method: 'DELETE' }).then(safeJson),
  zoteroProxy: (path, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return authFetch(`${BASE}/zotero/proxy/${path}${qs ? '?' + qs : ''}`).then(async r => {
      const total = parseInt(r.headers.get('Total-Results') || '0', 10)
      const data = await safeJson(r)
      return { data, total }
    })
  },

  // Templates
  getTemplates: () => authFetch(`${BASE}/templates`).then(safeJson),
  getTemplate: (id) => authFetch(`${BASE}/templates/${id}`).then(safeJson),
  createTemplate: (data) => authFetch(`${BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  updateTemplate: (id, data) => authFetch(`${BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(safeJson),
  deleteTemplate: (id) => authFetch(`${BASE}/templates/${id}`, { method: 'DELETE' }).then(safeJson),
  saveAsTemplate: (id, title) => authFetch(`${BASE}/presentations/${id}/save-as-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }).then(safeJson),

  // Version History
  saveSnapshot: (id, name) => authFetch(`${BASE}/presentations/${id}/snapshot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
  }).then(safeJson),
  getSnapshots: (id) => authFetch(`${BASE}/presentations/${id}/snapshots`).then(safeJson),
  restoreSnapshot: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/restore/${snapshotId}`, { method: 'POST' }).then(safeJson),
  deleteSnapshot: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}`, { method: 'DELETE' }).then(safeJson),
  getSnapshotData: (id, snapshotId) => authFetch(`${BASE}/presentations/${id}/snapshots/${snapshotId}/data`).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // Rclone / Proton Drive
  getRcloneStatus: () => authFetch(`${BASE}/rclone/status`).then(safeJson),
  configureRclone: (data) => authFetch(`${BASE}/rclone/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error); return b }),
  syncToRemote: (data) => authFetch(`${BASE}/rclone/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error); return b }),
  syncSingleToRemote: (data) => authFetch(`${BASE}/rclone/sync-single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error); return b }),

  // Git history
  getGitHistory: (id) => authFetch(`${BASE}/presentations/${id}/github/history`).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),
  getGitVersion: (id, sha) => authFetch(`${BASE}/presentations/${id}/github/version/${sha}`).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // Fork from Git
  browseGitRepo: (url) => authFetch(`${BASE}/github/browse-repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Browse failed'); return b }),
  forkFromGit: (owner, repo, folder, branch) => authFetch(`${BASE}/presentations/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, folder, branch }),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.message || b.error || 'Fork failed'); return b }),

  // Zenodo
  getZenodoConfig: () => authFetch(`${BASE}/zenodo/config`).then(async r => { if (!r.ok) return { hasToken: false, sandbox: false }; return safeJson(r) }),
  saveZenodoConfig: (data) => authFetch(`${BASE}/zenodo/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Save failed'); return b }),
  deleteZenodoConfig: () => authFetch(`${BASE}/zenodo/config`, { method: 'DELETE' }).then(safeJson),
  getZenodoStatus: (id) => authFetch(`${BASE}/presentations/${id}/zenodo/status`).then(safeJson),
  publishToZenodo: (id, metadata) => authFetch(`${BASE}/presentations/${id}/zenodo/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Publish failed'); return b }),

  // Custom fonts
  getFonts: () => authFetch(`${BASE}/fonts`).then(safeJson),
  uploadFont: (file, familyName) => {
    const fd = new FormData()
    fd.append('file', file)
    if (familyName) fd.append('familyName', familyName)
    return authFetch(`${BASE}/fonts/upload`, { method: 'POST', body: fd }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Upload failed'); return b })
  },
  addGoogleFont: (familyName) => authFetch(`${BASE}/fonts/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyName }),
  }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),
  deleteFont: (id) => authFetch(`${BASE}/fonts/${id}`, { method: 'DELETE' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Failed'); return b }),

  // File management
  getUploads: () => authFetch(`${BASE}/uploads`).then(safeJson),
  deleteUpload: (id) => authFetch(`${BASE}/uploads/${id}`, { method: 'DELETE' }).then(async r => { const b = await safeJson(r); if (!r.ok) throw new Error(b.error || 'Delete failed'); return b }),

  // User / plan
  getMe: () => authFetch(`${BASE}/me`).then(safeJson),

  // Share links
  enableShare: (id) => authFetch(`${BASE}/presentations/${id}/share`, { method: 'POST' }).then(safeJson),
  disableShare: (id) => authFetch(`${BASE}/presentations/${id}/share`, { method: 'DELETE' }).then(safeJson),
  getShareStatus: (id) => authFetch(`${BASE}/presentations/${id}/share`).then(safeJson),

  // Billing
  createCheckout: () => authFetch(`${BASE}/billing/checkout`, { method: 'POST' }).then(safeJson),
  createPortal: () => authFetch(`${BASE}/billing/portal`, { method: 'POST' }).then(safeJson),
  getBillingStatus: () => authFetch(`${BASE}/billing/status`).then(safeJson),
  cancelSubscription: () => authFetch(`${BASE}/billing/cancel`, { method: 'POST' }).then(safeJson),
  resumeSubscription: () => authFetch(`${BASE}/billing/resume`, { method: 'POST' }).then(safeJson),
}
