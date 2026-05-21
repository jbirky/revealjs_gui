// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs-extra')
const { parse: csvParse } = require('csv-parse/sync')
const { v4: uuidv4 } = require('uuid')
const { uploadToR2, streamFromR2, deleteFromR2 } = require('./r2')
const { isR2Enabled } = require('./r2')

const ALLOWED_FORMATS = new Set(['csv', 'json', 'tsv'])

function detectFormat(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  if (ext === 'csv') return 'csv'
  if (ext === 'tsv' || ext === 'tab') return 'tsv'
  if (ext === 'json') return 'json'
  return null
}

function parseFile(filePath, format) {
  const raw = fs.readFileSync(filePath, 'utf8')
  if (format === 'csv' || format === 'tsv') {
    const delimiter = format === 'tsv' ? '\t' : ','
    return csvParse(raw, { columns: true, skip_empty_lines: true, delimiter, cast: true, relax_column_count: true })
  }
  if (format === 'json') {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data
    throw new Error('JSON must be an array of objects or have a "data" array property')
  }
  throw new Error(`Unsupported format: ${format}`)
}

function inferType(values) {
  const sample = values.slice(0, 100)
  if (sample.length === 0) return 'string'
  if (sample.every(v => typeof v === 'boolean' || v === 'true' || v === 'false')) return 'boolean'
  if (sample.every(v => typeof v === 'number' && Number.isInteger(v))) return 'integer'
  if (sample.every(v => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))) return 'float'
  if (sample.every(v => typeof v === 'string' && v.length > 6 && !isNaN(Date.parse(v)))) return 'date'
  return 'string'
}

function inferColumns(rows) {
  if (!rows.length) return []
  const colNames = Object.keys(rows[0])
  return colNames.map(name => {
    const values = rows.map(r => r[name]).filter(v => v != null && v !== '')
    return {
      name,
      type: inferType(values),
      nullable: values.length < rows.length,
      sample: values.slice(0, 3),
    }
  })
}

async function ingestDataset(filePath, originalFilename, { userId, storage, localDir }) {
  const format = detectFormat(originalFilename)
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new Error(`Unsupported file format. Accepted: ${[...ALLOWED_FORMATS].join(', ')}`)
  }

  const rows = parseFile(filePath, format)
  const columns = inferColumns(rows)
  const stat = fs.statSync(filePath)
  const baseName = path.basename(originalFilename, path.extname(originalFilename))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()

  let storageKey
  if (isR2Enabled()) {
    storageKey = `${userId}/datasets/${baseName}/${uuidv4()}${path.extname(originalFilename)}`
    await uploadToR2(filePath, storageKey, 'application/octet-stream')
  } else {
    const dsDir = path.join(localDir, 'datasets')
    fs.ensureDirSync(dsDir)
    const localName = `${uuidv4()}${path.extname(originalFilename)}`
    storageKey = `local:${localName}`
    fs.copySync(filePath, path.join(dsDir, localName))
  }

  fs.removeSync(filePath)

  return {
    name: baseName,
    filename: originalFilename,
    format,
    storageKey,
    columns,
    rowCount: rows.length,
    byteSize: stat.size,
  }
}

async function readDatasetFile(storageKey, format, localDir) {
  let raw
  if (storageKey.startsWith('local:')) {
    const localName = storageKey.replace('local:', '')
    raw = fs.readFileSync(path.join(localDir, 'datasets', localName), 'utf8')
  } else {
    const { body } = await streamFromR2(storageKey)
    const chunks = []
    for await (const chunk of body) chunks.push(chunk)
    raw = Buffer.concat(chunks).toString('utf8')
  }

  if (format === 'csv' || format === 'tsv') {
    const delimiter = format === 'tsv' ? '\t' : ','
    return csvParse(raw, { columns: true, skip_empty_lines: true, delimiter, cast: true, relax_column_count: true })
  }
  if (format === 'json') {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : parsed.data
  }
  throw new Error(`Unsupported format: ${format}`)
}

function applyQuery(rows, columns, opts = {}) {
  let filtered = rows

  if (opts.where) {
    filtered = filtered.filter(row => {
      for (const [col, conditions] of Object.entries(opts.where)) {
        const val = row[col]
        if (conditions.eq != null && val !== conditions.eq) return false
        if (conditions.neq != null && val === conditions.neq) return false
        if (conditions.gt != null && !(val > conditions.gt)) return false
        if (conditions.gte != null && !(val >= conditions.gte)) return false
        if (conditions.lt != null && !(val < conditions.lt)) return false
        if (conditions.lte != null && !(val <= conditions.lte)) return false
        if (conditions.in && !conditions.in.includes(val)) return false
        if (conditions.like) {
          const pattern = new RegExp('^' + conditions.like.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
          if (!pattern.test(String(val))) return false
        }
      }
      return true
    })
  }

  if (opts.orderBy) {
    const col = typeof opts.orderBy === 'string' ? opts.orderBy : opts.orderBy.column
    const dir = (typeof opts.orderBy === 'object' && opts.orderBy.direction === 'desc') ? -1 : 1
    filtered = [...filtered].sort((a, b) => {
      if (a[col] < b[col]) return -dir
      if (a[col] > b[col]) return dir
      return 0
    })
  }

  const totalRows = filtered.length

  if (opts.offset) filtered = filtered.slice(opts.offset)
  if (opts.limit) filtered = filtered.slice(0, opts.limit)

  const selectedCols = opts.columns || columns.map(c => c.name)
  const result = {}
  for (const col of selectedCols) {
    result[col] = filtered.map(r => r[col] ?? null)
  }

  return { columns: result, totalRows }
}

async function deleteDatasetFile(storageKey, localDir) {
  if (storageKey.startsWith('local:')) {
    const localName = storageKey.replace('local:', '')
    fs.removeSync(path.join(localDir, 'datasets', localName))
  } else {
    await deleteFromR2(storageKey)
  }
}

module.exports = { ingestDataset, readDatasetFile, applyQuery, deleteDatasetFile, detectFormat, ALLOWED_FORMATS }
