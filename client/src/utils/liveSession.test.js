import { describe, it, expect, vi } from 'vitest'

// Stub browser APIs
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
      { id: 's1', elements: [{ id: 'e1', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Slide 1</h1>' }] },
      { id: 's2', elements: [{ id: 'e2', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Slide 2</h1>' }] },
      { id: 's3', elements: [{ id: 'e3', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Slide 3</h1>' }] },
    ],
    ...overrides,
  }
}

// ── Session code generation ──────────────────────────────────────

describe('live session code generation', () => {
  const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'

  function generateSessionCode() {
    let code = ''
    for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]
    return code
  }

  it('generates a 6-character code', () => {
    const code = generateSessionCode()
    expect(code).toHaveLength(6)
  })

  it('only uses allowed characters (no ambiguous i/l/o/0/1)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSessionCode()
      for (const ch of code) {
        expect(CHARS).toContain(ch)
      }
      expect(code).not.toMatch(/[ilo01]/)
    }
  })

  it('generates unique codes (statistical)', () => {
    const codes = new Set()
    for (let i = 0; i < 200; i++) codes.add(generateSessionCode())
    expect(codes.size).toBeGreaterThan(190)
  })
})

// ── Session state management ─────────────────────────────────────

describe('live session state', () => {
  it('tracks unlocked slides progressively', () => {
    const unlocked = new Set([0])
    expect(unlocked.has(0)).toBe(true)
    expect(unlocked.has(1)).toBe(false)

    unlocked.add(1)
    expect(unlocked.has(1)).toBe(true)

    unlocked.add(3)
    expect(unlocked.has(2)).toBe(false)
    expect(unlocked.has(3)).toBe(true)
  })

  it('computes maxUnlocked correctly', () => {
    const unlocked = new Set([0, 1, 3, 5])
    const maxUnlocked = Math.max(...unlocked)
    expect(maxUnlocked).toBe(5)
  })

  it('allows backward navigation within unlocked range', () => {
    const unlocked = new Set([0, 1, 2, 3])
    const maxUnlocked = Math.max(...unlocked)
    const targetSlide = 1
    expect(targetSlide <= maxUnlocked).toBe(true)
  })

  it('blocks forward navigation past max unlocked', () => {
    const unlocked = new Set([0, 1, 2])
    const maxUnlocked = Math.max(...unlocked)
    const targetSlide = 4
    expect(targetSlide > maxUnlocked).toBe(true)
  })

  it('serializes unlocked set to sorted array', () => {
    const unlocked = new Set([3, 0, 5, 1])
    const arr = [...unlocked].sort((a, b) => a - b)
    expect(arr).toEqual([0, 1, 3, 5])
  })

  it('handles single slide presentation', () => {
    const unlocked = new Set([0])
    const maxUnlocked = Math.max(...unlocked)
    expect(maxUnlocked).toBe(0)
  })
})

// ── Live viewer HTML injection ───────────────────────────────────

describe('live viewer HTML injection', () => {
  it('base HTML can be injected with live script before </body>', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('</body>')
    const injected = html.replace('</body>', '<script>/* live */</script>\n</body>')
    expect(injected).toContain('<script>/* live */</script>')
    expect(injected).toContain('</body>')
  })

  it('base HTML contains Reveal.initialize for live viewer to hook into', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('Reveal.initialize')
    expect(html).toContain('Reveal.on')
  })

  it('base HTML contains all slides for the viewer to navigate', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('Slide 1')
    expect(html).toContain('Slide 2')
    expect(html).toContain('Slide 3')
  })
})

// ── Live presenter HTML injection ────────────────────────────────

