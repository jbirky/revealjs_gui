// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const { Pool } = require('pg')
const { v4: uuidv4 } = require('uuid')
const StorageInterface = require('./interface')

class PgStorage extends StorageInterface {
  constructor(connectionString) {
    super()
    this.pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  }

  async query(text, params) {
    return this.pool.query(text, params)
  }

  // --- Presentations ---

  async listPresentations(userId, opts = {}) {
    const conditions = ['is_template = false']
    const params = []
    if (userId) { params.push(userId); conditions.push(`user_id = $${params.length}`) }
    if (opts.excludeExpired) { conditions.push('(expires_at IS NULL OR expires_at > NOW())') }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await this.query(`
      SELECT id, title,
        data->>'theme' as theme,
        data->>'transition' as transition,
        jsonb_array_length(COALESCE(data->'slides', '[]'::jsonb)) as "slideCount",
        updated_at as "updatedAt",
        created_at as "createdAt",
        expires_at as "expiresAt",
        data->'slides'->0->'background' as thumbnail
      FROM presentations
      ${where}
      ORDER BY updated_at DESC
    `, params)
    return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0, thumbnail: r.thumbnail || null }))
  }

  async getPresentation(id, userId) {
    const { rows } = await this.query(
      'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt", expires_at as "expiresAt" FROM presentations WHERE id = $1 AND is_template = false',
      [id]
    )
    if (!rows.length) return null
    const r = rows[0]
    return { ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, expiresAt: r.expiresAt || null }
  }

  async createPresentation(data, userId, expiresAt = null) {
    const id = data.id || uuidv4()
    const now = new Date().toISOString()
    const title = data.title || 'Untitled'
    const pres = { ...data, id, createdAt: now, updatedAt: now }
    if (expiresAt) pres.expiresAt = expiresAt
    await this.query(
      'INSERT INTO presentations (id, user_id, title, data, is_template, created_at, updated_at, expires_at) VALUES ($1, $2, $3, $4, false, $5, $5, $6)',
      [id, userId || null, title, JSON.stringify(pres), now, expiresAt]
    )
    return pres
  }

  async updatePresentation(id, data, userId) {
    const existing = await this.getPresentation(id, userId)
    if (!existing) return null
    const now = new Date().toISOString()
    const merged = { ...existing, ...data, id, updatedAt: now }
    await this.query(
      'UPDATE presentations SET title = $1, data = $2, updated_at = $3 WHERE id = $4',
      [merged.title || 'Untitled', JSON.stringify(merged), now, id]
    )
    return merged
  }

  async deletePresentation(id, userId) {
    const { rowCount } = await this.query('DELETE FROM presentations WHERE id = $1', [id])
    return rowCount > 0
  }

  async duplicatePresentation(id, userId) {
    const orig = await this.getPresentation(id, userId)
    if (!orig) return null
    const copy = { ...JSON.parse(JSON.stringify(orig)), title: (orig.title || 'Untitled') + ' (copy)' }
    delete copy.id
    delete copy.createdAt
    delete copy.updatedAt
    return this.createPresentation(copy, userId)
  }

  // --- Templates ---

  async listTemplates(userId) {
    const { rows } = await this.query(`
      SELECT id, title,
        data->>'theme' as theme,
        data->>'transition' as transition,
        jsonb_array_length(COALESCE(data->'slides', '[]'::jsonb)) as "slideCount",
        updated_at as "updatedAt",
        created_at as "createdAt",
        data->'slides'->0->'background' as thumbnail
      FROM presentations
      WHERE is_template = true
      ORDER BY updated_at DESC
    `)
    return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0, thumbnail: r.thumbnail || null }))
  }

  async getTemplate(id, userId) {
    const { rows } = await this.query(
      'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt" FROM presentations WHERE id = $1 AND is_template = true',
      [id]
    )
    if (!rows.length) return null
    const r = rows[0]
    return { ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt }
  }

  async createTemplate(data, userId) {
    const id = uuidv4()
    const now = new Date().toISOString()
    const title = data.title || 'Untitled Template'
    const tmpl = { ...data, id, isTemplate: true, createdAt: now, updatedAt: now }
    await this.query(
      'INSERT INTO presentations (id, user_id, title, data, is_template, created_at, updated_at) VALUES ($1, $2, $3, $4, true, $5, $5)',
      [id, userId || null, title, JSON.stringify(tmpl), now]
    )
    return tmpl
  }

  async updateTemplate(id, data, userId) {
    const existing = await this.getTemplate(id, userId)
    if (!existing) return null
    const now = new Date().toISOString()
    const merged = { ...existing, ...data, id, updatedAt: now }
    await this.query(
      'UPDATE presentations SET title = $1, data = $2, updated_at = $3 WHERE id = $4 AND is_template = true',
      [merged.title || 'Untitled', JSON.stringify(merged), now, id]
    )
    return merged
  }

  async deleteTemplate(id, userId) {
    const { rowCount } = await this.query('DELETE FROM presentations WHERE id = $1 AND is_template = true', [id])
    return rowCount > 0
  }

  async saveAsTemplate(presentationId, title, userId) {
    const pres = await this.getPresentation(presentationId, userId)
    if (!pres) return null
    const tmplData = { ...JSON.parse(JSON.stringify(pres)), title: (title || pres.title || 'Untitled') + ' (template)' }
    delete tmplData.id
    delete tmplData.createdAt
    delete tmplData.updatedAt
    return this.createTemplate(tmplData, userId)
  }

  // --- Sharing ---

  async createShareToken(presentationId, userId) {
    const { rows } = await this.query('SELECT id, share_token, share_enabled FROM presentations WHERE id = $1', [presentationId])
    if (!rows.length) return null
    const row = rows[0]
    if (row.share_enabled && row.share_token) return { token: row.share_token, shared: true }
    const token = row.share_token || uuidv4()
    await this.query('UPDATE presentations SET share_token = $1, share_enabled = true WHERE id = $2', [token, presentationId])
    return { token, shared: true }
  }

  async deleteShareToken(presentationId, userId) {
    await this.query('UPDATE presentations SET share_enabled = false WHERE id = $1', [presentationId])
    return { shared: false }
  }

  async getShareStatus(presentationId, userId) {
    const { rows } = await this.query('SELECT share_token, share_enabled FROM presentations WHERE id = $1', [presentationId])
    if (!rows.length) return { shared: false, token: null }
    return { shared: rows[0].share_enabled, token: rows[0].share_enabled ? rows[0].share_token : null }
  }

  async getSharedPresentation(token) {
    const { rows } = await this.query(
      'SELECT id, data, created_at as "createdAt", updated_at as "updatedAt" FROM presentations WHERE share_token = $1 AND share_enabled = true',
      [token]
    )
    if (!rows.length) return null
    const r = rows[0]
    return { ...r.data, id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt }
  }

  // --- Snapshots ---

  async createSnapshot(presentationId, name, userId) {
    const pres = await this.getPresentation(presentationId, userId)
    if (!pres) return null
    const id = uuidv4()
    const label = name || new Date().toISOString()
    const now = new Date().toISOString()
    await this.query(
      'INSERT INTO snapshots (id, presentation_id, data, label, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, presentationId, JSON.stringify(pres), label, now]
    )
    return { id, name: label, createdAt: now }
  }

  async listSnapshots(presentationId, userId) {
    const { rows } = await this.query(
      `SELECT id, label as name, created_at as "createdAt",
        jsonb_array_length(COALESCE(data->'slides', '[]'::jsonb)) as "slideCount"
      FROM snapshots WHERE presentation_id = $1 ORDER BY created_at DESC`,
      [presentationId]
    )
    return rows.map(r => ({ ...r, slideCount: parseInt(r.slideCount) || 0 }))
  }

  async restoreSnapshot(presentationId, snapshotId, userId) {
    const { rows } = await this.query('SELECT data FROM snapshots WHERE id = $1 AND presentation_id = $2', [snapshotId, presentationId])
    if (!rows.length) return null
    const snapData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
    return this.updatePresentation(presentationId, snapData, userId)
  }

  async deleteSnapshot(presentationId, snapshotId, userId) {
    await this.query('DELETE FROM snapshots WHERE id = $1 AND presentation_id = $2', [snapshotId, presentationId])
    return true
  }

  // --- GitHub config ---

  async getGithubConfig(userId) {
    if (!userId) return { token: '', owner: '', repo: '', pagesUrl: '' }
    const { rows } = await this.query('SELECT token, owner, repo, pages_url as "pagesUrl" FROM github_configs WHERE user_id = $1', [userId])
    return rows.length ? rows[0] : { token: '', owner: '', repo: '', pagesUrl: '' }
  }

  async setGithubConfig(config, userId) {
    if (!userId) return config
    const existing = await this.getGithubConfig(userId)
    const updated = {
      token: config.token !== undefined ? config.token : existing.token,
      owner: config.owner !== undefined ? config.owner : existing.owner,
      repo: config.repo !== undefined ? config.repo : existing.repo,
      pagesUrl: config.pagesUrl !== undefined ? config.pagesUrl : (existing.pagesUrl || ''),
    }
    await this.query(
      `INSERT INTO github_configs (user_id, token, owner, repo, pages_url) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, owner = $3, repo = $4, pages_url = $5`,
      [userId, updated.token, updated.owner, updated.repo, updated.pagesUrl]
    )
    return updated
  }
}

module.exports = PgStorage
