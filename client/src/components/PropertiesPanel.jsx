import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { api } from '../utils/api'

const COLOR_SWATCHES = [
  '#1e1e2e', '#0a0a0f', '#1a1a4e', '#0d3349',
  '#1a3a1a', '#3a1a1a', '#2d1b69', '#000000',
  '#ffffff', '#f8f9fa', '#4a4a6a', '#6b3fa0'
]

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #360033, #0b8793)',
  'radial-gradient(ellipse at center, #1e3c72 0%, #2a5298 100%)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #2c3e50, #3498db)'
]

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

export default function PropertiesPanel({ slide, selectedElement, onUpdateSlide, onUpdateElement, onDeleteElement, onBringForward, onSendBackward, onEditHtml, onEditCode, presentation, onUpdatePresentation, selectedElementIds, onDeleteSelectedElements }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  if (!slide) {
    return (
      <div className="properties-panel">
        <div className="prop-section">
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No slide selected</p>
        </div>
      </div>
    )
  }

  const bg = slide.background || { type: 'color', color: '#1e1e2e' }
  const bgType = bg.type || 'color'

  function setBgType(type) {
    onUpdateSlide({ background: { ...bg, type } })
  }

  function setBgColor(color) {
    onUpdateSlide({ background: { ...bg, type: 'color', color } })
  }

  function setBgGradient(gradient) {
    onUpdateSlide({ background: { ...bg, type: 'gradient', gradient } })
  }

  function setBgImage(image) {
    onUpdateSlide({ background: { ...bg, type: 'image', image, size: bg.size || 'cover', position: bg.position || 'center' } })
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await api.uploadFile(file)
      if (result.url) {
        setBgImage(result.url)
      }
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="properties-panel">
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>X</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.x)} onChange={e => onUpdateElement({ x: Number(e.target.value) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Y</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.y)} onChange={e => onUpdateElement({ y: Number(e.target.value) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>W</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.width)} onChange={e => onUpdateElement({ width: Number(e.target.value) })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>H</div>
              <input className="prop-input" type="number" value={Math.round(selectedElement.height)} onChange={e => onUpdateElement({ height: Number(e.target.value) })} />
            </div>
          </div>

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
            </div>
          )}

          {/* Shape-specific options */}
          {selectedElement?.type === 'shape' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Fill</div>
                  <input type="color" style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.fill || '#6366f1'}
                    onChange={e => onUpdateElement({ fill: e.target.value })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Stroke</div>
                  <input type="color" style={{ width: '100%', height: 32, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer' }}
                    value={selectedElement.stroke === 'none' || !selectedElement.stroke ? '#ffffff' : selectedElement.stroke}
                    onChange={e => onUpdateElement({ stroke: e.target.value })}
                  />
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
        <h3>Section</h3>
        <input
          className="prop-input"
          type="text"
          value={slide.section || ''}
          onChange={e => onUpdateSlide({ section: e.target.value })}
          placeholder="Section name (shown in footer)"
          style={{ marginBottom: 10 }}
        />
        {(presentation?.showFooter || presentation?.showPageNumbers) && presentation && onUpdatePresentation && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Footer Style</div>
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
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Color</div>
                <input type="color"
                  value={presentation.footerColor || '#a8b4c8'}
                  onChange={e => onUpdatePresentation({ footerColor: e.target.value })}
                  style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Background Section */}
      <div className="prop-section">
        <h3>Background</h3>

        <div className="bg-type-tabs">
          {['color', 'gradient', 'image', 'none'].map(type => (
            <button
              key={type}
              className={`bg-type-tab ${bgType === type ? 'active' : ''}`}
              onClick={() => setBgType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {bgType === 'color' && (
          <>
            <div className="color-row">
              <input
                type="color"
                value={bg.color || '#1e1e2e'}
                onChange={e => setBgColor(e.target.value)}
                title="Pick background color"
              />
              <input
                className="prop-input"
                type="text"
                value={bg.color || '#1e1e2e'}
                onChange={e => setBgColor(e.target.value)}
                placeholder="#1e1e2e"
              />
            </div>
            <div className="color-swatch-row">
              {COLOR_SWATCHES.map(color => (
                <div
                  key={color}
                  className={`color-swatch ${bg.color === color ? 'active' : ''}`}
                  style={{ backgroundColor: color, border: color === '#ffffff' || color === '#f8f9fa' ? '1px solid var(--border)' : undefined }}
                  onClick={() => setBgColor(color)}
                  title={color}
                />
              ))}
            </div>
          </>
        )}

        {bgType === 'gradient' && (
          <>
            <div
              style={{
                height: 40,
                borderRadius: 6,
                background: bg.gradient || 'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
                marginBottom: 10,
                border: '1px solid var(--border)'
              }}
            />
            <input
              className="prop-input"
              type="text"
              value={bg.gradient || ''}
              onChange={e => setBgGradient(e.target.value)}
              placeholder="linear-gradient(135deg, #1e1e2e, #4a0e8f)"
              style={{ marginBottom: 10 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {GRADIENT_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setBgGradient(preset)}
                  style={{
                    height: 28,
                    borderRadius: 4,
                    background: preset,
                    border: bg.gradient === preset ? '2px solid white' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'border 0.1s'
                  }}
                  title={preset}
                />
              ))}
            </div>
          </>
        )}

        {bgType === 'image' && (
          <>
            {bg.image && (
              <div
                style={{
                  height: 80,
                  borderRadius: 6,
                  backgroundImage: `url(${bg.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  marginBottom: 10,
                  border: '1px solid var(--border)'
                }}
              />
            )}
            <input
              className="prop-input"
              type="text"
              value={bg.image || ''}
              onChange={e => setBgImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={{ marginBottom: 8 }}
            />
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8, fontSize: 12 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={13} />
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Size</div>
                <select
                  className="prop-input"
                  value={bg.size || 'cover'}
                  onChange={e => onUpdateSlide({ background: { ...bg, size: e.target.value } })}
                  style={{ padding: '4px 6px' }}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="auto">Auto</option>
                  <option value="100% 100%">Stretch</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Position</div>
                <select
                  className="prop-input"
                  value={bg.position || 'center'}
                  onChange={e => onUpdateSlide({ background: { ...bg, position: e.target.value } })}
                  style={{ padding: '4px 6px' }}
                >
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </>
        )}

        {bgType === 'none' && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            No background (uses theme default)
          </p>
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
    </div>
  )
}
