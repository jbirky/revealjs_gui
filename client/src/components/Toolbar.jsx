import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import {
  Undo2, Redo2,
  Pencil,
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
  Shapes,
  Video,
  Music,
  Table2,
  Magnet,
  Highlighter,
  Ruler,
  Group,
  Ungroup,
  FileText,
} from 'lucide-react'
import { SHAPES } from '../utils/shapeUtils'

const COLOR_PALETTE = [
  '#ffffff','#e2e8f0','#94a3b8','#64748b','#334155','#1e293b','#0f172a','#000000',
  '#fca5a5','#f87171','#ef4444','#dc2626','#fcd34d','#fbbf24','#f59e0b','#d97706',
  '#86efac','#4ade80','#22c55e','#16a34a','#6ee7b7','#34d399','#10b981','#059669',
  '#93c5fd','#60a5fa','#3b82f6','#2563eb','#a5b4fc','#818cf8','#6366f1','#4f46e5',
  '#d8b4fe','#c084fc','#a855f7','#7c3aed','#f5d0fe','#f0abfc','#e879f9','#d946ef',
]

const COLOR_SWATCHES_BG = [
  '#1e1e2e', '#0a0a0f', '#1a1a4e', '#0d3349',
  '#1a3a1a', '#3a1a1a', '#2d1b69', '#000000',
  '#ffffff', '#f8f9fa', '#4a4a6a', '#6b3fa0'
]

const GRADIENT_PRESETS_BG = [
  'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #360033, #0b8793)',
  'radial-gradient(ellipse at center, #1e3c72 0%, #2a5298 100%)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #2c3e50, #3498db)'
]

