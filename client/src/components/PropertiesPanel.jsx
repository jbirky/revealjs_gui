// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useRef, useMemo } from 'react'
import katex from 'katex'
import { api } from '../utils/api'
import { parseAuthors, formatAuthorsShort } from '../utils/bibtexParser'

const CODE_LANGUAGES = [
  { id: 'plaintext', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'r', label: 'R' },
  { id: 'scala', label: 'Scala' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'bash', label: 'Bash/Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'latex', label: 'LaTeX' },
]

function CitationAutocomplete({ bibliography, citationText, citationLink, onUpdate }) {
  const [query, setQuery] = useState(citationText)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)
  const inputRef = useRef(null)

  const prevTextRef = useRef(citationText)
  if (citationText !== prevTextRef.current) {
    prevTextRef.current = citationText
    if (citationText !== query) setQuery(citationText)
  }

  const suggestions = useMemo(() => {
    if (!query || !bibliography.length) return []
    const q = query.toLowerCase()
    return bibliography.filter(entry => {
      const authors = parseAuthors(entry.author)
      const authorStr = formatAuthorsShort(authors).toLowerCase()
      const fullAuthors = (entry.author || '').toLowerCase()
      const title = (entry.title || '').toLowerCase()
      const year = entry.year || ''
      const key = entry.key.toLowerCase()
      return authorStr.includes(q) || fullAuthors.includes(q) || title.includes(q) || year.includes(q) || key.includes(q)
    }).slice(0, 6)
  }, [query, bibliography])

  function selectEntry(entry) {
    const authors = parseAuthors(entry.author)
    const text = `${formatAuthorsShort(authors)}${entry.year ? ` (${entry.year})` : ''}`
    setQuery(text)
    setSelectedKey(entry.key)
    setShowSuggestions(false)
    const updates = { citationText: text }
    if (entry.doi) updates.citationLink = `https://doi.org/${entry.doi}`
    else if (entry.url) updates.citationLink = entry.url
    onUpdate(updates)
  }

  function handleInputChange(val) {
    setQuery(val)
    setSelectedKey(null)
    setShowSuggestions(val.length > 0)
    onUpdate({ citationText: val || null })
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 150)
  }

  return (
    <>
      <div style={{ marginBottom: 4, position: 'relative' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Text</div>
        <input ref={inputRef} className="prop-input" placeholder="e.g. Smith et al. (2023)"
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (query && suggestions.length) setShowSuggestions(true) }}
          onBlur={handleBlur}
          style={{ width: '100%', fontSize: 11, padding: '4px 6px', boxSizing: 'border-box' }} />
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 100, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
            {suggestions.map(entry => {
              const authors = parseAuthors(entry.author)
              return (
                <div key={entry.key}
                  onMouseDown={e => { e.preventDefault(); selectEntry(entry) }}
                  style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatAuthorsShort(authors)}{entry.year ? ` (${entry.year})` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Link (optional)</div>
        <input className="prop-input" placeholder="https://..."
          value={citationLink}
          onChange={e => onUpdate({ citationLink: e.target.value || null })}
          style={{ width: '100%', fontSize: 11, padding: '4px 6px', boxSizing: 'border-box' }} />
      </div>
    </>
  )
}

export default function PropertiesPanel({ slide, selectedElement, onUpdateSlide, onUpdateElement, onDeleteElement, onBringForward, onSendBackward, onEditHtml, onEditCode, onEditLatex, onEditP5, presentation, onUpdatePresentation, selectedElementIds, onDeleteSelectedElements, isTemplate = false, activeMathNode, onUpdateMathNode, onCloseMathNode, onPreviewSlide, currentSlideIndex }) {
  const [videoUploading, setVideoUploading] = useState(false)
  const [collapsed, setCollapsed] = useState({ element: false, slideGroup: true, transition: true, presentGrid: true, layoutGrid: true, axisLines: true, footer: true, notes: true, customCss: true })
  const SectionHead = ({ k, children }) => (
    <h3 onClick={() => setCollapsed(p => ({ ...p, [k]: !p[k] }))} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
      {children} <span style={{ fontSize: 10, opacity: 0.5 }}>{collapsed[k] ? '▸' : '▾'}</span>
    </h3>
  )
  const videoFileRef = useRef(null)

  async function handleVideoUpload(file) {
    if (!file || !presentation?.id) return
    setVideoUploading(true)
    try {
      const result = await api.uploadFileToPresentation(presentation.id, file)
      if (result.url) onUpdateElement({ src: result.url })
    } finally {
      setVideoUploading(false)
    }
  }

  if (!slide) {
    return (
      <div className="properties-panel">
        <div className="prop-section">
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No slide selected</p>
        </div>
      </div>
    )
  }

  // Render KaTeX preview HTML safely
  const mathPreviewHtml = activeMathNode ? (() => {
    try {
      return katex.renderToString(activeMathNode.latex || '', {
        displayMode: activeMathNode.display || false,
        throwOnError: false,
      })
    } catch (e) {
      return `<span style="color:#f87171;font-size:11px">${e.message}</span>`
    }
  })() : ''

  return (
    <div className="properties-panel">

      {/* ── Preview Slide ─────────────────────────────────────────────────── */}
      {onPreviewSlide && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={onPreviewSlide}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 0', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            title={`Preview slide ${(currentSlideIndex ?? 0) + 1} in a new window`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
            Preview Slide {(currentSlideIndex ?? 0) + 1}
          </button>
        </div>
      )}

      {/* ── Inline Math Node Editor ────────────────────────────────────────── */}
      {activeMathNode && (
        <div className="prop-section" style={{ borderBottom: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Inline Math</h3>
            <button
              onClick={onCloseMathNode}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', fontSize: 14, lineHeight: 1 }}
              title="Close math editor"
            >✕</button>
          </div>

          {/* Live KaTeX preview */}
          <div
            style={{ background: '#0a0a14', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 10, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'auto', fontSize: 16 }}
            dangerouslySetInnerHTML={{ __html: mathPreviewHtml }}
          />

          {/* LaTeX source */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>LaTeX source</div>
          <textarea
            value={activeMathNode.latex || ''}
            onChange={e => onUpdateMathNode({ latex: e.target.value })}
            style={{ width: '100%', minHeight: 80, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 4, fontSize: 12, fontFamily: "'Fira Code', 'JetBrains Mono', monospace", resize: 'vertical', boxSizing: 'border-box', marginBottom: 8, lineHeight: 1.5 }}
            spellCheck={false}
            placeholder="\frac{a}{b}"
            autoFocus
          />

          {/* Display mode toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={activeMathNode.display || false}
              onChange={e => onUpdateMathNode({ display: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Display mode (centered block)</span>
          </label>

          {/* Font size + color */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font size (px)</div>
              <input
                className="prop-input"
                type="number"
                placeholder="–"
                min={6}
                max={200}
                value={activeMathNode.fontSize ? parseInt(activeMathNode.fontSize, 10) || '' : ''}
                onChange={e => onUpdateMathNode({ fontSize: e.target.value ? `${e.target.value}px` : null })}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Color</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(activeMathNode.color || '') ? activeMathNode.color : '#ffffff'}
                  onChange={e => onUpdateMathNode({ color: e.target.value })}
                  style={{ width: 30, height: 28, borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', padding: 1, flexShrink: 0, background: 'none' }}
                />
                <input
                  className="prop-input"
                  type="text"
                  placeholder="inherit"
                  value={activeMathNode.color || ''}
                  onChange={e => onUpdateMathNode({ color: e.target.value || null })}
                  style={{ fontSize: 11 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Element Section */}
      {selectedElement && (
        <div className="prop-section">
          <SectionHead k="element">Element</SectionHead>
          {!collapsed.element && (<>

          {selectedElementIds && selectedElementIds.length > 1 && (
            <div style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📌 {selectedElementIds.length} elements selected</span>
              <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={onDeleteSelectedElements}>Delete All</button>
            </div>
          )}

          {/* Position */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>X</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.x)} onChange={e => onUpdateElement({ x: Number(e.target.value) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Y</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.y)} onChange={e => onUpdateElement({ y: Number(e.target.value) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Rot</div>
              <input className="prop-input" type="number" step="1" value={Math.round(selectedElement.rotation || 0)} onChange={e => onUpdateElement({ rotation: Number(e.target.value) % 360 })} title="Rotation angle in degrees" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>W</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.width)} onChange={e => onUpdateElement({ width: Number(e.target.value) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>H</div>
              <input className="prop-input" type="number"
                value={Math.round(selectedElement.height)}
                onChange={e => onUpdateElement({ height: Number(e.target.value) })}
                disabled={selectedElement.type === 'text' && selectedElement.sizeMode === 'auto'}
                style={{ opacity: selectedElement.type === 'text' && selectedElement.sizeMode === 'auto' ? 0.4 : 1 }}
              />
            </div>
          </div>

          {/* Text box sizing mode */}
          {selectedElement.type === 'text' && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[['fixed', 'Fixed Box'], ['auto', 'Auto Fit']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => onUpdateElement({ sizeMode: mode })}
                  style={{
                    flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: (selectedElement.sizeMode || 'fixed') === mode ? 'var(--accent)' : 'var(--bg-hover)',
                    color: (selectedElement.sizeMode || 'fixed') === mode ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Text spacing controls */}
          {selectedElement.type === 'text' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Line Height</div>
                <input className="prop-input" type="number" min={0.1} max={4} step={0.1}
                  value={selectedElement.lineHeight ?? 1.4}
                  onChange={e => onUpdateElement({ lineHeight: Number(e.target.value) })}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Letter (px)</div>
                <input className="prop-input" type="number" min={-20} max={100} step={0.5}
                  value={selectedElement.letterSpacing ?? 0}
                  onChange={e => onUpdateElement({ letterSpacing: Number(e.target.value) })}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Word (px)</div>
                <input className="prop-input" type="number" min={-10} max={200} step={0.5}
                  value={selectedElement.wordSpacing ?? 0}
                  onChange={e => onUpdateElement({ wordSpacing: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8, userSelect: 'none' }}>
            <input type="checkbox" checked={selectedElement.locked || false}
              onChange={e => onUpdateElement({ locked: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedElement.locked ? '🔒' : '🔓'} Lock element</span>
          </label>

          {/* HTML embed options */}
          {selectedElement.type === 'html' && (
            <div style={{ marginBottom: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 6 }}
                onClick={onEditHtml}
              >
                Edit HTML / D3 Code
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Double-click element to open code editor</p>
            </div>
          )}

          {selectedElement.type === 'p5' && (
            <div style={{ marginBottom: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 6 }}
                onClick={onEditP5}
              >
                Edit p5.js Sketch
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Double-click element to open sketch editor</p>
            </div>
          )}

          {/* LaTeX / TikZ options */}
          {selectedElement.type === 'latex' && (
            <div style={{ marginBottom: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 6 }}
                onClick={onEditLatex}
              >
                Edit LaTeX / TikZ
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Double-click element to open editor</p>
            </div>
          )}

          {/* Text Path options */}
          {selectedElement.type === 'textpath' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Text Content</div>
              <textarea
                value={selectedElement.content || ''}
                onChange={e => onUpdateElement({ content: e.target.value })}
                style={{ width: '100%', minHeight: 48, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 4, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Angle (°)</div>
                  <input className="prop-input" type="number" min={-85} max={85} step={1}
                    value={selectedElement.angle ?? 15}
                    onChange={e => {
                      const angle = Math.max(-85, Math.min(85, Number(e.target.value) || 0))
                      const fs = selectedElement.fontSize || 64
                      const w = selectedElement.width || 500
                      const dy = Math.abs(w * Math.tan((angle * Math.PI) / 180))
                      onUpdateElement({ angle, height: Math.ceil(dy + fs * 2.4) })
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font Size</div>
                  <input className="prop-input" type="number" min={8} max={300}
                    value={selectedElement.fontSize || 64}
                    onChange={e => {
                      const fontSize = Math.max(8, Number(e.target.value) || 64)
                      const angle = selectedElement.angle ?? 0
                      const w = selectedElement.width || 500
                      const dy = Math.abs(w * Math.tan((angle * Math.PI) / 180))
                      onUpdateElement({ fontSize, height: Math.ceil(dy + fontSize * 2.4) })
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font Family</div>
                <select className="prop-input" value={selectedElement.fontFamily || ''} onChange={e => onUpdateElement({ fontFamily: e.target.value || null })}>
                  <option value="">↺ Use Global{presentation?.globalFont ? ` (${presentation.globalFont.split(',')[0].replace(/'/g, '')})` : ''}</option>
                  <option value="sans-serif">Default Sans</option>
                  <optgroup label="Sans-serif">
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Helvetica Neue', sans-serif">Helvetica</option>
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="'Inter Tight', sans-serif">Inter Tight</option>
                    <option value="Roboto, sans-serif">Roboto</option>
                    <option value="'Roboto Flex', sans-serif">Roboto Flex</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Source Sans Pro', sans-serif">Source Sans Pro</option>
                    <option value="'Source Sans 3', sans-serif">Source Sans 3</option>
                    <option value="'Fira Sans', sans-serif">Fira Sans</option>
                    <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
                    <option value="Manrope, sans-serif">Manrope</option>
                    <option value="Geist, sans-serif">Geist</option>
                    <option value="Figtree, sans-serif">Figtree</option>
                    <option value="Ubuntu, sans-serif">Ubuntu</option>
                    <option value="Rubik, sans-serif">Rubik</option>
                    <option value="'PT Sans', sans-serif">PT Sans</option>
                    <option value="'Didact Gothic', sans-serif">Didact Gothic</option>
                    <option value="Questrial, sans-serif">Questrial</option>
                    <option value="Barlow, sans-serif">Barlow</option>
                  </optgroup>
                  <optgroup label="Rounded">
                    <option value="Comfortaa, sans-serif">Comfortaa</option>
                    <option value="Nunito, sans-serif">Nunito</option>
                    <option value="'Nunito Sans', sans-serif">Nunito Sans</option>
                    <option value="Quicksand, sans-serif">Quicksand</option>
                    <option value="Dosis, sans-serif">Dosis</option>
                    <option value="'M PLUS Rounded 1c', sans-serif">M PLUS Rounded 1c</option>
                    <option value="Jura, sans-serif">Jura</option>
                  </optgroup>
                  <optgroup label="Condensed">
                    <option value="'Barlow Condensed', sans-serif">Barlow Condensed</option>
                    <option value="'Asap Condensed', sans-serif">Asap Condensed</option>
                    <option value="'Roboto Condensed', sans-serif">Roboto Condensed</option>
                  </optgroup>
                  <optgroup label="Serif">
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="Merriweather, serif">Merriweather</option>
                    <option value="'Computer Modern Serif', serif">Computer Modern</option>
                    <option value="'Latin Modern Roman', serif">Latin Modern Roman</option>
                  </optgroup>
                  <optgroup label="Monospace">
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="'Fira Code', monospace">Fira Code</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    <option value="Inconsolata, monospace">Inconsolata</option>
                    <option value="'Roboto Mono', monospace">Roboto Mono</option>
                    <option value="'Space Mono', monospace">Space Mono</option>
                  </optgroup>
                  <optgroup label="Display">
                    <option value="Impact, sans-serif">Impact</option>
                    <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
                    <option value="Codystar, sans-serif">Codystar</option>
                    <option value="'National Park', sans-serif">National Park</option>
                    <option value="'Futura PT', Futura, 'Century Gothic', sans-serif">Futura</option>
                    <option value="'Bauhaus 93', Impact, sans-serif">Bauhaus 93</option>
                  </optgroup>
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Color</div>
                <input type="color" value={selectedElement.color || '#ffffff'}
                  onChange={e => onUpdateElement({ color: e.target.value })}
                  style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, padding: 2, background: 'none', cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Line Height</div>
                  <input className="prop-input" type="number" min={0.1} max={4} step={0.1}
                    value={selectedElement.lineHeight ?? 1.35}
                    onChange={e => onUpdateElement({ lineHeight: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Letter (px)</div>
                  <input className="prop-input" type="number" min={-20} max={100} step={0.5}
                    value={selectedElement.letterSpacing || 0}
                    onChange={e => onUpdateElement({ letterSpacing: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Word (px)</div>
                  <input className="prop-input" type="number" min={-10} max={200} step={0.5}
                    value={selectedElement.wordSpacing || 0}
                    onChange={e => onUpdateElement({ wordSpacing: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Weight</div>
                  <select className="prop-input" value={selectedElement.fontWeight || 'normal'} onChange={e => onUpdateElement({ fontWeight: e.target.value })}>
                    <option value="100">Thin</option>
                    <option value="300">Light</option>
                    <option value="normal">Normal</option>
                    <option value="500">Medium</option>
                    <option value="700">Bold</option>
                    <option value="900">Black</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Style</div>
                  <select className="prop-input" value={selectedElement.fontStyle || 'normal'} onChange={e => onUpdateElement({ fontStyle: e.target.value })}>
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                    <option value="oblique">Oblique</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Alignment</div>
                  <select className="prop-input" value={selectedElement.textAnchor || 'start'} onChange={e => onUpdateElement({ textAnchor: e.target.value })}>
                    <option value="start">Start</option>
                    <option value="middle">Middle</option>
                    <option value="end">End</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Offset (%)</div>
                  <input className="prop-input" type="number" min={0} max={100}
                    value={selectedElement.startOffset || 0}
                    onChange={e => onUpdateElement({ startOffset: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Path Shape</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {[
                    { value: undefined, label: 'Line' },
                    { value: 'arc', label: 'Arc' },
                    { value: 'circle', label: 'Circle' },
                    { value: 'wave', label: 'Wave' },
                  ].map(opt => (
                    <button key={opt.value || 'line'}
                      onClick={() => onUpdateElement({ pathShape: opt.value || null })}
                      style={{
                        padding: '4px 0', fontSize: 10, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)',
                        background: (selectedElement.pathShape || undefined) === opt.value ? 'var(--accent)' : 'var(--bg-hover)',
                        color: (selectedElement.pathShape || undefined) === opt.value ? '#fff' : 'var(--text-secondary)',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
                {selectedElement.pathShape === 'arc' && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    Angle controls arc sweep. Resize height to adjust vertical space.
                  </div>
                )}
                {selectedElement.pathShape === 'circle' && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    Text follows an elliptical path. Width/height control the ellipse.
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}>
                <input type="checkbox" checked={selectedElement.showPath !== false}
                  onChange={e => onUpdateElement({ showPath: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Show path guide line
              </label>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Path Position</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 4 }}>
                  {[
                    { value: 'bottom', label: 'Base' },
                    { value: 'left',   label: 'Mid' },
                    { value: 'top',    label: 'Cap' },
                    { value: 'right',  label: 'Below' },
                    { value: 'leftedge',  label: '← Left' },
                    { value: 'rightedge', label: 'Right →' },
                  ].map(opt => (
                    <button key={opt.value}
                      onClick={() => onUpdateElement({ pathSide: opt.value })}
                      style={{
                        padding: '4px 0', fontSize: 11, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border)',
                        background: (selectedElement.pathSide || 'bottom') === opt.value ? 'var(--accent)' : 'var(--bg-hover)',
                        color: (selectedElement.pathSide || 'bottom') === opt.value ? '#fff' : 'var(--text-secondary)',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
                {(selectedElement.pathSide === 'leftedge' || selectedElement.pathSide === 'rightedge') && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Resize element height to control path length. Text flows top → bottom along the edge.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Markdown options */}
          {selectedElement.type === 'markdown' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Markdown Content</div>
              <textarea
                value={selectedElement.content || ''}
                onChange={e => onUpdateElement({ content: e.target.value })}
                style={{ width: '100%', minHeight: 120, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                spellCheck={false}
              />
            </div>
          )}

          {/* Chart options */}
          {selectedElement.type === 'chart' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Chart Type</div>
              <select className="prop-input" value={selectedElement.chartType || 'bar'} onChange={e => onUpdateElement({ chartType: e.target.value })} style={{ padding: '4px 6px', marginBottom: 8 }}>
                {['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Labels (comma-separated)</div>
              <input className="prop-input" type="text"
                value={(selectedElement.chartData?.labels || []).join(', ')}
                onChange={e => onUpdateElement({ chartData: { ...selectedElement.chartData, labels: e.target.value.split(',').map(s => s.trim()) } })}
                style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Values (comma-separated)</div>
              <input className="prop-input" type="text"
                value={((selectedElement.chartData?.datasets || [])[0]?.data || []).join(', ')}
                onChange={e => {
                  const data = e.target.value.split(',').map(s => Number(s.trim()) || 0)
                  const datasets = [...(selectedElement.chartData?.datasets || [{ label: 'Series 1', data: [], color: '#6366f1' }])]
                  datasets[0] = { ...datasets[0], data }
                  onUpdateElement({ chartData: { ...selectedElement.chartData, datasets } })
                }}
                style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Series Label</div>
              <input className="prop-input" type="text"
                value={(selectedElement.chartData?.datasets || [])[0]?.label || ''}
                onChange={e => {
                  const datasets = [...(selectedElement.chartData?.datasets || [{ label: '', data: [], color: '#6366f1' }])]
                  datasets[0] = { ...datasets[0], label: e.target.value }
                  onUpdateElement({ chartData: { ...selectedElement.chartData, datasets } })
                }}
                style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color</div>
                <input type="color"
                  value={(selectedElement.chartData?.datasets || [])[0]?.color || '#6366f1'}
                  onChange={e => {
                    const datasets = [...(selectedElement.chartData?.datasets || [{ label: '', data: [], color: '#6366f1' }])]
                    datasets[0] = { ...datasets[0], color: e.target.value }
                    onUpdateElement({ chartData: { ...selectedElement.chartData, datasets } })
                  }}
                  style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                />
              </div>
            </div>
          )}

          {/* Callout options */}
          {selectedElement.type === 'callout' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Number</div>
                  <input className="prop-input" type="number" min="1" max="99"
                    value={selectedElement.calloutNumber || 1}
                    onChange={e => onUpdateElement({ calloutNumber: Number(e.target.value) })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font Size</div>
                  <input className="prop-input" type="number" min="8" max="48"
                    value={selectedElement.fontSize || 16}
                    onChange={e => onUpdateElement({ fontSize: Number(e.target.value) })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>BG Color</div>
                  <input type="color" style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.calloutColor || '#ef4444'}
                    onChange={e => onUpdateElement({ calloutColor: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Text Color</div>
                  <input type="color" style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.calloutTextColor || '#ffffff'}
                    onChange={e => onUpdateElement({ calloutTextColor: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Icon options */}
          {selectedElement.type === 'icon' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Color</div>
                  <input type="color" style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.iconColor || '#ffffff'}
                    onChange={e => onUpdateElement({ iconColor: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Stroke</div>
                  <input className="prop-input" type="number" min="0.5" max="4" step="0.5"
                    value={selectedElement.iconStrokeWidth || 2}
                    onChange={e => onUpdateElement({ iconStrokeWidth: Number(e.target.value) })} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Icon: {selectedElement.iconName || 'Star'}</div>
            </div>
          )}

          {/* Code block options */}
          {selectedElement.type === 'code' && (
            <div style={{ marginBottom: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 8 }}
                onClick={onEditCode}
              >
                Edit Code
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Language</div>
                  <select className="prop-input" style={{ padding: '4px 6px' }}
                    value={selectedElement.language || 'plaintext'}
                    onChange={e => onUpdateElement({ language: e.target.value })}
                  >
                    {CODE_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font Size</div>
                  <input className="prop-input" type="number" min="8" max="32" step="1"
                    value={selectedElement.fontSize || 14}
                    onChange={e => onUpdateElement({ fontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) })}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Round Corners: {selectedElement.borderRadius || 0}px</div>
                <input type="range" min="0" max="50" value={selectedElement.borderRadius || 0}
                  onChange={e => onUpdateElement({ borderRadius: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </div>
            </div>
          )}

          {/* Image-specific options */}
          {selectedElement.type === 'image' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Object Fit</div>
              <select className="prop-input" value={selectedElement.objectFit || 'contain'} onChange={e => onUpdateElement({ objectFit: e.target.value })} style={{ padding: '4px 6px', marginBottom: 10 }}>
                {['contain', 'cover', 'fill', 'none'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Brightness: {selectedElement.filterBrightness ?? 100}%</div>
                <input type="range" min="0" max="200" value={selectedElement.filterBrightness ?? 100}
                  onChange={e => onUpdateElement({ filterBrightness: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Contrast: {selectedElement.filterContrast ?? 100}%</div>
                <input type="range" min="0" max="200" value={selectedElement.filterContrast ?? 100}
                  onChange={e => onUpdateElement({ filterContrast: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Grayscale: {selectedElement.filterGrayscale ?? 0}%</div>
                <input type="range" min="0" max="100" value={selectedElement.filterGrayscale ?? 0}
                  onChange={e => onUpdateElement({ filterGrayscale: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Round Corners: {selectedElement.borderRadius || 0}px</div>
                <input type="range" min="0" max="100" value={selectedElement.borderRadius || 0}
                  onChange={e => onUpdateElement({ borderRadius: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 8 }}>
                <input type="checkbox" checked={!!selectedElement.clickToExpand}
                  onChange={e => onUpdateElement({ clickToExpand: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }} />
                Click to expand in present mode
              </label>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Pop-up text (present mode)</div>
                <textarea className="prop-input" rows={2} placeholder="Click to show this text..."
                  value={selectedElement.popupText || ''}
                  onChange={e => onUpdateElement({ popupText: e.target.value || null })}
                  style={{ width: '100%', resize: 'vertical', fontSize: 11, padding: '4px 6px', fontFamily: 'inherit' }} />
              </div>
              {selectedElement.popupText && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Position</div>
                    <select className="prop-input" value={selectedElement.popupPosition || 'below'}
                      onChange={e => onUpdateElement({ popupPosition: e.target.value })}
                      style={{ padding: '4px 6px' }}>
                      <option value="below">Below</option>
                      <option value="center">Centered</option>
                      <option value="side">Side</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Font size</div>
                    <input type="number" className="prop-input" min="8" max="48" step="1"
                      value={selectedElement.popupFontSize || 15}
                      onChange={e => onUpdateElement({ popupFontSize: Number(e.target.value) || 15 })}
                      style={{ padding: '4px 6px', width: '100%' }} />
                  </div>
                </div>
              )}
              <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Citation</div>
                <CitationAutocomplete
                  bibliography={presentation?.bibliography || []}
                  citationText={selectedElement.citationText || ''}
                  citationLink={selectedElement.citationLink || ''}
                  onUpdate={onUpdateElement}
                />
                {(selectedElement.citationText || selectedElement.citationLink) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Display</div>
                      <select className="prop-input" value={selectedElement.citationMode || 'caption'}
                        onChange={e => onUpdateElement({ citationMode: e.target.value })}
                        style={{ padding: '4px 6px' }}>
                        <option value="caption">Caption bar</option>
                        <option value="side">Side reference</option>
                      </select>
                    </div>
                    {(selectedElement.citationMode || 'caption') === 'caption' && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Align</div>
                        <select className="prop-input" value={selectedElement.citationAlign || 'left'}
                          onChange={e => onUpdateElement({ citationAlign: e.target.value })}
                          style={{ padding: '4px 6px' }}>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shape-specific options */}
          {selectedElement?.type === 'shape' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                {selectedElement.shape !== 'line' && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Fill</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="color"
                        style={{ flex: 1, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: selectedElement.fill === 'none' ? 'not-allowed' : 'pointer', opacity: selectedElement.fill === 'none' ? 0.35 : 1 }}
                        value={selectedElement.fill === 'none' || !selectedElement.fill ? '#6366f1' : selectedElement.fill}
                        disabled={selectedElement.fill === 'none'}
                        onChange={e => onUpdateElement({ fill: e.target.value })}
                      />
                      <button
                        title="Transparent fill"
                        onClick={() => onUpdateElement({ fill: selectedElement.fill === 'none' ? '#6366f1' : 'none' })}
                        style={{
                          width: 28, height: 28, flexShrink: 0, borderRadius: 4, cursor: 'pointer',
                          border: selectedElement.fill === 'none' ? '2px solid var(--accent)' : '1px solid var(--border)',
                          backgroundImage: 'linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)',
                          backgroundSize: '6px 6px', backgroundPosition: '0 0,0 3px,3px -3px,-3px 0', backgroundColor: '#fff',
                        }}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{selectedElement.shape === 'line' ? 'Color' : 'Stroke'}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="color"
                      style={{ flex: 1, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: selectedElement.stroke === 'none' ? 'not-allowed' : 'pointer', opacity: selectedElement.stroke === 'none' ? 0.35 : 1 }}
                      value={selectedElement.stroke === 'none' || !selectedElement.stroke ? '#ffffff' : selectedElement.stroke}
                      disabled={selectedElement.stroke === 'none'}
                      onChange={e => onUpdateElement({ stroke: e.target.value })}
                    />
                    <button
                      title="Transparent stroke"
                      onClick={() => onUpdateElement({ stroke: selectedElement.stroke === 'none' ? '#ffffff' : 'none' })}
                      style={{
                        width: 28, height: 28, flexShrink: 0, borderRadius: 4, cursor: 'pointer',
                        border: selectedElement.stroke === 'none' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        backgroundImage: 'linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)',
                        backgroundSize: '6px 6px', backgroundPosition: '0 0,0 3px,3px -3px,-3px 0', backgroundColor: '#fff',
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Stroke Width: {selectedElement.strokeWidth || 0}px</div>
                <input type="range" min="0" max="20" value={selectedElement.strokeWidth || 0}
                  onChange={e => onUpdateElement({ strokeWidth: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Stroke Style</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { value: 'solid',  label: '—',   title: 'Solid' },
                    { value: 'dashed', label: '- -',  title: 'Dashed' },
                    { value: 'dotted', label: '···', title: 'Dotted' },
                  ].map(({ value, label, title }) => (
                    <button key={value} title={title}
                      onClick={() => onUpdateElement({ strokeDasharray: value === 'solid' ? undefined : value })}
                      style={{
                        flex: 1, padding: '4px 0', fontSize: 13, borderRadius: 4, cursor: 'pointer',
                        background: (selectedElement.strokeDasharray || 'solid') === value ? 'var(--accent)' : 'var(--bg-hover)',
                        color: 'white', border: '1px solid var(--border)', fontFamily: 'monospace',
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Opacity: {Math.round((selectedElement.opacity ?? 1) * 100)}%</div>
                <input type="range" min="0" max="100" value={Math.round((selectedElement.opacity ?? 1) * 100)}
                  onChange={e => onUpdateElement({ opacity: Number(e.target.value) / 100 })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
              {selectedElement.shape === 'star' && (() => {
                const w = selectedElement.width || 100
                const h = selectedElement.height || 100
                const sw = selectedElement.strokeWidth || 0
                const defOuter = Math.min(w,h)/2 - sw
                const defInner = defOuter * 0.4
                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Center X</div>
                        <input className="prop-input" type="number" step={1}
                          value={selectedElement.starCx != null ? selectedElement.starCx : Math.round(w/2)}
                          onChange={e => onUpdateElement({ starCx: Number(e.target.value) })} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Center Y</div>
                        <input className="prop-input" type="number" step={1}
                          value={selectedElement.starCy != null ? selectedElement.starCy : Math.round(h/2)}
                          onChange={e => onUpdateElement({ starCy: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Outer R</div>
                        <input className="prop-input" type="number" step={1} min={1}
                          value={selectedElement.starOuterR != null ? selectedElement.starOuterR : Math.round(defOuter)}
                          onChange={e => onUpdateElement({ starOuterR: Number(e.target.value) })} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Inner R</div>
                        <input className="prop-input" type="number" step={1} min={1}
                          value={selectedElement.starInnerR != null ? selectedElement.starInnerR : Math.round(defInner)}
                          onChange={e => onUpdateElement({ starInnerR: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>
                )
              })()}
              {(selectedElement.shape === 'rect' || selectedElement.shape === 'rounded-rect') && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Corner Radius: {selectedElement.borderRadius || 0}px</div>
                  <input type="range" min="0" max="100" value={selectedElement.borderRadius || 0}
                    onChange={e => onUpdateElement({ borderRadius: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Label Text</div>
                <input className="prop-input" type="text"
                  value={selectedElement.text || ''}
                  onChange={e => onUpdateElement({ text: e.target.value })}
                  placeholder="Text inside shape"
                />
              </div>
              {selectedElement.text && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Text Size</div>
                    <input className="prop-input" type="number" min="8" max="144"
                      value={selectedElement.fontSize || 16}
                      onChange={e => onUpdateElement({ fontSize: Number(e.target.value) })}
                      style={{ padding: '4px 6px' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Text Color</div>
                    <input type="color" style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                      value={selectedElement.textColor || '#ffffff'}
                      onChange={e => onUpdateElement({ textColor: e.target.value })}
                    />
                  </div>
                  {['circle', 'diamond', 'triangle', 'rect', 'rounded-rect'].includes(selectedElement.shape) && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', gridColumn: 'span 2' }}>
                      <input type="checkbox" checked={selectedElement.textReflow || false}
                        onChange={e => onUpdateElement({ textReflow: e.target.checked })}
                        style={{ accentColor: 'var(--accent)' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Reflow text to shape boundary</span>
                    </label>
                  )}
                  {selectedElement.textReflow && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Padding (px)</div>
                      <input className="prop-input" type="number" min="0" max="100"
                        value={selectedElement.textReflowPadding || 12}
                        onChange={e => onUpdateElement({ textReflowPadding: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Video options */}
          {selectedElement.type === 'video' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Source URL</div>
              <input className="prop-input" type="text"
                value={selectedElement.src || ''}
                onChange={e => onUpdateElement({ src: e.target.value })}
                placeholder="Video URL or upload below"
                style={{ marginBottom: 6 }}
              />
              <input ref={videoFileRef} type="file" accept="video/mp4,video/webm,video/ogg,video/*"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleVideoUpload(e.target.files[0]); e.target.value = '' }}
              />
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '5px 8px', marginBottom: 8, opacity: videoUploading ? 0.6 : 1 }}
                disabled={videoUploading}
                onClick={() => videoFileRef.current?.click()}
              >
                {videoUploading ? 'Uploading…' : '↑ Upload MP4 / Video File'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Poster Image URL</div>
              <input className="prop-input" type="text"
                value={selectedElement.poster || ''}
                onChange={e => onUpdateElement({ poster: e.target.value })}
                placeholder="Thumbnail URL (optional)"
                style={{ marginBottom: 8 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Object Fit</div>
              <select className="prop-input" value={selectedElement.objectFit || 'contain'} onChange={e => onUpdateElement({ objectFit: e.target.value })} style={{ padding: '4px 6px', marginBottom: 8 }}>
                {['contain', 'cover', 'fill', 'none'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['controls', 'Show controls'],
                  ['autoplay', 'Autoplay'],
                  ['loop', 'Loop'],
                  ['muted', 'Muted'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={key === 'controls' ? selectedElement[key] !== false : selectedElement[key] || false}
                      onChange={e => onUpdateElement({ [key]: e.target.checked })}
                      style={{ accentColor: 'var(--accent)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Audio options */}
          {selectedElement.type === 'audio' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Source URL</div>
              <input className="prop-input" type="text"
                value={selectedElement.src || ''}
                onChange={e => onUpdateElement({ src: e.target.value })}
                placeholder="Audio URL"
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['autoplay', 'Autoplay'],
                  ['loop', 'Loop'],
                  ['muted', 'Muted'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedElement[key] || false}
                      onChange={e => onUpdateElement({ [key]: e.target.checked })}
                      style={{ accentColor: 'var(--accent)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Table options */}
          {selectedElement.type === 'table' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
                  onClick={() => {
                    const data = [...(selectedElement.data || [['']])]
                    const cols = (data[0] || ['']).length
                    data.push(Array(cols).fill(''))
                    onUpdateElement({ data })
                  }}>+ Row</button>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
                  onClick={() => {
                    const data = (selectedElement.data || [['']])
                    if (data.length > 1) onUpdateElement({ data: data.slice(0, -1) })
                  }}>- Row</button>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
                  onClick={() => {
                    const data = (selectedElement.data || [['']])
                    onUpdateElement({ data: data.map(row => [...row, '']) })
                  }}>+ Col</button>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
                  onClick={() => {
                    const data = (selectedElement.data || [['']])
                    if ((data[0] || []).length > 1) onUpdateElement({ data: data.map(row => row.slice(0, -1)) })
                  }}>- Col</button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8 }}>
                <input type="checkbox" checked={selectedElement.headerRow || false}
                  onChange={e => onUpdateElement({ headerRow: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Header row</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Header BG</div>
                  <input type="color" style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.headerBgColor || '#6366f1'}
                    onChange={e => onUpdateElement({ headerBgColor: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Text Color</div>
                  <input type="color" style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.textColor || '#ffffff'}
                    onChange={e => onUpdateElement({ textColor: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Border</div>
                  <input type="color" style={{ width: '100%', height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.borderColor || '#555555'}
                    onChange={e => onUpdateElement({ borderColor: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Font Size</div>
                  <input className="prop-input" type="number" min="8" max="32"
                    value={selectedElement.fontSize || 14}
                    onChange={e => onUpdateElement({ fontSize: Number(e.target.value) })} />
                </div>
              </div>
              {/* Table cell editor */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Edit Cells</div>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                {(selectedElement.data || []).map((row, ri) => (
                  <div key={ri} style={{ display: 'flex' }}>
                    {(row || []).map((cell, ci) => (
                      <input
                        key={ci}
                        type="text"
                        value={cell || ''}
                        onChange={e => {
                          const data = (selectedElement.data || []).map(r => [...r])
                          data[ri][ci] = e.target.value
                          onUpdateElement({ data })
                        }}
                        style={{
                          flex: 1, minWidth: 0, padding: '4px 6px', border: '1px solid var(--border)',
                          background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 11,
                          outline: 'none', borderRadius: 0,
                        }}
                        placeholder={ri === 0 ? `H${ci + 1}` : `R${ri}C${ci + 1}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slide entry animation (GSAP) */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Slide Entry Animation</div>
            <select
              className="prop-input"
              style={{ padding: '4px 6px', marginBottom: 6, width: '100%' }}
              value={selectedElement.animationEnter || 'none'}
              onChange={e => onUpdateElement({ animationEnter: e.target.value })}
            >
              <option value="none">None</option>
              <optgroup label="Fade">
                <option value="fadeIn">Fade In</option>
                <option value="fadeUp">Fade Up ↑</option>
                <option value="fadeDown">Fade Down ↓</option>
                <option value="fadeLeft">Fade Left ←</option>
                <option value="fadeRight">Fade Right →</option>
              </optgroup>
              <optgroup label="Zoom">
                <option value="zoomIn">Zoom In</option>
                <option value="zoomOut">Zoom Out</option>
              </optgroup>
              <optgroup label="Slide">
                <option value="slideUp">Slide Up ↑</option>
                <option value="slideDown">Slide Down ↓</option>
                <option value="slideLeft">Slide Left ←</option>
                <option value="slideRight">Slide Right →</option>
              </optgroup>
              <optgroup label="Flip">
                <option value="flipX">Flip X</option>
                <option value="flipY">Flip Y</option>
              </optgroup>
            </select>
            {selectedElement.animationEnter && selectedElement.animationEnter !== 'none' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Delay (ms)</div>
                  <input
                    className="prop-input"
                    type="number"
                    min={0} max={5000} step={50}
                    placeholder="0"
                    value={selectedElement.animationDelay ?? 0}
                    onChange={e => onUpdateElement({ animationDelay: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Duration (ms)</div>
                  <input
                    className="prop-input"
                    type="number"
                    min={100} max={5000} step={50}
                    placeholder="600"
                    value={selectedElement.animationDuration ?? 600}
                    onChange={e => onUpdateElement({ animationDuration: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fragment animation */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedElement.fragment || false}
                onChange={e => onUpdateElement({ fragment: e.target.checked, fragmentIndex: selectedElement.fragmentIndex ?? 1 })}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fragment (animate in)</span>
            </label>
            {selectedElement.fragment && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Order</div>
                  <input className="prop-input" type="number" min="1" max="20"
                    value={selectedElement.fragmentIndex ?? 1}
                    onChange={e => onUpdateElement({ fragmentIndex: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Animation</div>
                  <select className="prop-input" style={{ padding: '4px 6px' }}
                    value={selectedElement.fragmentAnimation || 'fade-in'}
                    onChange={e => onUpdateElement({ fragmentAnimation: e.target.value })}
                  >
                    <optgroup label="Fade">
                      <option value="fade-in">Fade In</option>
                      <option value="fade-out">Fade Out</option>
                      <option value="fade-up">Fade Up</option>
                      <option value="fade-down">Fade Down</option>
                      <option value="fade-left">Fade Left</option>
                      <option value="fade-right">Fade Right</option>
                    </optgroup>
                    <optgroup label="Zoom / Scale">
                      <option value="grow">Grow</option>
                      <option value="shrink">Shrink</option>
                      <option value="zoom-in">Zoom In</option>
                    </optgroup>
                    <optgroup label="Slide">
                      <option value="slide-up">Slide Up</option>
                      <option value="slide-down">Slide Down</option>
                      <option value="slide-left">Slide Left</option>
                      <option value="slide-right">Slide Right</option>
                    </optgroup>
                    <optgroup label="Flip">
                      <option value="flip-up">Flip Up</option>
                      <option value="flip-down">Flip Down</option>
                    </optgroup>
                    <optgroup label="Highlight">
                      <option value="highlight-red">Highlight Red</option>
                      <option value="highlight-green">Highlight Green</option>
                      <option value="highlight-blue">Highlight Blue</option>
                      <option value="highlight-current-red">Current Red</option>
                      <option value="highlight-current-green">Current Green</option>
                      <option value="highlight-current-blue">Current Blue</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="strike">Strike Through</option>
                      <option value="semi-fade-out">Semi Fade Out</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Drawing element options */}
          {selectedElement.type === 'drawing' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Drawing</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <input type="checkbox"
                    checked={selectedElement.smooth !== false}
                    onChange={e => onUpdateElement({ smooth: e.target.checked })}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Auto-smooth
                </label>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {(selectedElement.paths || []).length} stroke{(selectedElement.paths || []).length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '4px 8px', color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}
                onClick={() => onUpdateElement({ paths: [] })}
              >
                Clear all strokes
              </button>
            </div>
          )}

          {/* Drop Shadow */}
          {selectedElement.type !== 'html' && selectedElement.type !== 'code' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Drop Shadow</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 6, alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>X</div>
                  <input className="prop-input" type="number" value={selectedElement.shadowX ?? 0} onChange={e => onUpdateElement({ shadowX: Number(e.target.value) })} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Y</div>
                  <input className="prop-input" type="number" value={selectedElement.shadowY ?? 0} onChange={e => onUpdateElement({ shadowY: Number(e.target.value) })} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Blur</div>
                  <input className="prop-input" type="number" min="0" value={selectedElement.shadowBlur ?? 0} onChange={e => onUpdateElement({ shadowBlur: Number(e.target.value) })} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}></div>
                  <input type="color" style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                    value={selectedElement.shadowColor || '#000000'}
                    onChange={e => onUpdateElement({ shadowColor: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Layer buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }} onClick={onBringForward}>↑ Forward</button>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '5px 8px', justifyContent: 'center' }} onClick={onSendBackward}>↓ Backward</button>
          </div>

          {/* Delete */}
          <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={onDeleteElement}>
            Delete Element
          </button>
          </>)}
        </div>
      )}

      {/* Slide Grouping */}
      <div className="prop-section">
        <SectionHead k="slideGroup">Slide Group</SectionHead>
        {!collapsed.slideGroup && (<>
        {(() => {
          const slides = presentation?.slides || []
          const idx = slides.indexOf(slide)
          const groupId = slide.slideGroup
          const groupSlides = groupId ? slides.map((s, i) => ({ s, i })).filter(({ s }) => s.slideGroup === groupId) : []
          const isGrouped = !!groupId && groupSlides.length > 1
          const isFirst = isGrouped && groupSlides[0].i === idx
          const posLabel = isGrouped ? `${groupSlides.findIndex(g => g.i === idx) + 1} of ${groupSlides.length}` : null
          const prevSlide = idx > 0 ? slides[idx - 1] : null
          const nextSlide = idx < slides.length - 1 ? slides[idx + 1] : null
          const canGroupPrev = idx > 0
          const canGroupNext = idx < slides.length - 1

          const groupWith = (otherIdx) => {
            const other = slides[otherIdx]
            const gid = slide.slideGroup || other.slideGroup || crypto.randomUUID()
            const patch = {}
            slides.forEach((s, i) => {
              if (i === idx || i === otherIdx || (s.slideGroup && (s.slideGroup === slide.slideGroup || s.slideGroup === other.slideGroup))) {
                patch[i] = gid
              }
            })
            const updated = slides.map((s, i) => patch[i] !== undefined ? { ...s, slideGroup: patch[i] } : s)
            onUpdateSlide({ __replaceAllSlides: updated })
          }

          const ungroup = () => {
            const updated = slides.map(s => s.slideGroup === groupId ? { ...s, slideGroup: null } : s)
            onUpdateSlide({ __replaceAllSlides: updated })
          }

          const ungroupThis = () => {
            onUpdateSlide({ slideGroup: null })
          }

          return (
            <div>
              {isGrouped ? (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Slide {posLabel} in group ({groupSlides.length} slides share page number)
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }} onClick={ungroupThis}>Remove from group</button>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }} onClick={ungroup}>Ungroup all</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Group with adjacent slides to share the same page number.</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {canGroupPrev && (
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }} onClick={() => groupWith(idx - 1)}>
                        Group with prev
                      </button>
                    )}
                    {canGroupNext && (
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }} onClick={() => groupWith(idx + 1)}>
                        Group with next
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
        </>)}
      </div>

      {/* Auto-Animate & Transition */}
      <div className="prop-section">
        <SectionHead k="transition">Transition</SectionHead>
        {!collapsed.transition && (<>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8, userSelect: 'none' }}>
          <input type="checkbox" checked={slide.autoAnimate || false}
            onChange={e => onUpdateSlide({ autoAnimate: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Auto-animate from previous slide</span>
        </label>
        {slide.autoAnimate && (
          <div style={{ marginBottom: 10, padding: '6px 8px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              Elements with the same ID on adjacent slides will morph between positions. Duplicate a slide, rearrange elements, and enable this to see morphing transitions.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Duration (s)</div>
                <input className="prop-input" type="number" min="0.1" max="5" step="0.1"
                  value={slide.autoAnimateDuration || 1}
                  onChange={e => onUpdateSlide({ autoAnimateDuration: Math.max(0.1, Math.min(5, Number(e.target.value) || 1)) })}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Easing</div>
                <select className="prop-input" value={slide.autoAnimateEasing || 'ease'}
                  onChange={e => onUpdateSlide({ autoAnimateEasing: e.target.value })}
                >
                  <option value="ease">Ease</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="ease-in-out">Ease In-Out</option>
                  <option value="linear">Linear</option>
                  <option value="cubic-bezier(0.25, 0.46, 0.45, 0.94)">Smooth</option>
                  <option value="cubic-bezier(0.68, -0.55, 0.27, 1.55)">Spring</option>
                </select>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Slide transition</div>
            <select className="prop-input" value={slide.transition || ''}
              onChange={e => onUpdateSlide({ transition: e.target.value || null })}
            >
              <option value="">Default</option>
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="convex">Convex</option>
              <option value="concave">Concave</option>
              <option value="zoom">Zoom</option>
              <option value="differential-rotation">Differential Rotation</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Speed</div>
            <select className="prop-input" value={slide.transitionSpeed || ''}
              onChange={e => onUpdateSlide({ transitionSpeed: e.target.value || null })}
            >
              <option value="">Default</option>
              <option value="fast">Fast</option>
              <option value="slow">Slow</option>
            </select>
          </div>
        </div>
        </>)}
      </div>

      {/* Present Grid per-slide override */}
      <div className="prop-section">
        <SectionHead k="presentGrid">Present Grid</SectionHead>
        {!collapsed.presentGrid && (<>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {[['default', 'Default'], ['show', 'Show'], ['hide', 'Hide']].map(([val, label]) => {
            const current = slide.showPresentGrid == null ? 'default' : (slide.showPresentGrid ? 'show' : 'hide')
            return (
              <button
                key={val}
                className={`bg-type-tab ${current === val ? 'active' : ''}`}
                onClick={() => {
                  const newVal = val === 'default' ? null : val === 'show'
                  onUpdateSlide({ showPresentGrid: newVal })
                }}
                style={{ flex: 1 }}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Default: grid {presentation?.showPresentGrid ? 'on' : 'off'} (controlled by top bar)
        </div>
        </>)}
      </div>

      {/* Layout Grid */}
      <div className="prop-section">
        <SectionHead k="layoutGrid">Layout Grid</SectionHead>
        {!collapsed.layoutGrid && (<>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8, userSelect: 'none' }}>
          <input type="checkbox" checked={slide.layoutGrid?.enabled || false}
            onChange={e => onUpdateSlide({ layoutGrid: { columns: 3, rows: 0, gutter: 20, marginX: 40, marginY: 40, snap: true, ...(slide.layoutGrid || {}), enabled: e.target.checked } })}
            style={{ accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Show layout grid</span>
        </label>
        {slide.layoutGrid?.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Columns</div>
              <input className="prop-input" type="number" min="1" max="12"
                value={slide.layoutGrid?.columns ?? 3}
                onChange={e => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, columns: Math.max(1, Math.min(12, Number(e.target.value) || 3)) } })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Rows</div>
              <input className="prop-input" type="number" min="0" max="12"
                value={slide.layoutGrid?.rows ?? 0}
                onChange={e => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, rows: Math.max(0, Math.min(12, Number(e.target.value) || 0)) } })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Gutter (px)</div>
              <input className="prop-input" type="number" min="0" max="100"
                value={slide.layoutGrid?.gutter ?? 20}
                onChange={e => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, gutter: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Margin X (px)</div>
              <input className="prop-input" type="number" min="0" max="200"
                value={slide.layoutGrid?.marginX ?? 40}
                onChange={e => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, marginX: Math.max(0, Number(e.target.value) || 0) } })}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Margin Y (px)</div>
              <input className="prop-input" type="number" min="0" max="200"
                value={slide.layoutGrid?.marginY ?? 40}
                onChange={e => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, marginY: Math.max(0, Number(e.target.value) || 0) } })}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', gridColumn: 'span 2' }}>
              <input type="checkbox" checked={slide.layoutGrid?.snap !== false}
                onChange={e => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, snap: e.target.checked } })}
                style={{ accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Snap to columns/rows</span>
            </label>
            {/* Ratio presets */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Presets</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { label: '2-col', columns: 2, gutter: 20 },
                  { label: '3-col', columns: 3, gutter: 20 },
                  { label: '4-col', columns: 4, gutter: 16 },
                  { label: '6-col', columns: 6, gutter: 12 },
                  { label: '3x3', columns: 3, rows: 3, gutter: 16 },
                  { label: '4x3', columns: 4, rows: 3, gutter: 12 },
                ].map(preset => (
                  <button key={preset.label}
                    onClick={() => onUpdateSlide({ layoutGrid: { ...slide.layoutGrid, columns: preset.columns, rows: preset.rows ?? 0, gutter: preset.gutter } })}
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                  >{preset.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        </>)}
      </div>

      {/* Axis Lines */}
      <div className="prop-section">
        <SectionHead k="axisLines">Axis Lines</SectionHead>
        {!collapsed.axisLines && (<>
        {(slide.axisLines || []).map((al, i) => (
          <div key={al.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <select className="prop-input" value={al.axis}
              onChange={e => {
                const updated = [...(slide.axisLines || [])]
                updated[i] = { ...al, axis: e.target.value, position: e.target.value === 'x' ? Math.round(960 / 3) : 270 }
                onUpdateSlide({ axisLines: updated })
              }}
              style={{ width: 40, padding: '2px 4px', fontSize: 11 }}
            >
              <option value="x">V</option>
              <option value="y">H</option>
            </select>
            <input className="prop-input" type="number" min="0" max={al.axis === 'x' ? 960 : 540}
              value={al.position}
              onChange={e => {
                const updated = [...(slide.axisLines || [])]
                updated[i] = { ...al, position: Math.max(0, Math.min(al.axis === 'x' ? 960 : 540, Number(e.target.value) || 0)) }
                onUpdateSlide({ axisLines: updated })
              }}
              style={{ width: 48, fontSize: 11, textAlign: 'center' }}
            />
            {/* Position ratio presets */}
            <div style={{ display: 'flex', gap: 2 }}>
              {[
                { label: '⅓', frac: 1/3 },
                { label: '½', frac: 1/2 },
                { label: '⅔', frac: 2/3 },
              ].map(({ label, frac }) => (
                <button key={label}
                  onClick={() => {
                    const updated = [...(slide.axisLines || [])]
                    updated[i] = { ...al, position: Math.round((al.axis === 'x' ? 960 : 540) * frac) }
                    onUpdateSlide({ axisLines: updated })
                  }}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 3, padding: '1px 4px', fontSize: 10, cursor: 'pointer', lineHeight: 1.2 }}
                  title={`${Math.round(frac * 100)}%`}
                >{label}</button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              <input type="checkbox" checked={al.snap !== false}
                onChange={e => {
                  const updated = [...(slide.axisLines || [])]
                  updated[i] = { ...al, snap: e.target.checked }
                  onUpdateSlide({ axisLines: updated })
                }}
                style={{ accentColor: 'var(--accent)', width: 12, height: 12 }}
              />
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Snap</span>
            </label>
            <button
              onClick={() => {
                const updated = (slide.axisLines || []).filter((_, j) => j !== i)
                onUpdateSlide({ axisLines: updated })
              }}
              title="Remove axis line"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
            >&times;</button>
          </div>
        ))}
        <button
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '3px 8px', marginTop: 4 }}
          onClick={() => {
            const existing = slide.axisLines || []
            const axis = existing.length % 2 === 0 ? 'x' : 'y'
            onUpdateSlide({ axisLines: [...existing, { id: crypto.randomUUID(), axis, position: axis === 'x' ? Math.round(960 / 3) : 270, visible: true, snap: true }] })
          }}
        >+ Add Axis Line</button>
        </>)}
      </div>

      {/* Slide Section + Footer Style */}
      <div className="prop-section">
        <SectionHead k="footer">Slide Footer</SectionHead>
        {!collapsed.footer && (<>

        {/* Show footer on this slide */}
        {(presentation?.showFooter || presentation?.showPageNumbers) && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8, userSelect: 'none' }}>
            <input type="checkbox" checked={slide.showSlideFooter !== false}
              onChange={e => onUpdateSlide({ showSlideFooter: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Show footer on this slide</span>
          </label>
        )}

        {/* Per-slide page number toggle */}
        {presentation?.showPageNumbers && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8, userSelect: 'none' }}>
            <input type="checkbox" checked={slide.showPageNumber !== false}
              onChange={e => onUpdateSlide({ showPageNumber: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Show page number on this slide</span>
          </label>
        )}

        {/* Basic mode: section name input */}
        {(presentation?.footerMode || 'basic') === 'basic' && (
          <input
            className="prop-input"
            type="text"
            value={slide.section || ''}
            onChange={e => onUpdateSlide({ section: e.target.value })}
            placeholder="Section name (shown in footer)"
            style={{ marginBottom: 10 }}
          />
        )}

        {/* Sequence mode: pick active section for this slide */}
        {presentation?.footerMode === 'sequence' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Active Section</div>
            {(presentation.sequenceSections || []).length === 0 ? (
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No sections defined. Add them in Footer Style below.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button
                  style={{
                    padding: '4px 8px', fontSize: 11, textAlign: 'left', cursor: 'pointer',
                    background: slide.activeSection == null ? 'var(--accent)' : 'var(--bg-hover)',
                    border: '1px solid var(--border)', borderRadius: 4,
                    color: slide.activeSection == null ? 'white' : 'var(--text-secondary)',
                  }}
                  onClick={() => onUpdateSlide({ activeSection: null })}
                >
                  None
                </button>
                {(presentation.sequenceSections || []).map((sec, i) => {
                  const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
                  return (
                    <button
                      key={i}
                      style={{
                        padding: '4px 8px', fontSize: 11, textAlign: 'left', cursor: 'pointer',
                        background: slide.activeSection === i ? 'var(--accent)' : 'var(--bg-hover)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        color: slide.activeSection === i ? 'white' : 'var(--text-secondary)',
                      }}
                      onClick={() => onUpdateSlide({ activeSection: i })}
                    >
                      {secLabel || `Section ${i + 1}`}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        </>)}
      </div>

      {/* Speaker Notes */}
      <div className="prop-section">
        <SectionHead k="notes">Speaker Notes</SectionHead>
        {!collapsed.notes && (<>
        <textarea
          className="notes-textarea"
          value={slide.notes || ''}
          onChange={e => onUpdateSlide({ notes: e.target.value })}
          placeholder="Add speaker notes here..."
        />
        </>)}
      </div>

      {/* Custom CSS — template editor only */}
      {isTemplate && presentation && onUpdatePresentation && (
        <div className="prop-section">
          <SectionHead k="customCss">Custom CSS</SectionHead>
          {!collapsed.customCss && (<>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            CSS applied to all slides in presentations created from this template.
          </p>
          <textarea
            value={presentation.customCSS || ''}
            onChange={e => onUpdatePresentation({ customCSS: e.target.value })}
            placeholder={`/* Example */\n.reveal .slides section h1 {\n  color: #6366f1;\n  text-transform: uppercase;\n}`}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 140, background: '#0d0d1a', color: '#e2e8f0',
              fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 11,
              padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
              outline: 'none', resize: 'vertical', lineHeight: 1.5, tabSize: 2,
              boxSizing: 'border-box',
            }}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault()
                const { selectionStart: s, selectionEnd: end, value } = e.target
                const next = value.substring(0, s) + '  ' + value.substring(end)
                e.target.value = next
                onUpdatePresentation({ customCSS: next })
                requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2 })
              }
            }}
          />
          </>)}
        </div>
      )}
    </div>
  )
}
