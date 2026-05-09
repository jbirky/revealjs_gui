import { useState, useMemo } from 'react'

const FONTS = [
  "'Barlow', sans-serif",
  "'Inter', sans-serif",
  "'Roboto', sans-serif",
  "'Playfair Display', serif",
  "'Bebas Neue', sans-serif",
  "'JetBrains Mono', monospace",
  "'Space Mono', monospace",
  "'Source Sans 3', sans-serif",
]

const TEMPLATES = [
  { id: 'typewriter', name: 'Typewriter', desc: 'Characters appear one at a time with a blinking cursor' },
  { id: 'word-reveal', name: 'Word Reveal', desc: 'Words fade and slide in one by one' },
  { id: 'revolve', name: 'Revolve', desc: '3D rotation around the Y-axis' },
  { id: 'wave', name: 'Wave', desc: 'Letters undulate in a sine wave' },
  { id: 'split-flap', name: 'Split-Flap', desc: 'Airport departure board flip effect' },
  { id: 'fade-cascade', name: 'Fade Cascade', desc: 'Letters fade in with cascading delay' },
  { id: 'circular', name: 'Circular Orbit', desc: 'Text arranged on a rotating circle' },
  { id: 'glitch', name: 'Glitch', desc: 'Digital glitch with color channel split' },
  { id: 'bounce', name: 'Bounce In', desc: 'Letters drop in with spring physics' },
  { id: 'stagger-center', name: 'Stagger Center', desc: 'Letters spread out from center' },
]

function generateHTML(templateId, params) {
  const { text, fontFamily, fontSize, color, duration, background } = params
  const font = fontFamily || "'Barlow', sans-serif"
  const size = fontSize || 48
  const col = color || '#ffffff'
  const dur = duration || 2
  const bg = background || 'transparent'
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const chars = [...text]
  const words = text.split(/\s+/)

  const base = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;600;700&family=Inter:wght@400;600;700&family=Roboto:wght@400;700&family=Playfair+Display:wght@400;700&family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&family=Source+Sans+3:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:${bg}}
body{display:flex;align-items:center;justify-content:center;font-family:${font};color:${col}}
</style>`

  switch (templateId) {

    case 'typewriter': {
      const speed = Math.max(0.02, dur / chars.length)
      return `${base}
<style>
.tw{font-size:${size}px;white-space:nowrap;overflow:hidden;border-right:3px solid ${col};width:0;animation:tw-type ${dur}s steps(${chars.length}) forwards,tw-blink 0.6s step-end infinite}
@keyframes tw-type{to{width:${chars.length}ch}}
@keyframes tw-blink{50%{border-color:transparent}}
</style></head><body><div class="tw">${escaped}</div></body></html>`
    }

    case 'word-reveal': {
      const delay = dur / words.length
      const spans = words.map((w, i) =>
        `<span style="display:inline-block;opacity:0;transform:translateY(20px);animation:wr-in 0.5s ease-out ${(i * delay).toFixed(2)}s forwards">${w.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`
      ).join(' ')
      return `${base}
<style>
.wr{font-size:${size}px;text-align:center;max-width:90%;line-height:1.4}
.wr span{margin:0 0.15em}
@keyframes wr-in{to{opacity:1;transform:translateY(0)}}
</style></head><body><div class="wr">${spans}</div></body></html>`
    }

    case 'revolve': {
      return `${base}
<style>
.rv-wrap{perspective:800px;text-align:center}
.rv{font-size:${size}px;font-weight:700;display:inline-block;transform-style:preserve-3d;opacity:0;transform:rotateY(-180deg);animation:rv-in ${dur}s cubic-bezier(0.23,1,0.32,1) 0.2s forwards,rv-drift ${dur*4}s ease-in-out ${dur+0.5}s infinite}
@keyframes rv-in{0%{opacity:0;transform:rotateY(-180deg)}30%{opacity:1}100%{opacity:1;transform:rotateY(0)}}
@keyframes rv-drift{0%,100%{transform:rotateY(0)}50%{transform:rotateY(10deg)}}
</style></head><body><div class="rv-wrap"><div class="rv">${escaped}</div></div></body></html>`
    }

    case 'wave': {
      const spans = chars.map((c, i) => {
        const d = (i * 0.08).toFixed(2)
        const ch = c === ' ' ? '&nbsp;' : c.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        return `<span style="animation-delay:${d}s">${ch}</span>`
      }).join('')
      return `${base}
<style>
.wv{font-size:${size}px;white-space:nowrap}
.wv span{display:inline-block;animation:wv-bob ${dur}s ease-in-out infinite}
@keyframes wv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-${Math.round(size*0.4)}px)}}
</style></head><body><div class="wv">${spans}</div></body></html>`
    }

    case 'split-flap': {
      const spans = chars.map((c, i) => {
        const d = (i * (dur / chars.length)).toFixed(2)
        const ch = c === ' ' ? '&nbsp;' : c.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        return `<span style="animation-delay:${d}s">${ch}</span>`
      }).join('')
      return `${base}
