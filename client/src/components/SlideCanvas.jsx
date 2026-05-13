// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useRef, useEffect, useState, useCallback } from 'react'
import PluginSandbox from '../plugins/PluginSandbox'
import registry from '../plugins/PluginRegistry'

function buildHtmlEmbed(userHtml, embedW, embedH) {
  const initScript = `<script>const EMBED_WIDTH=${embedW},EMBED_HEIGHT=${embedH};(function(){function fit(){document.querySelectorAll('svg').forEach(function(s){if(s._vb)return;var w=s.getAttribute('width'),h=s.getAttribute('height');if(w&&h&&!s.getAttribute('viewBox'))s.setAttribute('viewBox','0 0 '+parseFloat(w)+' '+parseFloat(h));if(s.getAttribute('viewBox')){s.setAttribute('width','100%');s.setAttribute('height','100%');s._vb=1;}});}window.addEventListener('load',fit);setTimeout(fit,100);setTimeout(fit,400);new MutationObserver(fit).observe(document.documentElement,{childList:true,subtree:true});})();<\/script>`
  const resetStyle = `<style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;box-sizing:border-box;}canvas{display:block;}svg{display:block;}<\/style>`
  const injection = initScript + resetStyle
  // Inject into <head> so DOCTYPE stays first (preserves standards mode)
  if (/<head[^>]*>/i.test(userHtml))
    return userHtml.replace(/<head[^>]*>/i, m => m + injection)
  // Full doc without explicit <head>: insert after <html> tag or after DOCTYPE
  if (/<html[^>]*>/i.test(userHtml))
    return userHtml.replace(/<html[^>]*>/i, m => m + injection)
  if (/<!doctype[^>]*>/i.test(userHtml))
    return userHtml.replace(/(<!doctype[^>]*>)/i, '$1' + injection)
  // Snippet: prepend directly
  return injection + userHtml
}
import { EditorContent } from '@tiptap/react'
import katex from 'katex'
import hljs from 'highlight.js'
import { calculateGuides } from '../utils/smartGuides'
import { generateLatexIframeHtml } from '../utils/latexRenderer'
import { pointsToPath } from '../utils/drawingUtils'

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

const MIN_SIZE = 40

function textPathGeometry(width, angle, fontSize, pathShape, height) {
  const angleRad = ((angle || 0) * Math.PI) / 180
  const pad = Math.ceil((fontSize || 64) * 1.2)

  if (pathShape === 'arc') {
    const h = height || 200
    const svgH = h
    const sweep = Math.abs(angle || 30)
    const sweepRad = (sweep * Math.PI) / 180
    const r = (width / 2) / Math.sin(sweepRad / 2)
    const sagitta = r - r * Math.cos(sweepRad / 2)
    const cy = pad + r - sagitta
    const startAngle = Math.PI + (Math.PI - sweepRad) / 2
    const endAngle = startAngle + sweepRad
    const x1 = width / 2 + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = width / 2 + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = sweep > 180 ? 1 : 0
    return { svgH, pathD: `M ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2}` }
  }

  if (pathShape === 'circle') {
    const h = height || width
    const svgH = h
    const rx = width / 2 - 2
    const ry = h / 2 - 2
    const cx = width / 2
    const cy = h / 2
    return { svgH, pathD: `M ${cx},${cy - ry} A ${rx},${ry} 0 1 1 ${cx - 0.01},${cy - ry}` }
  }

  if (pathShape === 'wave') {
    const h = height || Math.ceil(fontSize * 3)
    const svgH = h
    const amp = Math.max(10, Math.abs(angle || 30))
    const midY = h / 2
    const seg = width / 4
    return { svgH, pathD: `M 0,${midY} C ${seg},${midY - amp} ${seg * 2},${midY + amp} ${seg * 3},${midY - amp} S ${width},${midY + amp / 2} ${width},${midY}` }
  }

  // Default: straight line
  const dy = width * Math.tan(angleRad)
  const minY = Math.min(0, dy)
  const svgH = Math.ceil(Math.abs(dy) + pad * 2)
  return { svgH, pathD: `M 0,${pad - minY} L ${width},${pad - minY + dy}` }
}

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

