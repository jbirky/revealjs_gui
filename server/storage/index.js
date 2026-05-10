// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const FileStorage = require('./file-storage')

function createStorage() {
  const backend = process.env.PARALLAX_DB || 'file'

  if (backend === 'file') {
    const dataDir = process.env.SLIDES_DATA_DIR || path.join(__dirname, '..', 'data')
    return new FileStorage(dataDir)
  }

  // Future: postgres backend
  // if (backend === 'postgres') {
  //   const PgStorage = require('./pg-storage')
  //   return new PgStorage(process.env.DATABASE_URL)
  // }

  throw new Error(`Unknown storage backend: ${backend}`)
}

module.exports = createStorage
