// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useMemo } from 'react'

const PRESETS = [
  { name: 'Cartesian', xExpr: 'u', yExpr: 'v', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 10, vDiv: 10 },
  { name: 'Polar', xExpr: 'u*cos(v)', yExpr: 'u*sin(v)', uMin: 0.5, uMax: 5, vMin: 0, vMax: '2*PI', uDiv: 8, vDiv: 32 },
  { name: 'Wave Mesh', xExpr: 'u+0.4*sin(v*PI)', yExpr: 'v+0.4*sin(u*PI)', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 12, vDiv: 12 },
  { name: 'Log Polar', xExpr: 'exp(u*0.3)*cos(v)', yExpr: 'exp(u*0.3)*sin(v)', uMin: 0, uMax: 5, vMin: 0, vMax: '2*PI', uDiv: 8, vDiv: 32 },
  { name: 'Perspective', xExpr: 'u/(1+v*0.15)', yExpr: 'v', uMin: -5, uMax: 5, vMin: 0, vMax: 5, uDiv: 10, vDiv: 10 },
  { name: 'Gravity Well', xExpr: 'u*(1+0.3/(0.5+u*u+v*v))', yExpr: 'v*(1+0.3/(0.5+u*u+v*v))', uMin: -4, uMax: 4, vMin: -4, vMax: 4, uDiv: 16, vDiv: 16 },
  { name: 'Saddle', xExpr: 'u+0.08*u*v', yExpr: 'v+0.04*(u*u-v*v)', uMin: -5, uMax: 5, vMin: -5, vMax: 5, uDiv: 12, vDiv: 12 },
  { name: 'Spiral', xExpr: '(1+u*0.15)*cos(v)', yExpr: '(1+u*0.15)*sin(v)', uMin: 0, uMax: 20, vMin: 0, vMax: '6*PI', uDiv: 6, vDiv: 80 },
  { name: 'Diamond', xExpr: '(u+v)*0.7', yExpr: '(u-v)*0.7', uMin: -4, uMax: 4, vMin: -4, vMax: 4, uDiv: 8, vDiv: 8 },
  { name: 'Sinusoidal', xExpr: 'u', yExpr: 'v+sin(u*PI)*cos(v*PI*0.5)*0.8', uMin: -4, uMax: 4, vMin: -4, vMax: 4, uDiv: 1, vDiv: 20 },
]

function compileExpr(expr) {
  try {
    return new Function('u', 'v',
      'const {sin,cos,tan,abs,sqrt,pow,exp,log,log2,PI,E,min,max,floor,ceil,round,atan2,hypot,sign,asin,acos,atan,sinh,cosh,tanh}=Math;return(' + expr + ')')
  } catch { return null }
}

function evalRange(val) {
  if (typeof val === 'number') return val
  try { return new Function('const {PI,E}=Math;return(' + val + ')')() } catch { return 0 }
}

function generateGrid(xExpr, yExpr, params) {
  const xFn = compileExpr(xExpr)
  const yFn = compileExpr(yExpr)
  if (!xFn || !yFn) return { uLines: [], vLines: [], error: 'Invalid expression' }

  const uMin = evalRange(params.uMin), uMax = evalRange(params.uMax)
  const vMin = evalRange(params.vMin), vMax = evalRange(params.vMax)
  const uDiv = params.uDiv || 10, vDiv = params.vDiv || 10
  const uStep = uDiv > 0 ? (uMax - uMin) / uDiv : 1
  const vStep = vDiv > 0 ? (vMax - vMin) / vDiv : 1

  const points = []
  for (let i = 0; i <= uDiv; i++) {
    points[i] = []
    const u = uMin + uStep * i
    for (let j = 0; j <= vDiv; j++) {
      const v = vMin + vStep * j
      try {
        const x = xFn(u, v), y = yFn(u, v)
        points[i][j] = isFinite(x) && isFinite(y) ? { x, y } : null
      } catch { points[i][j] = null }
    }
  }

  const toPolyline = (pts) => {
    const segments = []
    let current = []
    for (const p of pts) {
      if (p) { current.push(p) }
      else if (current.length > 1) { segments.push(current); current = [] }
      else { current = [] }
    }
    if (current.length > 1) segments.push(current)
    return segments
  }

  const uLines = []
  for (let i = 0; i <= uDiv; i++) uLines.push(...toPolyline(points[i]))
  const vLines = []
  for (let j = 0; j <= vDiv; j++) vLines.push(...toPolyline(points.map(row => row[j])))

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const row of points) for (const p of row) {
    if (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  }
  if (!isFinite(minX)) return { uLines: [], vLines: [], error: 'No valid points' }

  const pad = Math.max(maxX - minX, maxY - minY) * 0.05 || 1
  return { uLines, vLines, bounds: { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad } }
}