function buildP5Srcdoc(userCode, w, h) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;overflow:hidden;}canvas{display:block;}</style>
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"><\/script>
</head><body><script>
${userCode}
<\/script></body></html>`
}

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || 'linear-gradient(135deg, #1e1e2e, #2d2d5e)' }
  if (bg.type === 'image' && bg.image) return { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }
  return { backgroundColor: '#1e1e2e' }
}

export default function SlideCanvas({ editor, slide, selectedElementIds, editingElementId, showGrid, gridSize = 40, showFooter, showPageNumbers, footerTimeMode = 'none', timerDuration = 20, pageNumberFormat, pageNumber, totalSlides, sectionName, footerFontSize = 14, footerFontFamily = '-apple-system,sans-serif', footerColor = 'rgba(255,255,255,0.65)', footerInactiveColor = 'rgba(255,255,255,0.25)', smartGuidesEnabled = true, footerMode = 'basic', sequenceSections = [], activeSection = null, showRulers = false, persistentGuides = [], onAddGuide, onRemoveGuide, onUpdateGuide, onToggleSelectElement, onStartEdit, onStopEdit, onUpdateElement, onUpdateElements, onDeleteElement, onDeleteSelectedElements, onAddImage, onOpenHtmlEditor, onOpenCodeEditor, onOpenLatexEditor, onOpenManimEditor, onOpenP5Editor, slideW = 960, slideH = 540, drawTool = null, onAddDrawingStroke, globalFont = '', onUpdateAxisLines }) {
  const SLIDE_W = slideW
  const SLIDE_H = slideH
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const showTimeWidget = footerTimeMode !== 'none'
  const isClockMode = footerTimeMode === 'clock12' || footerTimeMode === 'clock24'
  const isTimerMode = footerTimeMode === 'timer-up' || footerTimeMode === 'timer-down'
  const formatClock = useCallback((d) => {
    if (footerTimeMode === 'clock24') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  }, [footerTimeMode])
  const [clockTime, setClockTime] = useState(() => formatClock(new Date()))
  const [timerElapsed, setTimerElapsed] = useState(0)
  const timerStartRef = useRef(null)
  useEffect(() => {
    if (!isClockMode) return
    setClockTime(formatClock(new Date()))
    const id = setInterval(() => setClockTime(formatClock(new Date())), 1000)
    return () => clearInterval(id)
  }, [isClockMode, formatClock])
  useEffect(() => {
    if (!isTimerMode) { timerStartRef.current = null; setTimerElapsed(0); return }
    timerStartRef.current = Date.now()
    setTimerElapsed(0)
    const id = setInterval(() => {
      setTimerElapsed(Math.floor((Date.now() - timerStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [isTimerMode])
  const timeDisplay = (() => {
    if (isClockMode) return clockTime
    if (isTimerMode) {
      let secs
      if (footerTimeMode === 'timer-up') {
        secs = timerElapsed
      } else {
        secs = Math.max(0, timerDuration * 60 - timerElapsed)
      }
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return ''
  })()
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
  const [activeGuides, setActiveGuides] = useState([])
  const scaleRef = useRef(scale)
  const smartGuidesRef = useRef(smartGuidesEnabled)

  useEffect(() => { showGridRef.current = showGrid }, [showGrid])
  useEffect(() => { gridSizeRef.current = gridSize }, [gridSize])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { selectedElementIdsRef.current = selectedElementIds }, [selectedElementIds])
  useEffect(() => { smartGuidesRef.current = smartGuidesEnabled }, [smartGuidesEnabled])
  const slideRef = useRef(slide)
  useEffect(() => { slideRef.current = slide }, [slide])
  const persistentGuidesRef = useRef(persistentGuides)
  useEffect(() => { persistentGuidesRef.current = persistentGuides }, [persistentGuides])
  const draggingGuideRef = useRef(null) // { index, axis }
  const draggingAxisRef = useRef(null) // { id, axis }
  const [previewGuide, setPreviewGuide] = useState(null) // { axis: 'x'|'y', position }

  // Drawing tool state
  const drawToolRef = useRef(drawTool)
  useEffect(() => { drawToolRef.current = drawTool }, [drawTool])
  const drawingActiveRef = useRef(false)
  const drawPointsRef = useRef([])
  const [liveStroke, setLiveStroke] = useState(null)

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!drawingActiveRef.current) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(SLIDE_W, (e.clientX - rect.left) / scaleRef.current))
      const y = Math.max(0, Math.min(SLIDE_H, (e.clientY - rect.top) / scaleRef.current))
      drawPointsRef.current.push({ x, y })
      setLiveStroke(prev => prev ? { ...prev, points: [...drawPointsRef.current] } : null)
    }
    const onMouseUp = () => {
      if (!drawingActiveRef.current) return
      drawingActiveRef.current = false
      const pts = drawPointsRef.current
      drawPointsRef.current = []
      setLiveStroke(null)
      if (pts.length >= 2 && drawToolRef.current && onAddDrawingStroke) {
        onAddDrawingStroke({ ...drawToolRef.current, points: pts })
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onAddDrawingStroke])

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

    const GUIDE_THRESHOLD = 8
    const guideSnap = (rawX, rawY, w, h) => {
      const guides = persistentGuidesRef.current
      if (!guides || !guides.length) return { x: rawX, y: rawY, didX: false, didY: false }
      let x = rawX, y = rawY, didX = false, didY = false
      let bestXDist = GUIDE_THRESHOLD, bestYDist = GUIDE_THRESHOLD
      for (const guide of guides) {
        if (guide.axis === 'x') {
          for (const xp of [rawX, rawX + w / 2, rawX + w]) {
            const d = Math.abs(xp - guide.position)
            if (d < bestXDist) { bestXDist = d; x = rawX + (guide.position - xp); didX = true }
          }
        } else {
          for (const yp of [rawY, rawY + h / 2, rawY + h]) {
            const d = Math.abs(yp - guide.position)
            if (d < bestYDist) { bestYDist = d; y = rawY + (guide.position - yp); didY = true }
          }
        }
      }
      return { x, y, didX, didY }
    }

    const layoutGridSnap = (rawX, rawY, w, h) => {
      const sl = slideRef.current
      const lg = sl?.layoutGrid
      let x = rawX, y = rawY, didX = false, didY = false
      let bestXDist = GUIDE_THRESHOLD, bestYDist = GUIDE_THRESHOLD

      if (lg?.enabled && lg?.snap) {
        const cols = lg.columns || 3
        const rows = lg.rows || 0
        const gutter = lg.gutter ?? 20
        const mx = lg.marginX ?? 40
        const my = lg.marginY ?? 40
        const usableW = SLIDE_W - 2 * mx
        const colW = (usableW - (cols - 1) * gutter) / cols
        for (let i = 0; i < cols; i++) {
          const colLeft = mx + i * (colW + gutter)
          const colRight = colLeft + colW
          for (const xp of [rawX, rawX + w / 2, rawX + w]) {
            for (const edge of [colLeft, colRight]) {
              const d = Math.abs(xp - edge)
              if (d < bestXDist) { bestXDist = d; x = rawX + (edge - xp); didX = true }
            }
          }
        }
        // Margin edges
        for (const xp of [rawX, rawX + w / 2, rawX + w]) {
          for (const edge of [mx, SLIDE_W - mx]) {
            const d = Math.abs(xp - edge)
            if (d < bestXDist) { bestXDist = d; x = rawX + (edge - xp); didX = true }
          }
        }
        if (rows > 0) {
          const usableH = SLIDE_H - 2 * my
          const rowH = (usableH - (rows - 1) * gutter) / rows
          for (let i = 0; i < rows; i++) {
            const rowTop = my + i * (rowH + gutter)
            const rowBottom = rowTop + rowH
            for (const yp of [rawY, rawY + h / 2, rawY + h]) {
              for (const edge of [rowTop, rowBottom]) {
                const d = Math.abs(yp - edge)
                if (d < bestYDist) { bestYDist = d; y = rawY + (edge - yp); didY = true }
              }
            }
          }
        }
      }

      // Axis lines
      const axisLines = sl?.axisLines || []
      for (const al of axisLines) {
        if (!al.visible || !al.snap) continue
        if (al.axis === 'x') {
          for (const xp of [rawX, rawX + w / 2, rawX + w]) {
            const d = Math.abs(xp - al.position)
            if (d < bestXDist) { bestXDist = d; x = rawX + (al.position - xp); didX = true }
          }
        } else {
          for (const yp of [rawY, rawY + h / 2, rawY + h]) {
            const d = Math.abs(yp - al.position)
            if (d < bestYDist) { bestYDist = d; y = rawY + (al.position - yp); didY = true }
          }
        }
      }

      return { x, y, didX, didY }
    }

    const onMouseMove = (e) => {
      // Guide drag
      if (draggingGuideRef.current && canvasRef.current) {
        const dg = draggingGuideRef.current
        const rect = canvasRef.current.getBoundingClientRect()
        const pos = dg.axis === 'x'
          ? Math.max(0, Math.min(SLIDE_W, Math.round((e.clientX - rect.left) / scaleRef.current)))
          : Math.max(0, Math.min(SLIDE_H, Math.round((e.clientY - rect.top) / scaleRef.current)))
        onUpdateGuide?.(dg.index, pos)
        return
      }

      // Axis line drag
      if (draggingAxisRef.current && canvasRef.current) {
        const da = draggingAxisRef.current
        const rect = canvasRef.current.getBoundingClientRect()
        const pos = da.axis === 'x'
          ? Math.max(0, Math.min(SLIDE_W, Math.round((e.clientX - rect.left) / scaleRef.current)))
          : Math.max(0, Math.min(SLIDE_H, Math.round((e.clientY - rect.top) / scaleRef.current)))
        const updated = (slideRef.current?.axisLines || []).map(a => a.id === da.id ? { ...a, position: pos } : a)
        onUpdateAxisLines?.(updated)
        return
      }

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
          let newX, newY
          if (showGridRef.current) {
            const { x: snappedX, y: snappedY } = snapWithRef(rawX, rawY, drag.startEl.width, drag.startEl.height, drag.startEl.snapRef || 'ul', snap)
            newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, snappedX))
            newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, snappedY))
            // Custom guides override grid snap when closer
            const { x: gx, y: gy, didX, didY } = guideSnap(newX, newY, drag.startEl.width, drag.startEl.height)
            if (didX) newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, gx))
            if (didY) newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, gy))
            // Layout grid + axis lines override when closer
            const { x: lgx, y: lgy, didX: lgDidX, didY: lgDidY } = layoutGridSnap(newX, newY, drag.startEl.width, drag.startEl.height)
            if (lgDidX) newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, lgx))
            if (lgDidY) newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, lgy))
            setActiveGuides([])
          } else if (persistentGuidesRef.current.length > 0) {
            const { x: gx, y: gy } = guideSnap(rawX, rawY, drag.startEl.width, drag.startEl.height)
            newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, gx))
            newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, gy))
            const { x: lgx, y: lgy, didX: lgDidX, didY: lgDidY } = layoutGridSnap(newX, newY, drag.startEl.width, drag.startEl.height)
            if (lgDidX) newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, lgx))
            if (lgDidY) newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, lgy))
            setActiveGuides([])
          } else if (smartGuidesRef.current) {
            const allEls = (slideRef.current?.elements || [])
            const draggedEl = { id: drag.elementId, x: rawX, y: rawY, width: drag.startEl.width, height: drag.startEl.height }
            const { guides, snappedX, snappedY } = calculateGuides(draggedEl, allEls, SLIDE_W, SLIDE_H)
            newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, snappedX))
            newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, snappedY))
            const { x: lgx, y: lgy, didX: lgDidX, didY: lgDidY } = layoutGridSnap(newX, newY, drag.startEl.width, drag.startEl.height)
            if (lgDidX) newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, lgx))
            if (lgDidY) newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, lgy))
            setActiveGuides(guides)
          } else {
            newX = rawX
            newY = rawY
            const { x: lgx, y: lgy, didX: lgDidX, didY: lgDidY } = layoutGridSnap(rawX, rawY, drag.startEl.width, drag.startEl.height)
            if (lgDidX) newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, lgx))
            if (lgDidY) newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, lgy))
            setActiveGuides([])
          }
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
        // Snap resize edges to custom guides
        if (persistentGuidesRef.current.length > 0) {
          const { x: gx, y: gy, didX, didY } = guideSnap(updates.x, updates.y, updates.width, updates.height)
          if (didX) { updates.width = Math.max(MIN_SIZE, updates.width + (gx - updates.x)); updates.x = gx }
          if (didY) { updates.height = Math.max(MIN_SIZE, updates.height + (gy - updates.y)); updates.y = gy }
        }
        // Snap resize edges to layout grid + axis lines
        {
          const { x: lgx, y: lgy, didX: lgDidX, didY: lgDidY } = layoutGridSnap(updates.x, updates.y, updates.width, updates.height)
          if (lgDidX) { updates.width = Math.max(MIN_SIZE, updates.width + (lgx - updates.x)); updates.x = lgx }
          if (lgDidY) { updates.height = Math.max(MIN_SIZE, updates.height + (lgy - updates.y)); updates.y = lgy }
        }
        updates.width = Math.max(MIN_SIZE, updates.width)
        updates.height = Math.max(MIN_SIZE, updates.height)
        onUpdateElement(drag.elementId, updates)
      } else if (drag.type === 'rotate') {
        // Calculate angle from element center to mouse position
        const centerX = drag.startEl.x + drag.startEl.width / 2
        const centerY = drag.startEl.y + drag.startEl.height / 2
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90
        // Snap to 15-degree increments when holding shift
        let rotation = Math.round(angle)
        if (e.shiftKey) rotation = Math.round(rotation / 15) * 15
        // Normalize to 0-360
        rotation = ((rotation % 360) + 360) % 360
        onUpdateElement(drag.elementId, { rotation })
      }
    }
    const onMouseUp = () => {
      draggingGuideRef.current = null
      draggingAxisRef.current = null
      cropDragRef.current = null
      pendingDragRef.current = null
      draggingRef.current = null
      setActiveGuides([])
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

  // Reorder element in the z-stack: 'front' | 'back' | 'forward' | 'backward'
  const reorderElement = useCallback((elementId, direction) => {
    const elements = slide?.elements || []
    if (elements.length < 2) return
    const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    const pos = sorted.findIndex(el => el.id === elementId)
    if (pos === -1) return
    const reordered = [...sorted]
    const [el] = reordered.splice(pos, 1)
    if      (direction === 'front'    )                      reordered.push(el)
    else if (direction === 'back'     )                      reordered.unshift(el)
    else if (direction === 'forward'  && pos < sorted.length - 1) reordered.splice(pos + 1, 0, el)
    else if (direction === 'backward' && pos > 0             ) reordered.splice(pos - 1, 0, el)
    else return
    onUpdateElements(reordered.map((e, i) => ({ id: e.id, zIndex: i + 1 })))
    setContextMenu(null)
  }, [slide, onUpdateElements])

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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'))
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

  const handleRulerMouseDown = (axis, e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const getPos = (me) => axis === 'x'
      ? (me.clientX - rect.left) / scaleRef.current
      : (me.clientY - rect.top) / scaleRef.current
    const onMove = (me) => {
      const pos = getPos(me)
      if (pos >= 0 && pos <= (axis === 'x' ? SLIDE_W : SLIDE_H)) {
        setPreviewGuide({ axis, position: Math.round(pos) })
      }
    }
    const onUp = (me) => {
      const pos = getPos(me)
      if (pos >= 0 && pos <= (axis === 'x' ? SLIDE_W : SLIDE_H)) {
        onAddGuide?.({ axis, position: Math.round(pos) })
      }
      setPreviewGuide(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
    >
      {/* Rulers */}
      {showRulers && (
        <>
          {/* Top ruler */}
          <div
            style={{
              position: 'absolute', top: 0, left: '50%',
              transform: `translateX(calc(-50% * 1)) scale(${scale})`, transformOrigin: 'top center',
              width: SLIDE_W, height: 20, background: 'rgba(30,30,46,0.9)', zIndex: 100,
              cursor: 'crosshair', overflow: 'hidden', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'flex-end', userSelect: 'none', fontSize: 8, color: 'rgba(255,255,255,0.4)',
            }}
            onMouseDown={e => handleRulerMouseDown('x', e)}
          >
            {Array.from({ length: Math.ceil(SLIDE_W / 50) }, (_, i) => (
              <div key={i} style={{ position: 'absolute', left: i * 50, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.2)', height: '100%', paddingLeft: 2 }}>
                {i * 50}
              </div>
            ))}
          </div>
          {/* Left ruler */}
          <div
            style={{
              position: 'absolute', left: 0, top: '50%',
              transform: `translateY(calc(-50% * 1)) scale(${scale})`, transformOrigin: 'left center',
              width: 20, height: SLIDE_H, background: 'rgba(30,30,46,0.9)', zIndex: 100,
              cursor: 'crosshair', overflow: 'hidden', borderRight: '1px solid var(--border)',
              userSelect: 'none', fontSize: 8, color: 'rgba(255,255,255,0.4)',
            }}
            onMouseDown={e => handleRulerMouseDown('y', e)}
          >
            {Array.from({ length: Math.ceil(SLIDE_H / 50) }, (_, i) => (
              <div key={i} style={{ position: 'absolute', top: i * 50, left: 0, borderTop: '1px solid rgba(255,255,255,0.2)', width: '100%', paddingLeft: 2, paddingTop: 1 }}>
                {i * 50}
              </div>
            ))}
          </div>
        </>
      )}
      <div
        ref={canvasRef}
        className="slide-canvas"
        style={{
          width: SLIDE_W, height: SLIDE_H,
          transform: `scale(${scale})`, transformOrigin: 'center center',
          flexShrink: 0, position: 'relative', fontSize: '42px',
          outline: dragOver ? '3px dashed #6366f1' : 'none',
          cursor: drawTool ? 'crosshair' : undefined,
          ...getBgStyle(slide?.background)
        }}
        onMouseDown={(e) => {
          if (!drawToolRef.current || editingElementId || cropMode) return
          if (e.button !== 0) return
          const rect = canvasRef.current?.getBoundingClientRect()
          if (!rect) return
          const x = Math.max(0, Math.min(SLIDE_W, (e.clientX - rect.left) / scaleRef.current))
          const y = Math.max(0, Math.min(SLIDE_H, (e.clientY - rect.top) / scaleRef.current))
          drawingActiveRef.current = true
          drawPointsRef.current = [{ x, y }]
          setLiveStroke({ ...drawToolRef.current, points: [{ x, y }] })
          e.stopPropagation()
        }}
        onClick={(e) => {
          if (cropMode || drawTool) return
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

        {/* Layout grid overlay (typographic columns/rows) */}
        {slide?.layoutGrid?.enabled && (() => {
          const lg = slide.layoutGrid
          const cols = lg.columns || 3
          const rows = lg.rows || 0
          const gutter = lg.gutter ?? 20
          const mx = lg.marginX ?? 40
          const my = lg.marginY ?? 40
          const usableW = SLIDE_W - 2 * mx
          const usableH = SLIDE_H - 2 * my
          const colW = (usableW - (cols - 1) * gutter) / cols
          const rowH = rows > 0 ? (usableH - (rows - 1) * gutter) / rows : 0
          return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 997 }}>
              {Array.from({ length: cols }, (_, i) => (
                <div key={`col${i}`} style={{
                  position: 'absolute',
                  left: mx + i * (colW + gutter),
                  top: my,
                  width: colW,
                  height: usableH,
                  background: 'rgba(99,102,241,0.06)',
                  borderLeft: '1px solid rgba(99,102,241,0.25)',
                  borderRight: '1px solid rgba(99,102,241,0.25)',
                }} />
              ))}
              {rows > 0 && Array.from({ length: rows }, (_, i) => (
                <div key={`row${i}`} style={{
                  position: 'absolute',
                  top: my + i * (rowH + gutter),
                  left: mx,
                  width: usableW,
                  height: rowH,
                  borderTop: '1px solid rgba(99,102,241,0.2)',
                  borderBottom: '1px solid rgba(99,102,241,0.2)',
                }} />
              ))}
              <div style={{
                position: 'absolute', left: mx, top: my, width: usableW, height: usableH,
                border: '1px dashed rgba(99,102,241,0.15)',
              }} />
            </div>
          )
        })()}

        {/* Persistent guide lines (user-placed from rulers) */}
        {persistentGuides.map((guide, i) => (
          guide.axis === 'x' ? (
            <div key={`pg${i}`} style={{
              position: 'absolute', left: guide.position, top: 0, width: 9, height: SLIDE_H,
              marginLeft: -4,
              background: 'transparent', zIndex: 998, pointerEvents: 'auto', cursor: 'col-resize',
            }}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); draggingGuideRef.current = { index: i, axis: 'x' } }}
            onDoubleClick={() => onRemoveGuide?.(i)}
            title={`Vertical guide x=${guide.position} — drag to move, double-click to delete`}
            >
              <div style={{ position: 'absolute', left: 4, top: 0, width: 1, height: '100%', background: '#22d3ee', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 4, left: 7, fontSize: 9, color: '#22d3ee', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.65)', padding: '1px 3px', borderRadius: 2, pointerEvents: 'none' }}>
                {guide.position}
              </div>
            </div>
          ) : (
            <div key={`pg${i}`} style={{
              position: 'absolute', top: guide.position, left: 0, height: 9, width: SLIDE_W,
              marginTop: -4,
              background: 'transparent', zIndex: 998, pointerEvents: 'auto', cursor: 'row-resize',
            }}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); draggingGuideRef.current = { index: i, axis: 'y' } }}
            onDoubleClick={() => onRemoveGuide?.(i)}
            title={`Horizontal guide y=${guide.position} — drag to move, double-click to delete`}
            >
              <div style={{ position: 'absolute', top: 4, left: 0, width: '100%', height: 1, background: '#22d3ee', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: 4, top: 7, fontSize: 9, color: '#22d3ee', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.65)', padding: '1px 3px', borderRadius: 2, pointerEvents: 'none' }}>
                {guide.position}
              </div>
            </div>
          )
        ))}

        {/* Axis lines (composition guides, per-slide) */}
        {(slide?.axisLines || []).filter(a => a.visible).map((axisLine) => (
          axisLine.axis === 'x' ? (
            <div key={axisLine.id} style={{
              position: 'absolute', left: axisLine.position, top: 0, width: 9, height: SLIDE_H,
              marginLeft: -4,
              background: 'transparent', zIndex: 998, pointerEvents: 'auto', cursor: 'col-resize',
            }}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); draggingAxisRef.current = { id: axisLine.id, axis: 'x' } }}
            onDoubleClick={() => {
              const updated = (slide?.axisLines || []).filter(a => a.id !== axisLine.id)
              onUpdateAxisLines?.(updated)
            }}
            title={`Axis x=${axisLine.position} — drag to move, double-click to delete`}
            >
              <div style={{ position: 'absolute', left: 4, top: 0, width: 1, height: '100%', background: '#f472b6', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 4, left: 7, fontSize: 9, color: '#f472b6', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.65)', padding: '1px 3px', borderRadius: 2, pointerEvents: 'none' }}>
                axis {axisLine.position}
              </div>
            </div>
          ) : (
            <div key={axisLine.id} style={{
              position: 'absolute', top: axisLine.position, left: 0, height: 9, width: SLIDE_W,
              marginTop: -4,
              background: 'transparent', zIndex: 998, pointerEvents: 'auto', cursor: 'row-resize',
            }}
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); draggingAxisRef.current = { id: axisLine.id, axis: 'y' } }}
            onDoubleClick={() => {
              const updated = (slide?.axisLines || []).filter(a => a.id !== axisLine.id)
              onUpdateAxisLines?.(updated)
            }}
            title={`Axis y=${axisLine.position} — drag to move, double-click to delete`}
            >
              <div style={{ position: 'absolute', top: 4, left: 0, width: '100%', height: 1, background: '#f472b6', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: 4, top: 7, fontSize: 9, color: '#f472b6', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.65)', padding: '1px 3px', borderRadius: 2, pointerEvents: 'none' }}>
                axis {axisLine.position}
              </div>
            </div>
          )
        ))}

        {/* Preview guide while dragging from ruler */}
        {previewGuide && (
          previewGuide.axis === 'x' ? (
            <div style={{ position: 'absolute', left: previewGuide.position, top: 0, width: 1, height: SLIDE_H, background: 'rgba(34,211,238,0.5)', zIndex: 997, pointerEvents: 'none' }} />
          ) : (
            <div style={{ position: 'absolute', top: previewGuide.position, left: 0, height: 1, width: SLIDE_W, background: 'rgba(34,211,238,0.5)', zIndex: 997, pointerEvents: 'none' }} />
          )
        )}

        {/* Smart guide lines */}
        {activeGuides.map((guide, i) => (
          guide.axis === 'x' ? (
            <div key={`g${i}`} style={{
              position: 'absolute', left: guide.position, top: 0, width: 1, height: SLIDE_H,
              background: '#f59e0b', zIndex: 999, pointerEvents: 'none',
            }} />
          ) : (
            <div key={`g${i}`} style={{
              position: 'absolute', top: guide.position, left: 0, height: 1, width: SLIDE_W,
              background: '#f59e0b', zIndex: 999, pointerEvents: 'none',
            }} />
          )
        ))}

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
              if (drawToolRef.current) return
              if (editingElementId === element.id) return
              if (element.locked && type === 'move') return
              e.stopPropagation()
              onToggleSelectElement(element.id, e.shiftKey || e.ctrlKey || e.metaKey)
              startElementDrag(e, element.id, type, handle)
            }}
            onClick={(e) => { e.stopPropagation(); if (!cropMode && !drawToolRef.current) onToggleSelectElement(element.id, e.shiftKey || e.ctrlKey || e.metaKey) }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (element.type === 'text') onStartEdit(element.id)
              else if (element.type === 'html') onOpenHtmlEditor?.(element.id)
              else if (element.type === 'code') onOpenCodeEditor?.(element.id)
              else if (element.type === 'latex') onOpenLatexEditor?.(element.id)
              else if (element.type === 'manim' || element.type === 'plugin:manim') onOpenManimEditor?.(element.id)
              else if (element.type === 'p5') onOpenP5Editor?.(element.id)
              else if (element.type === 'textpath') onStartEdit(element.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault(); e.stopPropagation()
              setContextMenu({ elementId: element.id, elementType: element.type, x: e.clientX, y: e.clientY })
            }}
            onStopEdit={onStopEdit}
            onUpdateContent={(id, content) => onUpdateElement?.(id, { content })}
            onAutoResize={(id, h) => onUpdateElement?.(id, { height: h })}
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
            globalFont={globalFont}
          />
        ))}

        {/* Auto-animate badge */}
        {slide?.autoAnimate && (
          <div style={{
            position: 'absolute', top: 6, right: 6, zIndex: 999, pointerEvents: 'none',
            background: 'rgba(99,102,241,0.85)', color: '#fff', fontSize: 9, fontWeight: 600,
            padding: '2px 6px', borderRadius: 3, letterSpacing: 0.3,
          }}>MORPH</div>
        )}

        {/* Footer overlay */}
        {(showFooter || showPageNumbers || showTimeWidget) && !slide?.hideFooter && (
          footerMode === 'sequence' && sequenceSections.length > 0 ? (
            <div style={{
              position: 'absolute', bottom: 6, left: 16, right: 16, zIndex: 900,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0,
              fontSize: footerFontSize, fontFamily: footerFontFamily,
              pointerEvents: 'none', boxSizing: 'border-box'
            }}>
              {showTimeWidget && (
                <span style={{ color: footerColor, marginRight: 12, flexShrink: 0 }}>{timeDisplay}</span>
              )}
              <div style={{ display: 'flex', flex: 1, justifyContent: 'space-evenly', alignItems: 'center' }}>
                {sequenceSections.map((sec, i) => {
                  const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
                  const secActiveColor = typeof sec === 'object' && sec?.color ? sec.color : (footerColor || 'rgba(255,255,255,0.9)')
                  return (
                    <span key={i} style={{
                      color: activeSection === i ? secActiveColor : footerInactiveColor,
                      fontWeight: activeSection === i ? 700 : 400,
                      fontSize: footerFontSize,
                      transition: 'color 0.2s, font-weight 0.2s',
                    }}>
                      {secLabel || `Section ${i + 1}`}
                    </span>
                  )
                })}
              </div>
              {showPageNumbers && pageNumber != null && (
                <span style={{ color: footerColor, marginLeft: 12, flexShrink: 0 }}>
                  {pageNumberFormat === 'c/t' ? `${pageNumber} / ${totalSlides}` : `${pageNumber}`}
                </span>
              )}
            </div>
          ) : (
            <div style={{
              position: 'absolute', bottom: 8, left: 16, right: 16, zIndex: 900,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: footerFontSize, color: footerColor, fontFamily: footerFontFamily,
              pointerEvents: 'none', boxSizing: 'border-box'
            }}>
              <span>{showTimeWidget ? timeDisplay : ''}{showTimeWidget && showFooter && sectionName ? ' — ' : ''}{showFooter ? sectionName : ''}</span>
              <span>{showPageNumbers && pageNumber != null ? (pageNumberFormat === 'c/t' ? `${pageNumber} / ${totalSlides}` : `${pageNumber}`) : ''}</span>
            </div>
          )
        )}

        {/* Drawing elements — rendered via SVG above other elements, paths capture clicks for selection */}
        {(slide?.elements || [])
          .filter(el => el.type === 'drawing')
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map(el => (
            <svg key={el.id}
              style={{
                position: 'absolute', left: 0, top: 0,
                width: SLIDE_W, height: SLIDE_H,
                zIndex: el.zIndex || 1,
                overflow: 'visible',
                pointerEvents: 'none',
              }}
            >
              {(el.paths || []).map((path, pi) => (
                <path key={pi}
                  d={pointsToPath(path.points, el.smooth !== false)}
                  stroke={path.color || '#ffffff'}
                  strokeWidth={path.strokeWidth || 3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={path.opacity ?? 1}
                  style={{ pointerEvents: drawTool ? 'none' : 'stroke', cursor: 'pointer' }}
                  onClick={e => {
                    if (drawTool) return
                    e.stopPropagation()
                    onToggleSelectElement(el.id, e.shiftKey || e.ctrlKey || e.metaKey)
                  }}
                />
              ))}
              {selectedElementIds.includes(el.id) && (
                <rect x={0} y={0} width={SLIDE_W} height={SLIDE_H}
                  fill="none" stroke="#6366f1" strokeWidth={2}
                  strokeDasharray="6 3" pointerEvents="none"
                />
              )}
            </svg>
          ))
        }

        {/* Live stroke while drawing */}
        {liveStroke && liveStroke.points.length >= 2 && (
          <svg style={{ position: 'absolute', left: 0, top: 0, width: SLIDE_W, height: SLIDE_H, pointerEvents: 'none', zIndex: 9998, overflow: 'visible' }}>
            <path
              d={pointsToPath(liveStroke.points, false)}
              stroke={liveStroke.color || '#ffffff'}
              strokeWidth={liveStroke.strokeWidth || 3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={liveStroke.opacity ?? 1}
            />
          </svg>
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
            <button onClick={() => reorderElement(contextMenu.elementId, 'front')}>▲▲ Bring to Front</button>
            <button onClick={() => reorderElement(contextMenu.elementId, 'forward')}>▲ Bring Forward</button>
            <button onClick={() => reorderElement(contextMenu.elementId, 'backward')}>▼ Send Backward</button>
            <button onClick={() => reorderElement(contextMenu.elementId, 'back')}>▼▼ Send to Back</button>
            <div className="canvas-context-menu-separator" />

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

function CanvasElement({ element, isSelected, isEditing, isCropping, cropState, isDragging, editor, onPointerDown, onClick, onDoubleClick, onContextMenu, onStopEdit, onCropHandleDown, onCommitCrop, onAutoResize, onUpdateContent, globalFont }) {
  const contentRef = useRef(null)
  const outerRef = useRef(null)
  const lastAutoHeightRef = useRef(null)
  const isAutoFit = element.type === 'text' && element.sizeMode === 'auto'

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

  // Sync auto-fit height back to element data so drag, export, etc. stay consistent
  useEffect(() => {
    if (!isAutoFit || !outerRef.current) return
    const observer = new ResizeObserver(() => {
      const h = Math.ceil(outerRef.current.getBoundingClientRect().height)
      if (h > 0 && h !== lastAutoHeightRef.current) {
        lastAutoHeightRef.current = h
        onAutoResize?.(element.id, h)
      }
    })
    observer.observe(outerRef.current)
    return () => observer.disconnect()
  }, [isAutoFit, element.id, onAutoResize])

  return (
    <div
      ref={outerRef}
      style={{
        position: 'absolute',
        left: element.x, top: element.y,
        width: element.width, height: isAutoFit ? 'auto' : element.height,
        zIndex: element.zIndex || 1,
        outline: element.locked ? '2px solid #f59e0b' : (isSelected || isEditing) && !isCropping ? '2px solid #6366f1' : isCropping ? '2px solid #f59e0b' : 'none',
        cursor: isCropping ? 'crosshair' : isEditing ? 'text' : isDragging ? 'grabbing' : element.locked ? 'not-allowed' : 'grab',
        userSelect: isEditing ? 'text' : 'none',
        overflow: isAutoFit || element.type === 'textpath' ? 'visible' : 'hidden',
        boxSizing: 'border-box',
        borderRadius: (element.type === 'image' || element.type === 'code') && element.borderRadius ? element.borderRadius : undefined,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        boxShadow: (element.shadowBlur || element.shadowX || element.shadowY)
          ? `${element.shadowX||0}px ${element.shadowY||0}px ${element.shadowBlur||0}px ${element.shadowColor||'rgba(0,0,0,0.5)'}`
          : undefined,
      }}
      onMouseDown={(e) => { if (!isEditing && !isCropping) onPointerDown(e, 'move', null) }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {element.animationEnter && element.animationEnter !== 'none' && !isEditing && (
        <div style={{ position: 'absolute', top: 3, right: 3, zIndex: 20, background: 'rgba(99,102,241,0.85)', color: 'white', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, pointerEvents: 'none', letterSpacing: '0.04em', lineHeight: 1.5 }}>
          ▶ {element.animationDelay ? `+${element.animationDelay}ms` : 'anim'}
        </div>
      )}
      {element.type === 'text' && !isEditing && (
        <div
          ref={contentRef}
          className="slide-text-content"
          style={{
            width: '100%', height: isAutoFit ? 'auto' : '100%', overflow: isAutoFit ? 'visible' : 'hidden',
            color: 'white', padding: '8px 12px', boxSizing: 'border-box',
            fontFamily: globalFont || undefined,
            lineHeight: element.lineHeight ?? 1.5,
            letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : undefined,
            wordSpacing: element.wordSpacing ? `${element.wordSpacing}px` : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: element.content || '' }}
        />
      )}
      {element.type === 'text' && isEditing && (
        <EditorContent editor={editor} style={{
          width: '100%', height: isAutoFit ? 'auto' : '100%', minHeight: isAutoFit ? 40 : undefined, color: 'white',
          fontFamily: globalFont || undefined,
          lineHeight: element.lineHeight || undefined,
          letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : undefined,
          wordSpacing: element.wordSpacing ? `${element.wordSpacing}px` : undefined,
        }} />
      )}
      {element.type === 'image' && (() => {
        const imgFilter = [
          (element.filterBrightness != null && element.filterBrightness !== 100) ? `brightness(${element.filterBrightness}%)` : '',
          (element.filterContrast != null && element.filterContrast !== 100) ? `contrast(${element.filterContrast}%)` : '',
          element.filterGrayscale ? `grayscale(${element.filterGrayscale}%)` : '',
        ].filter(Boolean).join(' ') || undefined
        const hasCiteText = element.citationText || element.citationLink
        return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: (isCropping || hasCiteText) ? 'visible' : 'hidden' }}>
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
          {(element.clickToExpand || element.popupText || element.citationText || element.citationLink) && (
            <div style={{ position: 'absolute', bottom: 3, right: 3, zIndex: 20, display: 'flex', gap: 3, pointerEvents: 'none' }}>
              {(element.citationText || element.citationLink) && (
                <div style={{ background: 'rgba(34,197,94,0.85)', color: 'white', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 21H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3"/><path d="M15 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3"/><path d="M6 7v14"/><path d="M15 3v14"/></svg>
                  CITE
                </div>
              )}
              {element.popupText && (
                <div style={{ background: 'rgba(251,191,36,0.9)', color: '#000', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  POPUP
                </div>
              )}
              {element.clickToExpand && (
                <div style={{ background: 'rgba(99,102,241,0.85)', color: 'white', fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  EXPAND
                </div>
              )}
            </div>
          )}
          {hasCiteText && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: '-apple-system,sans-serif', lineHeight: 1.3, padding: '3px 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none', textAlign: element.citationAlign || 'left' }}>
              {element.citationText || element.citationLink}
            </div>
          )}
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
          key={`${element.id}-${element.width}-${element.height}`}
          srcDoc={buildHtmlEmbed(element.content || '', element.width, element.height)}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: isSelected ? 'auto' : 'none' }}
          sandbox="allow-scripts"
          title="HTML embed"
        />
      )}
      {element.type === 'p5' && (
        <iframe
          key={`${element.id}-${element.width}-${element.height}-${element.content}`}
          srcDoc={buildP5Srcdoc(element.content || '', element.width, element.height)}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: isSelected ? 'auto' : 'none' }}
          sandbox="allow-scripts"
          title="p5.js sketch"
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
      {element.type === 'video' && (
        <video
          ref={el => {
            if (!el) return
            el.playbackRate = element.playbackRate || 1
            const start = element.startTime ?? 0
            const end = element.endTime
            if (start && el.currentTime < start) el.currentTime = start
            el.ontimeupdate = () => {
              if (end != null && el.currentTime >= end) {
                if (element.loop) { el.currentTime = start || 0 }
                else el.pause()
              }
            }
            el.onplay = () => { if (start && el.currentTime < start) el.currentTime = start }
          }}
          controls={element.controls !== false}
          muted={element.muted || false}
          loop={false}
          poster={element.poster || undefined}
          style={{ width: '100%', height: '100%', objectFit: element.objectFit || 'contain', display: 'block', pointerEvents: isSelected ? 'auto' : 'none' }}
        >
          <source src={element.src} type={/\.webm$/i.test(element.src) ? 'video/webm' : /\.og[gv]$/i.test(element.src) ? 'video/ogg' : 'video/mp4'} />
        </video>
      )}
      {element.type === 'audio' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
          <audio
            src={element.src}
            controls
            style={{ width: '90%', pointerEvents: isSelected ? 'auto' : 'none' }}
          />
        </div>
      )}
      {element.type === 'table' && (
        <TableRenderer element={element} isEditing={isEditing} />
      )}
      {element.type === 'latex' && (
        <LatexRenderer element={element} isSelected={isSelected} />
      )}
      {element.type === 'markdown' && (
        <MarkdownRenderer element={element} />
      )}
      {element.type === 'timeline' && (() => {
        const w = element.width, h = element.height
        const t0 = new Date(element.startDate).getTime(), t1 = new Date(element.endDate).getTime()
        const range = t1 - t0 || 1
        const lineY = h * 0.5
        const pad = 30
        const lineColor = element.lineColor || '#6366f1'
        const dotColor = element.dotColor || lineColor
        const textColor = element.textColor || '#fff'
        const fs = element.fontSize || 11
        const items = element.items || []
        const datePos = (d) => pad + ((new Date(d).getTime() - t0) / range) * (w - pad * 2)
        const spacing = element.tickSpacing || 'auto'
        const yearSpan = (t1 - t0) / (365.25 * 24 * 3600000)
        const useYearLabels = spacing === 'auto' ? yearSpan >= 1 : ['year','10year','100year','1000year'].includes(spacing)
        const ticks = []
        const d0 = new Date(element.startDate), d1 = new Date(element.endDate)
        if (spacing === 'day') {
          const step = 86400000
          for (let t = d0.getTime(); t <= d1.getTime(); t += step) { const d = new Date(t); ticks.push({ date: d.toISOString().split('T')[0], label: `${d.getMonth()+1}/${d.getDate()}` }) }
        } else if (spacing === 'month') {
          for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d.setMonth(d.getMonth() + 1)) { ticks.push({ date: d.toISOString().split('T')[0], label: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }) }
        } else {
          const step = spacing === '1000year' ? 1000 : spacing === '100year' ? 100 : spacing === '10year' ? 10 : yearSpan > 8 ? 2 : 1
          const sY = Math.ceil(d0.getFullYear() / step) * step
          for (let y = sY; y <= d1.getFullYear(); y += step) ticks.push({ date: `${y}-01-01`, label: String(y) })
        }
        const itemDateLabel = (d) => useYearLabels ? new Date(d).getFullYear().toString() : d
        return (
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
            <line x1={pad} y1={lineY} x2={w - pad} y2={lineY} stroke={lineColor} strokeWidth={2} />
            {ticks.map((t, i) => {
              const x = datePos(t.date)
              return <g key={i}><line x1={x} y1={lineY - 4} x2={x} y2={lineY + 4} stroke={lineColor} strokeWidth={1.5} /><text x={x} y={lineY + 18} textAnchor="middle" fill={textColor} fontSize={fs - 1} opacity={0.5}>{t.label}</text></g>
            })}
            {items.map((item) => {
              const x = datePos(item.date)
              const isTop = item.side !== 'bottom'
              const cardY = isTop ? 8 : lineY + 28
              const cardH = isTop ? lineY - 36 : h - lineY - 36
              const connY1 = isTop ? cardY + cardH : lineY
              const connY2 = isTop ? lineY : cardY
              const imgH = item.image ? Math.min(cardH * 0.55, 60) : 0
              return (
                <g key={item.id}>
                  <line x1={x} y1={connY1} x2={x} y2={connY2} stroke={lineColor} strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
                  <circle cx={x} cy={lineY} r={4} fill={dotColor} />
                  {item.image && <image href={item.image} x={x - 40} y={cardY} width={80} height={imgH} preserveAspectRatio="xMidYMid meet" clipPath={`inset(0 round 4px)`} />}
                  <text x={x} y={cardY + imgH + fs + 2} textAnchor="middle" fill={textColor} fontSize={fs} fontWeight={600}>{item.label}</text>
                  {item.description && <text x={x} y={cardY + imgH + fs * 2 + 4} textAnchor="middle" fill={textColor} fontSize={fs - 1} opacity={0.6}>{item.description}</text>}
                  <text x={x} y={cardY + imgH + fs * (item.description ? 3 : 2) + 6} textAnchor="middle" fill={textColor} fontSize={fs - 2} opacity={0.35}>{itemDateLabel(item.date)}</text>
                </g>
              )
            })}
          </svg>
        )
      })()}
      {element.type === 'chart' && (
        <ChartRenderer element={element} isSelected={isSelected} />
      )}
      {element.type === 'callout' && (
        <CalloutRenderer element={element} />
      )}
      {element.type === 'icon' && (
        <IconRenderer element={element} />
      )}

      {element.type === 'manim' && (
        element.rendered
          ? <video src={element.rendered} autoPlay={element.autoplay !== false} loop={element.loop !== false} muted={element.muted !== false} controls={element.controls || false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }} />
          : <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: Math.min(element.height * 0.25, 48) }}>🎬</div>
              <div style={{ fontSize: Math.min(element.height * 0.06, 14), fontWeight: 500 }}>Manim: {element.sceneName || 'MyScene'}</div>
              <div style={{ fontSize: Math.min(element.height * 0.05, 11), opacity: 0.6 }}>Double-click to edit & render</div>
            </div>
      )}

      {element.type === 'textpath' && !isEditing && (() => {
        const pathSide = element.pathSide || 'bottom'
        const fontSize = element.fontSize || 64
        const w = element.width
        const effectiveFont = element.fontFamily || globalFont || 'sans-serif'

        // Edge modes: multi-line text with each line's first/last char aligned to an (optionally angled) guide
        if (pathSide === 'leftedge' || pathSide === 'rightedge') {
          const pad = Math.ceil(fontSize * 0.6)
          const pathX0 = pathSide === 'leftedge' ? pad : (w - pad)
          const svgH = element.height || 300
          const lineH = fontSize * (element.lineHeight ?? 1.35)
          const tanA = Math.tan(((element.angle || 0) * Math.PI) / 180)
          const lines = (element.content || '').split('\n')
          const lineXAt = (i) => pathX0 + (fontSize + i * lineH) * tanA
          const guideX2 = pathX0 + svgH * tanA
          return (
            <svg width={w} height={svgH} viewBox={`0 0 ${w} ${svgH}`}
              style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
              {element.showPath !== false && (
                <line x1={pathX0} y1={0} x2={guideX2} y2={svgH} stroke="rgba(34,211,238,0.4)" strokeWidth={1} />
              )}
              <text
                fontSize={fontSize}
                fontFamily={effectiveFont}
                fill={element.color || '#ffffff'}
                fontWeight={element.fontWeight || 'normal'}
                fontStyle={element.fontStyle || 'normal'}
                letterSpacing={element.letterSpacing || 0}
                wordSpacing={element.wordSpacing || undefined}
                textAnchor={pathSide === 'leftedge' ? 'start' : 'end'}
              >
                {lines.map((line, i) => (
                  <tspan key={i} x={lineXAt(i)} dy={i === 0 ? fontSize : lineH}>                    {line || ' '}
                  </tspan>
                ))}
              </text>
            </svg>
          )
        }

        // Diagonal modes: text follows slanted path
        const { svgH, pathD } = textPathGeometry(w, element.angle, fontSize, element.pathShape, element.height)
        const pathId = `tp-${element.id}`
        const capHeight = Math.round(fontSize * 0.72)
        const textDy = (pathSide === 'left' || pathSide === 'right') ? capHeight : 0
        const tpSide = (pathSide === 'top' || pathSide === 'right') ? 'right' : 'left'
        return (
          <svg width={w} height={svgH} viewBox={`0 0 ${w} ${svgH}`}
            style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
            <defs><path id={pathId} d={pathD} /></defs>
            {element.showPath !== false && (
              <use href={`#${pathId}`} stroke="rgba(34,211,238,0.4)" strokeWidth={1} fill="none" />
            )}
            <text
              fontSize={fontSize}
              fontFamily={effectiveFont}
              fill={element.color || '#ffffff'}
              fontWeight={element.fontWeight || 'normal'}
              fontStyle={element.fontStyle || 'normal'}
              letterSpacing={element.letterSpacing || 0}
              wordSpacing={element.wordSpacing || undefined}
              dy={textDy || undefined}
            >
              <textPath href={`#${pathId}`} startOffset={`${element.startOffset || 0}%`} textAnchor={element.textAnchor || 'start'} side={tpSide}>
                {element.content || ''}
              </textPath>
            </text>
          </svg>
        )
      })()}

      {element.type === 'textpath' && isEditing && (() => {
        const pathSide = element.pathSide || 'bottom'
        const fontSize = element.fontSize || 64
        const w = element.width
        const effectiveFont = element.fontFamily || globalFont || 'sans-serif'

        const editOverlay = (svgH, svgPreview) => (
          <div style={{ position: 'relative', width: w, height: svgH }}>
            {svgPreview}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}>
              <textarea
                autoFocus
                defaultValue={element.content || ''}
                onBlur={e => { onUpdateContent?.(element.id, e.target.value); onStopEdit?.() }}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => { if (e.key === 'Escape') { onUpdateContent?.(element.id, e.target.value); onStopEdit?.() } e.stopPropagation() }}
                style={{ width: '90%', background: 'rgba(15,15,30,0.95)', color: 'white', border: '1px solid #6366f1', borderRadius: 6, padding: '10px 14px', fontSize: 14, fontFamily: effectiveFont, resize: 'vertical', outline: 'none', minHeight: 48 }}
                placeholder="Use Enter for new lines in edge mode"
                rows={3}
              />
            </div>
          </div>
        )

        if (pathSide === 'leftedge' || pathSide === 'rightedge') {
          const pad = Math.ceil(fontSize * 0.6)
          const pathX0 = pathSide === 'leftedge' ? pad : (w - pad)
          const svgH = element.height || 300
          const lineH = fontSize * (element.lineHeight ?? 1.35)
          const tanA = Math.tan(((element.angle || 0) * Math.PI) / 180)
          const lines = (element.content || '').split('\n')
          const lineXAt = (i) => pathX0 + (fontSize + i * lineH) * tanA
          const guideX2 = pathX0 + svgH * tanA
          const preview = (
            <svg width={w} height={svgH} viewBox={`0 0 ${w} ${svgH}`}
              style={{ display: 'block', overflow: 'visible', opacity: 0.25, pointerEvents: 'none' }}>
              <line x1={pathX0} y1={0} x2={guideX2} y2={svgH} stroke="#22d3ee" strokeWidth={1} />
              <text fontSize={fontSize} fontFamily={effectiveFont} fill={element.color || '#ffffff'}
                letterSpacing={element.letterSpacing || 0} wordSpacing={element.wordSpacing || undefined}
                textAnchor={pathSide === 'leftedge' ? 'start' : 'end'}>
                {lines.map((line, i) => (
                  <tspan key={i} x={lineXAt(i)} dy={i === 0 ? fontSize : lineH}>{line || ' '}</tspan>
                ))}
              </text>
            </svg>
          )
          return editOverlay(svgH, preview)
        }

        const { svgH, pathD } = textPathGeometry(w, element.angle, fontSize, element.pathShape, element.height)
        const pathId = `tp-edit-${element.id}`
        const capHeight = Math.round(fontSize * 0.72)
        const textDy = (pathSide === 'left' || pathSide === 'right') ? capHeight : 0
        const tpSide = (pathSide === 'top' || pathSide === 'right') ? 'right' : 'left'
        const preview = (
          <svg width={w} height={svgH} viewBox={`0 0 ${w} ${svgH}`}
            style={{ display: 'block', overflow: 'visible', opacity: 0.25, pointerEvents: 'none' }}>
            <defs><path id={pathId} d={pathD} /></defs>
            <use href={`#${pathId}`} stroke="#22d3ee" strokeWidth={1} fill="none" />
            <text fontSize={fontSize} fontFamily={effectiveFont} fill={element.color || '#ffffff'} dy={textDy || undefined}>
              <textPath href={`#${pathId}`} side={tpSide}>{element.content || ''}</textPath>
            </text>
          </svg>
        )
        return editOverlay(svgH, preview)
      })()}

      {element.type?.startsWith('plugin:') && (() => {
        const etDef = registry.getElementType(element.type)
        const pluginEntry = etDef ? registry.getPlugin(etDef.pluginId) : null
        const slug = pluginEntry?.slug
        const sandboxUrl = pluginEntry?.manifest?.sandbox && slug
          ? `/api/plugins/${slug}/assets/${pluginEntry.manifest.sandbox.replace(/^\.\//, '')}`
          : null
        return (
          <PluginSandbox
            sandboxUrl={sandboxUrl}
            pluginData={element.pluginData}
            width={element.width}
            height={element.height}
            isSelected={isSelected}
            onDataUpdate={(patch) => onUpdateElement?.(element.id, { pluginData: { ...(element.pluginData || {}), ...patch } })}
          />
        )
      })()}

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

      {/* Group badge */}
      {element.groupId && isSelected && (
        <div style={{
          position: 'absolute', top: -20, right: 0, zIndex: 101, pointerEvents: 'none',
          background: '#14b8a6', color: 'white', fontSize: '9px', fontFamily: 'sans-serif',
          padding: '1px 5px', borderRadius: 3, userSelect: 'none',
        }}>
          Group
        </div>
      )}

      {/* Resize handles — auto-fit text only exposes width handles */}
      {isSelected && !isEditing && !isCropping && !element.locked && element.type !== 'html' && Object.entries(HANDLE_STYLES)
        .filter(([handle]) => !isAutoFit || handle === 'w' || handle === 'e')
        .map(([handle, hStyle]) => (
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

      {/* Rotation handle */}
      {isSelected && !isEditing && !isCropping && !element.locked && (
        <>
          <div style={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            width: 1, height: 20, background: '#6366f1', zIndex: 100, pointerEvents: 'none',
          }} />
          <div
            style={{
              position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
              width: 14, height: 14, borderRadius: '50%',
              background: '#6366f1', border: '2px solid white', zIndex: 100,
              cursor: 'grab',
            }}
            onMouseDown={(e) => { e.stopPropagation(); onPointerDown(e, 'rotate', null) }}
          />
        </>
      )}
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

// Simple Markdown to HTML converter (no external deps)
function markdownToHtml(md) {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre style="background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-family:'Fira Code',monospace;font-size:13px;"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#60a5fa;text-decoration:underline;">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:12px 0;">')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul style="padding-left:1.5em;margin:0.4em 0;">$1</ul>')
  // Paragraphs (lines not already wrapped)
  html = html.split('\n').map(line => {
    if (!line.trim()) return ''
    if (/^<(h[1-4]|ul|ol|li|pre|hr|div|blockquote)/.test(line.trim())) return line
    return `<p style="margin:0 0 0.4em;line-height:1.6;">${line}</p>`
  }).join('\n')
  return html
}

function MarkdownRenderer({ element }) {
  const html = markdownToHtml(element.content || '')
  return (
    <div
      style={{ width: '100%', height: '100%', overflow: 'auto', padding: '8px 12px', boxSizing: 'border-box', color: 'white', fontSize: '18px', lineHeight: 1.5 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ChartRenderer({ element, isSelected }) {
  const { chartType = 'bar', chartData = {} } = element
  const labels = chartData.labels || []
  const datasets = chartData.datasets || []

  const chartHtml = `<!doctype html><html><head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style>
</head><body>
<canvas id="c" style="width:100%;height:100%"></canvas>
<script>
new Chart(document.getElementById('c'),{
  type:'${chartType}',
  data:{
    labels:${JSON.stringify(labels)},
    datasets:${JSON.stringify(datasets.map(ds => ({
      label: ds.label || '',
      data: ds.data || [],
      backgroundColor: ds.color || '#6366f1',
      borderColor: ds.color || '#6366f1',
      borderWidth: chartType === 'line' ? 2 : 0,
      fill: chartType === 'line' ? false : undefined,
    })))}
  },
  options:{
    responsive:true,
    maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},
    scales:${chartType === 'pie' || chartType === 'doughnut' ? '{}' : `{x:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}},y:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}}}`}
  }
});
<\/script></body></html>`

  return (
    <iframe
      srcDoc={chartHtml}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: isSelected ? 'auto' : 'none', background: 'transparent' }}
      sandbox="allow-scripts"
      title="Chart"
    />
  )
}

