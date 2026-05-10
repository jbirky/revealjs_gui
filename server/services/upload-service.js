// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const { v4: uuidv4 } = require('uuid')
const { uploadToR2, deleteFromR2 } = require('./r2')

async function handleUpload(filePath, originalFilename, mimetype, { presentationId, userId, storage }) {
  const ext = path.extname(originalFilename || filePath)
  const fileId = uuidv4()
  const fileName = `${fileId}${ext}`

  // URL-path portion (what the client sees after /uploads/)
  const urlFilename = presentationId ? `${presentationId}/${fileName}` : fileName
  // R2 key (scoped by user)
  const storageKey = userId
    ? `${userId}/${urlFilename}`
    : `anonymous/${urlFilename}`

  const contentType = mimetype || 'application/octet-stream'
  const { size } = await uploadToR2(filePath, storageKey, contentType)

  // Record in uploads table
  if (storage && storage.query) {
    await storage.query(
      'INSERT INTO uploads (id, presentation_id, user_id, filename, storage_key, content_type, size_bytes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [uuidv4(), presentationId || null, userId || null, urlFilename, storageKey, contentType, size]
    )
  }

  // Clean up temp file
  fs.removeSync(filePath)

  return { url: `/uploads/${urlFilename}` }
}

async function deleteUploadsForPresentation(presentationId, storage) {
  if (!storage || !storage.query) return
  const { rows } = await storage.query(
    'SELECT storage_key FROM uploads WHERE presentation_id = $1',
    [presentationId]
  )
  for (const row of rows) {
    try { await deleteFromR2(row.storage_key) } catch (e) {
      console.error('R2 delete failed:', e.message)
    }
  }
}

module.exports = { handleUpload, deleteUploadsForPresentation }
