// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Link, Unlink, ChevronDown, ChevronRight, Database, Table2, X, Check, Search, ArrowUpDown } from 'lucide-react'
import { api } from '../utils/api'

const TYPE_COLORS = {
  integer: '#60a5fa',
  float: '#34d399',
  string: '#fbbf24',
  boolean: '#f472b6',
  date: '#a78bfa',
  datetime: '#a78bfa',
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SchemaTable({ columns }) {
  if (!columns || !columns.length) return null
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Column</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Sample</th>
          </tr>
        </thead>
        <tbody>
          {columns.map(col => (
            <tr key={col.name} style={{ borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
              <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{col.name}</td>
              <td style={{ padding: '4px 8px' }}>
                <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, background: `${TYPE_COLORS[col.type] || '#94a3b8'}22`, color: TYPE_COLORS[col.type] || '#94a3b8' }}>
                  {col.type}
                </span>
              </td>
              <td style={{ padding: '4px 8px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(col.sample || []).slice(0, 3).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataPreview({ datasetId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getDatasetData(datasetId, { limit: '20' })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [datasetId])

  if (loading) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading preview...</div>
  if (!data || !data.columns) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No data</div>

  const colNames = Object.keys(data.columns)
  const rowCount = data.columns[colNames[0]]?.length || 0

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {colNames.map(c => (
              <th key={c} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
              {colNames.map(c => (
                <td key={c} style={{ padding: '3px 8px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {data.columns[c][i] != null ? String(data.columns[c][i]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.totalRows > 20 && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px', textAlign: 'right' }}>
          Showing 20 of {data.totalRows.toLocaleString()} rows
        </div>
      )}
    </div>
  )
}

export default function DatasetPanel({ presentationId, onClose }) {
  const [datasets, setDatasets] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      const [all, linked] = await Promise.all([
        api.getDatasets(),
        presentationId ? api.getPresentationDatasets(presentationId) : Promise.resolve([]),
      ])
      setDatasets(Array.isArray(all) ? all : [])
      setLinkedIds(new Set((linked || []).map(d => d.id)))
    } catch {
      setDatasets([])
    }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [presentationId])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const ds = await api.uploadDataset(file)
      if (presentationId) {
        await api.linkDataset(presentationId, ds.id)
      }
      await refresh()
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleLink(datasetId) {
    if (!presentationId) return
    await api.linkDataset(presentationId, datasetId)
    setLinkedIds(prev => new Set([...prev, datasetId]))
  }

  async function handleUnlink(datasetId) {
    if (!presentationId) return
    await api.unlinkDataset(presentationId, datasetId)
    setLinkedIds(prev => { const s = new Set(prev); s.delete(datasetId); return s })
  }

  async function handleDelete(datasetId) {
    await api.deleteDataset(datasetId)
    setDeleteConfirm(null)
    if (expandedId === datasetId) setExpandedId(null)
    if (previewId === datasetId) setPreviewId(null)
    await refresh()
  }

  async function handleRename(datasetId) {
    if (!renameValue.trim()) return
    await api.renameDataset(datasetId, renameValue.trim())
    setRenaming(null)
    await refresh()
  }

  const filtered = datasets.filter(d =>
    !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-primary, #0f0f1a)', border: '1px solid var(--border)', borderRadius: 12, width: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Datasets</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 8px', borderRadius: 10 }}>
              {datasets.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 8px 5px 28px', borderRadius: 6, fontSize: 12, width: 180 }}
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500, opacity: uploading ? 0.6 : 1 }}
            >
              <Upload size={13} />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.json,.tab" onChange={handleUpload} style={{ display: 'none' }} />
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div style={{ margin: '8px 20px 0', padding: '8px 12px', borderRadius: 6, fontSize: 12, background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <X size={14} />
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>&times;</button>
          </div>
        )}

        {/* Dataset list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Database size={32} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12 }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {searchQuery ? 'No datasets match your search' : 'No datasets yet'}
              </div>
              {!searchQuery && (
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                  Upload a CSV, TSV, or JSON file to get started
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(ds => {
                const isExpanded = expandedId === ds.id
                const isLinked = linkedIds.has(ds.id)
                const isPreviewing = previewId === ds.id

                return (
                  <div key={ds.id} style={{ background: 'var(--bg-hover)', borderRadius: 8, border: `1px solid ${isLinked ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                    {/* Row header */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : ds.id)}
                    >
                      {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                      <Table2 size={14} style={{ color: isLinked ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renaming === ds.id ? (
                          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(ds.id); if (e.key === 'Escape') setRenaming(null) }}
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 4, fontSize: 12, flex: 1 }}
                            />
                            <button onClick={() => handleRename(ds.id)} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer' }}><Check size={14} /></button>
                            <button onClick={() => setRenaming(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                          </div>
                        ) : (
                          <div
                            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            onDoubleClick={e => { e.stopPropagation(); setRenaming(ds.id); setRenameValue(ds.name) }}
                            title="Double-click to rename"
                          >
                            {ds.name}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {ds.filename} &middot; {ds.rowCount?.toLocaleString()} rows &middot; {ds.columns?.length} cols &middot; {formatBytes(ds.byteSize)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {presentationId && (
                          <button
                            onClick={() => isLinked ? handleUnlink(ds.id) : handleLink(ds.id)}
                            title={isLinked ? 'Unlink from presentation' : 'Link to presentation'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: isLinked ? 'var(--accent)' : 'none', color: isLinked ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontWeight: 500 }}
                          >
                            {isLinked ? <><Unlink size={11} /> Linked</> : <><Link size={11} /> Link</>}
                          </button>
                        )}
                        {deleteConfirm === ds.id ? (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => handleDelete(ds.id)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: 'rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 500 }}>Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(ds.id)}
                            title="Delete dataset"
                            style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded: schema + preview */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                          <button
                            onClick={() => setPreviewId(isPreviewing ? null : ds.id)}
                            style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', background: isPreviewing ? 'var(--accent)' : 'var(--bg-card)', color: isPreviewing ? '#fff' : 'var(--text-secondary)' }}
                          >
                            <ArrowUpDown size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            Data Preview
                          </button>
                        </div>

                        {/* Schema */}
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Schema</div>
                        <SchemaTable columns={ds.columns} />

                        {/* Data preview */}
                        {isPreviewing && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Data Preview</div>
                            <DataPreview datasetId={ds.id} />
                          </div>
                        )}

                        {/* Usage hint */}
                        {isLinked && (
                          <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ctx.datasets.query("{ds.name}")
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Linked datasets are available to plugins via ctx.datasets.query()</span>
          <span>Accepts CSV, TSV, JSON</span>
        </div>
      </div>
    </div>
  )
}
