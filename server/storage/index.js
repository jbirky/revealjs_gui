// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const FileStorage = require('./file-storage')

function createStorage() {
  const backend = process.env.PARALLAX_DB || 'file'

  if (backend === 'postgres') {
    const PgStorage = require('./pg-storage')
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('PARALLAX_DB=postgres but DATABASE_URL is not set')
    return new PgStorage(url)
  }

  const dataDir = process.env.SLIDES_DATA_DIR || path.join(__dirname, '..', 'data')
  return new FileStorage(dataDir)
}

module.exports = createStorage
