// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Copy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react'
import { shapeSvgString } from '../utils/shapeUtils'
import { pointsToPath } from '../utils/drawingUtils'

const THUMB_W = 150

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || '#1e1e2e' }
  if (bg.type === 'image' && bg.image) return { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }
  return { backgroundColor: '#1e1e2e' }
}

function SlideThumbnail({ slide, slideW, slideH }) {
  const scale = THUMB_W / slideW
  const thumbH = Math.round(THUMB_W * slideH / slideW)

  return (
    <div style={{ width: THUMB_W, height: thumbH, overflow: 'hidden', position: 'relative', flexShrink: 0, borderRadius: 3 }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: slideW, height: slideH,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        pointerEvents: 'none',
        ...getBgStyle(slide.background),
      }}>
        {(slide.elements || [])
          .slice()
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map(el => (
            <div key={el.id} style={{
              position: 'absolute',
              left: el.x, top: el.y,
              width: el.width, height: el.height,
              overflow: 'hidden',
              zIndex: el.zIndex || 1,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              boxShadow: (el.shadowBlur || el.shadowX || el.shadowY)
                ? `${el.shadowX||0}px ${el.shadowY||0}px ${el.shadowBlur||0}px ${el.shadowColor||'rgba(0,0,0,0.5)'}`
                : undefined,
            }}>
              {el.type === 'text' && (
                <div style={{ width: '100%', height: '100%', color: 'white', padding: '8px 12px', boxSizing: 'border-box', overflow: 'hidden' }}
                  dangerouslySetInnerHTML={{ __html: el.content || '' }} />
              )}
              {el.type === 'image' && (() => {
                const imgFilter = [
                  (el.filterBrightness != null && el.filterBrightness !== 100) ? `brightness(${el.filterBrightness}%)` : '',
                  (el.filterContrast   != null && el.filterContrast   !== 100) ? `contrast(${el.filterContrast}%)` : '',
                  el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
                ].filter(Boolean).join(' ') || undefined
                return (
                  <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: el.borderRadius || undefined }}>
                    <img
                      src={el.src} alt=""
                      style={el.imageW != null ? {
                        position: 'absolute',
                        left: el.imageOffsetX ?? 0,
                        top: el.imageOffsetY ?? 0,
                        width: el.imageW,
                        height: el.imageH,
                        objectFit: el.objectFit || 'contain',
                        display: 'block',
                        filter: imgFilter,
                      } : {
                        width: '100%', height: '100%',
                        objectFit: el.objectFit || 'contain',
                        display: 'block',
                        filter: imgFilter,
                      }}
                      draggable={false}
                    />
                  </div>
                )
              })()}
              {el.type === 'shape' && (
                <div style={{ width: '100%', height: '100%', position: 'relative', opacity: el.opacity ?? 1 }}
                  dangerouslySetInnerHTML={{ __html: shapeSvgString(el) }} />
              )}
              {el.type === 'drawing' && (
                <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                  {(el.paths || []).map((path, pi) => (
                    <path key={pi}
                      d={pointsToPath(path.points, el.smooth !== false)}
                      stroke={path.color || '#ffffff'}
                      strokeWidth={path.strokeWidth || 3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={path.opacity ?? 1}
                    />
                  ))}
                </svg>
              )}
              {el.type === 'manim' && (
                el.rendered
                  ? <video src={el.rendered} muted style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: el.height * 0.25 }}>🎬</div>
              )}
              {el.type === 'video' && (
                el.poster
                  ? <img src={el.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
                  : <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: el.height * 0.4 }}>▶</div>
              )}
              {(el.type === 'html' || el.type === 'code' || el.type === 'latex' || el.type === 'markdown' || el.type === 'chart' || el.type === 'audio' || el.type === 'table' || el.type === 'icon' || el.type === 'callout' || el.type === 'p5') && (
                <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: el.height * 0.25 }}>
                  { el.type === 'code' ? '</>' : el.type === 'latex' ? 'TeX' : el.type === 'chart' ? '▦' : el.type === 'table' ? '⊞' : el.type === 'audio' ? '♪' : el.type === 'callout' ? el.calloutNumber || '●' : el.type === 'icon' ? '★' : el.type === 'p5' ? 'p5' : 'MD' }
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

