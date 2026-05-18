import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateRevealHTML, generatePresenterHTML } from './generateHTML'

function makePres(overrides = {}) {
  return {
    title: 'Test Deck',
    theme: 'black',
    transition: 'slide',
    slideWidth: 960,
    slideHeight: 540,
    slides: [
      { id: 's1', elements: [{ id: 'e1', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Slide 1</h1>' }], section: 'Intro' },
      { id: 's2', elements: [{ id: 'e2', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<p>Slide 2</p>' }], section: 'Intro' },
      { id: 's3', elements: [{ id: 'e3', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<p>Slide 3</p>' }], section: 'Methods' },
    ],
    ...overrides,
  }
}

function parseHTML(html) {
  const win = new Window()
  const doc = win.document
  doc.write(html)
  return doc
}

// ── Overview panel structure ──────────────────────────────────────────

describe('overview panel — DOM structure', () => {
  it('has a toggle button and panel container', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    expect(doc.getElementById('overview-toggle')).toBeTruthy()
    expect(doc.getElementById('overview-panel')).toBeTruthy()
    expect(doc.getElementById('ov-body')).toBeTruthy()
    expect(doc.getElementById('ov-count')).toBeTruthy()
  })

  it('panel starts hidden (no "open" class)', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    const panel = doc.getElementById('overview-panel')
    expect(panel.classList.contains('open')).toBe(false)
  })

  it('uses linear layout class by default', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    const body = doc.getElementById('ov-body')
    expect(body.classList.contains('linear')).toBe(true)
    expect(body.classList.contains('sections')).toBe(false)
  })

  it('uses sections layout class when configured', () => {
    const doc = parseHTML(generateRevealHTML(makePres({ overviewLayout: 'sections' })))
    const body = doc.getElementById('ov-body')
    expect(body.classList.contains('sections')).toBe(true)
    expect(body.classList.contains('linear')).toBe(false)
  })

  it('toggle button has keyboard hint in title', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    const btn = doc.getElementById('overview-toggle')
    expect(btn.getAttribute('title')).toContain('G')
  })
})

describe('overview panel — JS data', () => {
  it('embeds correct slide count', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('SLIDES.length')
    expect(html).toContain('"flatIdx":0')
    expect(html).toContain('"flatIdx":1')
    expect(html).toContain('"flatIdx":2')
  })

  it('embeds section labels in metadata', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('"section":"Intro"')
    expect(html).toContain('"section":"Methods"')
  })

  it('assigns correct h/v coordinates for 1D slides', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('"h":0,"v":0')
    expect(html).toContain('"h":1,"v":0')
    expect(html).toContain('"h":2,"v":0')
  })

  it('assigns correct h/v coordinates for 2D column slides', () => {
    const pres = makePres({
      slides: [
        { id: 's1', column: 0, elements: [], section: 'A' },
        { id: 's2', column: 0, elements: [], section: 'A' },
        { id: 's3', column: 1, elements: [], section: 'B' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('"h":0,"v":0')
    expect(html).toContain('"h":0,"v":1')
    expect(html).toContain('"h":1,"v":0')
  })

  it('overview JS registers Reveal.on ready and slidechanged', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain("Reveal.on('ready'")
    expect(html).toContain("Reveal.on('slidechanged'")
  })

  it('overview JS calls Reveal.slide on thumbnail click', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('Reveal.slide(meta.h, meta.v)')
  })

  it('overview JS has toggle key handler for G', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toMatch(/e\.key\s*===\s*'g'\s*\|\|\s*e\.key\s*===\s*'G'/)
  })
})

// ── Slide sections in reveal DOM ──────────────────────────────────────

describe('slide sections — DOM structure', () => {
  it('renders one <section> per slide in 1D mode', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    expect(sections.length).toBe(3)
  })

  it('renders nested sections for 2D columns', () => {
    const pres = makePres({
      slides: [
        { id: 's1', column: 0, elements: [] },
        { id: 's2', column: 0, elements: [] },
        { id: 's3', column: 1, elements: [] },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const topSections = doc.querySelectorAll('.reveal .slides > section')
    expect(topSections.length).toBe(2)
    const nested = topSections[0].querySelectorAll(':scope > section')
    expect(nested.length).toBe(2)
  })

  it('each slide section has correct dimensions', () => {
    const doc = parseHTML(generateRevealHTML(makePres({ slideWidth: 1280, slideHeight: 720 })))
    const section = doc.querySelector('.reveal .slides > section')
    const style = section.getAttribute('style')
    expect(style).toContain('width:1280px')
    expect(style).toContain('height:720px')
  })
})

// ── Footer rendering ──────────────────────────────────────────────────

describe('footer — basic mode', () => {
  it('renders section label in footer', () => {
    const pres = makePres({ showFooter: true })
    const doc = parseHTML(generateRevealHTML(pres))
    const footers = doc.querySelectorAll('.reveal-footer')
    expect(footers.length).toBeGreaterThan(0)
    const first = footers[0]
    expect(first.textContent).toContain('Intro')
  })

  it('does not render footer when showFooter is false and no page numbers', () => {
    const pres = makePres({ showFooter: false, showPageNumbers: false })
    const doc = parseHTML(generateRevealHTML(pres))
    const footers = doc.querySelectorAll('.reveal-footer')
    expect(footers.length).toBe(0)
  })

  it('renders page numbers in all slides with footer', () => {
    const pres = makePres({ showPageNumbers: true, pageNumberFormat: 'c/t' })
    const doc = parseHTML(generateRevealHTML(pres))
    const footers = doc.querySelectorAll('.reveal-footer')
    expect(footers.length).toBe(3)
    expect(footers[0].textContent).toContain('1 / 3')
    expect(footers[1].textContent).toContain('2 / 3')
    expect(footers[2].textContent).toContain('3 / 3')
  })

  it('page number format "c" shows only current', () => {
    const pres = makePres({ showPageNumbers: true, pageNumberFormat: 'c' })
    const doc = parseHTML(generateRevealHTML(pres))
    const footers = doc.querySelectorAll('.reveal-footer')
    expect(footers[0].textContent).toContain('1')
    expect(footers[0].textContent).not.toContain('/')
  })

  it('hides footer on individual slide when showSlideFooter=false', () => {
    const pres = makePres({
      showFooter: true,
      slides: [
        { id: 's1', elements: [], section: 'Intro' },
        { id: 's2', elements: [], section: 'Intro', showSlideFooter: false },
        { id: 's3', elements: [], section: 'Methods' },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    expect(sections[0].querySelector('.reveal-footer')).toBeTruthy()
    expect(sections[1].querySelector('.reveal-footer')).toBeFalsy()
    expect(sections[2].querySelector('.reveal-footer')).toBeTruthy()
  })
})

describe('footer — sequence mode', () => {
  it('renders sequence section labels', () => {
    const pres = makePres({
      showFooter: true,
      footerMode: 'sequence',
      sequenceSections: [{ label: 'Intro', color: '' }, { label: 'Methods', color: '' }, { label: 'Results', color: '' }],
      slides: [
        { id: 's1', elements: [], activeSection: 0 },
        { id: 's2', elements: [], activeSection: 1 },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const footers = doc.querySelectorAll('.reveal-footer')
    expect(footers.length).toBe(2)
    expect(footers[0].textContent).toContain('Intro')
    expect(footers[0].textContent).toContain('Methods')
    expect(footers[0].textContent).toContain('Results')
  })

  it('applies bold to the active section', () => {
    const pres = makePres({
      showFooter: true,
      footerMode: 'sequence',
      sequenceSections: ['Intro', 'Methods'],
      slides: [{ id: 's1', elements: [], activeSection: 0 }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const footer = doc.querySelector('.reveal-footer')
    const spans = footer.querySelectorAll('span')
    const activeSpan = Array.from(spans).find(s => s.textContent.trim() === 'Intro')
    expect(activeSpan).toBeTruthy()
    expect(activeSpan.getAttribute('style')).toContain('font-weight:700')
  })
})

// ── Time widget ────────────────────────────────────────────────────────

describe('time widget', () => {
  it('renders time widget span when clock mode is set', () => {
    const pres = makePres({ footerTimeMode: 'clock12', showFooter: true })
    const doc = parseHTML(generateRevealHTML(pres))
    const widgets = doc.querySelectorAll('.reveal-time-widget')
    expect(widgets.length).toBeGreaterThan(0)
  })

  it('does not render time widget when mode is none', () => {
    const pres = makePres({ footerTimeMode: 'none', showFooter: true })
    const doc = parseHTML(generateRevealHTML(pres))
    const widgets = doc.querySelectorAll('.reveal-time-widget')
    expect(widgets.length).toBe(0)
  })

  it('timer JS uses correct duration', () => {
    const html = generateRevealHTML(makePres({ footerTimeMode: 'timer-down', timerDuration: 15 }))
    expect(html).toContain('15 * 60')
  })

  it('includes update interval for time widget', () => {
    const html = generateRevealHTML(makePres({ footerTimeMode: 'clock24' }))
    expect(html).toContain('setInterval(update, 1000)')
  })
})

// ── Grid overlay ──────────────────────────────────────────────────────

describe('grid overlay', () => {
  it('renders grid div in slides when showPresentGrid is true', () => {
    const pres = makePres({ showPresentGrid: true, gridSize: 50 })
    const doc = parseHTML(generateRevealHTML(pres))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    for (const sec of sections) {
      const gridDiv = Array.from(sec.querySelectorAll('div')).find(d =>
        (d.getAttribute('style') || '').includes('linear-gradient')
      )
      expect(gridDiv).toBeTruthy()
      expect(gridDiv.getAttribute('style')).toContain('50px 50px')
    }
  })

  it('does not render grid when showPresentGrid is false', () => {
    const pres = makePres({ showPresentGrid: false })
    const doc = parseHTML(generateRevealHTML(pres))
    const section = doc.querySelector('.reveal .slides > section')
    const gridDiv = Array.from(section.querySelectorAll('div')).find(d =>
      (d.getAttribute('style') || '').includes('linear-gradient')
    )
    expect(gridDiv).toBeFalsy()
  })

  it('per-slide grid override works', () => {
    const pres = makePres({
      showPresentGrid: false,
      slides: [
        { id: 's1', elements: [], showPresentGrid: true },
        { id: 's2', elements: [] },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    const hasGrid = (sec) => Array.from(sec.querySelectorAll('div')).some(d =>
      (d.getAttribute('style') || '').includes('linear-gradient')
    )
    expect(hasGrid(sections[0])).toBe(true)
    expect(hasGrid(sections[1])).toBe(false)
  })
})

// ── Slide groups & page numbering ─────────────────────────────────────

describe('slide groups', () => {
  it('grouped slides share the same page number', () => {
    const pres = makePres({
      showPageNumbers: true,
      pageNumberFormat: 'c/t',
      slides: [
        { id: 's1', elements: [], slideGroup: 'g1' },
        { id: 's2', elements: [], slideGroup: 'g1' },
        { id: 's3', elements: [] },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const footers = doc.querySelectorAll('.reveal-footer')
    expect(footers[0].textContent).toContain('1 / 2')
    expect(footers[1].textContent).toContain('1 / 2')
    expect(footers[2].textContent).toContain('2 / 2')
  })

  it('showPageNumber=false excludes slide from total count', () => {
    const pres = makePres({
      showPageNumbers: true,
      pageNumberFormat: 'c/t',
      slides: [
        { id: 's1', elements: [] },
        { id: 's2', elements: [], showPageNumber: false },
        { id: 's3', elements: [] },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    const s1Footer = sections[0].querySelector('.reveal-footer')
    expect(s1Footer.textContent).toContain('1 / 2')
    const s2Footer = sections[1].querySelector('.reveal-footer')
    if (s2Footer) expect(s2Footer.textContent).not.toMatch(/\d+\s*\/\s*\d+/)
    const s3Footer = sections[2].querySelector('.reveal-footer')
    expect(s3Footer.textContent).toContain('2 / 2')
  })
})

// ── Fragments ─────────────────────────────────────────────────────────

describe('fragment elements', () => {
  it('renders fragment class and animation', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [
          { id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'A', fragment: true, fragmentAnimation: 'fade-up' },
          { id: 'e2', type: 'text', x: 0, y: 60, width: 100, height: 50, zIndex: 1, content: 'B', fragment: true, fragmentAnimation: 'slide-left' },
        ],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const frags = doc.querySelectorAll('.fragment')
    expect(frags.length).toBe(2)
    expect(frags[0].classList.contains('fade-up')).toBe(true)
    expect(frags[1].classList.contains('slide-left')).toBe(true)
  })

  it('sets fragment index when provided', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [
          { id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'A', fragment: true, fragmentAnimation: 'fade-in', fragmentIndex: 2 },
        ],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const frag = doc.querySelector('.fragment')
    expect(frag.getAttribute('data-fragment-index')).toBe('2')
  })

  it('fragment CSS rules exist for custom animations', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('.fragment.slide-up')
    expect(html).toContain('.fragment.slide-down')
    expect(html).toContain('.fragment.slide-left')
    expect(html).toContain('.fragment.slide-right')
    expect(html).toContain('.fragment.flip-up')
    expect(html).toContain('.fragment.flip-down')
  })
})

// ── Auto-animate ──────────────────────────────────────────────────────

describe('auto-animate', () => {
  it('sets data-auto-animate on sections', () => {
    const pres = makePres({
      slides: [
        { id: 's1', autoAnimate: true, elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'A' }] },
        { id: 's2', autoAnimate: true, elements: [{ id: 'e1', type: 'text', x: 200, y: 0, width: 100, height: 50, zIndex: 1, content: 'A' }] },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    expect(sections[0].hasAttribute('data-auto-animate')).toBe(true)
    expect(sections[1].hasAttribute('data-auto-animate')).toBe(true)
  })

  it('sets data-id on elements within auto-animate slides', () => {
    const pres = makePres({
      slides: [{ id: 's1', autoAnimate: true, elements: [{ id: 'shared', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'X' }] }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('[data-id="shared"]')
    expect(el).toBeTruthy()
  })

  it('sets custom duration and easing when provided', () => {
    const pres = makePres({
      slides: [{ id: 's1', autoAnimate: true, autoAnimateDuration: 1.5, autoAnimateEasing: 'ease-in-out', elements: [] }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const section = doc.querySelector('.reveal .slides > section')
    expect(section.getAttribute('data-auto-animate-duration')).toBe('1.5')
    expect(section.getAttribute('data-auto-animate-easing')).toBe('ease-in-out')
  })
})

// ── Per-slide transitions ─────────────────────────────────────────────

describe('per-slide transitions', () => {
  it('applies data-transition attribute', () => {
    const pres = makePres({
      slides: [{ id: 's1', elements: [], transition: 'fade' }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const section = doc.querySelector('.reveal .slides > section')
    expect(section.getAttribute('data-transition')).toBe('fade')
  })

  it('applies data-transition-speed attribute', () => {
    const pres = makePres({
      slides: [{ id: 's1', elements: [], transitionSpeed: 'slow' }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const section = doc.querySelector('.reveal .slides > section')
    expect(section.getAttribute('data-transition-speed')).toBe('slow')
  })

  it('uses data-custom-transition for custom transitions', () => {
    const pres = makePres({
      slides: [{ id: 's1', elements: [], transition: 'differential-rotation' }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const section = doc.querySelector('.reveal .slides > section')
    expect(section.getAttribute('data-custom-transition')).toBe('differential-rotation')
    expect(section.getAttribute('data-transition')).toBe('none')
  })
})

// ── Speaker notes ─────────────────────────────────────────────────────

describe('speaker notes', () => {
  it('renders aside.notes for slides with notes', () => {
    const pres = makePres({
      slides: [
        { id: 's1', elements: [], notes: 'Explain this' },
        { id: 's2', elements: [] },
      ],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const notes = doc.querySelectorAll('aside.notes')
    expect(notes.length).toBe(1)
    expect(notes[0].textContent).toBe('Explain this')
  })

  it('does not render aside.notes for slides without notes', () => {
    const pres = makePres({ slides: [{ id: 's1', elements: [] }] })
    const doc = parseHTML(generateRevealHTML(pres))
    expect(doc.querySelector('aside.notes')).toBeFalsy()
  })
})

// ── Image interactions (expand / popup) ──────────────────────────────

describe('image interactions', () => {
  it('adds data-expand attribute when clickToExpand is true', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png', clickToExpand: true }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('[data-expand]')
    expect(el).toBeTruthy()
  })

  it('adds data-popup attribute with text', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png', popupText: 'Caption here' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('[data-popup]')
    expect(el).toBeTruthy()
    expect(el.getAttribute('data-popup')).toBe('Caption here')
  })

  it('expand/popup JS registers click handler', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain("document.addEventListener('click'")
    expect(html).toContain('expand-overlay')
    expect(html).toContain('image-popup')
  })

  it('expand/popup CSS rules are present', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('.expand-overlay')
    expect(html).toContain('.expand-overlay.active')
    expect(html).toContain('.image-popup')
    expect(html).toContain('.image-popup.active')
  })
})

// ── Image citations ───────────────────────────────────────────────────

describe('image citations', () => {
  it('renders caption below image', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png', citationText: 'Source: NASA', citationMode: 'caption' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const cap = doc.querySelector('.image-caption')
    expect(cap).toBeTruthy()
    expect(cap.textContent).toContain('Source: NASA')
  })

  it('renders side citation with superscript number', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png', citationText: 'Smith 2024', citationMode: 'side' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const sup = doc.querySelector('.cite-sup')
    expect(sup).toBeTruthy()
    expect(sup.textContent).toBe('1')
    const sideCite = doc.querySelector('.slide-citations-text')
    expect(sideCite).toBeTruthy()
    expect(sideCite.textContent).toContain('Smith 2024')
  })
})

// ── GSAP entry animations ─────────────────────────────────────────────

describe('GSAP entry animations', () => {
  it('adds data-gsap-enter attributes', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'A', animationEnter: 'fadeUp', animationDelay: 200, animationDuration: 800 }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('[data-gsap-enter="fadeUp"]')
    expect(el).toBeTruthy()
    expect(el.getAttribute('data-gsap-delay')).toBe('200')
    expect(el.getAttribute('data-gsap-duration')).toBe('800')
  })

  it('GSAP preset functions are defined in JS', () => {
    const html = generateRevealHTML(makePres())
    const presets = ['fadeIn', 'fadeUp', 'fadeDown', 'fadeLeft', 'fadeRight', 'zoomIn', 'zoomOut', 'slideUp', 'slideDown']
    for (const name of presets) {
      expect(html).toContain(`${name}:`)
    }
  })

  it('runSlideAnimations is called on ready and slidechanged', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('runSlideAnimations(e.currentSlide)')
  })
})

// ── Fullscreen button ─────────────────────────────────────────────────

describe('fullscreen button', () => {
  it('renders fullscreen button', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    const btn = doc.getElementById('fs-btn')
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('onclick')).toContain('requestFullscreen')
  })

  it('has CSS to hide in fullscreen mode', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain(':fullscreen #fs-btn')
    expect(html).toContain('display: none')
  })
})

// ── Reveal.js initialization ──────────────────────────────────────────

describe('Reveal.js initialization', () => {
  it('loads reveal.js and plugins', () => {
    const doc = parseHTML(generateRevealHTML(makePres()))
    const scripts = Array.from(doc.querySelectorAll('script[src]'))
    const srcs = scripts.map(s => s.getAttribute('src'))
    expect(srcs.some(s => s.includes('reveal.js'))).toBe(true)
    expect(srcs.some(s => s.includes('notes'))).toBe(true)
    expect(srcs.some(s => s.includes('highlight'))).toBe(true)
    expect(srcs.some(s => s.includes('katex'))).toBe(true)
    expect(srcs.some(s => s.includes('gsap'))).toBe(true)
  })

  it('configures correct width/height/margin', () => {
    const html = generateRevealHTML(makePres({ slideWidth: 1280, slideHeight: 720 }))
    expect(html).toContain('width: 1280')
    expect(html).toContain('height: 720')
    expect(html).toContain('margin: 0')
    expect(html).toContain('center: false')
  })

  it('applies global transition to Reveal config', () => {
    const html = generateRevealHTML(makePres({ transition: 'convex' }))
    expect(html).toContain("_globalTransition = 'convex'")
  })

  it('KaTeX rendering is triggered on ready', () => {
    const html = generateRevealHTML(makePres())
    expect(html).toContain('katex.render')
    expect(html).toContain('data-math-latex')
  })
})

// ── Custom CSS ────────────────────────────────────────────────────────

describe('custom CSS', () => {
  it('injects custom CSS in a separate style block', () => {
    const pres = makePres({ customCSS: '.my-thing { color: hotpink; }' })
    const doc = parseHTML(generateRevealHTML(pres))
    const styles = doc.querySelectorAll('style')
    const hasCustom = Array.from(styles).some(s => s.textContent.includes('.my-thing'))
    expect(hasCustom).toBe(true)
  })

  it('does not inject extra style block when customCSS is empty', () => {
    const pres = makePres({ customCSS: '' })
    const html = generateRevealHTML(pres)
    const styleCount = (html.match(/<style>/g) || []).length
    const presWithCustom = makePres({ customCSS: '.x{}' })
    const htmlWithCustom = generateRevealHTML(presWithCustom)
    const styleCountWithCustom = (htmlWithCustom.match(/<style>/g) || []).length
    expect(styleCountWithCustom).toBe(styleCount + 1)
  })
})

// ── Element rendering in DOM ──────────────────────────────────────────

describe('element rendering', () => {
  it('positions elements absolutely with correct coordinates', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 120, y: 80, width: 400, height: 60, zIndex: 3, content: 'Hi' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('.reveal .slides section div[style]')
    const style = el.getAttribute('style')
    expect(style).toContain('position:absolute')
    expect(style).toContain('left:120px')
    expect(style).toContain('top:80px')
    expect(style).toContain('width:400px')
    expect(style).toContain('height:60px')
    expect(style).toContain('z-index:3')
  })

  it('applies rotation to elements', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'Hi', rotation: 45 }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('.reveal .slides section div[style]')
    expect(el.getAttribute('style')).toContain('rotate(45deg)')
  })

  it('applies box-shadow to elements', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'Hi', shadowX: 4, shadowY: 4, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const el = doc.querySelector('.reveal .slides section div[style]')
    expect(el.getAttribute('style')).toContain('box-shadow:4px 4px 10px rgba(0,0,0,0.5)')
  })

  it('renders video element with src attribute', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'video', x: 0, y: 0, width: 400, height: 300, zIndex: 1, src: 'https://example.com/vid.mp4' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const video = doc.querySelector('video')
    expect(video).toBeTruthy()
    expect(video.getAttribute('src')).toBe('https://example.com/vid.mp4')
    expect(video.hasAttribute('controls')).toBe(true)
  })

  it('renders callout with number', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'callout', x: 0, y: 0, width: 40, height: 40, zIndex: 1, calloutNumber: 3, calloutColor: '#ef4444' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const section = doc.querySelector('.reveal .slides > section')
    expect(section.textContent).toContain('3')
    expect(section.innerHTML).toContain('border-radius:50%')
    expect(section.innerHTML).toContain('#ef4444')
  })

  it('renders icon SVG', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'icon', x: 0, y: 0, width: 50, height: 50, zIndex: 1, iconName: 'Heart', iconColor: '#ff0000' }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const svg = doc.querySelector('.reveal .slides section svg')
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('stroke')).toBe('#ff0000')
  })

  it('renders drawing paths', () => {
    const pres = makePres({
      slides: [{
        id: 's1',
        elements: [{
          id: 'e1', type: 'drawing', x: 0, y: 0, width: 200, height: 100, zIndex: 1,
          paths: [{ points: [{ x: 0, y: 0 }, { x: 50, y: 50 }], color: '#ffffff', strokeWidth: 3 }],
        }],
      }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const path = doc.querySelector('.reveal .slides section svg path')
    expect(path).toBeTruthy()
    expect(path.getAttribute('stroke')).toBe('#ffffff')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Presenter Mode tests
// ═══════════════════════════════════════════════════════════════════════

function makePresenterPres(overrides = {}) {
  return {
    title: 'My Talk',
    theme: 'black',
    transition: 'slide',
    slideWidth: 960,
    slideHeight: 540,
    slides: [
      { id: 's1', elements: [{ id: 'e1', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Opening</h1>' }], section: 'Intro', notes: 'Welcome everyone to the talk' },
      { id: 's2', elements: [{ id: 'e2', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<p>Background</p>' }], section: 'Intro', notes: 'Cover the background material' },
      { id: 's3', elements: [{ id: 'e3', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<p>Data</p>' }], section: 'Methods', notes: '' },
      { id: 's4', elements: [{ id: 'e4', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<p>Conclusions</p>' }], section: 'Results', notes: 'Key takeaway here' },
    ],
    ...overrides,
  }
}

describe('presenter mode — layout structure', () => {
  it('returns a complete HTML document', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('</html>')
  })

  it('includes the presentation title in the page title', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('<title>Presenter — My Talk</title>')
  })

  it('has the two-pane layout (main + sidebar)', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    expect(doc.querySelector('.pv-layout')).toBeTruthy()
    expect(doc.querySelector('.pv-main')).toBeTruthy()
    expect(doc.querySelector('.pv-sidebar')).toBeTruthy()
  })

  it('has a header bar with slide indicator', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const indicator = doc.getElementById('pv-slide-indicator')
    expect(indicator).toBeTruthy()
    expect(indicator.textContent).toContain('Slide 1 / 4')
  })

  it('has an elapsed timer element', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const elapsed = doc.getElementById('pv-elapsed')
    expect(elapsed).toBeTruthy()
    expect(elapsed.textContent).toBe('00:00')
  })

  it('has prev/next navigation buttons', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    expect(doc.getElementById('pv-prev')).toBeTruthy()
    expect(doc.getElementById('pv-next')).toBeTruthy()
  })
})

describe('presenter mode — iframe embed', () => {
  it('embeds the presentation in an iframe', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const iframe = doc.getElementById('pv-iframe')
    expect(iframe).toBeTruthy()
    expect(iframe.tagName.toLowerCase()).toBe('iframe')
  })

  it('iframe src is a data URL containing the reveal HTML', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const iframe = doc.getElementById('pv-iframe')
    const src = iframe.getAttribute('src')
    expect(src).toMatch(/^data:text\/html;charset=utf-8,/)
    const decoded = decodeURIComponent(src.replace('data:text/html;charset=utf-8,', ''))
    expect(decoded).toContain('Reveal.initialize')
    expect(decoded).toContain('reveal.js')
  })
})

describe('presenter mode — speaker notes panel', () => {
  it('has a notes section with label', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const notesSection = doc.getElementById('pv-notes')
    expect(notesSection).toBeTruthy()
    expect(notesSection.querySelector('.pv-notes-label').textContent).toBe('Speaker Notes')
  })

  it('has a notes text container', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    expect(doc.getElementById('pv-notes-text')).toBeTruthy()
  })

  it('embeds all slide notes in JS metadata', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('Welcome everyone to the talk')
    expect(html).toContain('Cover the background material')
    expect(html).toContain('Key takeaway here')
  })

  it('includes section labels in JS metadata', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('"section":"Intro"')
    expect(html).toContain('"section":"Methods"')
    expect(html).toContain('"section":"Results"')
  })
})

describe('presenter mode — upcoming slides', () => {
  it('has an upcoming slides section', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const upcoming = doc.getElementById('pv-upcoming')
    expect(upcoming).toBeTruthy()
    expect(upcoming.querySelector('.pv-upcoming-label').textContent).toBe('Upcoming Slides')
  })

  it('renders a thumbnail for each slide', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const thumbs = doc.querySelectorAll('.pv-thumb')
    expect(thumbs.length).toBe(4)
  })

  it('thumbnails have correct data-idx attributes', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const thumbs = doc.querySelectorAll('.pv-thumb')
    expect(thumbs[0].getAttribute('data-idx')).toBe('0')
    expect(thumbs[1].getAttribute('data-idx')).toBe('1')
    expect(thumbs[2].getAttribute('data-idx')).toBe('2')
    expect(thumbs[3].getAttribute('data-idx')).toBe('3')
  })

  it('thumbnails display slide numbers', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const nums = doc.querySelectorAll('.pv-thumb-num')
    expect(nums.length).toBe(4)
    expect(nums[0].textContent).toBe('1')
    expect(nums[1].textContent).toBe('2')
    expect(nums[2].textContent).toBe('3')
    expect(nums[3].textContent).toBe('4')
  })

  it('thumbnails show text content preview from slide elements', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres()))
    const thumbs = doc.querySelectorAll('.pv-thumb')
    expect(thumbs[0].textContent).toContain('Opening')
    expect(thumbs[1].textContent).toContain('Background')
    expect(thumbs[3].textContent).toContain('Conclusions')
  })

  it('thumbnails have correct dimensions for slide aspect ratio', () => {
    const doc = parseHTML(generatePresenterHTML(makePresenterPres({ slideWidth: 960, slideHeight: 540 })))
    const thumb = doc.querySelector('.pv-thumb')
    const style = thumb.getAttribute('style')
    expect(style).toContain('width:140px')
    const expectedH = Math.round(140 * 540 / 960)
    expect(style).toContain(`height:${expectedH}px`)
  })

  it('thumbnails apply background color from slide', () => {
    const pres = makePresenterPres({
      slides: [
        { id: 's1', elements: [], background: { type: 'color', color: '#ff0000' }, notes: '' },
      ],
    })
    const doc = parseHTML(generatePresenterHTML(pres))
    const thumb = doc.querySelector('.pv-thumb')
    expect(thumb.getAttribute('style')).toContain('background:#ff0000')
  })

  it('thumbnails apply gradient background from slide', () => {
    const pres = makePresenterPres({
      slides: [
        { id: 's1', elements: [], background: { type: 'gradient', gradient: 'linear-gradient(red,blue)' }, notes: '' },
      ],
    })
    const doc = parseHTML(generatePresenterHTML(pres))
    const thumb = doc.querySelector('.pv-thumb')
    expect(thumb.getAttribute('style')).toContain('linear-gradient(red,blue)')
  })
})

describe('presenter mode — navigation JS', () => {
  it('has keyboard navigation for arrow keys', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain("e.key === 'ArrowRight'")
    expect(html).toContain("e.key === 'ArrowLeft'")
    expect(html).toContain("e.key === 'ArrowDown'")
    expect(html).toContain("e.key === 'ArrowUp'")
  })

  it('has goFlat function that calls Reveal.slide', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('function goFlat')
    expect(html).toContain('Reveal.slide(idx.h, idx.v)')
  })

  it('has click handlers on prev/next buttons', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain("document.getElementById('pv-prev').onclick")
    expect(html).toContain("document.getElementById('pv-next').onclick")
  })

  it('has click handlers on thumbnails', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('t.onclick = function')
    expect(html).toContain("t.getAttribute('data-idx')")
  })

  it('listens for slidechanged events from Reveal', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain("Reveal.on('slidechanged'")
  })

  it('builds a flat index map from Reveal slides', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('Reveal.getSlides()')
    expect(html).toContain('Reveal.getIndices')
    expect(html).toContain('flatMap')
  })
})

describe('presenter mode — elapsed timer', () => {
  it('starts a setInterval for the timer', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('setInterval(function')
    expect(html).toContain('startTime')
    expect(html).toContain('Date.now()')
  })

  it('formats time with hours when needed', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain("h > 0")
    expect(html).toContain("h + ':'")
  })
})

describe('presenter mode — updateState function', () => {
  it('updates notes text from slide metadata', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('function updateState')
    expect(html).toContain('meta.notes')
    expect(html).toContain('pv-notes-empty')
  })

  it('updates the slide indicator with section name', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('indicator.textContent')
    expect(html).toContain('meta.section')
  })

  it('toggles current and active classes on thumbnails', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain("'current'")
    expect(html).toContain("'active'")
    expect(html).toContain('i === flatIdx')
    expect(html).toContain('i <= flatIdx + 3')
  })

  it('auto-scrolls upcoming thumbnails', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('scrollIntoView')
  })
})

describe('presenter mode — iframe sizing', () => {
  it('has a sizeIframe function that maintains aspect ratio', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain('function sizeIframe')
    expect(html).toContain('aspect')
    expect(html).toContain('960 / 540')
  })

  it('resizes on window resize event', () => {
    const html = generatePresenterHTML(makePresenterPres())
    expect(html).toContain("window.addEventListener('resize', sizeIframe)")
  })

  it('uses correct dimensions for custom slide size', () => {
    const html = generatePresenterHTML(makePresenterPres({ slideWidth: 1280, slideHeight: 720 }))
    expect(html).toContain('1280 / 720')
  })
})

describe('presenter mode — escaping', () => {
  it('escapes HTML in the title', () => {
    const html = generatePresenterHTML(makePresenterPres({ title: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<title>Presenter — <script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes notes content in JS metadata', () => {
    const pres = makePresenterPres({
      slides: [{ id: 's1', elements: [], notes: 'Use <b>bold</b> & "quotes"' }],
    })
    const html = generatePresenterHTML(pres)
    expect(html).toContain('Use <b>bold</b>')
  })
})