export default function Toolbar({ editor, editingElementId, showGrid, onToggleGrid, gridSize, onGridSizeChange, onAddText, onAddTextPath, onAddImage, onAddImageUpload, onAddShape, onAddHtml, onAddCode, onAddLatex, onAddMarkdown, onAddChart, onAddCallout, onAddIcon, onAddVideo, onAddVideoUpload, onAddAudio, onAddTable, onAddManim, onAddP5, selectedCount, onAlignElements, smartGuidesEnabled, onToggleSmartGuides, slide, onUpdateSlide, onGroupElements, onUngroupElements, showRulers, onToggleRulers, guides = [], onAddGuide, onRemoveGuide, onUpdateGuide, onImportPptx, drawTool, onSetDrawTool, onUndo, onRedo, canUndo, canRedo }) {
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showColorPalette, setShowColorPalette] = useState(false)
  const [showHighlightPalette, setShowHighlightPalette] = useState(false)
  const [showBgMenu, setShowBgMenu] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [iconSearch, setIconSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const bgFileRef = useRef(null)
  const pdfInputRef = useRef(null)
  const [pdfModal, setPdfModal] = useState(null) // { pages: [{canvas, num}], selected: Set }
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pptxLoading, setPptxLoading] = useState(false)
  const pptxInputRef = useRef(null)

  async function handlePdfUpload(file) {
    if (!file) return
    setPdfLoading(true)
    try {
      // Load PDF.js from CDN if not already loaded
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          s.onload = resolve
          s.onerror = reject
          document.head.appendChild(s)
        })
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const pages = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2 }) // 2x for quality
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        pages.push({ canvas, num: i })
      }
      setPdfModal({ pages, selected: new Set([1]) })
    } catch (e) {
      alert('Failed to load PDF: ' + e.message)
    } finally {
      setPdfLoading(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  async function insertPdfPages() {
    if (!pdfModal || !onAddImageUpload) return
    const { pages, selected } = pdfModal
    setPdfModal(null)
    for (const { canvas, num } of pages) {
      if (!selected.has(num)) continue
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const f = new File([blob], `pdf-page-${num}.png`, { type: 'image/png' })
      await onAddImageUpload(f)
    }
  }

  useEffect(() => {
    if (!showColorPalette) return
    const close = () => setShowColorPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showColorPalette])

  useEffect(() => {
    if (!showHighlightPalette) return
    const close = () => setShowHighlightPalette(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showHighlightPalette])

  useEffect(() => {
    if (!showBgMenu) return
    const close = (e) => {
      // Don't close if clicking inside the popup
      if (e.target.closest?.('.bg-popup-container')) return
      setShowBgMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showBgMenu])

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
      {/* Global Undo / Redo */}
      <button className="btn-icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo2 size={14} />
      </button>
      <button className="btn-icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Redo2 size={14} />
      </button>
      <span className="toolbar-divider" />

      {/* Draw / Freehand tool */}
      <button
        className={`btn-icon ${drawTool ? 'active' : ''}`}
        title={drawTool ? 'Exit draw mode (Esc)' : 'Freehand draw'}
        onClick={() => onSetDrawTool(drawTool ? null : { color: '#ffffff', strokeWidth: 3, opacity: 1, smooth: true })}
        style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}
      >
        <Pencil size={14} /> Draw
      </button>
      {drawTool && (
        <>
          <input type="color"
            title="Stroke color"
            value={drawTool.color || '#ffffff'}
            onChange={e => onSetDrawTool({ ...drawTool, color: e.target.value })}
            style={{ width: 28, height: 28, padding: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
          />
          <select
            title="Stroke width"
            value={drawTool.strokeWidth || 3}
            onChange={e => onSetDrawTool({ ...drawTool, strokeWidth: Number(e.target.value) })}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '2px 4px', borderRadius: 4, fontSize: 12, width: 52 }}
          >
            {[1, 2, 3, 4, 6, 8, 12, 18].map(w => <option key={w} value={w}>{w}px</option>)}
          </select>
          <select
            title="Opacity"
            value={drawTool.opacity ?? 1}
            onChange={e => onSetDrawTool({ ...drawTool, opacity: Number(e.target.value) })}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '2px 4px', borderRadius: 4, fontSize: 12, width: 60 }}
          >
            {[1, 0.75, 0.5, 0.25].map(o => <option key={o} value={o}>{Math.round(o * 100)}%</option>)}
          </select>
          <button
            className={`btn-icon ${drawTool.smooth ? 'active' : ''}`}
            title={drawTool.smooth ? 'Auto-smooth: on' : 'Auto-smooth: off'}
            onClick={() => onSetDrawTool({ ...drawTool, smooth: !drawTool.smooth })}
            style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}
          >
            ~
          </button>
          <button className="btn-icon" title="Undo last stroke (Ctrl+Z)" onClick={onUndo} style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}>
            ↩
          </button>
        </>
      )}
      <span className="toolbar-divider" />

      {/* Element tools — always active */}
      <button className="btn-icon" title="Add Text Box" onClick={onAddText} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <TypeIcon size={14} /> Text
      </button>
      <button className="btn-icon" title="Add Text on Path — text that follows a slanted baseline" onClick={onAddTextPath} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontStyle: 'italic', transform: 'rotate(-8deg)', display: 'inline-block', lineHeight: 1 }}>T/</span> Path
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
      <label className="btn-icon" title="Import PDF pages as images" style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, cursor: pdfLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', opacity: pdfLoading ? 0.6 : 1 }}>
        <FileText size={14} /> {pdfLoading ? 'Loading…' : 'PDF'}
        <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f) }} disabled={pdfLoading} />
      </label>

      <label
        className="btn-icon"
        title="Import PowerPoint — each slide becomes a new slide"
        style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, cursor: pptxLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', opacity: pptxLoading ? 0.6 : 1 }}
      >
        <FileText size={14} /> {pptxLoading ? 'Converting…' : 'PPTX'}
        <input
          ref={pptxInputRef}
          type="file"
          accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
          style={{ display: 'none' }}
          disabled={pptxLoading}
          onChange={async e => {
            const f = e.target.files?.[0]
            if (!f || !onImportPptx) return
            if (pptxInputRef.current) pptxInputRef.current.value = ''
            setPptxLoading(true)
            try {
              await onImportPptx(f)
            } catch (err) {
              alert('PPTX import failed: ' + err.message)
            } finally {
              setPptxLoading(false)
            }
          }}
        />
      </label>

      <button className="btn-icon" title="Insert HTML / D3 embed" onClick={onAddHtml} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <FileCode size={14} /> Embed
      </button>
      <button className="btn-icon" title="Insert p5.js sketch" onClick={onAddP5} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <Code size={14} /> p5
      </button>
      <button className="btn-icon" title="Insert Code Block" onClick={onAddCode} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <Code size={14} /> Code
      </button>

      <button className="btn-icon" title="Insert LaTeX / TikZ block" onClick={onAddLatex} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center', fontFamily: 'serif', fontWeight: 'bold' }}>
        <span style={{ fontSize: 14 }}>T<sub style={{ fontSize: 9 }}>E</sub>X</span>
      </button>
      <button className="btn-icon" title="Insert Markdown block" onClick={onAddMarkdown} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>M↓</span>
      </button>
      <button className="btn-icon" title="Insert Chart" onClick={onAddChart} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>&#9776;</span> Chart
      </button>
      <button className="btn-icon" title="Insert Callout" onClick={() => onAddCallout?.()} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>1</span>
      </button>

      {/* Icon picker */}
      <div style={{ position: 'relative' }}>
        <button className={`btn-icon ${showIconPicker ? 'active' : ''}`} title="Insert Icon" onClick={() => setShowIconPicker(v => !v)} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>&#9733;</span> Icon
        </button>
        {showIconPicker && (
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 8, zIndex: 1000, width: 240,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <input
              type="text" placeholder="Search icons..." value={iconSearch}
              onChange={e => setIconSearch(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, maxHeight: 180, overflow: 'auto' }}>
              {['Star', 'Heart', 'Check', 'X', 'AlertTriangle', 'Info', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
                'Zap', 'Target', 'Award', 'BookOpen', 'Briefcase', 'Calendar', 'Camera', 'Cloud', 'Coffee', 'Cpu',
                'Database', 'Eye', 'Flag', 'Globe', 'Home', 'Key', 'Layers', 'Lock', 'Mail', 'Map',
                'MessageCircle', 'Monitor', 'Moon', 'Music', 'Phone', 'Play', 'Search', 'Settings', 'Shield', 'Sun',
                'ThumbsUp', 'ThumbsDown', 'Trash2', 'TrendingUp', 'TrendingDown', 'User', 'Users', 'Wifi', 'Wrench', 'Lightbulb',
                'Rocket', 'Clock', 'Gift', 'Link', 'Clipboard', 'FileText', 'Folder', 'Image', 'PieChart', 'BarChart3',
              ].filter(name => !iconSearch || name.toLowerCase().includes(iconSearch.toLowerCase()))
                .map(name => (
                  <button
                    key={name}
                    title={name}
                    style={{ padding: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'var(--text-primary)', textAlign: 'center' }}
                    onClick={() => { onAddIcon?.(name); setShowIconPicker(false); setIconSearch('') }}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>

      <label className="btn-icon" title="Upload Video (MP4)" style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <Video size={14} /> Video
        <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" style={{ display: 'none' }} onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return; e.target.value = ''
          if (onAddVideoUpload) onAddVideoUpload(f)
          else { const fd = new FormData(); fd.append('file', f); const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json()); if (res.url) onAddVideo?.(res.url) }
        }} />
      </label>
      <label className="btn-icon" title="Upload Audio" style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <Music size={14} /> Audio
        <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return; e.target.value = ''
          const fd = new FormData(); fd.append('file', f)
          const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json())
          if (res.url) onAddAudio?.(res.url)
        }} />
      </label>
      <button className="btn-icon" title="Add Table" onClick={() => {
        const r = parseInt(window.prompt('Rows:', '3') || '3')
        const c = parseInt(window.prompt('Columns:', '3') || '3')
        if (r && c) onAddTable?.(r, c)
      }} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        <Table2 size={14} /> Table
      </button>
      <button className="btn-icon" title="Add Manim animation — renders Python/Manim scene to video" onClick={onAddManim} style={{ width: 'auto', padding: '0 8px', fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}>
        🎬 Manim
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

      {/* Slide Background popup */}
      {slide && onUpdateSlide && (() => {
        const bg = slide.background || { type: 'color', color: '#1e1e2e' }
        const bgType = bg.type || 'color'
        const setBgType = (type) => onUpdateSlide({ background: { ...bg, type } })
        const setBgColor = (color) => onUpdateSlide({ background: { ...bg, type: 'color', color } })
        const setBgGradient = (gradient) => onUpdateSlide({ background: { ...bg, type: 'gradient', gradient } })
        const setBgImage = (image) => onUpdateSlide({ background: { ...bg, type: 'image', image, size: bg.size || 'cover', position: bg.position || 'center' } })
        return (
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${showBgMenu ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              title="Slide Background"
              onClick={() => setShowBgMenu(v => !v)}
            >
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.3)',
                ...(bgType === 'color' ? { backgroundColor: bg.color || '#1e1e2e' } :
                    bgType === 'gradient' ? { background: bg.gradient || '#1e1e2e' } :
                    bgType === 'image' ? { backgroundImage: `url(${bg.image})`, backgroundSize: 'cover' } :
                    { backgroundColor: '#1e1e2e' })
              }} />
              BG
            </button>
            {showBgMenu && (
              <div
                className="bg-popup-container"
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 12, zIndex: 1000,
                  width: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Slide Background</div>
                <div className="bg-type-tabs" style={{ marginBottom: 8 }}>
                  {['color', 'gradient', 'image', 'none'].map(type => (
                    <button key={type} className={`bg-type-tab ${bgType === type ? 'active' : ''}`}
                      onClick={() => setBgType(type)}
                    >{type.charAt(0).toUpperCase() + type.slice(1)}</button>
                  ))}
                </div>

                {bgType === 'color' && (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input type="color" value={bg.color || '#1e1e2e'} onChange={e => setBgColor(e.target.value)}
                        style={{ width: 32, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-card)', cursor: 'pointer', padding: 1 }} />
                      <input className="prop-input" type="text" value={bg.color || '#1e1e2e'} onChange={e => setBgColor(e.target.value)}
                        style={{ flex: 1, fontSize: 12, padding: '4px 6px' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                      {COLOR_SWATCHES_BG.map(color => (
                        <div key={color} onClick={() => setBgColor(color)} title={color}
                          style={{
                            width: '100%', aspectRatio: '1', borderRadius: 4, cursor: 'pointer',
                            backgroundColor: color,
                            border: bg.color === color ? '2px solid white' : color === '#ffffff' || color === '#f8f9fa' ? '1px solid var(--border)' : '1px solid transparent',
                          }} />
                      ))}
                    </div>
                  </>
                )}

                {bgType === 'gradient' && (
                  <>
                    <div style={{ height: 32, borderRadius: 4, background: bg.gradient || 'linear-gradient(135deg, #1e1e2e, #4a0e8f)', marginBottom: 8, border: '1px solid var(--border)' }} />
                    <input className="prop-input" type="text" value={bg.gradient || ''} onChange={e => setBgGradient(e.target.value)}
                      placeholder="linear-gradient(...)" style={{ marginBottom: 8, fontSize: 11, padding: '4px 6px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {GRADIENT_PRESETS_BG.map((preset, i) => (
                        <button key={i} onClick={() => setBgGradient(preset)}
                          style={{ height: 24, borderRadius: 4, background: preset, cursor: 'pointer',
                            border: bg.gradient === preset ? '2px solid white' : '1px solid var(--border)' }}
                          title={preset} />
                      ))}
                    </div>
                  </>
                )}

                {bgType === 'image' && (
                  <>
                    {bg.image && (
                      <div style={{ height: 60, borderRadius: 4, backgroundImage: `url(${bg.image})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: 8, border: '1px solid var(--border)' }} />
                    )}
                    <input className="prop-input" type="text" value={bg.image || ''} onChange={e => setBgImage(e.target.value)}
                      placeholder="https://example.com/image.jpg" style={{ marginBottom: 6, fontSize: 11, padding: '4px 6px' }} />
                    <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 6, fontSize: 11, padding: '4px 8px' }}
                      onClick={() => bgFileRef.current?.click()} disabled={uploading}
                    >
                      <Upload size={12} />
                      {uploading ? 'Uploading...' : 'Upload Image'}
                    </button>
                    <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return
                        setUploading(true)
                        try { const res = await api.uploadFile(file); if (res.url) setBgImage(res.url) }
                        catch(err) { console.error('Upload failed', err) }
                        finally { setUploading(false); if (bgFileRef.current) bgFileRef.current.value = '' }
                      }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Size</div>
                        <select className="prop-input" value={bg.size || 'cover'} onChange={e => onUpdateSlide({ background: { ...bg, size: e.target.value } })} style={{ padding: '3px 4px', fontSize: 11 }}>
                          <option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Auto</option><option value="100% 100%">Stretch</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Position</div>
                        <select className="prop-input" value={bg.position || 'center'} onChange={e => onUpdateSlide({ background: { ...bg, position: e.target.value } })} style={{ padding: '3px 4px', fontSize: 11 }}>
                          <option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {bgType === 'none' && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No background (uses theme default)</p>
                )}
              </div>
            )}
          </div>
        )
      })()}

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

      {/* Smart guides toggle */}
      <button
        className={`btn-icon ${smartGuidesEnabled ? 'active' : ''}`}
        onClick={onToggleSmartGuides}
        title={smartGuidesEnabled ? 'Disable smart guides' : 'Enable smart guides'}
      >
        <Magnet size={14} />
      </button>

      {/* Ruler / guide toggle */}
      <button
        className={`btn-icon ${showRulers ? 'active' : ''}`}
        onClick={onToggleRulers}
        title={showRulers ? 'Hide rulers & guides' : 'Show rulers — drag from ruler to add custom guides'}
      >
        <Ruler size={14} />
      </button>

      {/* Custom guide manager */}
      {showRulers && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-hover)', borderRadius: 5, padding: '2px 5px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => onAddGuide?.({ axis: 'y', position: 270 })}
            title="Add horizontal guide"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22d3ee', fontWeight: 700, fontSize: 11, padding: '1px 4px', borderRadius: 3, lineHeight: 1 }}
          >+H</button>
          <button
            onClick={() => onAddGuide?.({ axis: 'x', position: 480 })}
            title="Add vertical guide"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22d3ee', fontWeight: 700, fontSize: 11, padding: '1px 4px', borderRadius: 3, lineHeight: 1 }}
          >+V</button>
          {guides.length > 0 && (
            <>
              <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
              {guides.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#22d3ee', fontWeight: 700, minWidth: 10 }}>{g.axis === 'x' ? 'V' : 'H'}</span>
                  <input
                    type="number" min="0" max={g.axis === 'x' ? 960 : 540}
                    value={g.position}
                    onChange={e => onUpdateGuide?.(i, Math.max(0, Math.min(g.axis === 'x' ? 960 : 540, Number(e.target.value) || 0)))}
                    style={{ width: 40, padding: '1px 4px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, fontSize: 11, textAlign: 'center' }}
                  />
                  <button
                    onClick={() => onRemoveGuide?.(i)}
                    title="Remove guide"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </>
          )}
        </div>
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
          <span className="toolbar-divider" />
          <button className="btn-icon" title="Group selected elements" onClick={onGroupElements} style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}>
            <Group size={13} />
          </button>
          <button className="btn-icon" title="Ungroup elements" onClick={onUngroupElements} style={{ width: 'auto', padding: '0 6px', fontSize: 11 }}>
            <Ungroup size={13} />
          </button>
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
              <option value="'Istok Web', sans-serif">Istok Web</option>
              <option value="'Didact Gothic', sans-serif">Didact Gothic</option>
              <option value="Questrial, sans-serif">Questrial</option>
              <option value="Barlow, sans-serif">Barlow</option>
              <option value="'Computer Modern Sans', sans-serif">Computer Modern Sans</option>
              <option value="'Humanist 777 BT', 'Gill Sans', 'Gill Sans MT', Calibri, sans-serif">Humanist 777</option>
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

          {/* Font Weight */}
          <select
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: 80, cursor: 'pointer' }}
            value={editor.getAttributes('textStyle').fontWeight || ''}
            onChange={e => e.target.value ? editor.chain().focus().setFontWeight(e.target.value).run() : editor.chain().focus().unsetFontWeight().run()}
            title="Font weight"
          >
            <option value="">Weight</option>
            <option value="100">100 Thin</option>
            <option value="200">200 XLight</option>
            <option value="300">300 Light</option>
            <option value="400">400 Regular</option>
            <option value="500">500 Medium</option>
            <option value="600">600 SemiBold</option>
            <option value="700">700 Bold</option>
            <option value="800">800 ExtraBold</option>
            <option value="900">900 Black</option>
          </select>

          {/* Line Height */}
          <select
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '3px 6px', borderRadius: 4, fontSize: 12, width: 72, cursor: 'pointer' }}
            value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || ''}
            onChange={e => e.target.value ? editor.chain().focus().setLineHeight(e.target.value).run() : editor.chain().focus().unsetLineHeight().run()}
            title="Line spacing"
          >
            <option value="">Spacing</option>
            <option value="0.7">0.7</option>
            <option value="0.75">0.75</option>
            <option value="0.8">0.8</option>
            <option value="0.85">0.85</option>
            <option value="0.9">0.9</option>
            <option value="0.95">0.95</option>
            <option value="1">1</option>
            <option value="1.15">1.15</option>
            <option value="1.25">1.25</option>
            <option value="1.5">1.5</option>
            <option value="1.75">1.75</option>
            <option value="2">2</option>
            <option value="2.5">2.5</option>
            <option value="3">3</option>
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

          {/* Highlight color palette */}
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-icon ${showHighlightPalette ? 'active' : ''}`}
              style={{ position: 'relative' }}
              onClick={() => setShowHighlightPalette(v => !v)}
              title="Highlight color"
            >
              <Highlighter size={15} />
              <span className="color-indicator" style={{ background: editor.getAttributes('highlight').color || 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} />
            </button>
            {showHighlightPalette && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  display: 'grid', gridTemplateColumns: 'repeat(6, 26px)', gap: 3,
                }}
              >
                {[
                  '#fef08a','#fde047','#facc15',
                  '#bbf7d0','#86efac','#4ade80',
                  '#bfdbfe','#93c5fd','#60a5fa',
                  '#fbcfe8','#f9a8d4','#f472b6',
                  '#fed7aa','#fdba74','#fb923c',
                  '#e9d5ff','#d8b4fe','#c084fc',
                  '#fecaca','#fca5a5','#f87171',
                  '#e2e8f0','#94a3b8','#64748b',
                ].map(color => (
                  <button
                    key={color}
                    title={color}
                    style={{
                      width: 26, height: 26, background: color, padding: 0,
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: 4, cursor: 'pointer',
                    }}
                    onMouseDown={e => {
                      e.preventDefault()
                      editor.chain().focus().setHighlight({ color }).run()
                      setShowHighlightPalette(false)
                    }}
                  />
                ))}
                <button
                  title="Remove highlight"
                  style={{
                    gridColumn: '1 / -1', padding: '4px 8px', marginTop: 4,
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                    borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: 11, textAlign: 'center',
                  }}
                  onMouseDown={e => {
                    e.preventDefault()
                    editor.chain().focus().unsetHighlight().run()
                    setShowHighlightPalette(false)
                  }}
                >
                  Remove highlight
                </button>
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

      {/* PDF page picker modal */}
      {pdfModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onKeyDown={e => { if (e.key === 'Escape') setPdfModal(null) }}
        >
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '80vw', maxWidth: 960, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Select PDF Pages to Insert</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pdfModal.pages.length} page{pdfModal.pages.length !== 1 ? 's' : ''} — click to select</span>
            </div>
            <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, flex: 1 }}>
              {pdfModal.pages.map(({ canvas, num }) => {
                const isSelected = pdfModal.selected.has(num)
                return (
                  <div
                    key={num}
                    onClick={() => setPdfModal(prev => {
                      const s = new Set(prev.selected)
                      s.has(num) ? s.delete(num) : s.add(num)
                      return { ...prev, selected: s }
                    })}
                    style={{ cursor: 'pointer', border: `2px solid ${isSelected ? '#6366f1' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden', position: 'relative', flexShrink: 0 }}
                  >
                    <img src={canvas.toDataURL()} alt={`Page ${num}`} style={{ display: 'block', width: 160, height: 'auto' }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>
                      {num}
                    </div>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700 }}>✓</div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setPdfModal(null)}>Cancel</button>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setPdfModal(prev => ({ ...prev, selected: new Set(prev.pages.map(p => p.num)) }))}>Select All</button>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={insertPdfPages} disabled={pdfModal.selected.size === 0}>
                Insert {pdfModal.selected.size > 0 ? `${pdfModal.selected.size} Page${pdfModal.selected.size !== 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
