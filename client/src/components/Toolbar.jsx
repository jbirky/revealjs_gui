import { useState, useEffect } from 'react'
import {
  Undo2, Redo2,
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Code, FileCode, Quote,
  Link, Unlink,
  Image,
  Type,
  RemoveFormatting,
  Type as TypeIcon,
  Image as ImageIcon,
  Upload,
  Grid,
  Shapes
} from 'lucide-react'
import { SHAPES } from '../utils/shapeUtils'

const COLOR_PALETTE = [
  '#ffffff','#e2e8f0','#94a3b8','#64748b','#334155','#1e293b','#0f172a','#000000',
  '#fca5a5','#f87171','#ef4444','#dc2626','#fcd34d','#fbbf24','#f59e0b','#d97706',
  '#86efac','#4ade80','#22c55e','#16a34a','#6ee7b7','#34d399','#10b981','#059669',
  '#93c5fd','#60a5fa','#3b82f6','#2563eb','#a5b4fc','#818cf8','#6366f1','#4f46e5',
  '#d8b4fe','#c084fc','#a855f7','#7c3aed','#f5d0fe','#f0abfc','#e879f9','#d946ef',
]

export default function Toolbar({ editor, editingElementId, showGrid, onToggleGrid, gridSize, onGridSizeChange, onAddText, onAddImage, onAddImageUpload, onAddShape, onAddHtml, onAddCode, selectedCount, onAlignElements }) {
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showColorPalette, setShowColorPalette] = useState(false)

  useEffect(() => {
    if (!showColorPalette) return
    const close = () => setShowColorPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showColorPalette])

  function handleLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().toggleLink({ href: url }).run()
    }
  }

  function handleImage() {
    if (!editor) return
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  function handleClearFormatting() {
    if (!editor) return
    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }

  const currentColor = editor ? (editor.getAttributes('textStyle').color || '#ffffff') : '#ffffff'

  return (
    <div className="toolbar">
      {/* Element tools — always active */}
      <button className="btn-icon" title="Add Text Box" onClick={onAddText} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <TypeIcon size={14} /> Text
      </button>
      <div className="color-btn-wrapper" title="Add Image" style={{ position: 'relative' }}>
        <button className="btn-icon" title="Add Image" onClick={onAddImage} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
          <ImageIcon size={14} /> Image
        </button>
      </div>
      <label className="btn-icon" title="Upload Image" style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <Upload size={14} /> Upload
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { onAddImageUpload(f); e.target.value = '' } }} />
      </label>

      <button className="btn-icon" title="Insert HTML / D3 embed" onClick={onAddHtml} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <FileCode size={14} /> Embed
      </button>
      <button className="btn-icon" title="Insert Code Block" onClick={onAddCode} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <Code size={14} /> Code
      </button>

      {/* Shape picker dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          className="btn-icon"
          style={{ width: 'auto', padding: '0 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Add Shape"
          onClick={() => setShowShapeMenu(v => !v)}
        >
          <Shapes size={14} /> Shape
        </button>
        {showShapeMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 8, zIndex: 1000,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: 180
          }}
          onMouseLeave={() => setShowShapeMenu(false)}
          >
            {SHAPES.map(s => (
              <button
                key={s.id}
                title={s.name}
                style={{ padding: '6px 4px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                onClick={() => { onAddShape(s.id); setShowShapeMenu(false) }}
              >
                <span>{s.icon}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid toggle */}
      <button
        className={`btn-icon ${showGrid ? 'active' : ''}`}
        onClick={onToggleGrid}
        title={showGrid ? 'Hide grid / disable snap' : 'Show grid + snap to grid'}
      >
        <Grid size={14} />
      </button>
      {showGrid && (
        <input
          type="number"
          min="5"
          max="200"
          step="5"
          value={gridSize}
          onChange={e => onGridSizeChange(Math.max(5, Math.min(200, Number(e.target.value) || 40)))}
          title="Grid size (px)"
          style={{
            width: 48, padding: '3px 6px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', color: 'var(--text-primary)',
            borderRadius: 4, fontSize: 12, textAlign: 'center'
          }}
        />
      )}

      {selectedCount >= 2 && (
        <>
          <span className="toolbar-divider" />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Align:</span>
          {[
            ['left','←L','Align left'], ['center-h','↔','Center H'], ['right','R→','Align right'],
            ['top','↑T','Align top'], ['center-v','↕','Center V'], ['bottom','B↓','Align bottom'],
            ['distribute-h','⇔','Distribute H'], ['distribute-v','⇕','Distribute V'],
          ].map(([type, label, title]) => (
            <button key={type} className="btn-icon" title={title}
              style={{ fontSize: 11, padding: '0 5px', width: 'auto', fontFamily: 'monospace' }}
              onClick={() => onAlignElements(type)}
            >{label}</button>
          ))}
        </>
      )}

      <span className="toolbar-divider" />

      {/* Hint when no text element is being edited */}
      {!editingElementId && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 8px' }}>
          Double-click a text box to edit
        </span>
      )}

      {editor && (
        <>
          {/* Font Family */}
          <select
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, maxWidth: 120, cursor: 'pointer' }}
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={e => e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run()}
            title="Font family"
          >
            <option value="">Default</option>
            <optgroup label="Sans-serif">
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Helvetica Neue', sans-serif">Helvetica</option>
              <option value="Verdana, sans-serif">Verdana</option>
              <option value="Tahoma, sans-serif">Tahoma</option>
              <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="Roboto, sans-serif">Roboto</option>
              <option value="'Open Sans', sans-serif">Open Sans</option>
              <option value="'Source Sans Pro', sans-serif">Source Sans Pro</option>
              <option value="'Computer Modern Sans', sans-serif">Computer Modern Sans</option>
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
            </optgroup>
            <optgroup label="Display">
              <option value="Impact, sans-serif">Impact</option>
            </optgroup>
          </select>

          {/* Font Size */}
          <select
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: 60, cursor: 'pointer' }}
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={e => e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run()}
            title="Font size"
          >
            <option value="">Auto</option>
            {['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px','96px'].map(s => (
              <option key={s} value={s}>{s.replace('px','')}</option>
            ))}
          </select>

          <span className="toolbar-divider" />

          {/* Undo / Redo */}
          <button
            className="btn-icon"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            className="btn-icon"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo2 size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Headings */}
          <button
            className={`btn-icon ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
            style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          >
            H1
          </button>
          <button
            className={`btn-icon ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          >
            H2
          </button>
          <button
            className={`btn-icon ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
            style={{ fontSize: 12, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          >
            H3
          </button>
          <button
            className={`btn-icon ${editor.isActive('paragraph') && !editor.isActive('heading') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Normal text"
          >
            <Type size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Text formatting */}
          <button
            className={`btn-icon ${editor.isActive('bold') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('italic') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('underline') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <Underline size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('strike') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Text color palette */}
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${showColorPalette ? 'active' : ''}`}
              style={{ position: 'relative' }}
              onClick={() => setShowColorPalette(v => !v)}
              title="Text color"
            >
              <Type size={15} />
              <span className="color-indicator" style={{ background: currentColor }} />
            </button>
            {showColorPalette && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 3,
                }}
              >
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color}
                    title={color}
                    style={{
                      width: 22, height: 22, background: color, padding: 0,
                      border: currentColor.toLowerCase() === color.toLowerCase() ? '2px solid white' : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                    }}
                    onMouseDown={e => {
                      e.preventDefault()
                      editor.chain().focus().setColor(color).run()
                      setShowColorPalette(false)
                    }}
                  />
                ))}
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Custom</span>
                  <div className="color-btn-wrapper" style={{ flex: 1 }}>
                    <div style={{ width: '100%', height: 22, borderRadius: 4, background: currentColor, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }} />
                    <input
                      type="color"
                      value={currentColor}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="toolbar-divider" />

          {/* Alignment */}
          <button
            className={`btn-icon ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align right"
          >
            <AlignRight size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Lists */}
          <button
            className={`btn-icon ${editor.isActive('bulletList') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('orderedList') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Ordered list"
          >
            <ListOrdered size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Code */}
          <button
            className={`btn-icon ${editor.isActive('code') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
          >
            <Code size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('codeBlock') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          >
            <FileCode size={15} />
          </button>
          <button
            className={`btn-icon ${editor.isActive('blockquote') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Table */}
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${editor.isActive('table') ? 'active' : ''}`}
              title="Table"
              onClick={() => setShowTableMenu(v => !v)}
              style={{ fontSize: 13 }}
            >
              ⊞
            </button>
            {showTableMenu && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 4, zIndex: 1000, width: 160, display: 'flex', flexDirection: 'column', gap: 2
                }}
                onMouseLeave={() => setShowTableMenu(false)}
              >
                {[
                  ['Insert Table', () => { const r=parseInt(window.prompt('Rows:','3')||'3'); const c=parseInt(window.prompt('Cols:','3')||'3'); if(r&&c) editor.chain().focus().insertTable({rows:r,cols:c,withHeaderRow:true}).run() }],
                  ['Add Row Before', () => editor.chain().focus().addRowBefore().run()],
                  ['Add Row After',  () => editor.chain().focus().addRowAfter().run()],
                  ['Delete Row',     () => editor.chain().focus().deleteRow().run()],
                  ['Add Col Before', () => editor.chain().focus().addColumnBefore().run()],
                  ['Add Col After',  () => editor.chain().focus().addColumnAfter().run()],
                  ['Delete Col',     () => editor.chain().focus().deleteColumn().run()],
                  ['Delete Table',   () => editor.chain().focus().deleteTable().run()],
                ].map(([label, action]) => (
                  <button
                    key={label}
                    style={{ padding: '6px 10px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                    onMouseEnter={e => e.target.style.background='var(--bg-hover)'}
                    onMouseLeave={e => e.target.style.background='none'}
                    onClick={() => { action(); setShowTableMenu(false) }}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>

          <span className="toolbar-divider" />

          {/* Link */}
          <button
            className={`btn-icon ${editor.isActive('link') ? 'active' : ''}`}
            onClick={handleLink}
            title="Add link"
          >
            <Link size={15} />
          </button>
          {editor.isActive('link') && (
            <button
              className="btn-icon"
              onClick={() => editor.chain().focus().unsetLink().run()}
              title="Remove link"
            >
              <Unlink size={15} />
            </button>
          )}

          {/* Image in text */}
          <button
            className="btn-icon"
            onClick={handleImage}
            title="Insert image in text"
          >
            <Image size={15} />
          </button>

          <span className="toolbar-divider" />

          {/* Math */}
          <button
            className="btn-icon"
            title="Insert inline math ($…$)"
            onClick={() => {
              const latex = window.prompt('LaTeX (inline):', 'E = mc^2')
              if (latex) editor.chain().focus().insertMath(latex, false).run()
            }}
            style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 14 }}
          >
            ∑
          </button>
          <button
            className="btn-icon"
            title="Insert display math ($$…$$)"
            onClick={() => {
              const latex = window.prompt('LaTeX (display):', '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}')
              if (latex) editor.chain().focus().insertMath(latex, true).run()
            }}
            style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 14 }}
          >
            ∫
          </button>

          <span className="toolbar-divider" />

          {/* Clear formatting */}
          <button
            className="btn-icon"
            onClick={handleClearFormatting}
            title="Clear formatting"
          >
            <RemoveFormatting size={15} />
          </button>
        </>
      )}
    </div>
  )
}
