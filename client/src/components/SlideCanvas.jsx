import { useRef, useEffect, useState, useCallback } from 'react'
import { EditorContent } from '@tiptap/react'
import katex from 'katex'
import hljs from 'highlight.js'

function highlightCode(code, language) {
  try {
    if (language && language !== 'plaintext' && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

const SNAP_REF_OPTIONS = [
  { id: 'ul', label: 'Upper Left',   fx: 0,   fy: 0   },
  { id: 'uc', label: 'Upper Center', fx: 0.5, fy: 0   },
  { id: 'ur', label: 'Upper Right',  fx: 1,   fy: 0   },
  { id: 'ml', label: 'Middle Left',  fx: 0,   fy: 0.5 },
  { id: 'mc', label: 'Center',       fx: 0.5, fy: 0.5 },
  { id: 'mr', label: 'Middle Right', fx: 1,   fy: 0.5 },
  { id: 'll', label: 'Lower Left',   fx: 0,   fy: 1   },
  { id: 'lc', label: 'Lower Center', fx: 0.5, fy: 1   },
  { id: 'lr', label: 'Lower Right',  fx: 1,   fy: 1   },
]

function snapWithRef(rawX, rawY, w, h, ref, snapFn) {
  const opt = SNAP_REF_OPTIONS.find(o => o.id === ref) || SNAP_REF_OPTIONS[0]
  const refX = rawX + opt.fx * w
  const refY = rawY + opt.fy * h
  return {
    x: snapFn(refX) - opt.fx * w,
    y: snapFn(refY) - opt.fy * h,
  }
}

const SLIDE_W = 960
const SLIDE_H = 540
const MIN_SIZE = 40

const HANDLE_STYLES = {
  nw: { top: -5, left: -5, cursor: 'nw-resize' },
  n:  { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
  ne: { top: -5, right: -5, cursor: 'ne-resize' },
  e:  { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'e-resize' },
  se: { bottom: -5, right: -5, cursor: 'se-resize' },
  s:  { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
  sw: { bottom: -5, left: -5, cursor: 'sw-resize' },
  w:  { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'w-resize' },
}

// px/py are fractions (0 or 0.5 or 1) within the crop rect
const CROP_HANDLES = [
  { id: 'nw', px: 0,   py: 0,   cursor: 'nw-resize' },
  { id: 'n',  px: 0.5, py: 0,   cursor: 'n-resize'  },
  { id: 'ne', px: 1,   py: 0,   cursor: 'ne-resize' },
  { id: 'e',  px: 1,   py: 0.5, cursor: 'e-resize'  },
  { id: 'se', px: 1,   py: 1,   cursor: 'se-resize' },
  { id: 's',  px: 0.5, py: 1,   cursor: 's-resize'  },
  { id: 'sw', px: 0,   py: 1,   cursor: 'sw-resize' },
  { id: 'w',  px: 0,   py: 0.5, cursor: 'w-resize'  },
]

function applyResize(handle, startEl, dx, dy) {
  let { x, y, width, height } = startEl
  switch(handle) {
    case 'se': width = Math.max(MIN_SIZE, startEl.width + dx); height = Math.max(MIN_SIZE, startEl.height + dy); break
    case 'sw':
      x = startEl.x + dx; width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      height = Math.max(MIN_SIZE, startEl.height + dy); break
    case 'ne':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      y = startEl.y + dy; height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE; break
    case 'nw':
      x = startEl.x + dx; width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      y = startEl.y + dy; height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE; break
    case 'n':
      y = startEl.y + dy; height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE; break
    case 's': height = Math.max(MIN_SIZE, startEl.height + dy); break
    case 'e': width = Math.max(MIN_SIZE, startEl.width + dx); break
    case 'w':
      x = startEl.x + dx; width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE; break
  }
  return { x, y, width, height }
}

function applyCropHandle(handle, startCrop, dx, dy, elW, elH) {
  // dx/dy are in element-pixel space; convert to fractions
  const fdx = dx / elW
  const fdy = dy / elH
  let { x, y, w, h } = startCrop
  const MIN_CROP = 0.05
  switch(handle) {
    case 'nw': {
      const nx = Math.min(x + fdx, x + w - MIN_CROP)
      const ny = Math.min(y + fdy, y + h - MIN_CROP)
      w = w - (nx - x); h = h - (ny - y); x = nx; y = ny; break
    }
    case 'n': {
      const ny = Math.min(y + fdy, y + h - MIN_CROP)
      h = h - (ny - y); y = ny; break
    }
    case 'ne': {
      const ny = Math.min(y + fdy, y + h - MIN_CROP)
      h = h - (ny - y); y = ny
      w = Math.max(MIN_CROP, w + fdx); break
    }
    case 'e': w = Math.max(MIN_CROP, w + fdx); break
    case 'se': w = Math.max(MIN_CROP, w + fdx); h = Math.max(MIN_CROP, h + fdy); break
    case 's': h = Math.max(MIN_CROP, h + fdy); break
    case 'sw': {
      const nx = Math.min(x + fdx, x + w - MIN_CROP)
      w = w - (nx - x); x = nx
      h = Math.max(MIN_CROP, h + fdy); break
    }
    case 'w': {
      const nx = Math.min(x + fdx, x + w - MIN_CROP)
      w = w - (nx - x); x = nx; break
    }
  }
  // Clamp to [0, 1]
  x = Math.max(0, x); y = Math.max(0, y)
  w = Math.min(w, 1 - x); h = Math.min(h, 1 - y)
  return { x, y, w, h }
}

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || 'linear-gradient(135deg, #1e1e2e, #2d2d5e)' }
  if (bg.type === 'image' && bg.image) return { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }
  return { backgroundColor: '#1e1e2e' }
}

export default function SlideCanvas({ editor, slide, selectedElementIds, editingElementId, showGrid, gridSize = 40, showFooter, showPageNumbers, pageNumberFormat, pageNumber, totalSlides, sectionName, footerFontSize = 14, footerFontFamily = '-apple-system,sans-serif', footerColor = 'rgba(255,255,255,0.65)', onToggleSelectElement, onStartEdit, onStopEdit, onUpdateElement, onUpdateElements, onDeleteElement, onDeleteSelectedElements, onAddImage, onOpenHtmlEditor, onOpenCodeEditor }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const pendingDragRef = useRef(null)
  const draggingRef = useRef(null)
  const [, forceUpdate] = useState(0)
  const showGridRef = useRef(showGrid)
  const selectedElementIdsRef = useRef(selectedElementIds)
  const gridSizeRef = useRef(gridSize)
  const [contextMenu, setContextMenu] = useState(null) // { elementId, x, y }
  const [cropMode, setCropMode] = useState(null) // { elementId, x, y, w, h }
  const cropDragRef = useRef(null) // { handle, startX, startY, startCrop, elW, elH }
  const [dragOver, setDragOver] = useState(false)
  const scaleRef = useRef(scale)

  useEffect(() => { showGridRef.current = showGrid }, [showGrid])
  useEffect(() => { gridSizeRef.current = gridSize }, [gridSize])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { selectedElementIdsRef.current = selectedElementIds }, [selectedElementIds])

  // Scale to fit container
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const { clientWidth: w, clientHeight: h } = containerRef.current
      setScale(Math.max(Math.min((w - 24) / SLIDE_W, (h - 24) / SLIDE_H), 0.1))
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Global mouse move/up for element drag + crop drag
  useEffect(() => {
    const snap = (v) => showGridRef.current ? Math.round(v / gridSizeRef.current) * gridSizeRef.current : v

    const onMouseMove = (e) => {
      // Crop drag
      if (cropDragRef.current) {
        const cd = cropDragRef.current
        const dx = (e.clientX - cd.startX) / scaleRef.current
        const dy = (e.clientY - cd.startY) / scaleRef.current
        const newCrop = applyCropHandle(cd.handle, cd.startCrop, dx, dy, cd.elW, cd.elH)
        setCropMode(prev => prev ? { ...prev, ...newCrop } : prev)
        return
      }

      // Promote pending → active drag after 4px movement
      if (pendingDragRef.current && !draggingRef.current) {
        const px = pendingDragRef.current
        if (Math.abs(e.clientX - px.startClientX) + Math.abs(e.clientY - px.startClientY) > 4) {
          draggingRef.current = {
            type: px.type, handle: px.handle, elementId: px.elementId,
            startMouseX: px.startMouseX, startMouseY: px.startMouseY, startEl: px.startEl,
            startEls: px.startEls
          }
          forceUpdate(n => n + 1)
        }
      }
      const drag = draggingRef.current
      if (!drag || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left) / scaleRef.current
      const mouseY = (e.clientY - rect.top) / scaleRef.current
      const dx = mouseX - drag.startMouseX
      const dy = mouseY - drag.startMouseY
      if (drag.type === 'move') {
        if (drag.startEls && drag.startEls.length > 1) {
          const updates = drag.startEls.map(sel => ({
            id: sel.id,
            x: Math.max(0, Math.min(SLIDE_W - sel.width, sel.x + dx)),
            y: Math.max(0, Math.min(SLIDE_H - sel.height, sel.y + dy)),
          }))
          onUpdateElements(updates)
        } else {
          const rawX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, drag.startEl.x + dx))
          const rawY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, drag.startEl.y + dy))
          const { x: snappedX, y: snappedY } = snapWithRef(rawX, rawY, drag.startEl.width, drag.startEl.height, drag.startEl.snapRef || 'ul', snap)
          const newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, snappedX))
          const newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, snappedY))
          onUpdateElement(drag.elementId, { x: newX, y: newY })
        }
      } else if (drag.type === 'resize') {
        let updates = applyResize(drag.handle, drag.startEl, dx, dy)
        if (e.shiftKey) {
          const ratio = drag.startEl.width / drag.startEl.height
          if (['nw','ne','sw','se'].includes(drag.handle)) {
            if (Math.abs(updates.width - drag.startEl.width) >= Math.abs(updates.height - drag.startEl.height)) {
              updates.height = Math.max(MIN_SIZE, Math.round(updates.width / ratio))
              if (drag.handle === 'ne' || drag.handle === 'nw') updates.y = drag.startEl.y + drag.startEl.height - updates.height
            } else {
              updates.width = Math.max(MIN_SIZE, Math.round(updates.height * ratio))
              if (drag.handle === 'nw' || drag.handle === 'sw') updates.x = drag.startEl.x + drag.startEl.width - updates.width
            }
          }
        }
        updates.x = snap(Math.max(0, updates.x))
        updates.y = snap(Math.max(0, updates.y))
        updates.width = snap(Math.min(SLIDE_W - updates.x, updates.width))
        updates.height = snap(Math.min(SLIDE_H - updates.y, updates.height))
        updates.width = Math.max(MIN_SIZE, updates.width)
        updates.height = Math.max(MIN_SIZE, updates.height)
        onUpdateElement(drag.elementId, updates)
      }
    }
    const onMouseUp = () => {
      cropDragRef.current = null
      pendingDragRef.current = null
      draggingRef.current = null
      forceUpdate(n => n + 1)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onUpdateElement, onUpdateElements])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (cropMode) {
        if (e.key === 'Enter') { commitCrop(); e.preventDefault() }
        if (e.key === 'Escape') { setCropMode(null); e.preventDefault() }
        return
      }
      const tag = document.activeElement?.tagName
      if (editingElementId) {
        if (e.key === 'Escape') { onStopEdit(); e.preventDefault() }
        return
      }
      if (selectedElementIds.length > 0) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && tag !== 'INPUT' && tag !== 'TEXTAREA') {
          onDeleteSelectedElements(); e.preventDefault()
        }
        if (e.key === 'Escape') { onToggleSelectElement(null, false); e.preventDefault() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedElementIds, editingElementId, cropMode, onStopEdit, onToggleSelectElement, onDeleteSelectedElements])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const startElementDrag = (e, elementId, type, handle = null) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const element = slide?.elements?.find(el => el.id === elementId)
    if (!element) return
    const allSelected = (slide?.elements || []).filter(el => selectedElementIdsRef.current.includes(el.id))
    pendingDragRef.current = {
      type, handle, elementId,
      startClientX: e.clientX, startClientY: e.clientY,
      startMouseX: (e.clientX - rect.left) / scale,
      startMouseY: (e.clientY - rect.top) / scale,
      startEl: { x: element.x, y: element.y, width: element.width, height: element.height, snapRef: element.snapRef },
      startEls: allSelected.map(el => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }))
    }
  }

  const startCrop = (elementId) => {
    const element = slide?.elements?.find(el => el.id === elementId)
    if (!element) return
    // cropMode uses {x,y,w,h} as fractions of the CURRENT element box
    setCropMode({ elementId, x: 0, y: 0, w: 1, h: 1 })
    setContextMenu(null)
  }

  const commitCrop = useCallback(() => {
    if (!cropMode) return
    const element = slide?.elements?.find(el => el.id === cropMode.elementId)
    if (!element) return
    const { x: cx, y: cy, w: cw, h: ch } = cropMode

    // Pixel crop amounts relative to current element box
    const dx = Math.round(cx * element.width)
    const dy = Math.round(cy * element.height)
    const newW = Math.round(cw * element.width)
    const newH = Math.round(ch * element.height)

    // imageW/H = the absolute pixel size the image renders at (never changes after first crop)
    const imgW = element.imageW ?? element.width
    const imgH = element.imageH ?? element.height
    // imageOffsetX/Y = offset of image render origin relative to element top-left
    const offX = (element.imageOffsetX ?? 0) - dx
    const offY = (element.imageOffsetY ?? 0) - dy

    onUpdateElement(cropMode.elementId, {
      x: element.x + dx,
      y: element.y + dy,
      width: newW,
      height: newH,
      imageW: imgW,
      imageH: imgH,
      imageOffsetX: offX,
      imageOffsetY: offY,
      crop: null, // no longer used
    })
    setCropMode(null)
  }, [cropMode, slide, onUpdateElement])

  // File drop on canvas
  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length || !onAddImage) return
    // Get drop position in slide coordinates
    let dropX = 130, dropY = 100
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      dropX = Math.round((e.clientX - rect.left) / scale)
      dropY = Math.round((e.clientY - rect.top) / scale)
    }
    for (const file of files) {
      await onAddImage(file, dropX, dropY)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <div
        ref={canvasRef}
        className="slide-canvas"
        style={{
          width: SLIDE_W, height: SLIDE_H,
          transform: `scale(${scale})`, transformOrigin: 'center center',
          flexShrink: 0, position: 'relative', fontSize: '42px',
          outline: dragOver ? '3px dashed #6366f1' : 'none',
          ...getBgStyle(slide?.background)
        }}
        onClick={(e) => {
          if (cropMode) return
          if (e.target === canvasRef.current) { onToggleSelectElement(null, false); onStopEdit() }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Grid overlay */}
        {showGrid && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 998,
            backgroundImage: 'linear-gradient(to right, rgba(99,102,241,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.18) 1px, transparent 1px)',
            backgroundSize: `${gridSize}px ${gridSize}px`
          }} />
        )}

        {slide?.elements?.slice().sort((a,b) => (a.zIndex||0) - (b.zIndex||0)).map(element => (
          <CanvasElement
            key={element.id}
            element={element}
            isSelected={selectedElementIds.includes(element.id)}
            isEditing={editingElementId === element.id}
            isCropping={cropMode?.elementId === element.id}
            cropState={cropMode?.elementId === element.id ? cropMode : null}
            isDragging={draggingRef.current?.elementId === element.id}
            editor={editor}
            onPointerDown={(e, type, handle) => {
              if (cropMode) return
              if (editingElementId === element.id) return
              if (element.locked && type === 'move') return
              e.stopPropagation()
              onToggleSelectElement(element.id, e.shiftKey)
              startElementDrag(e, element.id, type, handle)
            }}
            onClick={(e) => { e.stopPropagation(); if (!cropMode) onToggleSelectElement(element.id, e.shiftKey) }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (element.type === 'text') onStartEdit(element.id)
              else if (element.type === 'html') onOpenHtmlEditor?.(element.id)
              else if (element.type === 'code') onOpenCodeEditor?.(element.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault(); e.stopPropagation()
              setContextMenu({ elementId: element.id, elementType: element.type, x: e.clientX, y: e.clientY })
            }}
            onStopEdit={onStopEdit}
            onCropHandleDown={(handle, clientX, clientY) => {
              const el = slide?.elements?.find(el => el.id === element.id)
              if (!el) return
              cropDragRef.current = {
                handle,
                startX: clientX,
                startY: clientY,
                startCrop: { x: cropMode.x, y: cropMode.y, w: cropMode.w, h: cropMode.h },
                elW: el.width,
                elH: el.height
              }
            }}
            onCommitCrop={commitCrop}
          />
        ))}

        {/* Footer overlay */}
        {(showFooter || showPageNumbers) && (
          <div style={{
            position: 'absolute', bottom: 8, left: 16, right: 16, zIndex: 900,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: footerFontSize, color: footerColor, fontFamily: footerFontFamily,
            pointerEvents: 'none', boxSizing: 'border-box'
          }}>
            <span>{showFooter ? sectionName : ''}</span>
            <span>{showPageNumbers ? (pageNumberFormat === 'c/t' ? `${pageNumber} / ${totalSlides}` : `${pageNumber}`) : ''}</span>
          </div>
        )}

        {/* Drop hint */}
        {dragOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 999, background: 'rgba(99,102,241,0.08)', fontSize: '16px', color: 'rgba(255,255,255,0.7)', fontFamily: 'sans-serif' }}>
            Drop image here
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (() => {
        const ctxEl = slide?.elements?.find(e => e.id === contextMenu.elementId)
        const currentRef = ctxEl?.snapRef || 'ul'
        return (
          <div
            className="canvas-context-menu"
            style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            {contextMenu.elementType === 'image' && (<>
              <button onClick={() => startCrop(contextMenu.elementId)}>
                ✂ Crop
              </button>
              <button onClick={() => {
                const el = slide?.elements?.find(e => e.id === contextMenu.elementId)
                if (el && el.imageW != null) {
                  onUpdateElement(contextMenu.elementId, {
                    x: el.x + (el.imageOffsetX ?? 0),
                    y: el.y + (el.imageOffsetY ?? 0),
                    width: el.imageW,
                    height: el.imageH,
                    imageW: null, imageH: null, imageOffsetX: null, imageOffsetY: null, crop: null,
                  })
                }
                setContextMenu(null)
              }}>
                ↺ Reset crop
              </button>
              <div className="canvas-context-menu-separator" />
            </>)}
            <div style={{ padding: '4px 8px 2px', fontSize: 10, color: 'var(--text-muted)', userSelect: 'none' }}>Snap Reference</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: '2px 6px 6px' }}>
              {SNAP_REF_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  title={opt.label}
                  style={{
                    padding: '5px 4px', fontSize: 11, background: currentRef === opt.id ? 'var(--accent)' : 'var(--bg-hover)',
                    border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => {
                    onUpdateElement(contextMenu.elementId, { snapRef: opt.id })
                    setContextMenu(null)
                  }}
                >
                  {opt.id === 'ul' ? '↖' : opt.id === 'uc' ? '↑' : opt.id === 'ur' ? '↗' :
                   opt.id === 'ml' ? '←' : opt.id === 'mc' ? '⊕' : opt.id === 'mr' ? '→' :
                   opt.id === 'll' ? '↙' : opt.id === 'lc' ? '↓' : '↘'}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function CanvasElement({ element, isSelected, isEditing, isCropping, cropState, isDragging, editor, onPointerDown, onClick, onDoubleClick, onContextMenu, onStopEdit, onCropHandleDown, onCommitCrop }) {
  const contentRef = useRef(null)

  // Render KaTeX math in preview (when not editing)
  useEffect(() => {
    if (isEditing || !contentRef.current) return
    contentRef.current.querySelectorAll('span[data-math-latex]').forEach(el => {
      if (el.getAttribute('data-katex-done')) return
      try {
        katex.render(el.getAttribute('data-math-latex'), el, {
          throwOnError: false,
          displayMode: el.getAttribute('data-math-display') === 'true'
        })
        el.setAttribute('data-katex-done', '1')
      } catch(e) {}
    })
  }, [element.content, isEditing])

  return (
    <div
      style={{
        position: 'absolute',
        left: element.x, top: element.y,
        width: element.width, height: element.height,
        zIndex: element.zIndex || 1,
        outline: element.locked ? '2px solid #f59e0b' : (isSelected || isEditing) && !isCropping ? '2px solid #6366f1' : isCropping ? '2px solid #f59e0b' : 'none',
        cursor: isCropping ? 'crosshair' : isEditing ? 'text' : isDragging ? 'grabbing' : element.locked ? 'not-allowed' : 'grab',
        userSelect: isEditing ? 'text' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: (element.shadowBlur || element.shadowX || element.shadowY)
          ? `${element.shadowX||0}px ${element.shadowY||0}px ${element.shadowBlur||0}px ${element.shadowColor||'rgba(0,0,0,0.5)'}`
          : undefined,
      }}
      onMouseDown={(e) => { if (!isEditing && !isCropping) onPointerDown(e, 'move', null) }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {element.type === 'text' && !isEditing && (
        <div
          ref={contentRef}
          className="slide-text-content"
          style={{ width: '100%', height: '100%', overflow: 'hidden', color: 'white', padding: '8px 12px', boxSizing: 'border-box' }}
          dangerouslySetInnerHTML={{ __html: element.content || '' }}
        />
      )}
      {element.type === 'text' && isEditing && (
        <EditorContent editor={editor} style={{ width: '100%', height: '100%', color: 'white' }} />
      )}
      {element.type === 'image' && (() => {
        const imgFilter = [
          (element.filterBrightness != null && element.filterBrightness !== 100) ? `brightness(${element.filterBrightness}%)` : '',
          (element.filterContrast != null && element.filterContrast !== 100) ? `contrast(${element.filterContrast}%)` : '',
          element.filterGrayscale ? `grayscale(${element.filterGrayscale}%)` : '',
        ].filter(Boolean).join(' ') || undefined
        return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: isCropping ? 'visible' : 'hidden' }}>
          <img
            src={element.src} alt={element.alt || ''}
            style={element.imageW != null ? {
              // Pixel-exact positioning so scale never changes after crop
              position: 'absolute',
              left: element.imageOffsetX ?? 0,
              top: element.imageOffsetY ?? 0,
              width: element.imageW,
              height: element.imageH,
              objectFit: element.objectFit || 'contain',
              pointerEvents: 'none',
              filter: imgFilter,
            } : {
              width: '100%', height: '100%',
              objectFit: element.objectFit || 'contain',
              display: 'block', pointerEvents: 'none',
              filter: imgFilter,
            }}
            draggable={false}
          />
          {isCropping && cropState && (
            <CropOverlay
              crop={cropState}
              elW={element.width}
              elH={element.height}
              onHandleDown={onCropHandleDown}
              onCommit={onCommitCrop}
            />
          )}
        </div>
        )
      })()}
      {element.type === 'shape' && (
        <ShapeRenderer element={element} />
      )}
      {element.type === 'html' && (
        <iframe
          srcDoc={element.content || ''}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: isSelected ? 'auto' : 'none' }}
          sandbox="allow-scripts"
          title="HTML embed"
        />
      )}
      {element.type === 'code' && (
        <pre
          className="hljs"
          style={{
            margin: 0, padding: '10px 14px',
            width: '100%', height: '100%', overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: "'Fira Code','JetBrains Mono','Courier New',monospace",
            fontSize: element.fontSize || 14,
            lineHeight: 1.5,
            borderRadius: 0,
          }}
        >
          <code dangerouslySetInnerHTML={{ __html: highlightCode(element.content || '', element.language || 'plaintext') }} />
        </pre>
      )}

      {/* Fragment badge */}
      {element.fragment && (
        <div style={{
          position: 'absolute', top: -20, left: 0, zIndex: 101, pointerEvents: 'none',
          background: '#8b5cf6', color: 'white', fontSize: '10px', fontFamily: 'sans-serif',
          padding: '2px 6px', borderRadius: 3, userSelect: 'none', whiteSpace: 'nowrap'
        }}>
          ▶ {element.fragmentIndex ?? 1}
        </div>
      )}

      {/* Resize handles */}
      {isSelected && !isEditing && !isCropping && !element.locked && Object.entries(HANDLE_STYLES).map(([handle, hStyle]) => (
        <div
          key={handle}
          style={{
            position: 'absolute', width: 10, height: 10,
            background: '#6366f1', border: '2px solid white', borderRadius: 2, zIndex: 100,
            ...hStyle
          }}
          onMouseDown={(e) => { e.stopPropagation(); onPointerDown(e, 'resize', handle) }}
        />
      ))}
    </div>
  )
}

