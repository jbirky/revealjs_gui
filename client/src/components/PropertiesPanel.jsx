import { useState, useRef } from 'react'
import katex from 'katex'
import { api } from '../utils/api'

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

export default function PropertiesPanel({ slide, selectedElement, onUpdateSlide, onUpdateElement, onDeleteElement, onBringForward, onSendBackward, onEditHtml, onEditCode, onEditLatex, presentation, onUpdatePresentation, selectedElementIds, onDeleteSelectedElements, isTemplate = false, activeMathNode, onUpdateMathNode, onCloseMathNode }) {
  const [videoUploading, setVideoUploading] = useState(false)
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
          <h3>Element</h3>

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
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Opacity: {Math.round((selectedElement.opacity ?? 1) * 100)}%</div>
                <input type="range" min="0" max="100" value={Math.round((selectedElement.opacity ?? 1) * 100)}
                  onChange={e => onUpdateElement({ opacity: Number(e.target.value) / 100 })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
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
                    <option value="fade-in">Fade In</option>
                    <option value="fade-out">Fade Out</option>
                    <option value="fade-up">Fade Up</option>
                    <option value="fade-down">Fade Down</option>
                    <option value="fade-left">Fade Left</option>
                    <option value="fade-right">Fade Right</option>
                    <option value="grow">Grow</option>
                    <option value="shrink">Shrink</option>
                    <option value="zoom-in">Zoom In</option>
                    <option value="highlight-red">Highlight Red</option>
                    <option value="highlight-green">Highlight Green</option>
                    <option value="highlight-blue">Highlight Blue</option>
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
        </div>
      )}

      {/* Slide Section + Footer Style */}
      <div className="prop-section">
        <h3>Slide Footer</h3>

        {/* Hide footer on this slide */}
        {(presentation?.showFooter || presentation?.showPageNumbers) && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8, userSelect: 'none' }}>
            <input type="checkbox" checked={slide.hideFooter === true}
              onChange={e => onUpdateSlide({ hideFooter: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hide footer on this slide</span>
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

        {(presentation?.showFooter || presentation?.showPageNumbers) && presentation && onUpdatePresentation && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginTop: 6 }}>Footer Style</div>

            {/* Footer mode selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[['basic', 'Basic'], ['sequence', 'Sequence']].map(([mode, label]) => (
                <button
                  key={mode}
                  className={`bg-type-tab ${(presentation.footerMode || 'basic') === mode ? 'active' : ''}`}
                  onClick={() => onUpdatePresentation({ footerMode: mode })}
                  style={{ flex: 1 }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sequence mode: define section titles */}
            {presentation.footerMode === 'sequence' && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Section Titles</div>
                {(presentation.sequenceSections || []).map((sec, i) => {
                  const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
                  const secColor = typeof sec === 'object' && sec?.color ? sec.color : ''
                  const updateSec = patch => {
                    const sections = [...(presentation.sequenceSections || [])]
                    sections[i] = { label: secLabel, color: secColor, ...patch }
                    onUpdatePresentation({ sequenceSections: sections })
                  }
                  return (
                    <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
                      <input
                        className="prop-input"
                        type="text"
                        value={secLabel}
                        onChange={e => updateSec({ label: e.target.value })}
                        placeholder={`Section ${i + 1}`}
                        style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
                      />
                      <input type="color"
                        title="Active color for this section (overrides default)"
                        value={secColor || (presentation.footerColor || '#a8b4c8')}
                        onChange={e => updateSec({ color: e.target.value })}
                        style={{ width: 22, height: 22, padding: 1, background: 'var(--bg-card)', border: secColor ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <button
                        className="btn-icon"
                        style={{ width: 22, height: 22, fontSize: 12, flexShrink: 0 }}
                        title="Remove section"
                        onClick={() => {
                          const sections = [...(presentation.sequenceSections || [])]
                          sections.splice(i, 1)
                          onUpdatePresentation({ sequenceSections: sections })
                        }}
                      >×</button>
                    </div>
                  )
                })}
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '3px 8px', marginTop: 2 }}
                  onClick={() => {
                    const sections = [...(presentation.sequenceSections || []), { label: '', color: '' }]
                    onUpdatePresentation({ sequenceSections: sections })
                  }}
                >+ Add Section</button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 28px', gap: 6, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Font</div>
                <select className="prop-input" style={{ padding: '3px 4px', fontSize: 11 }}
                  value={presentation.footerFontFamily || '-apple-system,sans-serif'}
                  onChange={e => onUpdatePresentation({ footerFontFamily: e.target.value })}
                >
                  <optgroup label="Sans-serif">
                    <option value="-apple-system,sans-serif">System</option>
                    <option value="Inter,sans-serif">Inter</option>
                    <option value="Roboto,sans-serif">Roboto</option>
                    <option value="'Open Sans',sans-serif">Open Sans</option>
                    <option value="'Source Sans Pro',sans-serif">Source Sans Pro</option>
                  </optgroup>
                  <optgroup label="Serif">
                    <option value="'Playfair Display',serif">Playfair Display</option>
                    <option value="Merriweather,serif">Merriweather</option>
                    <option value="'Computer Modern Serif',serif">Computer Modern</option>
                    <option value="'Computer Modern Sans',sans-serif">Computer Modern Sans</option>
                    <option value="'Latin Modern Roman',serif">Latin Modern Roman</option>
                  </optgroup>
                  <optgroup label="Monospace">
                    <option value="'Fira Code',monospace">Fira Code</option>
                    <option value="'JetBrains Mono',monospace">JetBrains Mono</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Size</div>
                <input className="prop-input" type="number" min="8" max="32" step="1"
                  value={presentation.footerFontSize || 14}
                  onChange={e => onUpdatePresentation({ footerFontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) })}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Active</div>
                <input type="color"
                  value={presentation.footerColor || '#a8b4c8'}
                  onChange={e => onUpdatePresentation({ footerColor: e.target.value })}
                  style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                />
              </div>
            </div>
            {presentation.footerMode === 'sequence' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Inactive color</div>
                <input type="color"
                  value={presentation.footerInactiveColor || '#404060'}
                  onChange={e => onUpdatePresentation({ footerInactiveColor: e.target.value })}
                  style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Speaker Notes */}
      <div className="prop-section">
        <h3>Speaker Notes</h3>
        <textarea
          className="notes-textarea"
          value={slide.notes || ''}
          onChange={e => onUpdateSlide({ notes: e.target.value })}
          placeholder="Add speaker notes here..."
        />
      </div>

      {/* Custom CSS — template editor only */}
      {isTemplate && presentation && onUpdatePresentation && (
        <div className="prop-section">
          <h3>Custom CSS</h3>
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
        </div>
      )}
    </div>
  )
}
