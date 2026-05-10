// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const { v4: uuidv4 } = require('uuid')
const StorageInterface = require('./interface')

class FileStorage extends StorageInterface {
  constructor(dataDir) {
    super()
    this.dataDir = dataDir
    this.dataFile = path.join(dataDir, 'presentations.json')
    this.templatesFile = path.join(dataDir, 'templates.json')
    this.shareFile = path.join(dataDir, 'share-tokens.json')
    this.githubConfigFile = path.join(dataDir, 'github-config.json')
    this.historyDir = path.join(dataDir, 'history')

    fs.ensureDirSync(dataDir)
    fs.ensureDirSync(this.historyDir)
    if (!fs.existsSync(this.dataFile)) fs.writeJsonSync(this.dataFile, [])
    if (!fs.existsSync(this.templatesFile)) fs.writeJsonSync(this.templatesFile, [])
    if (!fs.existsSync(this.shareFile)) fs.writeJsonSync(this.shareFile, {})
    if (!fs.existsSync(this.githubConfigFile)) fs.writeJsonSync(this.githubConfigFile, { token: '', owner: '', repo: '' })
  }

  // --- internal helpers ---
  async _readPresentations() { return fs.readJson(this.dataFile) }
  async _writePresentations(data) { return fs.writeJson(this.dataFile, data, { spaces: 2 }) }
  async _readTemplates() { return fs.readJson(this.templatesFile) }
  async _writeTemplates(data) { return fs.writeJson(this.templatesFile, data, { spaces: 2 }) }
  async _readShareTokens() { return fs.readJson(this.shareFile) }
  async _writeShareTokens(data) { return fs.writeJson(this.shareFile, data, { spaces: 2 }) }

  // --- Presentations ---

  async listPresentations(_userId) {
    const presentations = await this._readPresentations()
    return presentations.map(p => ({
      id: p.id,
      title: p.title,
      theme: p.theme,
      transition: p.transition,
      slideCount: (p.slides || []).length,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      thumbnail: (p.slides && p.slides[0]) ? p.slides[0].background : null
    }))
  }

  async getPresentation(id, _userId) {
    const presentations = await this._readPresentations()
    return presentations.find(p => p.id === id) || null
  }

  async createPresentation(data, _userId) {
    const now = new Date().toISOString()
    const presentation = {
      ...data,
      id: data.id || uuidv4(),
      createdAt: now,
      updatedAt: now
    }
    const presentations = await this._readPresentations()
    presentations.push(presentation)
    await this._writePresentations(presentations)
    return presentation
  }

  async updatePresentation(id, data, _userId) {
    const presentations = await this._readPresentations()
    const index = presentations.findIndex(p => p.id === id)
    if (index === -1) return null
    presentations[index] = {
      ...presentations[index],
      ...data,
      id,
      updatedAt: new Date().toISOString()
    }
    await this._writePresentations(presentations)
    return presentations[index]
  }

  async deletePresentation(id, _userId) {
    const presentations = await this._readPresentations()
    const index = presentations.findIndex(p => p.id === id)
    if (index === -1) return false
    presentations.splice(index, 1)
    await this._writePresentations(presentations)
    return true
  }

  async duplicatePresentation(id, _userId) {
    const presentations = await this._readPresentations()
    const original = presentations.find(p => p.id === id)
    if (!original) return null
    const now = new Date().toISOString()
    const copy = JSON.parse(JSON.stringify(original))
    copy.id = uuidv4()
    copy.title = (copy.title || 'Untitled') + ' (copy)'
    copy.createdAt = now
    copy.updatedAt = now
    presentations.push(copy)
    await this._writePresentations(presentations)
    return copy
  }

  // --- Templates ---

  async listTemplates(_userId) {
    const templates = await this._readTemplates()
    return templates.map(t => ({
      id: t.id,
      title: t.title,
      theme: t.theme,
      transition: t.transition,
      slideCount: (t.slides || []).length,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
      thumbnail: (t.slides && t.slides[0]) ? t.slides[0].background : null
    }))
  }

  async getTemplate(id, _userId) {
    const templates = await this._readTemplates()
    return templates.find(t => t.id === id) || null
  }

  async createTemplate(data, _userId) {
    const now = new Date().toISOString()
    const template = {
      ...data,
      id: uuidv4(),
      isTemplate: true,
      createdAt: now,
      updatedAt: now
    }
    const templates = await this._readTemplates()
    templates.push(template)
    await this._writeTemplates(templates)
    return template
  }

