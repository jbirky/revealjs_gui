import { describe, it, expect } from 'vitest'

// Test diagram geometry helpers (extracted from DiagramModal logic)
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
  const hw = shape.w / 2, hh = shape.h / 2
  const ax = Math.abs(Math.cos(angle)), ay = Math.abs(Math.sin(angle))
  const t = Math.min(hw / (ax || 1), hh / (ay || 1))
  return { x: c.x + t * Math.cos(angle), y: c.y + t * Math.sin(angle) }
}

function renderShapeSVG(s) {
  const stroke = s.stroke || '#6366f1'
  const fill = s.fill || 'rgba(99,102,241,0.15)'
  if (s.shape === 'circle') {
    return `<ellipse cx="${s.x + s.r}" cy="${s.y + s.r}" rx="${s.r}" ry="${s.r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
  }
  if (s.shape === 'diamond') {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2
    return `<polygon points="${cx},${s.y} ${s.x + s.w},${cy} ${cx},${s.y + s.h} ${s.x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
  }
  if (s.shape === 'rounded') {
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
  }
  return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
}

describe('shapeCenter', () => {
  it('computes center of rectangle', () => {
    const c = shapeCenter({ shape: 'rect', x: 100, y: 200, w: 120, h: 60 })
    expect(c).toEqual({ x: 160, y: 230 })
  })

  it('computes center of circle', () => {
    const c = shapeCenter({ shape: 'circle', x: 50, y: 50, r: 30 })
    expect(c).toEqual({ x: 80, y: 80 })
  })

  it('computes center of diamond', () => {
    const c = shapeCenter({ shape: 'diamond', x: 0, y: 0, w: 100, h: 80 })
    expect(c).toEqual({ x: 50, y: 40 })
  })
})

describe('connectorEndpoint', () => {
  it('returns point on circle perimeter toward target', () => {
    const circle = { shape: 'circle', x: 100, y: 100, r: 50 }
    const target = { x: 300, y: 150 }
    const pt = connectorEndpoint(circle, target)
    const center = shapeCenter(circle)
    const dist = Math.sqrt((pt.x - center.x) ** 2 + (pt.y - center.y) ** 2)
    expect(dist).toBeCloseTo(50, 1)
  })

  it('returns point on rect edge toward target', () => {
    const rect = { shape: 'rect', x: 100, y: 100, w: 120, h: 60 }
    const target = { x: 400, y: 130 }
    const pt = connectorEndpoint(rect, target)
    const center = shapeCenter(rect)
    expect(pt.x).toBeGreaterThan(center.x)
    expect(pt.x).toBeLessThanOrEqual(rect.x + rect.w)
  })

  it('endpoint is between center and target', () => {
    const rect = { shape: 'rect', x: 0, y: 0, w: 100, h: 80 }
    const target = { x: 300, y: 40 }
    const pt = connectorEndpoint(rect, target)
    const center = shapeCenter(rect)
    expect(pt.x).toBeGreaterThan(center.x)
    expect(pt.x).toBeLessThan(target.x)
  })
})

describe('renderShapeSVG', () => {
  it('renders rectangle as <rect>', () => {
    const svg = renderShapeSVG({ shape: 'rect', x: 10, y: 20, w: 100, h: 50 })
    expect(svg).toContain('<rect')
    expect(svg).toContain('x="10"')
    expect(svg).toContain('width="100"')
    expect(svg).not.toContain('rx=')
  })

  it('renders rounded rect with rx attribute', () => {
    const svg = renderShapeSVG({ shape: 'rounded', x: 0, y: 0, w: 120, h: 60 })
    expect(svg).toContain('<rect')
    expect(svg).toContain('rx="8"')
  })

  it('renders circle as <ellipse>', () => {
    const svg = renderShapeSVG({ shape: 'circle', x: 50, y: 50, r: 30 })
    expect(svg).toContain('<ellipse')
    expect(svg).toContain('cx="80"')
    expect(svg).toContain('ry="30"')
  })

  it('renders diamond as <polygon>', () => {
    const svg = renderShapeSVG({ shape: 'diamond', x: 0, y: 0, w: 100, h: 80 })
    expect(svg).toContain('<polygon')
    expect(svg).toContain('points=')
  })

  it('uses provided fill and stroke', () => {
    const svg = renderShapeSVG({ shape: 'rect', x: 0, y: 0, w: 50, h: 50, fill: '#ff0000', stroke: '#00ff00' })
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).toContain('stroke="#00ff00"')
  })

  it('uses defaults when fill/stroke not provided', () => {
    const svg = renderShapeSVG({ shape: 'rect', x: 0, y: 0, w: 50, h: 50 })
    expect(svg).toContain('fill="rgba(99,102,241,0.15)"')
    expect(svg).toContain('stroke="#6366f1"')
  })
})
