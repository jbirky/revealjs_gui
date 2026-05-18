import { describe, it, expect } from 'vitest'
import { pointsToPath, simplifyPoints } from './drawingUtils'

describe('pointsToPath', () => {
  it('returns empty string for null/empty input', () => {
    expect(pointsToPath(null)).toBe('')
    expect(pointsToPath([])).toBe('')
    expect(pointsToPath([{ x: 0, y: 0 }])).toBe('')
  })

  it('produces a straight line for two points', () => {
    const path = pointsToPath([{ x: 0, y: 0 }, { x: 100, y: 50 }])
    expect(path).toBe('M 0 0 L 100 50')
  })

  it('uses line segments when smooth=false', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 25 }, { x: 100, y: 0 }]
    const path = pointsToPath(pts, false)
    expect(path).toContain('M 0 0')
    expect(path).toContain('L 50 25')
    expect(path).toContain('L 100 0')
    expect(path).not.toContain('C')
  })

  it('uses cubic bezier curves when smooth=true and >= 3 points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]
    const path = pointsToPath(pts, true)
    expect(path).toContain('M 0 0')
    expect(path).toContain('C')
  })

  it('produces one C segment per inter-point gap', () => {
    const pts = [{ x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 0 }, { x: 90, y: 30 }]
    const path = pointsToPath(pts, true)
    const cCount = (path.match(/C /g) || []).length
    expect(cCount).toBe(3)
  })
})

describe('simplifyPoints', () => {
  it('returns empty array for null/empty input', () => {
    expect(simplifyPoints(null)).toEqual([])
    expect(simplifyPoints([])).toEqual([])
  })

  it('returns points unchanged when <= 2', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    expect(simplifyPoints(pts)).toEqual(pts)
  })

  it('removes collinear interior points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]
    const result = simplifyPoints(pts, 1)
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }])
  })

  it('keeps points that deviate beyond tolerance', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 20 }, { x: 10, y: 0 }]
    const result = simplifyPoints(pts, 1)
    expect(result.length).toBe(3)
  })

  it('higher tolerance simplifies more aggressively', () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({
      x: i * 10,
      y: Math.sin(i * 0.3) * 5,
    }))
    const loose = simplifyPoints(pts, 10)
    const tight = simplifyPoints(pts, 0.5)
    expect(loose.length).toBeLessThanOrEqual(tight.length)
  })
})
