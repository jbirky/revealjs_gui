import { describe, it, expect } from 'vitest'
import { diffPresentations } from './presentationDiff'

function makePres(slides = []) {
  return { title: 'Test', theme: 'black', transition: 'slide', slides }
}

function makeSlide(id, elements = [], overrides = {}) {
  return { id, elements, background: { type: 'color', color: '#000' }, notes: '', ...overrides }
}

function makeEl(id, overrides = {}) {
  return { id, type: 'text', x: 100, y: 100, width: 400, height: 60, zIndex: 1, content: '<p>Hello</p>', ...overrides }
}

describe('diffPresentations', () => {
  it('returns all unchanged for identical presentations', () => {
    const pres = makePres([makeSlide('s1', [makeEl('e1')])])
    const result = diffPresentations(pres, pres)
    expect(result.summary).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 1 })
    expect(result.slides[0].status).toBe('unchanged')
  })

  it('detects an added slide', () => {
    const old = makePres([makeSlide('s1')])
    const newP = makePres([makeSlide('s1'), makeSlide('s2')])
    const result = diffPresentations(old, newP)
    expect(result.summary.added).toBe(1)
    const addedSlide = result.slides.find(s => s.status === 'added')
    expect(addedSlide.slideId).toBe('s2')
    expect(addedSlide.newIndex).toBe(1)
  })

  it('detects a removed slide', () => {
    const old = makePres([makeSlide('s1'), makeSlide('s2')])
    const newP = makePres([makeSlide('s1')])
    const result = diffPresentations(old, newP)
    expect(result.summary.removed).toBe(1)
    const removedSlide = result.slides.find(s => s.status === 'removed')
    expect(removedSlide.slideId).toBe('s2')
    expect(removedSlide.oldIndex).toBe(1)
  })

  it('detects a modified slide with added element', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1')])])
    const newP = makePres([makeSlide('s1', [makeEl('e1'), makeEl('e2')])])
    const result = diffPresentations(old, newP)
    expect(result.summary.modified).toBe(1)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements).toHaveLength(1)
    expect(mod.elements[0].status).toBe('added')
    expect(mod.elements[0].elementId).toBe('e2')
  })

  it('detects a modified slide with removed element', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1'), makeEl('e2')])])
    const newP = makePres([makeSlide('s1', [makeEl('e1')])])
    const result = diffPresentations(old, newP)
    expect(result.summary.modified).toBe(1)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements.find(e => e.status === 'removed').elementId).toBe('e2')
  })

  it('detects element moved', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { x: 100, y: 100 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { x: 200, y: 150 })])])
    const result = diffPresentations(old, newP)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements[0].status).toBe('moved')
    expect(mod.elements[0].changes).toContain('x: 100 → 200')
    expect(mod.elements[0].changes).toContain('y: 100 → 150')
  })

  it('detects element resized', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { width: 400, height: 60 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { width: 600, height: 120 })])])
    const result = diffPresentations(old, newP)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements[0].status).toBe('resized')
  })

  it('detects element content changed', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { content: '<p>Old</p>' })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { content: '<p>New text here</p>' })])])
    const result = diffPresentations(old, newP)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements[0].status).toBe('content-changed')
    expect(mod.elements[0].changes.some(c => c.includes('content changed'))).toBe(true)
  })

  it('detects element style changed', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { opacity: 1 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { opacity: 0.5 })])])
    const result = diffPresentations(old, newP)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements[0].status).toBe('style-changed')
  })

  it('detects background change', () => {
    const old = makePres([makeSlide('s1', [], { background: { type: 'color', color: '#000' } })])
    const newP = makePres([makeSlide('s1', [], { background: { type: 'color', color: '#fff' } })])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].status).toBe('modified')
    expect(result.slides[0].otherChanges).toContain('Background changed')
  })

  it('detects notes change', () => {
    const old = makePres([makeSlide('s1', [], { notes: 'old notes' })])
    const newP = makePres([makeSlide('s1', [], { notes: 'new notes' })])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].otherChanges).toContain('Speaker notes changed')
  })

  it('matches slides by id regardless of order', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1')]), makeSlide('s2', [makeEl('e2')])])
    const newP = makePres([makeSlide('s2', [makeEl('e2')]), makeSlide('s1', [makeEl('e1')])])
    const result = diffPresentations(old, newP)
    expect(result.summary.modified).toBe(0)
    expect(result.summary.unchanged).toBe(2)
  })

  it('handles empty presentations', () => {
    const result = diffPresentations(makePres([]), makePres([]))
    expect(result.summary).toEqual({ added: 0, removed: 0, modified: 0, unchanged: 0 })
    expect(result.slides).toHaveLength(0)
  })

  it('handles null/undefined slides gracefully', () => {
    const result = diffPresentations({ slides: null }, { slides: undefined })
    expect(result.summary.unchanged).toBe(0)
    expect(result.slides).toHaveLength(0)
  })

  it('ignores floating point noise in position', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { x: 100.0000001, y: 200.0000001 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { x: 100.0000002, y: 200.0000002 })])])
    const result = diffPresentations(old, newP)
    expect(result.summary.unchanged).toBe(1)
  })

  it('handles slides with no elements', () => {
    const old = makePres([makeSlide('s1', [])])
    const newP = makePres([makeSlide('s1', [])])
    const result = diffPresentations(old, newP)
    expect(result.summary.unchanged).toBe(1)
  })

  it('reports multiple element changes on the same slide', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1'), makeEl('e2'), makeEl('e3')])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { x: 500 }), makeEl('e3', { content: '<p>Changed</p>' })])])
    const result = diffPresentations(old, newP)
    const mod = result.slides.find(s => s.status === 'modified')
    expect(mod.elements).toHaveLength(3)
    expect(mod.elements.filter(e => e.status === 'moved')).toHaveLength(1)
    expect(mod.elements.filter(e => e.status === 'removed')).toHaveLength(1)
    expect(mod.elements.filter(e => e.status === 'content-changed')).toHaveLength(1)
  })

  it('detects image src change as content-changed', () => {
    const old = makePres([makeSlide('s1', [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 100, zIndex: 1, src: '/uploads/old.png' }])])
    const newP = makePres([makeSlide('s1', [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 100, zIndex: 1, src: '/uploads/new.png' }])])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].status).toBe('modified')
    expect(result.slides[0].elements[0].status).toBe('content-changed')
  })

  it('detects zIndex change as style-changed', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { zIndex: 1 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { zIndex: 5 })])])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].elements[0].status).toBe('style-changed')
    expect(result.slides[0].elements[0].changes.some(c => c.includes('zIndex'))).toBe(true)
  })

  it('detects slide transition change in otherChanges', () => {
    const old = makePres([makeSlide('s1', [], { transition: 'fade' })])
    const newP = makePres([makeSlide('s1', [], { transition: 'zoom' })])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].otherChanges.some(c => c.includes('fade') && c.includes('zoom'))).toBe(true)
  })

  it('treats content change as higher priority than style change', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { content: '<p>A</p>', opacity: 1 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { content: '<p>B</p>', opacity: 0.5 })])])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].elements[0].status).toBe('content-changed')
  })

  it('handles all slides removed', () => {
    const old = makePres([makeSlide('s1'), makeSlide('s2'), makeSlide('s3')])
    const newP = makePres([])
    const result = diffPresentations(old, newP)
    expect(result.summary.removed).toBe(3)
    expect(result.summary.added).toBe(0)
    expect(result.slides).toHaveLength(3)
  })

  it('handles all slides added', () => {
    const old = makePres([])
    const newP = makePres([makeSlide('s1'), makeSlide('s2')])
    const result = diffPresentations(old, newP)
    expect(result.summary.added).toBe(2)
    expect(result.summary.removed).toBe(0)
  })

  it('provides correct oldIndex and newIndex', () => {
    const old = makePres([makeSlide('s1'), makeSlide('s2'), makeSlide('s3')])
    const newP = makePres([makeSlide('s3'), makeSlide('s1')])
    const result = diffPresentations(old, newP)
    const s3 = result.slides.find(s => s.slideId === 's3')
    expect(s3.oldIndex).toBe(2)
    expect(s3.newIndex).toBe(0)
    const s1 = result.slides.find(s => s.slideId === 's1')
    expect(s1.oldIndex).toBe(0)
    expect(s1.newIndex).toBe(1)
    const s2 = result.slides.find(s => s.slideId === 's2')
    expect(s2.status).toBe('removed')
    expect(s2.oldIndex).toBe(1)
    expect(s2.newIndex).toBeNull()
  })

  it('detects element with new style property added', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', {})])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { opacity: 0.7 })])])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].elements[0].status).toBe('style-changed')
    expect(result.slides[0].elements[0].changes.some(c => c.includes('opacity'))).toBe(true)
  })

  it('generates change descriptions for moved + resized element', () => {
    const old = makePres([makeSlide('s1', [makeEl('e1', { x: 50, y: 50, width: 200, height: 100 })])])
    const newP = makePres([makeSlide('s1', [makeEl('e1', { x: 300, y: 200, width: 400, height: 250 })])])
    const result = diffPresentations(old, newP)
    const changes = result.slides[0].elements[0].changes
    expect(changes).toContain('x: 50 → 300')
    expect(changes).toContain('y: 50 → 200')
    expect(changes).toContain('width: 200 → 400')
    expect(changes).toContain('height: 100 → 250')
  })

  it('handles shape type change as content-changed', () => {
    const old = makePres([makeSlide('s1', [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 100, height: 100, zIndex: 1, shape: 'rect' }])])
    const newP = makePres([makeSlide('s1', [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 100, height: 100, zIndex: 1, shape: 'circle' }])])
    const result = diffPresentations(old, newP)
    expect(result.slides[0].elements[0].status).toBe('content-changed')
  })
})