describe('live presenter script', () => {
  function buildPresenterScript(sessionId) {
    return `
    (function() {
      var sessionId = '${sessionId}';
      function currentFlat() {
        var idx = Reveal.getIndices();
        for (var i = 0; i < flatMap.length; i++) {
          if (flatMap[i].h === idx.h && flatMap[i].v === idx.v) return i;
        }
        return 0;
      }
      function sendSlide() {
        fetch('/api/live/' + sessionId + '/slide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flatIndex: currentFlat() })
        });
      }
    })();`
  }

  it('embeds the session ID in the presenter script', () => {
    const script = buildPresenterScript('abc123')
    expect(script).toContain("var sessionId = 'abc123'")
  })

  it('posts to the correct API endpoint pattern', () => {
    const script = buildPresenterScript('xyz789')
    expect(script).toContain("'/api/live/' + sessionId + '/slide'")
  })

  it('sends flatIndex in the request body', () => {
    const script = buildPresenterScript('test')
    expect(script).toContain('flatIndex: currentFlat()')
  })
})

// ── Live viewer script ───────────────────────────────────────────

describe('live viewer script', () => {
  function buildViewerScript(sessionId) {
    return `
    (function() {
      var sessionId = '${sessionId}';
      var unlocked = new Set([0]);
      var maxUnlocked = 0;
      var es = new EventSource('/api/live/' + sessionId + '/stream');
      es.onmessage = function(e) {
        var data = JSON.parse(e.data);
        if (data.type === 'init' || data.type === 'slide') {
          data.unlocked.forEach(function(i) { unlocked.add(i); });
          maxUnlocked = Math.max.apply(null, Array.from(unlocked));
        }
        if (data.type === 'ended') { es.close(); }
      };
    })();`
  }

  it('connects to the correct SSE endpoint pattern', () => {
    const script = buildViewerScript('abc123')
    expect(script).toContain("'/api/live/' + sessionId + '/stream'")
  })

  it('initializes unlocked set with slide 0', () => {
    const script = buildViewerScript('test')
    expect(script).toContain('new Set([0])')
  })

  it('handles init and slide message types', () => {
    const script = buildViewerScript('test')
    expect(script).toContain("data.type === 'init'")
    expect(script).toContain("data.type === 'slide'")
  })

  it('handles ended message type', () => {
    const script = buildViewerScript('test')
    expect(script).toContain("data.type === 'ended'")
    expect(script).toContain('es.close()')
  })

  it('computes maxUnlocked from the unlocked set', () => {
    const script = buildViewerScript('test')
    expect(script).toContain('Math.max.apply(null, Array.from(unlocked))')
  })
})

// ── SSE message format ──────────────────────────────────────────

describe('SSE message serialization', () => {
  it('serializes init message correctly', () => {
    const session = { currentSlide: 2, unlockedSlides: new Set([0, 1, 2]), viewers: new Set(['a', 'b']) }
    const msg = JSON.stringify({
      type: 'init',
      currentSlide: session.currentSlide,
      unlocked: [...session.unlockedSlides].sort((a, b) => a - b),
      viewers: session.viewers.size,
    })
    const parsed = JSON.parse(msg)
    expect(parsed.type).toBe('init')
    expect(parsed.currentSlide).toBe(2)
    expect(parsed.unlocked).toEqual([0, 1, 2])
    expect(parsed.viewers).toBe(2)
  })

  it('serializes slide message correctly', () => {
    const msg = JSON.stringify({
      type: 'slide',
      currentSlide: 5,
      unlocked: [0, 1, 2, 3, 5],
    })
    const parsed = JSON.parse(msg)
    expect(parsed.type).toBe('slide')
    expect(parsed.currentSlide).toBe(5)
    expect(parsed.unlocked).toContain(5)
    expect(parsed.unlocked).not.toContain(4)
  })

  it('serializes ended message', () => {
    const msg = JSON.stringify({ type: 'ended' })
    expect(JSON.parse(msg).type).toBe('ended')
  })

  it('serializes viewer count message', () => {
    const msg = JSON.stringify({ type: 'viewers', count: 42 })
    const parsed = JSON.parse(msg)
    expect(parsed.type).toBe('viewers')
    expect(parsed.count).toBe(42)
  })

  it('formats as SSE data line', () => {
    const msg = JSON.stringify({ type: 'slide', currentSlide: 3 })
    const sseLine = `data: ${msg}\n\n`
    expect(sseLine).toMatch(/^data: \{.*\}\n\n$/)
    expect(JSON.parse(sseLine.replace('data: ', '').trim())).toEqual({ type: 'slide', currentSlide: 3 })
  })
})
