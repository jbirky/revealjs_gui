import { describe, it, expect } from 'vitest'
import { calculateGuides } from './smartGuides'

describe('calculateGuides', () => {
  const canvasW = 960
  const canvasH = 540

  it('returns original position when no other elements', () => {
    const el = { id: 'a', x: 100, y: 100, width: 80, height: 60 }
    const { snappedX, snappedY, guides } = calculateGuides(el, [el], canvasW, canvasH)
    expect(snappedX).toBe(100)
    expect(snappedY).toBe(100)
    expect(guides).toEqual([])
  })

  it('snaps to canvas left edge', () => {
    const el = { id: 'a', x: 3, y: 100, width: 80, height: 60 }
    const { snappedX, guides } = calculateGuides(el, [el], canvasW, canvasH)
    expect(snappedX).toBe(0)
    expect(guides.some(g => g.axis === 'x' && g.position === 0)).toBe(true)
  })

  it('snaps to canvas center horizontally', () => {
    const el = { id: 'a', x: canvasW / 2 - 40 + 2, y: 100, width: 80, height: 60 }
    const { snappedX, guides } = calculateGuides(el, [el], canvasW, canvasH)
    expect(snappedX).toBe(canvasW / 2 - 40)
    expect(guides.some(g => g.axis === 'x' && g.position === canvasW / 2)).toBe(true)
  })

  it('snaps to canvas top edge', () => {
    const el = { id: 'a', x: 100, y: 4, width: 80, height: 60 }
    const { snappedY, guides } = calculateGuides(el, [el], canvasW, canvasH)
    expect(snappedY).toBe(0)
    expect(guides.some(g => g.axis === 'y' && g.position === 0)).toBe(true)
  })

  it('snaps to another element edge', () => {
    const other = { id: 'b', x: 200, y: 300, width: 100, height: 50 }
    const el = { id: 'a', x: 197, y: 100, width: 80, height: 60 }
    const { snappedX } = calculateGuides(el, [el, other], canvasW, canvasH)
    expect(snappedX).toBe(200)
  })

  it('snaps to another element center', () => {
    const other = { id: 'b', x: 200, y: 100, width: 100, height: 60 }
    const el = { id: 'a', x: 248, y: 200, width: 80, height: 60 }
    const { snappedX } = calculateGuides(el, [el, other], canvasW, canvasH)
    // other centerX = 250, el centerX = 248+40=288 — not within threshold
    // but el left = 248, close to other center 250
    expect(snappedX).toBe(250)
  })

  it('does not snap beyond threshold', () => {
    const el = { id: 'a', x: 50, y: 50, width: 80, height: 60 }
    const { snappedX, snappedY, guides } = calculateGuides(el, [el], canvasW, canvasH)
    expect(snappedX).toBe(50)
    expect(snappedY).toBe(50)
    expect(guides).toEqual([])
  })
})