function CalloutRenderer({ element }) {
  const num = element.calloutNumber || 1
  const bg = element.calloutColor || '#ef4444'
  const textColor = element.calloutTextColor || '#ffffff'
  const fontSize = element.fontSize || 16
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: textColor, fontSize, fontWeight: 700, fontFamily: '-apple-system, sans-serif',
      boxSizing: 'border-box', userSelect: 'none',
    }}>
      {num}
    </div>
  )
}

// Lucide icon SVG paths (subset)
const ICON_PATHS = {
  Star: '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
  Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  Check: '<polyline points="20,6 9,17 4,12"/>',
  X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  AlertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  Info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  ArrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>',
  ArrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/>',
  ArrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/>',
  ArrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19,12 12,19 5,12"/>',
  Zap: '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>',
  Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  Award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  BookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  Globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>',
  Lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  Rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>',
  User: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  TrendingUp: '<polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/>',
  TrendingDown: '<polyline points="22,17 13.5,8.5 8.5,13.5 2,7"/><polyline points="16,17 22,17 22,11"/>',
  ThumbsUp: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/>',
  Shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  Sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  Moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  Search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  PieChart: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  BarChart3: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
}

function IconRenderer({ element }) {
  const svgPath = ICON_PATHS[element.iconName] || ICON_PATHS['Star']
  const color = element.iconColor || '#ffffff'
  const sw = element.iconStrokeWidth || 2
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: svgPath }}
      />
    </div>
  )
}


