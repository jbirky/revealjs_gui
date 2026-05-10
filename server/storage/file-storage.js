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

  async _readAll() { return fs.readJson(this.dataFile) }
  async _writeAll(data) { return fs.writeJson(this.dataFile, data, { spaces: 2 }) }
  async _readTemplates() { return fs.readJson(this.templatesFile) }
  async _writeTemplates(data) { return fs.writeJson(this.templatesFile, data, { spaces: 2 }) }
  async _readTokens() { return fs.readJson(this.shareFile) }
  async _writeTokens(data) { return fs.writeJson(this.shareFile, data, { spaces: 2 }) }

  _summary(p) {
    return { id: p.id, title: p.title, theme: p.theme, transition: p.transition, slideCount: (p.slides || []).length, updatedAt: p.updatedAt, createdAt: p.createdAt, thumbnail: (p.slides && p.slides[0]) ? p.slides[0].background : null }
  }

  async listPresentations() {
    return (await this._readAll()).map(p => this._summary(p))
  }
  async getPresentation(id) {
    return (await this._readAll()).find(p => p.id === id) || null
  }
  async createPresentation(data) {
    const now = new Date().toISOString()
    const pres = { ...data, id: data.id || uuidv4(), createdAt: now, updatedAt: now }
    const all = await this._readAll()
    all.push(pres)
    await this._writeAll(all)
    return pres
  }
  async updatePresentation(id, data) {
    const all = await this._readAll()
    const i = all.findIndex(p => p.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...data, id, updatedAt: new Date().toISOString() }
    await this._writeAll(all)
    return all[i]
  }
  async deletePresentation(id) {
    const all = await this._readAll()
    const i = all.findIndex(p => p.id === id)
    if (i === -1) return false
    all.splice(i, 1)
    await this._writeAll(all)
    return true
  }
  async duplicatePresentation(id) {
    const all = await this._readAll()
    const orig = all.find(p => p.id === id)
    if (!orig) return null
    const now = new Date().toISOString()
    const copy = { ...JSON.parse(JSON.stringify(orig)), id: uuidv4(), title: (orig.title || 'Untitled') + ' (copy)', createdAt: now, updatedAt: now }
    all.push(copy)
    await this._writeAll(all)
    return copy
  }

  async listTemplates() {
    return (await this._readTemplates()).map(t => this._summary(t))
  }
  async getTemplate(id) {
    return (await this._readTemplates()).find(t => t.id === id) || null
  }
  async createTemplate(data) {
    const now = new Date().toISOString()
    const tmpl = { ...data, id: uuidv4(), isTemplate: true, createdAt: now, updatedAt: now }
    const all = await this._readTemplates()
    all.push(tmpl)
    await this._writeTemplates(all)
    return tmpl
  }
  async updateTemplate(id, data) {
    const all = await this._readTemplates()
    const i = all.findIndex(t => t.id === id)
    if (i === -1) return null
    all[i] = { ...all[i], ...data, id, updatedAt: new Date().toISOString() }
    await this._writeTemplates(all)
    return all[i]
  }
  async deleteTemplate(id) {
    const all = await this._readTemplates()
    const i = all.findIndex(t => t.id === id)
    if (i === -1) return false
    all.splice(i, 1)
    await this._writeTemplates(all)
    return true
  }
  async saveAsTemplate(presentationId, title) {
    const pres = await this.getPresentation(presentationId)
    if (!pres) return null
    const now = new Date().toISOString()
    const tmpl = { ...JSON.parse(JSON.stringify(pres)), id: uuidv4(), title: (title || pres.title || 'Untitled') + ' (template)', isTemplate: true, createdAt: now, updatedAt: now }
    const all = await this._readTemplates()
    all.push(tmpl)
    await this._writeTemplates(all)
    return tmpl
  }

  async createShareToken(presentationId) {
    if (!(await this.getPresentation(presentationId))) return null
    const tokens = await this._readTokens()
    let token = Object.entries(tokens).find(([, id]) => id === presentationId)?.[0]
    if (!token) { token = uuidv4(); tokens[token] = presentationId; await this._writeTokens(tokens) }
    return { token, shared: true }
  }
  async deleteShareToken(presentationId) {
    const tokens = await this._readTokens()
    for (const [t, id] of Object.entries(tokens)) { if (id === presentationId) delete tokens[t] }
    await this._writeTokens(tokens)
    return { shared: false }
  }
  async getShareStatus(presentationId) {
    const tokens = await this._readTokens()
    const entry = Object.entries(tokens).find(([, id]) => id === presentationId)
    return { shared: !!entry, token: entry ? entry[0] : null }
  }
  async getSharedPresentation(token) {
    const tokens = await this._readTokens()
    const pid = tokens[token]
    if (!pid) return null
    return this.getPresentation(pid)
  }

  async createSnapshot(presentationId, name) {
    const pres = await this.getPresentation(presentationId)
    if (!pres) return null
    const dir = path.join(this.historyDir, presentationId)
    fs.ensureDirSync(dir)
    const id = uuidv4()
    const snap = { id, name: name || new Date().toISOString(), createdAt: new Date().toISOString(), data: JSON.parse(JSON.stringify(pres)) }
    fs.writeJsonSync(path.join(dir, `${id}.json`), snap, { spaces: 2 })
    return { id, name: snap.name, createdAt: snap.createdAt }
  }
  async listSnapshots(presentationId) {
    const dir = path.join(this.historyDir, presentationId)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
      const s = fs.readJsonSync(path.join(dir, f))
      return { id: s.id, name: s.name, createdAt: s.createdAt, slideCount: (s.data?.slides || []).length }
    }).reverse()
  }
  async restoreSnapshot(presentationId, snapshotId) {
    const file = path.join(this.historyDir, presentationId, `${snapshotId}.json`)
    if (!fs.existsSync(file)) return null
    const snap = fs.readJsonSync(file)
    return this.updatePresentation(presentationId, snap.data)
  }
  async deleteSnapshot(presentationId, snapshotId) {
    const file = path.join(this.historyDir, presentationId, `${snapshotId}.json`)
    if (fs.existsSync(file)) fs.removeSync(file)
    return true
  }

  async getGithubConfig() { return fs.readJson(this.githubConfigFile) }
  async setGithubConfig(config) {
    const existing = await this.getGithubConfig()
    const updated = { ...existing, ...config }
    await fs.writeJson(this.githubConfigFile, updated, { spaces: 2 })
    return updated
  }
}

module.exports = FileStorage
