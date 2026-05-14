// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { uploadToR2, deleteFromR2 } = require('./r2')

async function handleUpload(filePath, originalFilename, mimetype, { presentationId, userId, storage }) {
  const contentType = mimetype || 'application/octet-stream'
  const fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

  if (storage && storage.query && presentationId) {
    const { rows } = await storage.query(
      'SELECT filename FROM uploads WHERE presentation_id = $1 AND file_hash = $2 LIMIT 1',
      [presentationId, fileHash]
    )
    if (rows.length) {
      fs.removeSync(filePath)
      return { url: `/uploads/${rows[0].filename}` }
    }
  }

  const ext = path.extname(originalFilename || filePath)
  const fileName = `${uuidv4()}${ext}`
  const urlFilename = presentationId ? `${presentationId}/${fileName}` : fileName
  const storageKey = userId ? `${userId}/${urlFilename}` : `anonymous/${urlFilename}`

  const { size } = await uploadToR2(filePath, storageKey, contentType)

  if (storage && storage.query) {
    await storage.query(
      'INSERT INTO uploads (id, presentation_id, user_id, filename, storage_key, content_type, size_bytes, file_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [uuidv4(), presentationId || null, userId || null, urlFilename, storageKey, contentType, size, fileHash]
    )
  }

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