function CropOverlay({ crop, elW, elH, onHandleDown, onCommit }) {
  const { x, y, w, h } = crop
  // Dim regions outside crop using four absolutely positioned rects
  const dimStyle = { position: 'absolute', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }

  const handleMouseDown = (e, handle) => {
    e.stopPropagation()
    e.preventDefault()
    onHandleDown(handle, e.clientX, e.clientY)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} onDoubleClick={onCommit}>
      {/* Top strip */}
      <div style={{ ...dimStyle, top: 0, left: 0, right: 0, height: `${y * 100}%` }} />
      {/* Bottom strip */}
      <div style={{ ...dimStyle, bottom: 0, left: 0, right: 0, height: `${(1 - y - h) * 100}%` }} />
      {/* Left strip (between top and bottom) */}
      <div style={{ ...dimStyle, top: `${y * 100}%`, left: 0, width: `${x * 100}%`, height: `${h * 100}%` }} />
      {/* Right strip */}
      <div style={{ ...dimStyle, top: `${y * 100}%`, right: 0, width: `${(1 - x - w) * 100}%`, height: `${h * 100}%` }} />

      {/* Crop border */}
      <div style={{
        position: 'absolute',
        left: `${x * 100}%`, top: `${y * 100}%`,
        width: `${w * 100}%`, height: `${h * 100}%`,
        border: '2px solid white', boxSizing: 'border-box', pointerEvents: 'none',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.5)'
      }} />

      {/* Rule-of-thirds grid lines */}
      {[1/3, 2/3].map(f => (
        <div key={`v${f}`} style={{ position: 'absolute', left: `${(x + f * w) * 100}%`, top: `${y * 100}%`, width: 1, height: `${h * 100}%`, background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
      ))}
      {[1/3, 2/3].map(f => (
        <div key={`hz${f}`} style={{ position: 'absolute', top: `${(y + f * h) * 100}%`, left: `${x * 100}%`, height: 1, width: `${w * 100}%`, background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
      ))}

      {/* Crop handles */}
      {CROP_HANDLES.map(ch => (
        <div
          key={ch.id}
          style={{
            position: 'absolute',
            left: `calc(${(x + ch.px * w) * 100}% - 5px)`,
            top: `calc(${(y + ch.py * h) * 100}% - 5px)`,
            width: 10, height: 10,
            background: 'white', border: '1px solid rgba(0,0,0,0.5)',
            borderRadius: 2, cursor: ch.cursor, zIndex: 51
          }}
          onMouseDown={(e) => handleMouseDown(e, ch.id)}
        />
      ))}

      {/* Commit button */}
      <div
        style={{
          position: 'absolute',
          left: `${(x + w) * 100}%`, top: `${y * 100}%`,
          transform: 'translate(6px, -28px)',
          background: '#f59e0b', color: 'white', fontSize: '11px',
          padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
          whiteSpace: 'nowrap', userSelect: 'none', fontFamily: 'sans-serif',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)', zIndex: 52
        }}
        onMouseDown={e => e.stopPropagation()}
        onClick={onCommit}
      >
        Apply ↵
      </div>
    </div>
  )
}

function ShapeRenderer({ element }) {
  const w = element.width, h = element.height
  const fill = element.fill || '#6366f1'
  const stroke = element.stroke || 'none'
  const sw = element.strokeWidth || 0
  const shape = element.shape || 'rect'

  const renderShape = () => {
    if (shape === 'line') {
      const lw = element.strokeWidth || 3
      return <line x1={lw} y1={h/2} x2={w-lw} y2={h/2} stroke={fill} strokeWidth={lw} fill="none" />
    }
    const gProps = { fill, stroke, strokeWidth: sw }
    switch(shape) {
      case 'rect':
        return <g {...gProps}><rect x={sw/2} y={sw/2} width={w-sw} height={h-sw} rx={element.borderRadius || 0} /></g>
      case 'rounded-rect':
        return <g {...gProps}><rect x={sw/2} y={sw/2} width={w-sw} height={h-sw} rx={Math.min(w,h)*0.15} /></g>
      case 'circle':
        return <g {...gProps}><ellipse cx={w/2} cy={h/2} rx={Math.max(0,w/2-sw/2)} ry={Math.max(0,h/2-sw/2)} /></g>
      case 'triangle':
        return <g {...gProps}><polygon points={`${w/2},${sw} ${w-sw},${h-sw} ${sw},${h-sw}`} /></g>
      case 'diamond':
        return <g {...gProps}><polygon points={`${w/2},${sw} ${w-sw},${h/2} ${w/2},${h-sw} ${sw},${h/2}`} /></g>
      case 'arrow-right':
        return <g {...gProps}><polygon points={`${sw},${h*0.35} ${w*0.6},${h*0.35} ${w*0.6},${sw} ${w-sw},${h/2} ${w*0.6},${h-sw} ${w*0.6},${h*0.65} ${sw},${h*0.65}`} /></g>
      case 'star': {
        const cx=w/2, cy=h/2, outerR=Math.min(w,h)/2-sw, innerR=outerR*0.4
        const pts=[]; for(let i=0;i<10;i++){const a=(Math.PI/5)*i-Math.PI/2;const r=i%2===0?outerR:innerR;pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`)}
        return <g {...gProps}><polygon points={pts.join(' ')} /></g>
      }
      default: return <g {...gProps}><rect x={sw/2} y={sw/2} width={w-sw} height={h-sw} /></g>
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: element.opacity || 1 }}>
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {renderShape()}
        {element.text && (
          <text
            x={w/2} y={h/2}
            dominantBaseline="middle" textAnchor="middle"
            fontSize={element.fontSize || 16}
            fill={element.textColor || '#ffffff'}
          >
            {element.text}
          </text>
        )}
      </svg>
    </div>
  )
}
