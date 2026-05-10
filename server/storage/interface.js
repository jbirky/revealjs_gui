// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Storage interface — all backends must implement these methods.
// The "userId" parameter is ignored by file-storage (single-user)
// but will be required by pg-storage for multi-tenant isolation.

class StorageInterface {
  // --- Presentations ---
  async listPresentations(userId) { throw new Error('Not implemented') }
  async getPresentation(id, userId) { throw new Error('Not implemented') }
  async createPresentation(data, userId) { throw new Error('Not implemented') }
  async updatePresentation(id, data, userId) { throw new Error('Not implemented') }
  async deletePresentation(id, userId) { throw new Error('Not implemented') }
  async duplicatePresentation(id, userId) { throw new Error('Not implemented') }

  // --- Templates ---
  async listTemplates(userId) { throw new Error('Not implemented') }
  async getTemplate(id, userId) { throw new Error('Not implemented') }
  async createTemplate(data, userId) { throw new Error('Not implemented') }
  async updateTemplate(id, data, userId) { throw new Error('Not implemented') }
  async deleteTemplate(id, userId) { throw new Error('Not implemented') }
  async saveAsTemplate(presentationId, title, userId) { throw new Error('Not implemented') }

  // --- Sharing ---
  async createShareToken(presentationId, userId) { throw new Error('Not implemented') }
  async deleteShareToken(presentationId, userId) { throw new Error('Not implemented') }
  async getShareStatus(presentationId, userId) { throw new Error('Not implemented') }
  async getSharedPresentation(token) { throw new Error('Not implemented') }

  // --- Snapshots ---
  async createSnapshot(presentationId, name, userId) { throw new Error('Not implemented') }
  async listSnapshots(presentationId, userId) { throw new Error('Not implemented') }
  async restoreSnapshot(presentationId, snapshotId, userId) { throw new Error('Not implemented') }
  async deleteSnapshot(presentationId, snapshotId, userId) { throw new Error('Not implemented') }

  // --- GitHub config ---
  async getGithubConfig(userId) { throw new Error('Not implemented') }
  async setGithubConfig(config, userId) { throw new Error('Not implemented') }
}

module.exports = StorageInterface