  async updateTemplate(id, data, _userId) {
    const templates = await this._readTemplates()
    const index = templates.findIndex(t => t.id === id)
    if (index === -1) return null
    templates[index] = { ...templates[index], ...data, id, updatedAt: new Date().toISOString() }
    await this._writeTemplates(templates)
    return templates[index]
  }

  async deleteTemplate(id, _userId) {
    const templates = await this._readTemplates()
    const index = templates.findIndex(t => t.id === id)
    if (index === -1) return false
    templates.splice(index, 1)
    await this._writeTemplates(templates)
    return true
  }

  async saveAsTemplate(presentationId, title, _userId) {
    const presentations = await this._readPresentations()
    const pres = presentations.find(p => p.id === presentationId)
    if (!pres) return null
    const now = new Date().toISOString()
    const template = {
      ...JSON.parse(JSON.stringify(pres)),
      id: uuidv4(),
      title: (title || pres.title || 'Untitled') + ' (template)',
      isTemplate: true,
      createdAt: now,
      updatedAt: now
    }
    const templates = await this._readTemplates()
    templates.push(template)
    await this._writeTemplates(templates)
    return template
  }

  // --- Sharing ---

  async createShareToken(presentationId, _userId) {
    const presentations = await this._readPresentations()
    if (!presentations.find(p => p.id === presentationId)) return null
    const tokens = await this._readShareTokens()
    let token = Object.entries(tokens).find(([_t, id]) => id === presentationId)?.[0]
    if (!token) {
      token = uuidv4()
      tokens[token] = presentationId
      await this._writeShareTokens(tokens)
    }
    return { token, shared: true }
  }

  async deleteShareToken(presentationId, _userId) {
    const tokens = await this._readShareTokens()
    for (const [token, id] of Object.entries(tokens)) {
      if (id === presentationId) delete tokens[token]
    }
    await this._writeShareTokens(tokens)
    return { shared: false }
  }

  async getShareStatus(presentationId, _userId) {
    const tokens = await this._readShareTokens()
    const entry = Object.entries(tokens).find(([_t, id]) => id === presentationId)
    return { shared: !!entry, token: entry ? entry[0] : null }
  }

  async getSharedPresentation(token) {
    const tokens = await this._readShareTokens()
    const presentationId = tokens[token]
    if (!presentationId) return null
    const presentations = await this._readPresentations()
    return presentations.find(p => p.id === presentationId) || null
  }

  // --- Snapshots ---

  async createSnapshot(presentationId, name, _userId) {
    const presentations = await this._readPresentations()
    const pres = presentations.find(p => p.id === presentationId)
    if (!pres) return null
    const presDir = path.join(this.historyDir, presentationId)
    fs.ensureDirSync(presDir)
    const snapshotId = uuidv4()
    const snapshot = {
      id: snapshotId,
      name: name || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(pres))
    }
    fs.writeJsonSync(path.join(presDir, `${snapshotId}.json`), snapshot, { spaces: 2 })
    return { id: snapshotId, name: snapshot.name, createdAt: snapshot.createdAt }
  }

  async listSnapshots(presentationId, _userId) {
    const presDir = path.join(this.historyDir, presentationId)
    if (!fs.existsSync(presDir)) return []
    const files = fs.readdirSync(presDir).filter(f => f.endsWith('.json')).sort()
    return files.map(f => {
      const s = fs.readJsonSync(path.join(presDir, f))
      return { id: s.id, name: s.name, createdAt: s.createdAt, slideCount: (s.data?.slides || []).length }
    }).reverse()
  }

  async restoreSnapshot(presentationId, snapshotId, _userId) {
    const presDir = path.join(this.historyDir, presentationId)
    const snapFile = path.join(presDir, `${snapshotId}.json`)
    if (!fs.existsSync(snapFile)) return null
    const snapshot = fs.readJsonSync(snapFile)
    const presentations = await this._readPresentations()
    const index = presentations.findIndex(p => p.id === presentationId)
    if (index === -1) return null
    presentations[index] = { ...snapshot.data, id: presentationId, updatedAt: new Date().toISOString() }
    await this._writePresentations(presentations)
    return presentations[index]
  }

  async deleteSnapshot(presentationId, snapshotId, _userId) {
    const snapFile = path.join(this.historyDir, presentationId, `${snapshotId}.json`)
    if (fs.existsSync(snapFile)) fs.removeSync(snapFile)
    return true
  }

  // --- GitHub config ---

  async getGithubConfig(_userId) {
    return fs.readJson(this.githubConfigFile)
  }

  async setGithubConfig(config, _userId) {
    const existing = await this.getGithubConfig()
    const updated = { ...existing, ...config }
    await fs.writeJson(this.githubConfigFile, updated, { spaces: 2 })
    return updated
  }
}

module.exports = FileStorage
