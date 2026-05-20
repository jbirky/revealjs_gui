// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const POSITION_EPSILON = 0.5

function roughlyEqual(a, b) {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < POSITION_EPSILON
  return false
}

function describeChanges(oldEl, newEl) {
  const changes = []
  const posKeys = ['x', 'y']
  const sizeKeys = ['width', 'height']
  const styleKeys = ['fill', 'stroke', 'strokeWidth', 'opacity', 'rotation', 'borderRadius', 'fontSize', 'objectFit', 'zIndex']
  const contentKeys = ['content', 'src', 'language', 'chartType', 'shape', 'iconName']

  for (const k of posKeys) {
    if (!roughlyEqual(oldEl[k], newEl[k])) changes.push(`${k}: ${Math.round(oldEl[k])} → ${Math.round(newEl[k])}`)
  }
  for (const k of sizeKeys) {
    if (!roughlyEqual(oldEl[k], newEl[k])) changes.push(`${k}: ${Math.round(oldEl[k])} → ${Math.round(newEl[k])}`)
  }
  for (const k of styleKeys) {
    if (oldEl[k] !== undefined && newEl[k] !== undefined && oldEl[k] !== newEl[k]) {
      changes.push(`${k}: ${oldEl[k]} → ${newEl[k]}`)
    } else if (oldEl[k] === undefined && newEl[k] !== undefined) {
      changes.push(`${k}: (none) → ${newEl[k]}`)
    } else if (oldEl[k] !== undefined && newEl[k] === undefined) {
      changes.push(`${k}: ${oldEl[k]} → (removed)`)
    }
  }
  for (const k of contentKeys) {
    if (oldEl[k] !== newEl[k]) {
      if (k === 'content') {
        const oldLen = (oldEl[k] || '').length
        const newLen = (newEl[k] || '').length
        changes.push(`content changed (${oldLen} → ${newLen} chars)`)
      } else {
        changes.push(`${k}: ${oldEl[k] || '(none)'} → ${newEl[k] || '(none)'}`)
      }
    }
  }
  return changes
}

function classifyElementChange(oldEl, newEl) {
  const posChanged = !roughlyEqual(oldEl.x, newEl.x) || !roughlyEqual(oldEl.y, newEl.y)
  const sizeChanged = !roughlyEqual(oldEl.width, newEl.width) || !roughlyEqual(oldEl.height, newEl.height)
  const contentKeys = ['content', 'src', 'language', 'chartType', 'shape', 'iconName']
  const contentChanged = contentKeys.some(k => oldEl[k] !== newEl[k])
  const chartChanged = JSON.stringify(oldEl.chartData) !== JSON.stringify(newEl.chartData)
  const styleKeys = ['fill', 'stroke', 'strokeWidth', 'opacity', 'rotation', 'borderRadius', 'fontSize', 'objectFit', 'zIndex']
  const styleChanged = styleKeys.some(k => oldEl[k] !== newEl[k])

  if (contentChanged || chartChanged) return 'content-changed'
  if (posChanged && sizeChanged) return 'moved'
  if (posChanged) return 'moved'
  if (sizeChanged) return 'resized'
  if (styleChanged) return 'style-changed'
  return null
}

function diffElements(oldElements, newElements) {
  const oldMap = new Map((oldElements || []).map(el => [el.id, el]))
  const newMap = new Map((newElements || []).map(el => [el.id, el]))
  const result = []

  for (const [id, newEl] of newMap) {
    if (!oldMap.has(id)) {
      result.push({ status: 'added', elementId: id, oldElement: null, newElement: newEl, changes: [] })
    } else {
      const oldEl = oldMap.get(id)
      const status = classifyElementChange(oldEl, newEl)
      if (status) {
        result.push({ status, elementId: id, oldElement: oldEl, newElement: newEl, changes: describeChanges(oldEl, newEl) })
      }
    }
  }

  for (const [id, oldEl] of oldMap) {
    if (!newMap.has(id)) {
      result.push({ status: 'removed', elementId: id, oldElement: oldEl, newElement: null, changes: [] })
    }
  }

  return result
}

function diffSlideOtherChanges(oldSlide, newSlide) {
  const changes = []
  if (JSON.stringify(oldSlide.background) !== JSON.stringify(newSlide.background)) {
    changes.push('Background changed')
  }
  if ((oldSlide.notes || '') !== (newSlide.notes || '')) {
    changes.push('Speaker notes changed')
  }
  if ((oldSlide.transition || '') !== (newSlide.transition || '')) {
    changes.push(`Transition: ${oldSlide.transition || 'default'} → ${newSlide.transition || 'default'}`)
  }
  if ((oldSlide.section || '') !== (newSlide.section || '')) {
    changes.push(`Section: "${oldSlide.section || ''}" → "${newSlide.section || ''}"`)
  }
  return changes
}

export function diffPresentations(oldPres, newPres) {
  const oldSlides = oldPres?.slides || []
  const newSlides = newPres?.slides || []

  const oldMap = new Map(oldSlides.map((s, i) => [s.id, { slide: s, index: i }]))
  const newMap = new Map(newSlides.map((s, i) => [s.id, { slide: s, index: i }]))

  const slides = []
  let added = 0, removed = 0, modified = 0, unchanged = 0

  for (let i = 0; i < newSlides.length; i++) {
    const s = newSlides[i]
    if (!oldMap.has(s.id)) {
      slides.push({ status: 'added', slideId: s.id, oldIndex: null, newIndex: i, slide: s, elements: [], otherChanges: [] })
      added++
    } else {
      const old = oldMap.get(s.id)
      const elements = diffElements(old.slide.elements, s.elements)
      const otherChanges = diffSlideOtherChanges(old.slide, s)
      if (elements.length > 0 || otherChanges.length > 0) {
        slides.push({ status: 'modified', slideId: s.id, oldIndex: old.index, newIndex: i, slide: s, elements, otherChanges })
        modified++
      } else {
        slides.push({ status: 'unchanged', slideId: s.id, oldIndex: old.index, newIndex: i, slide: s, elements: [], otherChanges: [] })
        unchanged++
      }
    }
  }

  for (let i = 0; i < oldSlides.length; i++) {
    const s = oldSlides[i]
    if (!newMap.has(s.id)) {
      slides.push({ status: 'removed', slideId: s.id, oldIndex: i, newIndex: null, slide: s, elements: [], otherChanges: [] })
      removed++
    }
  }

  return {
    summary: { added, removed, modified, unchanged },
    slides,
  }
}
