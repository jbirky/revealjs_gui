// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

class StorageInterface {
  async listPresentations(userId) { throw new Error('Not implemented') }
  async getPresentation(id, userId) { throw new Error('Not implemented') }
  async createPresentation(data, userId) { throw new Error('Not implemented') }
  async updatePresentation(id, data, userId) { throw new Error('Not implemented') }
  async deletePresentation(id, userId) { throw new Error('Not implemented') }
  async duplicatePresentation(id, userId) { throw new Error('Not implemented') }

  async listTemplates(userId) { throw new Error('Not implemented') }
  async getTemplate(id, userId) { throw new Error('Not implemented') }
  async createTemplate(data, userId) { throw new Error('Not implemented') }
  async updateTemplate(id, data, userId) { throw new Error('Not implemented') }
  async deleteTemplate(id, userId) { throw new Error('Not implemented') }
  async saveAsTemplate(presentationId, title, userId) { throw new Error('Not implemented') }

  async createShareToken(presentationId, userId) { throw new Error('Not implemented') }
  async deleteShareToken(presentationId, userId) { throw new Error('Not implemented') }
  async getShareStatus(presentationId, userId) { throw new Error('Not implemented') }
  async getSharedPresentation(token) { throw new Error('Not implemented') }

  async createSnapshot(presentationId, name, userId) { throw new Error('Not implemented') }
  async listSnapshots(presentationId, userId) { throw new Error('Not implemented') }
  async restoreSnapshot(presentationId, snapshotId, userId) { throw new Error('Not implemented') }
  async deleteSnapshot(presentationId, snapshotId, userId) { throw new Error('Not implemented') }
  async getSnapshotData(presentationId, snapshotId, userId) { throw new Error('Not implemented') }

  async getGithubConfig(userId) { throw new Error('Not implemented') }
  async setGithubConfig(config, userId) { throw new Error('Not implemented') }
  async getZoteroConfig(userId) { throw new Error('Not implemented') }
  async setZoteroConfig(config, userId) { throw new Error('Not implemented') }

  async getZenodoConfig(userId) { throw new Error('Not implemented') }
  async setZenodoConfig(config, userId) { throw new Error('Not implemented') }

  async listPlugins() { throw new Error('Not implemented') }
  async getPlugin(slug) { throw new Error('Not implemented') }
  async installPlugin(pluginId, userId) { throw new Error('Not implemented') }
  async uninstallPlugin(pluginId, userId) { throw new Error('Not implemented') }
  async getInstalledPlugins(userId) { throw new Error('Not implemented') }
  async getPresentationPlugins(presentationId) { throw new Error('Not implemented') }
  async enablePluginForPresentation(presentationId, pluginId, config) { throw new Error('Not implemented') }
  async disablePluginForPresentation(presentationId, pluginId) { throw new Error('Not implemented') }
  async getPluginStorage(userId, pluginId, key) { throw new Error('Not implemented') }
  async setPluginStorage(userId, pluginId, key, value) { throw new Error('Not implemented') }
  async deletePluginStorage(userId, pluginId, key) { throw new Error('Not implemented') }
}

module.exports = StorageInterface