function LatexRenderer({ element, isSelected }) {
  const html = generateLatexIframeHtml(element.content || '')
  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: isSelected ? 'auto' : 'none', background: 'transparent' }}
      sandbox="allow-scripts"
      title="LaTeX / TikZ"
    />
  )
}

function TableRenderer({ element, isEditing }) {
  const data = element.data || [['']]
  const headerBg = element.headerBgColor || 'rgba(99,102,241,0.3)'
  const cellBg = element.cellBgColor || 'transparent'
  const borderColor = element.borderColor || 'rgba(255,255,255,0.2)'
  const borderWidth = element.borderWidth ?? 1
  const textColor = element.textColor || '#ffffff'
  const fontSize = element.fontSize || 14
  const cellPadding = element.cellPadding || 8

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {(row || []).map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: cellPadding,
                    border: `${borderWidth}px solid ${borderColor}`,
                    background: (element.headerRow && ri === 0) ? headerBg : cellBg,
                    color: textColor,
                    fontSize,
                    fontWeight: (element.headerRow && ri === 0) ? 600 : 400,
                    verticalAlign: 'middle',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cell || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ShapeRenderer({ element }) {
  const w = element.width, h = element.height
  const fill = element.fill || '#6366f1'
  const stroke = element.stroke || 'none'
  const sw = element.strokeWidth || 0
  const shape = element.shape || 'rect'
  const sda = element.strokeDasharray === 'dashed' ? `${sw*3} ${sw*2}` : element.strokeDasharray === 'dotted' ? `${sw} ${sw*1.5}` : undefined

  const renderShape = () => {
    if (shape === 'line') {
      const lw = element.strokeWidth || 3
      const lineColor = element.stroke && element.stroke !== 'none' ? element.stroke : (element.fill || '#ffffff')
      const lsda = element.strokeDasharray === 'dashed' ? `${lw*3} ${lw*2}` : element.strokeDasharray === 'dotted' ? `${lw} ${lw*1.5}` : undefined
      return <line x1={lw} y1={h/2} x2={w-lw} y2={h/2} stroke={lineColor} strokeWidth={lw} strokeDasharray={lsda} fill="none" />
    }
    const gProps = { fill, stroke, strokeWidth: sw, strokeDasharray: sda }
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
        const cx = element.starCx != null ? element.starCx : w/2
        const cy = element.starCy != null ? element.starCy : h/2
        const outerR = element.starOuterR != null ? element.starOuterR : Math.min(w,h)/2-sw
        const innerR = element.starInnerR != null ? element.starInnerR : outerR*0.4
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
        {element.text && !element.textReflow && (
          <text
            x={w/2} y={h/2}
            dominantBaseline="middle" textAnchor="middle"
            fontSize={element.fontSize || 16}
            fill={element.textColor || '#ffffff'}
          >
            {element.text}
          </text>
        )}
        {element.text && element.textReflow && (() => {
          const fs = element.fontSize || 14
          const lineH = fs * 1.4
          const padding = element.textReflowPadding || 12
          const tc = element.textColor || '#ffffff'

          const lineWidthAt = (y) => {
            if (shape === 'circle') {
              const rx = w / 2 - padding
              const ry = h / 2 - padding
              const cy = h / 2
              const dy = y - cy
              if (Math.abs(dy) >= ry) return 0
              return 2 * rx * Math.sqrt(1 - (dy * dy) / (ry * ry))
            }
            if (shape === 'diamond') {
              const cy = h / 2
              const dy = Math.abs(y - cy)
              const frac = 1 - dy / (h / 2 - padding)
              return frac > 0 ? (w - 2 * padding) * frac : 0
            }
            if (shape === 'triangle') {
              const frac = (y - padding) / (h - 2 * padding)
              return frac > 0 ? (w - 2 * padding) * Math.min(1, frac) : 0
            }
            return w - 2 * padding
          }

          const words = element.text.split(/\s+/)
          const lines = []
          const avgCharW = fs * 0.55
          let y = shape === 'circle' ? padding + fs : padding + fs
          let currentLine = ''
          let wordIdx = 0
          while (wordIdx < words.length && y < h - padding) {
            const lw = lineWidthAt(y)
            if (lw < avgCharW * 2) { y += lineH; continue }
            const maxChars = Math.floor(lw / avgCharW)
            if (currentLine === '') {
              currentLine = words[wordIdx]
              wordIdx++
            }
            while (wordIdx < words.length && (currentLine.length + 1 + words[wordIdx].length) <= maxChars) {
              currentLine += ' ' + words[wordIdx]
              wordIdx++
            }
            lines.push({ text: currentLine, y, lw })
            currentLine = ''
            y += lineH
          }
          if (currentLine) lines.push({ text: currentLine, y, lw: lineWidthAt(y) })

          return (
            <g>
              {lines.map((ln, i) => (
                <text key={i} x={w / 2} y={ln.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fs} fill={tc}
                  style={{ fontFamily: 'inherit' }}
                >{ln.text}</text>
              ))}
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