// Group flat slides array by column, returning sorted column data
function buildColumns(slides) {
  const is2D = slides.some(s => s.column !== undefined)
  if (!is2D) {
    // 1D mode: each slide is its own "column" of one
    return slides.map((slide, i) => ({ colNum: i, items: [{ slide, flatIndex: i }] }))
  }
  const colMap = {}
  slides.forEach((slide, i) => {
    const c = slide.column ?? 0
    if (!colMap[c]) colMap[c] = []
    colMap[c].push({ slide, flatIndex: i })
  })
  const sortedKeys = Object.keys(colMap).map(Number).sort((a, b) => a - b)
  return sortedKeys.map(k => ({ colNum: k, items: colMap[k] }))
}

export default function SlidePanel({ slides, currentIndex, onSelect, onAdd, onAddColumn, onDelete, onDuplicate, onMove, onMoveInColumn, onMoveToColumn, slideW = 960, slideH = 540 }) {
  const [dragOverInfo, setDragOverInfo] = useState(null) // { flatIndex, colNum }
  const dragSrcRef = useRef(null)
  const listRef = useRef(null)
  const itemRefs = useRef([])

  const columns = useMemo(() => buildColumns(slides), [slides])
  const is2D = slides.some(s => s.column !== undefined)

  useEffect(() => {
    itemRefs.current[currentIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIndex])

  const currentColNum = slides[currentIndex]?.column ?? (is2D ? 0 : currentIndex)
  const currentColIdx = columns.findIndex(c => c.colNum === currentColNum)

  function handleKeyDown(e) {
    if (is2D) {
      const currentCol = columns[currentColIdx]
      const rowIdx = currentCol ? currentCol.items.findIndex(it => it.flatIndex === currentIndex) : -1
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentCol && rowIdx < currentCol.items.length - 1)
          onSelect(currentCol.items[rowIdx + 1].flatIndex)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentCol && rowIdx > 0)
          onSelect(currentCol.items[rowIdx - 1].flatIndex)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (currentColIdx < columns.length - 1)
          onSelect(columns[currentColIdx + 1].items[0].flatIndex)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (currentColIdx > 0)
          onSelect(columns[currentColIdx - 1].items[0].flatIndex)
      }
    } else {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentIndex < slides.length - 1) onSelect(currentIndex + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentIndex > 0) onSelect(currentIndex - 1)
      }
    }
  }

  if (!is2D) {
    // ── 1D layout (original) ──────────────────────────────────────────────────
    return (
      <div className="slide-panel">
        <div className="slide-panel-header">
          <span>Slides</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{slides.length}</span>
        </div>

        <div
          className="slide-list"
          ref={listRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{ outline: 'none' }}
        >
          {slides.map((slide, index) => {
            const gid = slide.slideGroup
            const prevSameGroup = gid && index > 0 && slides[index - 1].slideGroup === gid
            const nextSameGroup = gid && index < slides.length - 1 && slides[index + 1].slideGroup === gid
            const isGrouped = prevSameGroup || nextSameGroup
            return (
            <div
              key={slide.id || index}
              ref={el => { itemRefs.current[index] = el }}
              className={`slide-item ${index === currentIndex ? 'active' : ''}`}
              style={{
                ...(dragOverInfo?.flatIndex === index ? { outline: '2px solid var(--accent)', outlineOffset: '-2px' } : undefined),
                ...(isGrouped ? { marginTop: prevSameGroup ? 1 : undefined, marginBottom: nextSameGroup ? 1 : undefined } : undefined),
              }}
              draggable
              onDragStart={() => { dragSrcRef.current = { flatIndex: index } }}
              onDragOver={e => { e.preventDefault(); setDragOverInfo({ flatIndex: index }) }}
              onDragLeave={() => setDragOverInfo(null)}
              onDrop={e => {
                e.preventDefault()
                setDragOverInfo(null)
                const src = dragSrcRef.current
                if (src && src.flatIndex !== index) onMove(src.flatIndex, index)
                dragSrcRef.current = null
              }}
              onDragEnd={() => { setDragOverInfo(null); dragSrcRef.current = null }}
              onClick={() => { onSelect(index); listRef.current?.focus() }}
            >
              {isGrouped && (
                <div style={{ position: 'absolute', left: 0, top: prevSameGroup ? -1 : '50%', bottom: nextSameGroup ? -1 : '50%', width: 3, background: 'var(--accent)', borderRadius: prevSameGroup && nextSameGroup ? 0 : prevSameGroup ? '0 0 2px 2px' : '2px 2px 0 0', zIndex: 15 }} />
              )}
              <span className="slide-number">{index + 1}</span>
              <SlideThumbnail slide={slide} slideW={slideW} slideH={slideH} />
              {slide.autoAnimate && (
                <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 7, color: '#fff', background: 'rgba(99,102,241,0.85)', padding: '1px 4px', borderRadius: 2, zIndex: 10, fontWeight: 600 }}>M</div>
              )}
              {slide.section && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 8, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.55)', padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 10 }}>
                  {slide.section}
                </div>
              )}
              <button className="slide-copy-btn" title="Duplicate slide" onClick={e => { e.stopPropagation(); onDuplicate(index) }}><Copy size={10} /></button>
              <div className="slide-actions">
                <button className="slide-action-btn" title="Move up" onClick={e => { e.stopPropagation(); onMove(index, index - 1) }} disabled={index === 0}><ArrowUp size={10} /></button>
                <button className="slide-action-btn" title="Move down" onClick={e => { e.stopPropagation(); onMove(index, index + 1) }} disabled={index === slides.length - 1}><ArrowDown size={10} /></button>
                <button className="slide-action-btn" title="Delete" onClick={e => { e.stopPropagation(); if (slides.length > 1) onDelete(index) }} style={{ color: slides.length > 1 ? 'white' : 'rgba(255,255,255,0.3)' }}><Trash2 size={10} /></button>
              </div>
            </div>
            )
          })}
        </div>

        <div className="slide-panel-footer" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="add-slide-btn" onClick={() => onAdd(null)}>
            <Plus size={14} />
            Add Slide
          </button>
          <button className="add-slide-btn" onClick={onAddColumn} title="Start a 2D vertical column" style={{ fontSize: 11 }}>
            <Plus size={12} />
            Add Column
          </button>
        </div>
      </div>
    )
  }

  // ── 2D layout ──────────────────────────────────────────────────────────────
  return (
    <div className="slide-panel" style={{ width: Math.min(columns.length * (THUMB_W + 28) + 20, 480), maxWidth: '45vw', minWidth: 200 }}>
      <div className="slide-panel-header">
        <span>Slides</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{columns.length} col · {slides.length}</span>
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 4, overflowX: 'auto', overflowY: 'hidden', padding: '6px 4px', outline: 'none' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {columns.map(({ colNum, items }, colDisplayIdx) => (
          <div
            key={colNum}
            style={{ minWidth: THUMB_W + 20, maxWidth: THUMB_W + 20, display: 'flex', flexDirection: 'column', flexShrink: 0 }}
          >
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', marginBottom: 4, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Col {colDisplayIdx + 1}
              </span>
              <div style={{ display: 'flex', gap: 1 }}>
                {colDisplayIdx > 0 && (
                  <button
                    className="slide-action-btn"
                    title="Move column left"
                    style={{ background: 'transparent', padding: 2, opacity: 0.7 }}
                    onClick={() => {
                      const prevCol = columns[colDisplayIdx - 1]
                      // Swap column numbers of the two columns
                      const tempNum = prevCol.colNum
                      const updates = new Map()
                      items.forEach(({ flatIndex }) => updates.set(flatIndex, colNum === 0 ? tempNum : colNum - 1))
                      prevCol.items.forEach(({ flatIndex }) => updates.set(flatIndex, colDisplayIdx))
                      // Use onMoveToColumn for each
                      items.forEach(({ flatIndex }) => onMoveToColumn(flatIndex, prevCol.colNum))
                      prevCol.items.forEach(({ flatIndex }) => onMoveToColumn(flatIndex, colNum))
                    }}
                  >
                    <ArrowLeft size={9} />
                  </button>
                )}
                {colDisplayIdx < columns.length - 1 && (
                  <button
                    className="slide-action-btn"
                    title="Move column right"
                    style={{ background: 'transparent', padding: 2, opacity: 0.7 }}
                    onClick={() => {
                      const nextCol = columns[colDisplayIdx + 1]
                      items.forEach(({ flatIndex }) => onMoveToColumn(flatIndex, nextCol.colNum))
                      nextCol.items.forEach(({ flatIndex }) => onMoveToColumn(flatIndex, colNum))
                    }}
                  >
                    <ArrowRight size={9} />
                  </button>
                )}
              </div>
            </div>

            {/* Slides in this column */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map(({ slide, flatIndex }, rowIdx) => (
                <div
                  key={slide.id || flatIndex}
                  ref={el => { itemRefs.current[flatIndex] = el }}
                  className={`slide-item ${flatIndex === currentIndex ? 'active' : ''}`}
                  style={dragOverInfo?.flatIndex === flatIndex ? { outline: '2px solid var(--accent)', outlineOffset: '-2px' } : undefined}
                  draggable
                  onDragStart={() => { dragSrcRef.current = { flatIndex, colNum } }}
                  onDragOver={e => { e.preventDefault(); setDragOverInfo({ flatIndex, colNum }) }}
                  onDragLeave={() => setDragOverInfo(null)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOverInfo(null)
                    const src = dragSrcRef.current
                    if (!src || src.flatIndex === flatIndex) { dragSrcRef.current = null; return }
                    if (src.colNum === colNum) {
                      // Same column: reorder rows
                      onMove(src.flatIndex, flatIndex)
                    } else {
                      // Different column: move to this column
                      onMoveToColumn(src.flatIndex, colNum)
                    }
                    dragSrcRef.current = null
                  }}
                  onDragEnd={() => { setDragOverInfo(null); dragSrcRef.current = null }}
                  onClick={() => onSelect(flatIndex)}
                >
                  <span className="slide-number">{flatIndex + 1}</span>
                  <SlideThumbnail slide={slide} slideW={slideW} slideH={slideH} />
                  {slide.autoAnimate && (
                    <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 7, color: '#fff', background: 'rgba(99,102,241,0.85)', padding: '1px 4px', borderRadius: 2, zIndex: 10, fontWeight: 600 }}>M</div>
                  )}
                  {slide.section && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 8, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.55)', padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 10 }}>
                      {slide.section}
                    </div>
                  )}
                  <button className="slide-copy-btn" title="Duplicate slide" onClick={e => { e.stopPropagation(); onDuplicate(flatIndex) }}><Copy size={9} /></button>

                  <div className="slide-actions" style={{ flexWrap: 'wrap', maxWidth: 76 }}>
                    <button className="slide-action-btn" title="Move up in column" onClick={e => { e.stopPropagation(); onMoveInColumn(flatIndex, -1) }} disabled={rowIdx === 0}><ArrowUp size={9} /></button>
                    <button className="slide-action-btn" title="Move down in column" onClick={e => { e.stopPropagation(); onMoveInColumn(flatIndex, 1) }} disabled={rowIdx === items.length - 1}><ArrowDown size={9} /></button>
                    {colDisplayIdx > 0 && (
                      <button className="slide-action-btn" title="Move to previous column" onClick={e => { e.stopPropagation(); onMoveToColumn(flatIndex, columns[colDisplayIdx - 1].colNum) }}><ArrowLeft size={9} /></button>
                    )}
                    {colDisplayIdx < columns.length - 1 && (
                      <button className="slide-action-btn" title="Move to next column" onClick={e => { e.stopPropagation(); onMoveToColumn(flatIndex, columns[colDisplayIdx + 1].colNum) }}><ArrowRight size={9} /></button>
                    )}
                    <button className="slide-action-btn" title="Delete" onClick={e => { e.stopPropagation(); if (slides.length > 1) onDelete(flatIndex) }} style={{ color: slides.length > 1 ? 'white' : 'rgba(255,255,255,0.3)' }}><Trash2 size={9} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add slide to this column */}
            <button
              className="add-slide-btn"
              style={{ marginTop: 4, fontSize: 10, padding: '5px 4px' }}
              onClick={() => onAdd(colNum)}
            >
              <Plus size={10} />
              Add
            </button>
          </div>
        ))}

        {/* Add new column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 28, flexShrink: 0 }}>
          <button
            className="add-slide-btn"
            style={{ fontSize: 10, padding: '6px 5px', width: 38, flexDirection: 'column', gap: 2 }}
            onClick={onAddColumn}
            title="Add a new column"
          >
            <Plus size={10} />
            <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: 9 }}>Col</span>
          </button>
        </div>
      </div>

      <div className="slide-panel-footer">
        <button className="add-slide-btn" style={{ fontSize: 11 }} onClick={() => onAdd(currentColNum)}>
          <Plus size={12} />
          Add to Col {currentColIdx + 1}
        </button>
      </div>
    </div>
  )
}
