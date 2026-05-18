import { describe, it, expect } from 'vitest'
import { SHAPES, shapeSvgString } from './shapeUtils'

describe('SHAPES', () => {
  it('contains expected shape types', () => {
    const ids = SHAPES.map(s => s.id)
    expect(ids).toContain('rect')
    expect(ids).toContain('circle')
    expect(ids).toContain('triangle')
    expect(ids).toContain('star')
    expect(ids).toContain('line')
  })

  it('each shape has id, name, and icon', () => {
    for (const s of SHAPES) {
      expect(s.id).toBeTruthy()
      expect(s.name).toBeTruthy()
      expect(s.icon).toBeTruthy()
    }
  })
})

describe('shapeSvgString', () => {
  const base = { width: 200, height: 100 }

  it('returns an SVG element with correct viewBox', () => {
    const svg = shapeSvgString({ ...base, shape: 'rect' })
    expect(svg).toContain('viewBox="0 0 200 100"')
    expect(svg).toMatch(/^<svg/)
    expect(svg).toMatch(/<\/svg>$/)
  })

  it('renders a <rect> for shape=rect', () => {
    const svg = shapeSvgString({ ...base, shape: 'rect' })
    expect(svg).toContain('<rect')
  })

  it('renders an <ellipse> for shape=circle', () => {
    const svg = shapeSvgString({ ...base, shape: 'circle' })
    expect(svg).toContain('<ellipse')
  })

  it('renders a <polygon> for triangle', () => {
    const svg = shapeSvgString({ ...base, shape: 'triangle' })
    expect(svg).toContain('<polygon')
  })

  it('renders a <polygon> with 10 points for star', () => {
    const svg = shapeSvgString({ ...base, shape: 'star' })
    expect(svg).toContain('<polygon')
    const match = svg.match(/points="([^"]+)"/)
    expect(match).toBeTruthy()
    const points = match[1].split(' ')
    expect(points.length).toBe(10)
  })

  it('renders <line> for shape=line', () => {
    const svg = shapeSvgString({ ...base, shape: 'line' })
    expect(svg).toContain('<line')
  })

  it('renders line + arrowhead for shape=line-arrow (if available)', () => {
    const hasLineArrow = SHAPES.some(s => s.id === 'line-arrow')
    if (!hasLineArrow) return
    const svg = shapeSvgString({ ...base, shape: 'line-arrow' })
    expect(svg).toContain('<line')
    expect(svg).toContain('<polyline')
  })

  it('applies fill and stroke', () => {
    const svg = shapeSvgString({ ...base, shape: 'rect', fill: '#ff0000', stroke: '#00ff00', strokeWidth: 3 })
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).toContain('stroke="#00ff00"')
    expect(svg).toContain('stroke-width="3"')
  })

  it('applies stroke-dasharray for dashed style', () => {
    const svg = shapeSvgString({ ...base, shape: 'rect', stroke: '#fff', strokeWidth: 2, strokeDasharray: 'dashed' })
    expect(svg).toContain('stroke-dasharray="6 4"')
  })

  it('includes text element when el.text is set', () => {
    const svg = shapeSvgString({ ...base, shape: 'rect', text: 'Hello', fontSize: 20, textColor: '#fff' })
    expect(svg).toContain('<text')
    expect(svg).toContain('Hello')
    expect(svg).toContain('font-size="20"')
  })
})
