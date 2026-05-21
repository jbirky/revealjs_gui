// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { api } from '../utils/api'

class DatasetManager {
  constructor() {
    this._cache = new Map()
    this._meta = new Map()
    this._listeners = new Map()
  }

  async loadForPresentation(presentationId) {
    const datasets = await api.getPresentationDatasets(presentationId)
    for (const ds of datasets) {
      const key = ds.alias || ds.name
      this._meta.set(key, ds)
    }
    return datasets
  }

  async load(name) {
    if (this._cache.has(name)) return
    const meta = this._meta.get(name)
    if (!meta) throw new Error(`Dataset "${name}" not found. Did you link it to the presentation?`)
    const data = await api.getDatasetData(meta.id)
    const columnIndex = {}
    const colNames = Object.keys(data.columns)
    colNames.forEach((c, i) => { columnIndex[c] = i })
    this._cache.set(name, { ...data, columnIndex, colNames })
  }

  async query(name, opts = {}) {
    const meta = this._meta.get(name)
    if (!meta) throw new Error(`Dataset "${name}" not found`)

    if (this._cache.has(name) && !opts._forceServer) {
      return this._queryLocal(name, opts)
    }

    const params = {}
    if (opts.columns) params.columns = opts.columns.join(',')
    if (opts.limit) params.limit = opts.limit
    if (opts.offset) params.offset = opts.offset
    if (opts.orderBy) params.orderBy = typeof opts.orderBy === 'string' ? opts.orderBy : opts.orderBy.column
    if (opts.where) params.where = JSON.stringify(opts.where)
    return api.getDatasetData(meta.id, params)
  }

  _queryLocal(name, opts) {
    const cached = this._cache.get(name)
    const selectedCols = opts.columns || cached.colNames
    const total = cached.totalRows
    const result = {}
    for (const col of selectedCols) {
      const arr = cached.columns[col]
      if (!arr) continue
      let values = [...arr]

      if (opts.offset) values = values.slice(opts.offset)
      if (opts.limit) values = values.slice(0, opts.limit)
      result[col] = values
    }
    return { columns: result, totalRows: total }
  }

  schema(name) {
    const meta = this._meta.get(name)
    return meta?.columns || null
  }

  list() {
    return Array.from(this._meta.values()).map(({ id, name, columns, rowCount, alias }) => ({
      id, name: alias || name, columns, rowCount,
    }))
  }

  onChange(name, callback) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set())
    this._listeners.get(name).add(callback)
    return () => this._listeners.get(name)?.delete(callback)
  }

  _notify(name) {
    const cbs = this._listeners.get(name)
    if (cbs) cbs.forEach(cb => cb())
  }

  invalidate(name) {
    this._cache.delete(name)
    this._notify(name)
  }

  clear() {
    this._cache.clear()
    this._meta.clear()
    this._listeners.clear()
  }
}

const datasetManager = new DatasetManager()
export default datasetManager
