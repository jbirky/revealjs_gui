// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useRef, useCallback } from 'react'

const SHAPE_TYPES = [
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'rounded', label: 'Rounded Rect', icon: '▢' },
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'diamond', label: 'Diamond', icon: '◇' },
]

const COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#ffffff', '#94a3b8']

function shapeCenter(s) {
  if (s.shape === 'circle') return { x: s.x + s.r, y: s.y + s.r }
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 }
}

function connectorEndpoint(shape, targetCenter) {
  const c = shapeCenter(shape)
  const dx = targetCenter.x - c.x
  const dy = targetCenter.y - c.y
  const angle = Math.atan2(dy, dx)

  if (shape.shape === 'circle') {
    return { x: c.x + shape.r * Math.cos(angle), y: c.y + shape.r * Math.sin(angle) }
  }
  if (shape.shape === 'diamond') {
    const hw = shape.w / 2, hh = shape.h / 2
    const ax = Math.abs(Math.cos(angle)), ay = Math.abs(Math.sin(angle))
    const t = Math.min(hw / (ax || 1), hh / (ay || 1))
    return { x: c.x + t * Math.cos(angle), y: c.y + t * Math.sin(angle) }
  }
  const hw = shape.w / 2, hh = shape.h / 2
  const ax = Math.abs(Math.cos(angle)), ay = Math.abs(Math.sin(angle))
  const t = Math.min(hw / (ax || 1), hh / (ay || 1))
  return { x: c.x + t * Math.cos(angle), y: c.y + t * Math.sin(angle) }
}