<style>
.sf{font-size:${size}px;display:flex;gap:2px;font-weight:700;letter-spacing:0.05em}
.sf span{display:inline-block;background:rgba(255,255,255,0.08);padding:4px 6px;border-radius:3px;opacity:0;transform:rotateX(-90deg);transform-origin:top center;animation:sf-flip 0.4s ease-out forwards}
@keyframes sf-flip{to{opacity:1;transform:rotateX(0)}}
</style></head><body><div style="perspective:600px"><div class="sf">${spans}</div></div></body></html>`
    }

    case 'fade-cascade': {
      const spans = chars.map((c, i) => {
        const d = (i * (dur / chars.length)).toFixed(2)
        const ch = c === ' ' ? '&nbsp;' : c.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        return `<span style="animation-delay:${d}s">${ch}</span>`
      }).join('')
      return `${base}
<style>
.fc{font-size:${size}px;white-space:nowrap}
.fc span{display:inline-block;opacity:0;filter:blur(8px);animation:fc-in 0.6s ease-out forwards}
@keyframes fc-in{to{opacity:1;filter:blur(0)}}
</style></head><body><div class="fc">${spans}</div></body></html>`
    }

    case 'circular': {
      const radius = Math.max(60, size * 1.5)
      const spans = chars.map((c, i) => {
        const angle = (i / chars.length) * 360
        const ch = c === ' ' ? '&nbsp;' : c.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        return `<span style="position:absolute;left:50%;top:50%;transform:rotate(${angle}deg) translateY(-${radius}px);transform-origin:0 ${radius}px;font-size:${size * 0.4}px">${ch}</span>`
      }).join('')
      return `${base}
<style>
.ci{position:relative;width:${radius*2+size}px;height:${radius*2+size}px;animation:ci-spin ${dur*3}s linear infinite}
@keyframes ci-spin{to{transform:rotate(360deg)}}
.ci span{display:inline-block;white-space:nowrap}
</style></head><body><div class="ci">${spans}</div></body></html>`
    }

    case 'glitch': {
      return `${base}
