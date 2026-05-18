import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub browser APIs that generateHTML uses (only window.location.origin for absoluteSrc)
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateRevealHTML } from './generateHTML'

function makePresentation(overrides = {}) {
  return {
    title: 'Test Deck',
    theme: 'black',
    transition: 'slide',
    slideWidth: 960,
    slideHeight: 540,
    slides: [
      {
        id: 's1',
        elements: [
          { id: 'e1', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Title</h1>' },
        ],
        background: { type: 'color', color: '#1e1e2e' },
      },
    ],
    ...overrides,
  }
}

describe('generateRevealHTML', () => {
  it('returns a complete HTML document', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html>')
    expect(html).toContain('</html>')
    expect(html).toContain('Reveal.initialize')
  })

  it('includes the presentation title', () => {
    const html = generateRevealHTML(makePresentation({ title: 'My Talk' }))
    expect(html).toContain('<title>My Talk</title>')
  })

  it('escapes HTML in the title', () => {
    const html = generateRevealHTML(makePresentation({ title: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<title><script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('applies the selected theme', () => {
    const html = generateRevealHTML(makePresentation({ theme: 'moon' }))
    expect(html).toContain('/theme/moon.css')
  })

  it('sets the correct slide dimensions in Reveal.initialize', () => {
    const html = generateRevealHTML(makePresentation({ slideWidth: 1280, slideHeight: 720 }))
    expect(html).toContain('width: 1280')
    expect(html).toContain('height: 720')
  })

  it('renders text elements', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('<h1>Title</h1>')
  })

  it('renders image elements with absolute src', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: '/uploads/photo.png' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('http://localhost:3000/uploads/photo.png')
  })

  it('preserves absolute image urls', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('https://example.com/img.png')
  })

  it('applies the global transition', () => {
    const html = generateRevealHTML(makePresentation({ transition: 'fade' }))
    expect(html).toContain("'fade'")
  })

  it('renders footer when showFooter is true', () => {
    const pres = makePresentation({
      showFooter: true,
      slides: [{ id: 's1', elements: [], section: 'Intro' }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('reveal-footer')
    expect(html).toContain('Intro')
  })

  it('renders page numbers when enabled', () => {
    const pres = makePresentation({
      showPageNumbers: true,
      pageNumberFormat: 'c/t',
      slides: [
        { id: 's1', elements: [] },
        { id: 's2', elements: [] },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('1 / 2')
  })

  it('includes speaker notes', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [], notes: 'Remember to pause here' }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('<aside class="notes">Remember to pause here</aside>')
  })

  it('applies per-slide background color', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [], background: { type: 'color', color: '#ff0000' } }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('data-background-color="#ff0000"')
  })

  it('applies per-slide background image', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1', elements: [],
        background: { type: 'image', image: 'https://example.com/bg.jpg', size: 'contain' },
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('data-background-image="https://example.com/bg.jpg"')
    expect(html).toContain('data-background-size="contain"')
  })

  it('applies auto-animate attributes', () => {
    const pres = makePresentation({
      slides: [
        { id: 's1', autoAnimate: true, elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'A' }] },
        { id: 's2', autoAnimate: true, elements: [{ id: 'e1', type: 'text', x: 200, y: 0, width: 100, height: 50, zIndex: 1, content: 'A' }] },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('data-auto-animate')
    expect(html).toContain('data-id="e1"')
  })

  it('renders fragment elements', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'Hi', fragment: true, fragmentAnimation: 'fade-up', fragmentIndex: 0 }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('class="fragment fade-up"')
    expect(html).toContain('data-fragment-index="0"')
  })

  it('wraps multi-slide columns in nested sections for 2D navigation', () => {
    const pres = makePresentation({
      slides: [
        { id: 's1', column: 0, elements: [] },
        { id: 's2', column: 0, elements: [] },
        { id: 's3', column: 1, elements: [] },
      ],
    })
    const html = generateRevealHTML(pres)
    const outerSections = html.match(/<div class="slides">\n([\s\S]*?)\n    <\/div>/)?.[1] || ''
    const nestedSectionCount = (outerSections.match(/<section>\n\s*<section/g) || []).length
    expect(nestedSectionCount).toBeGreaterThanOrEqual(1)
  })

  it('renders grid overlay when showPresentGrid is true', () => {
    const pres = makePresentation({ showPresentGrid: true, gridSize: 40 })
    const html = generateRevealHTML(pres)
    expect(html).toContain('linear-gradient')
  })

  it('includes overview panel elements', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('id="overview-panel"')
    expect(html).toContain('id="overview-toggle"')
  })

  it('sets overview layout class to linear by default', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('class="ov-body linear"')
  })

  it('sets overview layout class to sections when configured', () => {
    const html = generateRevealHTML(makePresentation({ overviewLayout: 'sections' }))
    expect(html).toContain('class="ov-body sections"')
  })

  it('embeds slide section metadata in the overview JS', () => {
    const pres = makePresentation({
      slides: [
        { id: 's1', elements: [], section: 'Intro' },
        { id: 's2', elements: [], section: 'Methods' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('"section":"Intro"')
    expect(html).toContain('"section":"Methods"')
  })

  it('includes time widget when footerTimeMode is set', () => {
    const html = generateRevealHTML(makePresentation({ footerTimeMode: 'clock12' }))
    expect(html).toContain('reveal-time-widget')
    expect(html).toContain('clock12')
  })

  it('excludes time widget when footerTimeMode is none', () => {
    const html = generateRevealHTML(makePresentation({ footerTimeMode: 'none' }))
    expect(html).not.toContain('reveal-time-widget')
  })

  it('applies custom CSS when provided', () => {
    const html = generateRevealHTML(makePresentation({ customCSS: '.my-class { color: red; }' }))
    expect(html).toContain('.my-class { color: red; }')
  })

  it('applies globalFont to text elements', () => {
    const html = generateRevealHTML(makePresentation({ globalFont: 'Inter, sans-serif' }))
    expect(html).toContain('font-family:Inter, sans-serif')
  })

  it('renders code elements', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'code', x: 0, y: 0, width: 400, height: 200, zIndex: 1, language: 'python', content: 'print("hello")' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('language-python')
    expect(html).toContain('print(&quot;hello&quot;)')
  })

  it('renders shape elements', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 100, height: 80, zIndex: 1, shape: 'circle', fill: '#ff0000' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('<svg')
    expect(html).toContain('<ellipse')
  })
})