function renderShapeSVG(s) {
  const stroke = s.stroke || '#6366f1'
  const fill = s.fill || 'rgba(99,102,241,0.15)'
  const sw = 2
  if (s.shape === 'circle') {
    return `<ellipse cx="${s.x + s.r}" cy="${s.y + s.r}" rx="${s.r}" ry="${s.r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
  }
  if (s.shape === 'diamond') {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2
    const pts = `${cx},${s.y} ${s.x + s.w},${cy} ${cx},${s.y + s.h} ${s.x},${cy}`
    return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
  }
  if (s.shape === 'rounded') {
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
  }
  return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
}

function renderTextSVG(s) {
  if (!s.text) return ''
  const c = shapeCenter(s)
  return `<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,sans-serif" font-size="13" fill="${s.textColor || '#e2e8f0'}">${escSvg(s.text)}</text>`
}

function escSvg(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

export default function DiagramModal({ onInsert, onClose, slideW = 960, slideH = 540 }) {
  const [shapes, setShapes] = useState([])
  const [arrows, setArrows] = useState([])
  const [tool, setTool] = useState('select') // select | rect | rounded | circle | diamond | arrow
  const [selected, setSelected] = useState(null)
  const [arrowFrom, setArrowFrom] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [editingText, setEditingText] = useState(null)
  const [fillColor, setFillColor] = useState('rgba(99,102,241,0.15)')
  const [strokeColor, setStrokeColor] = useState('#6366f1')
  const svgRef = useRef(null)
  const nextId = useRef(1)

  const W = 800, H = 500

  function svgPoint(e) {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleCanvasClick(e) {
    if (e.target !== svgRef.current && e.target.tagName !== 'svg') return
    const pt = svgPoint(e)

    if (SHAPE_TYPES.some(s => s.id === tool)) {
      const id = nextId.current++
      const w = 120, h = 60
      const newShape = tool === 'circle'
        ? { id, shape: 'circle', x: pt.x - 35, y: pt.y - 35, r: 35, text: '', fill: fillColor, stroke: strokeColor, textColor: '#e2e8f0' }
        : { id, shape: tool, x: pt.x - w / 2, y: pt.y - h / 2, w, h, text: '', fill: fillColor, stroke: strokeColor, textColor: '#e2e8f0' }
      setShapes(prev => [...prev, newShape])
      setSelected(id)
      setTool('select')
      return
    }

    setSelected(null)
    setArrowFrom(null)
  }

  function handleShapeClick(e, shape) {
    e.stopPropagation()
    if (tool === 'arrow') {
      if (!arrowFrom) {
        setArrowFrom(shape.id)
      } else if (arrowFrom !== shape.id) {
        setArrows(prev => [...prev, { from: arrowFrom, to: shape.id }])
        setArrowFrom(null)
        setTool('select')
      }
      return
    }
    setSelected(shape.id)
  }

  function handleShapeDoubleClick(e, shape) {
    e.stopPropagation()
    setEditingText(shape.id)
  }

  const handleMouseDown = useCallback((e, shape) => {
    if (tool !== 'select') return
    e.stopPropagation()
    const pt = svgPoint(e)
    setDragging({ id: shape.id, offsetX: pt.x - shape.x, offsetY: pt.y - shape.y })
    setSelected(shape.id)
  }, [tool])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const pt = svgPoint(e)
    setShapes(prev => prev.map(s => s.id === dragging.id
      ? { ...s, x: pt.x - dragging.offsetX, y: pt.y - dragging.offsetY }
      : s
    ))
  }, [dragging])

  const handleMouseUp = useCallback(() => { setDragging(null) }, [])

  function deleteSelected() {
    if (!selected) return
    setArrows(prev => prev.filter(a => a.from !== selected && a.to !== selected))
    setShapes(prev => prev.filter(s => s.id !== selected))
    setSelected(null)
  }

  function updateSelected(patch) {
    setShapes(prev => prev.map(s => s.id === selected ? { ...s, ...patch } : s))
  }

  function exportSVG() {
    const svgParts = []
    svgParts.push(`<defs><marker id="ah" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8"/></marker></defs>`)

    arrows.forEach(a => {
      const fromShape = shapes.find(s => s.id === a.from)
      const toShape = shapes.find(s => s.id === a.to)
      if (!fromShape || !toShape) return
      const tc = shapeCenter(toShape)
      const fc = shapeCenter(fromShape)
      const p1 = connectorEndpoint(fromShape, tc)
      const p2 = connectorEndpoint(toShape, fc)
      svgParts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#94a3b8" stroke-width="2" marker-end="url(#ah)"/>`)
    })

    shapes.forEach(s => {
      svgParts.push(renderShapeSVG(s))
      svgParts.push(renderTextSVG(s))
    })

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:transparent">${svgParts.join('')}</svg>`
  }

  function handleInsert() {
    const svg = exportSVG()
    onInsert(svg)
  }

  const selectedShape = shapes.find(s => s.id === selected)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '90vw', maxWidth: 1100, height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Diagram Editor</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleInsert} disabled={shapes.length === 0}>Insert Diagram</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ width: 180, borderRight: '1px solid var(--border)', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools</div>
            <button onClick={() => { setTool('select'); setArrowFrom(null) }}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                background: tool === 'select' ? 'var(--accent)' : 'var(--bg-hover)', color: tool === 'select' ? 'white' : 'var(--text-primary)' }}>
              Select / Move
            </button>
            {SHAPE_TYPES.map(st => (
              <button key={st.id} onClick={() => { setTool(st.id); setArrowFrom(null) }}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                  background: tool === st.id ? 'var(--accent)' : 'var(--bg-hover)', color: tool === st.id ? 'white' : 'var(--text-primary)' }}>
                <span style={{ fontSize: 16 }}>{st.icon}</span> {st.label}
              </button>
            ))}
            <button onClick={() => { setTool('arrow'); setArrowFrom(null) }}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
                background: tool === 'arrow' ? 'var(--accent)' : 'var(--bg-hover)', color: tool === 'arrow' ? 'white' : 'var(--text-primary)' }}>
              <span style={{ fontSize: 14 }}>&rarr;</span> Arrow
            </button>

            {tool === 'arrow' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px', background: 'rgba(99,102,241,0.08)', borderRadius: 4, lineHeight: 1.4 }}>
                {arrowFrom ? 'Click the target shape' : 'Click the source shape'}
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Style</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Fill</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button onClick={() => setFillColor('none')}
                  style={{ width: 20, height: 20, borderRadius: 3, border: fillColor === 'none' ? '2px solid var(--accent)' : '1px solid var(--border)', background: 'repeating-linear-gradient(45deg, var(--bg-hover), var(--bg-hover) 3px, transparent 3px, transparent 6px)', cursor: 'pointer' }} title="None" />
                {COLORS.map(c => (
                  <button key={c} onClick={() => setFillColor(c + '26')}
                    style={{ width: 20, height: 20, borderRadius: 3, border: fillColor.startsWith(c) ? '2px solid var(--accent)' : '1px solid var(--border)', background: c + '40', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Stroke</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setStrokeColor(c)}
                    style={{ width: 20, height: 20, borderRadius: 3, border: strokeColor === c ? '2px solid var(--accent)' : '1px solid var(--border)', background: c, cursor: 'pointer' }} />
                ))}
              </div>
            </div>

            {selectedShape && (<>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Label</div>
                <input className="prop-input" value={selectedShape.text || ''} onChange={e => updateSelected({ text: e.target.value })}
                  placeholder="Type label..." style={{ width: '100%', fontSize: 11, padding: '4px 6px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => updateSelected({ fill: fillColor, stroke: strokeColor })}
                  className="btn btn-secondary" style={{ flex: 1, fontSize: 10, padding: '3px 0', justifyContent: 'center' }}>
                  Apply colors
                </button>
                <button onClick={deleteSelected}
                  className="btn btn-danger" style={{ flex: 1, fontSize: 10, padding: '3px 0', justifyContent: 'center' }}>
                  Delete
                </button>
              </div>
            </>)}
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a', overflow: 'auto', padding: 16 }}>
            <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
              style={{ background: '#111122', borderRadius: 8, cursor: SHAPE_TYPES.some(s => s.id === tool) ? 'crosshair' : tool === 'arrow' ? 'pointer' : 'default' }}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Grid */}
              {Array.from({ length: Math.floor(W / 40) }, (_, i) => (
                <line key={`gv${i}`} x1={(i + 1) * 40} y1={0} x2={(i + 1) * 40} y2={H} stroke="rgba(255,255,255,0.04)" />
              ))}
              {Array.from({ length: Math.floor(H / 40) }, (_, i) => (
                <line key={`gh${i}`} x1={0} y1={(i + 1) * 40} x2={W} y2={(i + 1) * 40} stroke="rgba(255,255,255,0.04)" />
              ))}

              {/* Arrows */}
              {arrows.map((a, i) => {
                const fromShape = shapes.find(s => s.id === a.from)
                const toShape = shapes.find(s => s.id === a.to)
                if (!fromShape || !toShape) return null
                const tc = shapeCenter(toShape)
                const fc = shapeCenter(fromShape)
                const p1 = connectorEndpoint(fromShape, tc)
                const p2 = connectorEndpoint(toShape, fc)
                return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={2} markerEnd="url(#arrowhead)" />
              })}

              {/* Shapes */}
              {shapes.map(s => {
                const isSelected = selected === s.id
                const isArrowSource = arrowFrom === s.id
                return (
                  <g key={s.id}
                    onClick={e => handleShapeClick(e, s)}
                    onDoubleClick={e => handleShapeDoubleClick(e, s)}
                    onMouseDown={e => handleMouseDown(e, s)}
                    style={{ cursor: tool === 'select' ? 'move' : 'pointer' }}>
                    {s.shape === 'circle' ? (
                      <ellipse cx={s.x + s.r} cy={s.y + s.r} rx={s.r} ry={s.r}
                        fill={s.fill} stroke={isSelected || isArrowSource ? '#fff' : s.stroke} strokeWidth={isSelected ? 3 : 2} />
                    ) : s.shape === 'diamond' ? (
                      <polygon
                        points={`${s.x + s.w / 2},${s.y} ${s.x + s.w},${s.y + s.h / 2} ${s.x + s.w / 2},${s.y + s.h} ${s.x},${s.y + s.h / 2}`}
                        fill={s.fill} stroke={isSelected || isArrowSource ? '#fff' : s.stroke} strokeWidth={isSelected ? 3 : 2} />
                    ) : (
                      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.shape === 'rounded' ? 8 : 0}
                        fill={s.fill} stroke={isSelected || isArrowSource ? '#fff' : s.stroke} strokeWidth={isSelected ? 3 : 2} />
                    )}
                    {editingText === s.id ? (
                      <foreignObject x={s.shape === 'circle' ? s.x : s.x} y={s.shape === 'circle' ? s.y + s.r - 10 : s.y + (s.h / 2) - 10}
                        width={s.shape === 'circle' ? s.r * 2 : s.w} height={20}>
                        <input
                          autoFocus
                          value={s.text || ''}
                          onChange={e => setShapes(prev => prev.map(sh => sh.id === s.id ? { ...sh, text: e.target.value } : sh))}
                          onBlur={() => setEditingText(null)}
                          onKeyDown={e => { if (e.key === 'Enter') setEditingText(null) }}
                          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', textAlign: 'center', fontSize: 13, fontFamily: '-apple-system,sans-serif', padding: 0 }}
                        />
                      </foreignObject>
                    ) : (
                      <text x={shapeCenter(s).x} y={shapeCenter(s).y} textAnchor="middle" dominantBaseline="central"
                        fontSize={13} fill={s.textColor || '#e2e8f0'} fontFamily="-apple-system,sans-serif"
                        style={{ pointerEvents: 'none' }}>
                        {s.text || ''}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