function GridSVG({ grid, strokeColor, strokeWidth, opacity, showU, showV, width, height }) {
  if (!grid || grid.error || !grid.bounds) return null
  const { bounds, uLines, vLines } = grid
  const bw = bounds.maxX - bounds.minX || 1
  const bh = bounds.maxY - bounds.minY || 1
  const vb = `${bounds.minX} ${bounds.minY} ${bw} ${bh}`

  const linesToPaths = (lines) => lines.map((seg, i) =>
    <polyline key={i} points={seg.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={strokeColor} strokeWidth={strokeWidth * bw / (width || 400)} opacity={opacity} strokeLinecap="round" strokeLinejoin="round" />
  )

  return (
    <svg viewBox={vb} width={width || '100%'} height={height || '100%'} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      {showU && linesToPaths(uLines)}
      {showV && linesToPaths(vLines)}
    </svg>
  )
}

export default function MathGridModal({ onInsert, onClose }) {
  const [xExpr, setXExpr] = useState('u')
  const [yExpr, setYExpr] = useState('v')
  const [uMin, setUMin] = useState('-5')
  const [uMax, setUMax] = useState('5')
  const [vMin, setVMin] = useState('-5')
  const [vMax, setVMax] = useState('5')
  const [uDiv, setUDiv] = useState(10)
  const [vDiv, setVDiv] = useState(10)
  const [color, setColor] = useState('#6366f1')
  const [lineWidth, setLineWidth] = useState(1.5)
  const [opacity, setOpacity] = useState(0.8)
  const [showU, setShowU] = useState(true)
  const [showV, setShowV] = useState(true)
  const [bg, setBg] = useState('transparent')

  const grid = useMemo(() => generateGrid(xExpr, yExpr, {
    uMin, uMax, vMin, vMax, uDiv, vDiv
  }), [xExpr, yExpr, uMin, uMax, vMin, vMax, uDiv, vDiv])

  const applyPreset = (p) => {
    setXExpr(p.xExpr); setYExpr(p.yExpr)
    setUMin(String(p.uMin)); setUMax(String(p.uMax))
    setVMin(String(p.vMin)); setVMax(String(p.vMax))
    setUDiv(p.uDiv); setVDiv(p.vDiv)
  }

  const handleInsert = () => {
    if (grid.error) return
    const { bounds, uLines, vLines } = grid
    const bw = bounds.maxX - bounds.minX || 1
    const bh = bounds.maxY - bounds.minY || 1
    const sw = lineWidth * bw / 400

    const paths = []
    if (showU) uLines.forEach(seg => paths.push(`<polyline points="${seg.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`))
    if (showV) vLines.forEach(seg => paths.push(`<polyline points="${seg.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`))

    const bgStyle = bg !== 'transparent' ? `background:${bg};` : 'background:transparent;'
    const html = `<style>*{margin:0;padding:0}html,body{width:100%;height:100%;${bgStyle}overflow:hidden}</style>\n<svg viewBox="${bounds.minX} ${bounds.minY} ${bw} ${bh}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">\n${paths.join('\n')}\n</svg>`
    onInsert(html)
  }

  const inputStyle = { width: '100%', padding: '6px 8px', background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 13, fontFamily: "'Fira Code','JetBrains Mono',monospace", boxSizing: 'border-box' }
  const labelStyle = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 3, display: 'block' }
  const smallInputStyle = { ...inputStyle, fontSize: 12, padding: '4px 6px' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 12, width: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Math Grid</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>&times;</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: controls */}
          <div style={{ width: 320, padding: 16, overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Presets */}
            <div>
              <span style={labelStyle}>Presets</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {PRESETS.map(p => (
                  <button key={p.name} onClick={() => applyPreset(p)}
                    style={{ padding: '3px 8px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >{p.name}</button>
                ))}
              </div>
            </div>

            {/* Expressions */}
            <div>
              <span style={labelStyle}>x(u, v)</span>
              <input value={xExpr} onChange={e => setXExpr(e.target.value)} style={inputStyle} spellCheck={false} />
            </div>
            <div>
              <span style={labelStyle}>y(u, v)</span>
              <input value={yExpr} onChange={e => setYExpr(e.target.value)} style={inputStyle} spellCheck={false} />
            </div>

            {/* Ranges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div>
                <span style={labelStyle}>u min</span>
                <input value={uMin} onChange={e => setUMin(e.target.value)} style={smallInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>u max</span>
                <input value={uMax} onChange={e => setUMax(e.target.value)} style={smallInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>u lines</span>
                <input type="number" value={uDiv} onChange={e => setUDiv(Math.max(0, Number(e.target.value) || 0))} style={smallInputStyle} min={0} max={200} />
              </div>
              <div>
                <span style={labelStyle}>v min</span>
                <input value={vMin} onChange={e => setVMin(e.target.value)} style={smallInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>v max</span>
                <input value={vMax} onChange={e => setVMax(e.target.value)} style={smallInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>v lines</span>
                <input type="number" value={vDiv} onChange={e => setVDiv(Math.max(0, Number(e.target.value) || 0))} style={smallInputStyle} min={0} max={200} />
              </div>
            </div>

            {/* Line toggles */}
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showU} onChange={e => setShowU(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> u-lines
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showV} onChange={e => setShowV(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> v-lines
              </label>
            </div>

            {/* Style */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, alignItems: 'end' }}>
              <div>
                <span style={labelStyle}>Color</span>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ width: '100%', height: 28, padding: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
              </div>
              <div>
                <span style={labelStyle}>Width</span>
                <input type="number" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value) || 1)} min={0.1} max={10} step={0.5} style={smallInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>Opacity</span>
                <input type="number" value={opacity} onChange={e => setOpacity(Math.min(1, Math.max(0, Number(e.target.value) || 0.5)))} min={0} max={1} step={0.1} style={smallInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>BG</span>
                <select value={bg} onChange={e => setBg(e.target.value)} style={{ ...smallInputStyle, fontFamily: 'inherit' }}>
                  <option value="transparent">None</option>
                  <option value="#0a0a14">Dark</option>
                  <option value="#1e1e2e">Slate</option>
                  <option value="#ffffff">White</option>
                  <option value="#000000">Black</option>
                </select>
              </div>
            </div>

            {grid.error && (
              <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, fontSize: 12, color: '#f87171' }}>
                {grid.error}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Available: sin, cos, tan, abs, sqrt, pow, exp, log, PI, E, atan2, hypot, sinh, cosh, tanh, min, max, sign, floor, ceil, round
            </div>
          </div>

          {/* Right: preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Preview</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg !== 'transparent' ? bg : '#0a0a14', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minHeight: 300 }}>
              {!grid.error && grid.bounds ? (
                <GridSVG grid={grid} strokeColor={color} strokeWidth={lineWidth} opacity={opacity} showU={showU} showV={showV} width={440} height={360} />
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Enter valid expressions</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 20px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleInsert} disabled={!!grid.error}
                style={{ padding: '8px 24px', background: grid.error ? 'var(--bg-hover)' : 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', cursor: grid.error ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: grid.error ? 0.5 : 1 }}>
                Insert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
