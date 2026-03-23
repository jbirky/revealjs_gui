import { shapeSvgString } from './shapeUtils'

function absoluteSrc(src) {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src
  return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`
}

export function generateRevealHTML(presentation) {
  const totalSlides = presentation.slides.length
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const showPresentGrid = presentation.showPresentGrid || false
  const presentGridSize = presentation.gridSize || 40

  const slidesHtml = presentation.slides.map((slide, slideIndex) => {
    const bgAttrs = getBackgroundAttrs(slide.background)
    const notes = slide.notes ? `<aside class="notes">${slide.notes}</aside>` : ''

    const elementsHtml = (slide.elements || [])
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(el => {
        const shadowStyle = (el.shadowBlur || el.shadowX || el.shadowY)
          ? `box-shadow:${el.shadowX||0}px ${el.shadowY||0}px ${el.shadowBlur||0}px ${el.shadowColor||'rgba(0,0,0,0.5)'};`
          : ''
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}`
        const fragClass = el.fragment ? ` class="fragment ${el.fragmentAnimation || 'fade-in'}"` : ''
        const fragIdx = el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${el.fragmentIndex}"` : ''
        if (el.type === 'text') {
          return `<div${fragClass}${fragIdx} style="${style} padding:8px 12px; color:white;">${el.content || ''}</div>`
        }
        if (el.type === 'image') {
          const src = absoluteSrc(el.src)
          const imgFilterParts = [
            (el.filterBrightness != null && el.filterBrightness !== 100) ? `brightness(${el.filterBrightness}%)` : '',
            (el.filterContrast != null && el.filterContrast !== 100) ? `contrast(${el.filterContrast}%)` : '',
            el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
          ].filter(Boolean).join(' ')
          const filterStyle = imgFilterParts ? `filter:${imgFilterParts};` : ''
          if (el.imageW != null) {
            const offX = el.imageOffsetX ?? 0
            const offY = el.imageOffsetY ?? 0
            const imgStyle = `position:absolute;left:${offX}px;top:${offY}px;width:${el.imageW}px;height:${el.imageH}px;object-fit:${el.objectFit||'contain'};${filterStyle}`
            return `<div${fragClass}${fragIdx} style="${style}"><img src="${src}" alt="${el.alt||''}" style="${imgStyle}" /></div>`
          }
          return `<div${fragClass}${fragIdx} style="${style}"><img src="${src}" alt="${el.alt||''}" style="display:block;width:100%;height:100%;object-fit:${el.objectFit||'contain'};${filterStyle}" /></div>`
        }
        if (el.type === 'shape') {
          const opacityStyle = el.opacity !== undefined && el.opacity !== 1 ? `opacity:${el.opacity};` : ''
          return `<div${fragClass}${fragIdx} style="${style}${opacityStyle}">${shapeSvgString(el)}</div>`
        }
        if (el.type === 'html') {
          const srcdoc = (el.content || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${fragClass}${fragIdx} srcdoc="${srcdoc}" style="${style}border:none;" sandbox="allow-scripts allow-same-origin" scrolling="no"></iframe>`
        }
        if (el.type === 'code') {
          const lang = el.language || 'plaintext'
          const codeContent = escapeHtml(el.content || '')
          return `<div${fragClass}${fragIdx} style="${style}"><pre style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`
        }
        return ''
      }).join('\n')

    const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
    const pageLabel = showPageNumbers ? (pageNumberFormat === 'c/t' ? `${slideIndex + 1} / ${totalSlides}` : `${slideIndex + 1}`) : ''
    const footerHtml = (sectionLabel || pageLabel) ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>` : ''
    const gridHtml = showPresentGrid ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>` : ''

    return `    <section${bgAttrs} style="padding:0;width:960px;height:540px;overflow:hidden;font-size:42px;">\n${elementsHtml}\n${footerHtml}\n${gridHtml}\n      ${notes}\n    </section>`
  }).join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(presentation.title || 'Presentation')}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${presentation.theme || 'black'}.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${codeTheme}.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Source+Sans+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&family=Fira+Code:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
  <style>
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff2') format('woff2'), url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff2') format('woff2'), url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff2') format('woff2'), url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff') format('woff'); }
  </style>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #000; }
    /* Reset reveal.js section padding/alignment so absolute positions match the 960x540 editor canvas exactly */
    .reveal .slides section { padding: 0 !important; text-align: left !important; }
    /* Neutralise theme typography overrides so presentation matches editor exactly */
    /* font-family only on section (inherited) so KaTeX's explicit rules take precedence */
    .reveal .slides section { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .reveal .slides section * { text-transform: none !important; letter-spacing: normal !important; }
    /* Explicit heading sizes — override theme so present mode matches editor exactly */
    .reveal .slides section h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section p  { margin: 0 0 0.4em; line-height: 1.5; }
    .reveal .slides section ul,
    .reveal .slides section ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .reveal .slides section li { margin-bottom: 0.2em; line-height: 1.5; }
    .reveal .slides section a  { text-decoration: underline; }
    /* reveal.js constrains/decorates section imgs — reset everything */
    .reveal .slides section img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    /* Footer — explicit CSS rule with high specificity so reveal.js theme cannot override */
    .reveal .slides section .reveal-footer,
    .reveal .slides section .reveal-footer * { font-family: ${footerFontFamily} !important; font-size: ${footerFontSize}px !important; color: ${footerColor} !important; }
    #fs-btn {
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 13px;
      backdrop-filter: blur(4px); transition: background 0.15s;
    }
    #fs-btn:hover { background: rgba(0,0,0,0.75); }
    :fullscreen #fs-btn, :-webkit-full-screen #fs-btn { display: none; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6; Fullscreen</button>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      width: 960,
      height: 540,
      margin: 0,
      minScale: 0,
      maxScale: 10,
      center: false,
      transition: '${presentation.transition || 'slide'}',
      plugins: [ RevealNotes, RevealHighlight ]
    });
    Reveal.on('ready', function() {
      document.querySelectorAll('span[data-math-latex]').forEach(function(el) {
        try {
          katex.render(el.getAttribute('data-math-latex'), el, {
            displayMode: el.getAttribute('data-math-display') === 'true',
            throwOnError: false
          });
        } catch(e) {}
      });
    });
  </script>
</body>
</html>`
}

function getBackgroundAttrs(bg) {
  if (!bg) return ''
  if (bg.type === 'color' && bg.color) return ` data-background-color="${bg.color}"`
  if (bg.type === 'image' && bg.image) return ` data-background-image="${absoluteSrc(bg.image)}" data-background-size="${bg.size || 'cover'}" data-background-position="${bg.position || 'center'}"`
  if (bg.type === 'gradient' && bg.gradient) return ` data-background-gradient="${bg.gradient}"`
  return ''
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadHTML(presentation) {
  const html = generateRevealHTML(presentation)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF export (print-ready HTML, one page per fragment state) ───────────────

function getBgPrintStyle(bg) {
  if (!bg || bg.type === 'none') return 'background-color:#1e1e2e;'
  if (bg.type === 'color') return `background-color:${bg.color || '#1e1e2e'};`
  if (bg.type === 'gradient') return `background:${bg.gradient || '#1e1e2e'};`
  if (bg.type === 'image' && bg.image) {
    const src = absoluteSrc(bg.image)
    return `background-image:url('${src}');background-size:${bg.size || 'cover'};background-position:${bg.position || 'center'};`
  }
  return 'background-color:#1e1e2e;'
}

function generatePrintHTML(presentation) {
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'

  // Expand each slide into one page per fragment step (initial + one per unique index)
  const pages = []
  presentation.slides.forEach(slide => {
    const fragIndices = [...new Set(
      (slide.elements || []).filter(el => el.fragment).map(el => el.fragmentIndex || 1)
    )].sort((a, b) => a - b)
    pages.push({ slide, maxIdx: -Infinity })           // initial: no fragments
    fragIndices.forEach(idx => pages.push({ slide, maxIdx: idx }))
  })
  const totalPages = pages.length

  const pagesHtml = pages.map(({ slide, maxIdx }, pageIndex) => {
    const bgStyle = getBgPrintStyle(slide.background)

    const elementsHtml = (slide.elements || [])
      .slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(el => {
        const isHidden = el.fragment && (el.fragmentIndex || 1) > maxIdx
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;`
        const vis = isHidden ? 'visibility:hidden;' : ''
        if (el.type === 'text') {
          return `<div style="${style}${vis}padding:8px 12px;color:white;">${el.content || ''}</div>`
        }
        if (el.type === 'image') {
          const src = absoluteSrc(el.src)
          if (el.imageW != null) {
            const imgStyle = `position:absolute;left:${el.imageOffsetX ?? 0}px;top:${el.imageOffsetY ?? 0}px;width:${el.imageW}px;height:${el.imageH}px;object-fit:${el.objectFit || 'contain'};max-width:none;max-height:none;`
            return `<div style="${style}${vis}"><img src="${src}" alt="${el.alt || ''}" style="${imgStyle}" /></div>`
          }
          return `<div style="${style}${vis}"><img src="${src}" alt="${el.alt || ''}" style="display:block;width:100%;height:100%;object-fit:${el.objectFit || 'contain'};max-width:none;max-height:none;" /></div>`
        }
        if (el.type === 'shape') {
          const opacityStyle = el.opacity !== undefined && el.opacity !== 1 ? `opacity:${el.opacity};` : ''
          return `<div style="${style}${opacityStyle}${vis}">${shapeSvgString(el)}</div>`
        }
        if (el.type === 'html') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.15);border:1px dashed rgba(99,102,241,0.4);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:16px;">&lt;/&gt;</div>`
        }
        if (el.type === 'code') {
          const lang = el.language || 'plaintext'
          const codeContent = escapeHtml(el.content || '')
          return `<div style="${style}${vis}"><pre class="hljs" style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}">${codeContent}</code></pre></div>`
        }
        return ''
      }).join('\n')

    const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
    const pageLabel = showPageNumbers
      ? (pageNumberFormat === 'c/t' ? `${pageIndex + 1} / ${totalPages}` : `${pageIndex + 1}`) : ''
    const footerHtml = (sectionLabel || pageLabel)
      ? `<div style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;font-size:${footerFontSize}px;color:${footerColor};font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>`
      : ''

    return `<div class="slide-page" style="${bgStyle}font-size:42px;">\n${elementsHtml}\n${footerHtml}\n</div>`
  }).join('\n')

  const title = escapeHtml(presentation.title || 'Presentation')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — PDF</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Source+Sans+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&family=Fira+Code:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${codeTheme}.min.css">
  <style>
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff2') format('woff2'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff2') format('woff2'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff2') format('woff2'); }
    @page { size: 960px 540px; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    html, body { width: 960px; background: #000; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .slide-page {
      width: 960px; height: 540px; position: relative; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      break-after: page; page-break-after: always;
      print-color-adjust: exact; -webkit-print-color-adjust: exact;
    }
    .slide-page:last-child { break-after: avoid; page-break-after: avoid; }
    .slide-page h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page p  { margin: 0 0 0.4em; line-height: 1.5; }
    .slide-page ul, .slide-page ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .slide-page li { margin-bottom: 0.2em; line-height: 1.5; }
    .slide-page a  { text-decoration: underline; }
    .slide-page img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    #print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: rgba(15,15,23,0.96); color: white; padding: 10px 20px;
      display: flex; align-items: center; justify-content: space-between;
      font-family: -apple-system, sans-serif; font-size: 13px;
      backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #print-bar button { padding: 7px 18px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; }
    #print-bar button:hover { background: #5254cc; }
    #print-bar .hint { color: rgba(255,255,255,0.5); font-size: 12px; }
    @media print { #print-bar { display: none; } body { margin-top: 0; } }
  </style>
</head>
<body>
  <div id="print-bar">
    <div>
      <strong>${title}</strong>
      <span class="hint"> &nbsp;·&nbsp; ${totalPages} page${totalPages !== 1 ? 's' : ''} (fragments expanded)
        &nbsp;·&nbsp; enable <em>Background graphics</em> in print settings</span>
    </div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
${pagesHtml}
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js"></script>
  <script>
    window.addEventListener('load', function() {
      document.querySelectorAll('pre code').forEach(function(el) { try { hljs.highlightElement(el); } catch(e) {} });
      document.querySelectorAll('span[data-math-latex]').forEach(function(el) {
        try { katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false, displayMode: el.getAttribute('data-math-display') === 'true' }); } catch(e) {}
      });
      setTimeout(function() { window.print(); }, 1000);
    });
  </script>
</body>
</html>`
}

export function exportPDF(presentation) {
  const html = generatePrintHTML(presentation)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}

export function presentInWindow(presentation) {
  const html = generateRevealHTML(presentation)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
