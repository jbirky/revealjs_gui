// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useRef } from 'react'
import { parseBibtex, parseAuthors, formatAuthorsShort, formatCitation } from '../utils/bibtexParser'

export default function BibliographyModal({ bibliography = [], citationStyle = 'numbered', onUpdate, onInsertCitation, onClose }) {
  const [tab, setTab] = useState('library') // library | import | zotero
  const [bibtexInput, setBibtexInput] = useState('')
  const [importError, setImportError] = useState(null)
  const fileRef = useRef(null)

  // Zotero state
  const [zoteroUserId, setZoteroUserId] = useState('')
  const [zoteroApiKey, setZoteroApiKey] = useState('')
  const [zoteroConnected, setZoteroConnected] = useState(false)
  const [zoteroItems, setZoteroItems] = useState([])
  const [zoteroSearch, setZoteroSearch] = useState('')
  const [zoteroLoading, setZoteroLoading] = useState(false)
  const [zoteroError, setZoteroError] = useState(null)
  const [zoteroTotal, setZoteroTotal] = useState(0)
  const [zoteroOffset, setZoteroOffset] = useState(0)
  const [zoteroCollections, setZoteroCollections] = useState([])
  const [zoteroCollection, setZoteroCollection] = useState('')

  function handleImportBibtex() {
    try {
      const entries = parseBibtex(bibtexInput)
      if (entries.length === 0) {
        setImportError('No valid BibTeX entries found')
        return
      }
      const existing = new Set(bibliography.map(e => e.key))
      const newEntries = entries.filter(e => !existing.has(e.key))
      if (newEntries.length === 0) {
        setImportError('All entries already exist in bibliography')
        return
      }
      onUpdate({ bibliography: [...bibliography, ...newEntries] })
      setBibtexInput('')
      setImportError(null)
      setTab('library')
    } catch (e) {
      setImportError('Failed to parse BibTeX: ' + e.message)
    }
  }

  function handleFileUpload(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setBibtexInput(e.target.result)
    }
    reader.readAsText(file)
  }

  function removeEntry(key) {
    onUpdate({ bibliography: bibliography.filter(e => e.key !== key) })
  }

  function moveEntry(idx, dir) {
    const arr = [...bibliography]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    onUpdate({ bibliography: arr })
  }

  // ── Zotero ──────────────────────────────────────────────

  async function zoteroFetch(endpoint, params = {}) {
    const { itemType, ...rest } = params
    let qs = new URLSearchParams(rest).toString()
    if (itemType) qs += (qs ? '&' : '') + 'itemType=' + encodeURIComponent(itemType).replace(/%7C%7C/gi, '||')
    const url = `https://api.zotero.org/users/${zoteroUserId}${endpoint}${qs ? '?' + qs : ''}`
    const res = await fetch(url, {
      headers: {
        'Zotero-API-Version': '3',
        'Zotero-API-Key': zoteroApiKey,
      }
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (res.status === 403) throw new Error('Invalid API key or insufficient permissions')
      if (res.status === 404) throw new Error('User ID not found')
      throw new Error(`Zotero API error ${res.status}: ${body || res.statusText}`)
    }
    const total = parseInt(res.headers.get('Total-Results') || '0', 10)
    const data = await res.json()
    return { data, total }
  }

  async function connectZotero() {
    if (!zoteroUserId || !zoteroApiKey) {
      setZoteroError('Enter your Zotero User ID and API Key')
      return
    }
    setZoteroLoading(true)
    setZoteroError(null)
    try {
      const { data: collections } = await zoteroFetch('/collections', { limit: 100 })
      setZoteroCollections(collections.map(c => ({ key: c.key, name: c.data.name })))
      setZoteroConnected(true)
      await searchZotero('', '', 0)
    } catch (e) {
      setZoteroError('Failed to connect: ' + e.message)
    } finally {
      setZoteroLoading(false)
    }
  }

  async function searchZotero(query, collectionKey, offset) {
    setZoteroLoading(true)
    setZoteroError(null)
    try {
      const params = { limit: 25, start: offset, sort: 'dateAdded', direction: 'desc' }
      if (query) { params.q = query; params.qmode = 'titleCreatorYear' }
      const endpoint = collectionKey
        ? `/collections/${collectionKey}/items/top`
        : '/items/top'
      const { data, total } = await zoteroFetch(endpoint, params)
      setZoteroItems(data)
      setZoteroTotal(total)
      setZoteroOffset(offset)
    } catch (e) {
      setZoteroError('Search failed: ' + e.message)
    } finally {
      setZoteroLoading(false)
    }
  }

  function importZoteroItem(item) {
    const d = item.data
    const authors = (d.creators || [])
      .filter(c => c.creatorType === 'author')
      .map(c => c.lastName ? `${c.lastName}, ${c.firstName || ''}` : c.name || '')
      .join(' and ')
    const entry = {
      type: mapZoteroType(d.itemType),
      key: d.citationKey || item.key,
      title: d.title || '',
      author: authors,
      year: d.date ? d.date.match(/\d{4}/)?.[0] || '' : '',
      journal: d.publicationTitle || '',
      volume: d.volume || '',
      pages: d.pages || '',
      doi: d.DOI || '',
      url: d.url || '',
      booktitle: d.proceedingsTitle || d.bookTitle || '',
    }
    const existing = new Set(bibliography.map(e => e.key))
    if (existing.has(entry.key)) return
    onUpdate({ bibliography: [...bibliography, entry] })
  }

  function importAllZoteroItems() {
    const existing = new Set(bibliography.map(e => e.key))
    const newEntries = zoteroItems
      .map(item => {
        const d = item.data
        const authors = (d.creators || [])
          .filter(c => c.creatorType === 'author')
          .map(c => c.lastName ? `${c.lastName}, ${c.firstName || ''}` : c.name || '')
          .join(' and ')
        return {
          type: mapZoteroType(d.itemType),
          key: d.citationKey || item.key,
          title: d.title || '',
          author: authors,
          year: d.date ? d.date.match(/\d{4}/)?.[0] || '' : '',
          journal: d.publicationTitle || '',
          volume: d.volume || '',
          pages: d.pages || '',
          doi: d.DOI || '',
          url: d.url || '',
          booktitle: d.proceedingsTitle || d.bookTitle || '',
        }
      })
      .filter(e => !existing.has(e.key))
    if (newEntries.length > 0) {
      onUpdate({ bibliography: [...bibliography, ...newEntries] })
    }
  }

  function mapZoteroType(zt) {
    const map = { journalArticle: 'article', conferencePaper: 'inproceedings', book: 'book', bookSection: 'incollection', thesis: 'phdthesis', report: 'techreport', preprint: 'article' }
    return map[zt] || 'misc'
  }

  const isInBib = (key) => bibliography.some(e => e.key === key)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, width: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Bibliography</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select className="prop-input" value={citationStyle}
              onChange={e => onUpdate({ citationStyle: e.target.value })}
              style={{ fontSize: 12, padding: '4px 8px' }}>
              <option value="numbered">[1], [2], [3]</option>
              <option value="author-year">(Author, Year)</option>
            </select>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[['library', 'Library'], ['import', 'Import BibTeX'], ['zotero', 'Zotero']].map(([id, label]) => (
            <button key={id}
              onClick={() => setTab(id)}
              style={{ flex: 1, padding: '8px 0', fontSize: 13, border: 'none', cursor: 'pointer',
                background: tab === id ? 'var(--bg-hover)' : 'transparent',
                color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: tab === id ? 600 : 400,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Library tab */}
          {tab === 'library' && (
            <>
              {bibliography.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 14, marginBottom: 8 }}>No bibliography entries yet</p>
                  <p style={{ fontSize: 12 }}>Import a .bib file or connect to Zotero to add references</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bibliography.map((entry, i) => {
                    const authors = parseAuthors(entry.author)
                    return (
                      <div key={entry.key} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, minWidth: 28, textAlign: 'center', paddingTop: 2 }}>
                          {citationStyle === 'numbered' ? `[${i + 1}]` : ''}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {formatAuthorsShort(authors)}{entry.year ? `, ${entry.year}` : ''}
                            {entry.journal ? ` — ${entry.journal}` : ''}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'monospace' }}>
                            @{entry.type}{'{' + entry.key + '}'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          {onInsertCitation && (
                            <button onClick={() => onInsertCitation(entry, i)}
                              title="Insert citation at cursor"
                              style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                              Cite
                            </button>
                          )}
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => moveEntry(i, -1)} disabled={i === 0}
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px', fontSize: 10, cursor: 'pointer', color: 'var(--text-muted)', opacity: i === 0 ? 0.3 : 1 }}>
                              &uarr;
                            </button>
                            <button onClick={() => moveEntry(i, 1)} disabled={i === bibliography.length - 1}
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px', fontSize: 10, cursor: 'pointer', color: 'var(--text-muted)', opacity: i === bibliography.length - 1 ? 0.3 : 1 }}>
                              &darr;
                            </button>
                            <button onClick={() => removeEntry(entry.key)}
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px', fontSize: 10, cursor: 'pointer', color: 'var(--danger)' }}>
                              &times;
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {bibliography.length > 0 && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: 'var(--text-muted)' }}>
                  A "References" slide will be auto-generated at the end of your presentation.
                </div>
              )}
            </>
          )}

          {/* Import BibTeX tab */}
          {tab === 'import' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => fileRef.current?.click()}
                  className="btn btn-secondary" style={{ fontSize: 12 }}>
                  Upload .bib file
                </button>
                <input ref={fileRef} type="file" accept=".bib,.bibtex" style={{ display: 'none' }}
                  onChange={e => handleFileUpload(e.target.files[0])} />
              </div>
              <textarea
                value={bibtexInput}
                onChange={e => setBibtexInput(e.target.value)}
                placeholder={'Paste BibTeX entries here...\n\n@article{key,\n  author = {Last, First},\n  title = {Title},\n  journal = {Journal},\n  year = {2024},\n}'}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: 200, background: '#0d0d1a', color: '#e2e8f0',
                  fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 11,
                  padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6,
                  outline: 'none', resize: 'vertical', lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
              {importError && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{importError}</div>
              )}
              <button onClick={handleImportBibtex}
                disabled={!bibtexInput.trim()}
                className="btn btn-primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
                Import Entries
              </button>
            </>
          )}

          {/* Zotero tab */}
          {tab === 'zotero' && (
            <>
              {!zoteroConnected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Connect to your Zotero library. Find your numeric User ID and create an API key at{' '}
                    <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 500 }}>zotero.org/settings/keys</a>.
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>User ID <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(numeric, not username)</span></div>
                    <input className="prop-input" type="text" value={zoteroUserId}
                      onChange={e => setZoteroUserId(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 12345678 (from zotero.org/settings/keys)"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>API Key</div>
                    <input className="prop-input" type="password" value={zoteroApiKey}
                      onChange={e => setZoteroApiKey(e.target.value)}
                      placeholder="Enter your Zotero API key"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  {zoteroError && (
                    <div style={{ fontSize: 12, color: 'var(--danger)' }}>{zoteroError}</div>
                  )}
                  <button onClick={connectZotero} disabled={zoteroLoading}
                    className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {zoteroLoading ? 'Connecting...' : 'Connect to Zotero'}
                  </button>
                </div>
              ) : (
                <div>
                  {/* Search and filter */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input className="prop-input" type="text" value={zoteroSearch}
                      onChange={e => setZoteroSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') searchZotero(zoteroSearch, zoteroCollection, 0) }}
                      placeholder="Search title, author, year..."
                      style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
                    <select className="prop-input" value={zoteroCollection}
                      onChange={e => { setZoteroCollection(e.target.value); searchZotero(zoteroSearch, e.target.value, 0) }}
                      style={{ width: 160, padding: '6px 8px', fontSize: 11 }}>
                      <option value="">All Collections</option>
                      {zoteroCollections.map(c => (
                        <option key={c.key} value={c.key}>{c.name}</option>
                      ))}
                    </select>
                    <button onClick={() => searchZotero(zoteroSearch, zoteroCollection, 0)}
                      className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>
                      Search
                    </button>
                  </div>

                  {zoteroError && (
                    <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{zoteroError}</div>
                  )}

                  {zoteroLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                        {zoteroTotal} items found
                        {zoteroItems.length > 0 && (
                          <button onClick={importAllZoteroItems}
                            style={{ marginLeft: 8, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>
                            Import all visible
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {zoteroItems.map(item => {
                          const d = item.data
                          const itemKey = d.citationKey || item.key
                          const added = isInBib(itemKey)
                          const authorList = (d.creators || []).filter(c => c.creatorType === 'author')
                          const authorStr = authorList.length > 2
                            ? `${authorList[0].lastName} et al.`
                            : authorList.map(a => a.lastName || a.name).join(', ')
                          return (
                            <div key={item.key} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: added ? 'rgba(34,197,94,0.06)' : 'var(--bg-card)', border: `1px solid ${added ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 6, alignItems: 'center' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {d.title || 'Untitled'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                  {authorStr}{d.date ? `, ${d.date}` : ''}
                                  {d.publicationTitle ? ` — ${d.publicationTitle}` : ''}
                                </div>
                              </div>
                              <button onClick={() => importZoteroItem(item)}
                                disabled={added}
                                style={{
                                  background: added ? 'var(--success)' : 'var(--accent)',
                                  color: 'white', border: 'none', borderRadius: 4,
                                  padding: '4px 10px', fontSize: 11, cursor: added ? 'default' : 'pointer',
                                  fontWeight: 500, flexShrink: 0, opacity: added ? 0.7 : 1,
                                }}>
                                {added ? 'Added' : 'Import'}
                              </button>
                            </div>
                          )
                        })}
                      </div>

                      {/* Pagination */}
                      {zoteroTotal > 25 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                          <button onClick={() => searchZotero(zoteroSearch, zoteroCollection, Math.max(0, zoteroOffset - 25))}
                            disabled={zoteroOffset === 0}
                            className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 12px' }}>
                            Previous
                          </button>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                            {zoteroOffset + 1}–{Math.min(zoteroOffset + 25, zoteroTotal)} of {zoteroTotal}
                          </span>
                          <button onClick={() => searchZotero(zoteroSearch, zoteroCollection, zoteroOffset + 25)}
                            disabled={zoteroOffset + 25 >= zoteroTotal}
                            className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 12px' }}>
                            Next
                          </button>
                        </div>
                      )}

                      {/* Disconnect */}
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <button onClick={() => { setZoteroConnected(false); setZoteroItems([]); setZoteroError(null) }}
                          className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Disconnect Zotero
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