<style>
.gl{font-size:${size}px;font-weight:700;position:relative;white-space:nowrap}
.gl::before,.gl::after{content:'${escaped.replace(/'/g,"\\'")}';position:absolute;left:0;top:0;width:100%;overflow:hidden}
.gl::before{color:#0ff;animation:gl-r ${dur*0.5}s infinite linear alternate-reverse;clip-path:inset(0 0 60% 0)}
.gl::after{color:#f0f;animation:gl-b ${dur*0.4}s infinite linear alternate-reverse;clip-path:inset(60% 0 0 0)}
@keyframes gl-r{0%{transform:translate(0)}20%{transform:translate(-3px,2px)}40%{transform:translate(3px,-1px)}60%{transform:translate(-2px,1px)}80%{transform:translate(2px,-2px)}100%{transform:translate(0)}}
@keyframes gl-b{0%{transform:translate(0)}25%{transform:translate(2px,-2px)}50%{transform:translate(-3px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0)}}
</style></head><body><div class="gl">${escaped}</div></body></html>`
    }

    case 'bounce': {
      const spans = chars.map((c, i) => {
        const d = (i * (dur / chars.length)).toFixed(2)
        const ch = c === ' ' ? '&nbsp;' : c.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        return `<span style="animation-delay:${d}s">${ch}</span>`
      }).join('')
      return `${base}
<style>
.bn{font-size:${size}px;white-space:nowrap;font-weight:700}
.bn span{display:inline-block;opacity:0;transform:translateY(-80px);animation:bn-drop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards}
@keyframes bn-drop{to{opacity:1;transform:translateY(0)}}
</style></head><body><div class="bn">${spans}</div></body></html>`
    }

    case 'stagger-center': {
      const mid = chars.length / 2
      const spans = chars.map((c, i) => {
        const d = (Math.abs(i - mid) * (dur / chars.length)).toFixed(2)
        const ch = c === ' ' ? '&nbsp;' : c.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        return `<span style="animation-delay:${d}s">${ch}</span>`
      }).join('')
      return `${base}
<style>
.sc{font-size:${size}px;white-space:nowrap;font-weight:600}
.sc span{display:inline-block;opacity:0;transform:scale(0) rotate(20deg);animation:sc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
@keyframes sc-pop{to{opacity:1;transform:scale(1) rotate(0)}}
</style></head><body><div class="sc">${spans}</div></body></html>`
    }

    default:
      return `${base}</head><body><div style="font-size:${size}px">${escaped}</div></body></html>`
  }
}

export default function KineticTextModal({ onInsert, onClose, slideW = 960, slideH = 540 }) {
  const [selected, setSelected] = useState('typewriter')
  const [params, setParams] = useState({
    text: 'Hello World',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 48,
    color: '#ffffff',
    duration: 2,
    background: 'transparent',
  })

  const update = (k, v) => setParams(p => ({ ...p, [k]: v }))

  const previewHtml = useMemo(() => generateHTML(selected, params), [selected, params])

  const previewKey = `${selected}-${params.text}-${params.fontFamily}-${params.fontSize}-${params.color}-${params.duration}-${params.background}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, width: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border, #333)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border, #333)' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)' }}>Kinetic Text</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: template grid */}
          <div style={{ width: 240, borderRight: '1px solid var(--border, #333)', overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelected(t.id)} title={t.desc}
                  style={{
                    padding: '10px 6px', borderRadius: 6, border: selected === t.id ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #333)',
                    background: selected === t.id ? 'rgba(99,102,241,0.12)' : 'var(--bg-hover, #252530)',
                    color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right: preview + controls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Preview */}
            <div style={{ padding: 12, flex: 1, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              <iframe
                key={previewKey}
                srcDoc={previewHtml}
                style={{ width: slideW * 0.55, height: slideH * 0.55, border: '1px solid #333', borderRadius: 6, background: '#000' }}
                sandbox="allow-scripts"
                title="Kinetic text preview"
              />
            </div>

            {/* Controls */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border, #333)', overflowY: 'auto', maxHeight: 220 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 3 }}>Text</div>
                <input type="text" value={params.text} onChange={e => update('text', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', fontSize: 13 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Font</div>
                  <select value={params.fontFamily} onChange={e => update('fontFamily', e.target.value)}
                    style={{ width: '100%', padding: '4px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', fontSize: 10 }}>
                    {FONTS.map(f => <option key={f} value={f}>{f.split("'")[1] || f}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Size (px)</div>
                  <input type="number" min={12} max={200} value={params.fontSize} onChange={e => update('fontSize', Number(e.target.value) || 48)}
                    style={{ width: '100%', padding: '4px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', fontSize: 11 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Duration (s)</div>
                  <input type="number" min={0.3} max={10} step={0.1} value={params.duration} onChange={e => update('duration', Number(e.target.value) || 2)}
                    style={{ width: '100%', padding: '4px', background: 'var(--bg-hover, #252530)', border: '1px solid var(--border, #333)', borderRadius: 4, color: 'var(--text-primary, #fff)', fontSize: 11 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', marginBottom: 2 }}>Color</div>
                  <input type="color" value={params.color} onChange={e => update('color', e.target.value)}
                    style={{ width: '100%', height: 26, border: '1px solid var(--border, #333)', borderRadius: 4, cursor: 'pointer', background: 'var(--bg-hover, #252530)' }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4 }}>
                {TEMPLATES.find(t => t.id === selected)?.desc}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border, #333)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onClose}
                style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'transparent', color: 'var(--text-primary, #fff)', cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
              <button onClick={() => onInsert(previewHtml)}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent, #6366f1)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Insert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
