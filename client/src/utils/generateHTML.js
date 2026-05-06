import { shapeSvgString } from './shapeUtils'
import { pointsToPath } from './drawingUtils'

function absoluteSrc(src) {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src
  return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`
}

// Group slides by column for 2D navigation.
// If no slide has a `column` property, returns each slide as its own single-item column (1D mode).
function getSlideColumns(slides) {
  const is2D = slides.some(s => s.column !== undefined)
  if (!is2D) return slides.map(s => [s])
  const colMap = {}
  slides.forEach(s => {
    const c = s.column ?? 0
    if (!colMap[c]) colMap[c] = []
    colMap[c].push(s)
  })
  const sortedKeys = Object.keys(colMap).map(Number).sort((a, b) => a - b)
  return sortedKeys.map(k => colMap[k])
}

export function generateRevealHTML(presentation) {
  const slideW = presentation.slideWidth || 960
  const slideH = presentation.slideHeight || 540
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const showPresentGrid = presentation.showPresentGrid || false
  const presentGridSize = presentation.gridSize || 40
  const footerMode = presentation.footerMode || 'basic'
  const sequenceSections = presentation.sequenceSections || []
  const footerInactiveColor = presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'
  // Compute page numbers: only count slides where showPageNumber !== false
  const totalNumberedSlides = (presentation.slides || []).filter(s => s.showPageNumber !== false).length
  let pageCounter = 0

  // Build per-slide section HTML (preserving pageCounter increment order via flat array)
  const slideSectionHtmlByIndex = new Map()
  presentation.slides.forEach((slide, slideIndex) => {
    const bgAttrs = getBackgroundAttrs(slide.background)
    const notes = slide.notes ? `<aside class="notes">${slide.notes}</aside>` : ''

    const elementsHtml = (slide.elements || [])
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(el => {
        const shadowStyle = (el.shadowBlur || el.shadowX || el.shadowY)
          ? `box-shadow:${el.shadowX||0}px ${el.shadowY||0}px ${el.shadowBlur||0}px ${el.shadowColor||'rgba(0,0,0,0.5)'};`
          : ''
        const borderRadiusStyle = (el.type === 'image' || el.type === 'code') && el.borderRadius ? `border-radius:${el.borderRadius}px;` : ''
        const rotationStyle = el.rotation ? `transform:rotate(${el.rotation}deg);` : ''
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}${borderRadiusStyle}${rotationStyle}`
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
          return `<iframe${fragClass}${fragIdx} srcdoc="${srcdoc}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'code') {
          const lang = el.language || 'plaintext'
          const codeContent = escapeHtml(el.content || '')
          return `<div${fragClass}${fragIdx} style="${style}"><pre style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`
        }
        if (el.type === 'markdown') {
          const md = (el.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:18px;line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>document.getElementById('out').innerHTML=marked.parse(${JSON.stringify(el.content || '')});<\\/script></body></html>`
          const escaped = srcdoc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${fragClass}${fragIdx} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'chart') {
          const { chartType = 'bar', chartData = {} } = el
          const labels = JSON.stringify(chartData.labels || [])
          const datasets = JSON.stringify((chartData.datasets || []).map(ds => ({
            label: ds.label || '', data: ds.data || [],
            backgroundColor: ds.color || '#6366f1', borderColor: ds.color || '#6366f1',
            borderWidth: chartType === 'line' ? 2 : 0, fill: chartType === 'line' ? false : undefined,
          })))
          const scalesOpt = chartType === 'pie' || chartType === 'doughnut' ? '{}' : `{x:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}},y:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}}}`
          const chartSrc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style></head><body><canvas id="c" style="width:100%;height:100%"></canvas><script>new Chart(document.getElementById('c'),{type:'${chartType}',data:{labels:${labels},datasets:${datasets}},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},scales:${scalesOpt}}});<\\/script></body></html>`
          const escaped = chartSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${fragClass}${fragIdx} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'callout') {
          const bg = el.calloutColor || '#ef4444'
          const tc = el.calloutTextColor || '#ffffff'
          const fs = el.fontSize || 16
          return `<div${fragClass}${fragIdx} style="${style}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:${fs}px;font-weight:700;font-family:-apple-system,sans-serif;">${el.calloutNumber || 1}</div>`
        }
        if (el.type === 'icon') {
          const color = el.iconColor || '#ffffff'
          const sw = el.iconStrokeWidth || 2
          const iconPaths = { Star:'<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>', Heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', Check:'<polyline points="20,6 9,17 4,12"/>', X:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', Zap:'<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>', Target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' }
          const path = iconPaths[el.iconName] || iconPaths['Star']
          return `<div${fragClass}${fragIdx} style="${style}display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`
        }
        if (el.type === 'latex') {
          const content = el.content || ''
          const hasTikz = /\\begin\{tikzpicture\}|\\tikz\s*[{[]/.test(content)
          const hasTable = /\\begin\{(tabular\*?|table\*?|longtable|tabularx|tabulary)\}/.test(content)
          let srcdoc
          if (hasTikz) {
            srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:auto;color:white}svg{max-width:100%;max-height:100%}</style></head><body><script type="text/tikz">${content}<\\/script></body></html>`
          } else if (hasTable) {
            const wrapped = content.includes('\\begin{document}') ? content
              : `\\documentclass{article}\n\\usepackage{booktabs}\n\\usepackage{array}\n\\begin{document}\n${content}\n\\end{document}`
            srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/latex.js"><\\/script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/base.css"><style>*{box-sizing:border-box}html,body{margin:0;padding:8px;background:transparent;color:white!important;width:100%;height:100%;overflow:auto;font-family:'Computer Modern',Georgia,serif}table{border-collapse:collapse;color:white}td,th{padding:3px 10px;color:white!important}p,span,div{color:white!important}</style></head><body><div id="out"></div><script>try{var generator=new HtmlGenerator({hyphenate:false});var doc=parse(${JSON.stringify(wrapped)},{generator:generator});document.getElementById('out').appendChild(doc.domFragment())}catch(e){document.getElementById('out').innerHTML='<span style="color:#f87171">Error: '+e.message+'<\\/span>'}<\\/script></body></html>`
          } else {
            srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:white}.katex{font-size:1.4em}svg{max-width:100%;max-height:100%}</style></head><body><div id="m"></div><script>try{katex.render(${JSON.stringify(content)},document.getElementById('m'),{displayMode:true,throwOnError:false})}catch(e){document.getElementById('m').textContent=e.message}<\\/script></body></html>`
          }
          const escaped = srcdoc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${fragClass}${fragIdx} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'video' || (el.type === 'manim' && el.rendered)) {
          const src = absoluteSrc(el.type === 'manim' ? el.rendered : el.src)
          const attrs = []
          if (el.type === 'manim') { if (el.controls) attrs.push('controls'); if (el.autoplay !== false) attrs.push('autoplay'); if (el.loop !== false) attrs.push('loop'); if (el.muted !== false) attrs.push('muted') }
          else { if (el.controls !== false) attrs.push('controls'); if (el.autoplay) attrs.push('autoplay'); if (el.loop) attrs.push('loop'); if (el.muted) attrs.push('muted') }
          const posterAttr = el.poster ? ` poster="${absoluteSrc(el.poster)}"` : ''
          return `<div${fragClass}${fragIdx} style="${style}"><video src="${src}" ${attrs.join(' ')}${posterAttr} style="width:100%;height:100%;object-fit:contain;display:block;background:#000;"></video></div>`
        }
        if (el.type === 'manim' && !el.rendered) return '' // not yet rendered — omit from export
        if (el.type === 'audio') {
          const src = absoluteSrc(el.src)
          const attrs = ['controls']
          if (el.autoplay) attrs.push('autoplay')
          if (el.loop) attrs.push('loop')
          if (el.muted) attrs.push('muted')
          return `<div${fragClass}${fragIdx} style="${style}display:flex;align-items:center;justify-content:center;"><audio src="${src}" ${attrs.join(' ')} style="width:90%;"></audio></div>`
        }
        if (el.type === 'table') {
          const data = el.data || [['']]
          const headerBg = el.headerBgColor || 'rgba(99,102,241,0.3)'
          const cellBg = el.cellBgColor || 'transparent'
          const borderColor = el.borderColor || 'rgba(255,255,255,0.2)'
          const borderWidth = el.borderWidth ?? 1
          const textColor = el.textColor || '#ffffff'
          const fontSize = el.fontSize || 14
          const cellPadding = el.cellPadding || 8
          const rows = data.map((row, ri) => {
            const cells = (row || []).map((cell, ci) => {
              const bg = (el.headerRow && ri === 0) ? headerBg : cellBg
              return `<td style="padding:${cellPadding}px;border:${borderWidth}px solid ${borderColor};background:${bg};color:${textColor};font-size:${fontSize}px;">${escapeHtml(cell || '')}</td>`
            }).join('')
            return `<tr>${cells}</tr>`
          }).join('')
          return `<div${fragClass}${fragIdx} style="${style}overflow:auto;"><table style="width:100%;height:100%;border-collapse:collapse;">${rows}</table></div>`
        }
        if (el.type === 'drawing') {
          const svgPaths = (el.paths || []).map(path => {
            const d = pointsToPath(path.points, el.smooth !== false)
            return `<path d="${d}" stroke="${path.color || '#ffffff'}" stroke-width="${path.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${path.opacity ?? 1}"/>`
          }).join('')
          return `<svg${fragClass}${fragIdx} style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`
        }
        return ''
      }).join('\n')

    // Page numbering: increment counter only for slides with showPageNumber !== false
    const slideHasPageNum = slide.showPageNumber !== false
    if (slideHasPageNum) pageCounter++
    const pageLabel = showPageNumbers && slideHasPageNum
      ? (pageNumberFormat === 'c/t' ? `${pageCounter} / ${totalNumberedSlides}` : `${pageCounter}`)
      : ''

    let footerHtml = ''
    if (!slide.hideFooter) {
      if (footerMode === 'sequence' && sequenceSections.length > 0 && showFooter) {
        const activeIdx = slide.activeSection
        const seqSpans = sequenceSections.map((sec, i) => {
          const isActive = activeIdx === i
          const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
          const secActiveColor = typeof sec === 'object' && sec?.color ? sec.color : (footerColor || 'rgba(255,255,255,0.9)')
          const color = isActive ? secActiveColor : footerInactiveColor
          const weight = isActive ? 'font-weight:700;' : 'font-weight:400;'
          return `<span style="color:${color};${weight}">${escapeHtml(secLabel || `Section ${i+1}`)}</span>`
        }).join('')
        const pageSpan = pageLabel ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>` : ''
        footerHtml = `      <div class="reveal-footer" style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;pointer-events:none;box-sizing:border-box;"><div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
        footerHtml = (sectionLabel || pageLabel) ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>` : ''
      }
    }
    const gridHtml = showPresentGrid ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>` : ''

    slideSectionHtmlByIndex.set(slideIndex, `    <section${bgAttrs} style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">\n${elementsHtml}\n${footerHtml}\n${gridHtml}\n      ${notes}\n    </section>`)
  })

  // Group into columns for 2D output
  const columns = getSlideColumns(presentation.slides)
  const slidesHtml = columns.map(colSlides => {
    const sections = colSlides.map(slide => {
      const idx = presentation.slides.indexOf(slide)
      return slideSectionHtmlByIndex.get(idx) || ''
    }).join('\n')
    if (colSlides.length === 1) return sections
    return `    <section>\n${sections}\n    </section>`
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Open+Sans:wght@300;400;500;600;700;800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@300;400;700;900&family=Fira+Code:wght@300;400;500;600;700&family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&display=swap">
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
    /* color only on the container so per-span inline colors (inactive sections) are not overridden */
    .reveal .slides section .reveal-footer { color: ${footerColor} !important; }
    .reveal .slides section .reveal-footer,
    .reveal .slides section .reveal-footer * { font-family: ${footerFontFamily} !important; font-size: ${footerFontSize}px !important; }
    #fs-btn {
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 13px;
      backdrop-filter: blur(4px); transition: background 0.15s;
    }
    #fs-btn:hover { background: rgba(0,0,0,0.75); }
    :fullscreen #fs-btn, :-webkit-full-screen #fs-btn { display: none; }
  </style>${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}
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
      width: ${slideW},
      height: ${slideH},
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
  const slideW = presentation.slideWidth || 960
  const slideH = presentation.slideHeight || 540
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const footerMode = presentation.footerMode || 'basic'
  const sequenceSections = presentation.sequenceSections || []
  const footerInactiveColor = presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'

  // Expand each slide into one page per fragment step (initial + one per unique index)
  const pages = []
  let printPageCounter = 0
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
        const borderRadiusStyleP = (el.type === 'image' || el.type === 'code') && el.borderRadius ? `border-radius:${el.borderRadius}px;` : ''
        const rotationStyleP = el.rotation ? `transform:rotate(${el.rotation}deg);` : ''
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${borderRadiusStyleP}${rotationStyleP}`
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
        if (el.type === 'markdown') {
          return `<div style="${style}${vis}padding:8px 12px;color:white;overflow:auto;font-size:18px;line-height:1.6;">${el.content || ''}</div>`
        }
        if (el.type === 'chart') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:16px;">Chart</div>`
        }
        if (el.type === 'callout') {
          const bg = el.calloutColor || '#ef4444'; const tc = el.calloutTextColor || '#ffffff'; const fs = el.fontSize || 16
          return `<div style="${style}${vis}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:${fs}px;font-weight:700;">${el.calloutNumber || 1}</div>`
        }
        if (el.type === 'icon') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:16px;">Icon</div>`
        }
        if (el.type === 'latex') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.1);border:1px dashed rgba(99,102,241,0.3);color:rgba(255,255,255,0.4);font-family:serif;font-size:16px;">LaTeX</div>`
        }
        if (el.type === 'video') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:16px;">&#9654; Video</div>`
        }
        if (el.type === 'manim') {
          if (el.rendered) return `<div style="${style}${vis}"><video src="${absoluteSrc(el.rendered)}" autoplay loop muted style="width:100%;height:100%;object-fit:contain;display:block;background:#000;"></video></div>`
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:16px;">🎬 Manim (not rendered)</div>`
        }
        if (el.type === 'audio') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:16px;">&#9835; Audio</div>`
        }
        if (el.type === 'table') {
          const data = el.data || [['']]
          const headerBg = el.headerBgColor || 'rgba(99,102,241,0.3)'
          const cellBg = el.cellBgColor || 'transparent'
          const borderColor = el.borderColor || 'rgba(255,255,255,0.2)'
          const borderWidth = el.borderWidth ?? 1
          const textColor = el.textColor || '#ffffff'
          const fontSize = el.fontSize || 14
          const cellPadding = el.cellPadding || 8
          const rows = data.map((row, ri) => {
            const cells = (row || []).map((cell) => {
              const bg = (el.headerRow && ri === 0) ? headerBg : cellBg
              return `<td style="padding:${cellPadding}px;border:${borderWidth}px solid ${borderColor};background:${bg};color:${textColor};font-size:${fontSize}px;">${escapeHtml(cell || '')}</td>`
            }).join('')
            return `<tr>${cells}</tr>`
          }).join('')
          return `<div style="${style}${vis}overflow:auto;"><table style="width:100%;height:100%;border-collapse:collapse;">${rows}</table></div>`
        }
        if (el.type === 'drawing') {
          const svgPaths = (el.paths || []).map(path => {
            const d = pointsToPath(path.points, el.smooth !== false)
            return `<path d="${d}" stroke="${path.color || '#ffffff'}" stroke-width="${path.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${path.opacity ?? 1}"/>`
          }).join('')
          return `<svg style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`
        }
        return ''
      }).join('\n')

    // Per-slide page numbering
    const slideHasPageNum = slide.showPageNumber !== false
    if (slideHasPageNum && maxIdx === -Infinity) printPageCounter++ // only increment on initial page of each slide
    const pageLabel = showPageNumbers && slideHasPageNum
      ? (pageNumberFormat === 'c/t' ? `${printPageCounter} / ${(presentation.slides || []).filter(s => s.showPageNumber !== false).length}` : `${printPageCounter}`)
      : ''

    let footerHtml = ''
    if (!slide.hideFooter) {
      if (footerMode === 'sequence' && sequenceSections.length > 0 && showFooter) {
        const activeIdx = slide.activeSection
        const seqSpans = sequenceSections.map((sec, i) => {
          const isActive = activeIdx === i
          const secLabel = typeof sec === 'string' ? sec : (sec?.label || '')
          const secActiveColor = typeof sec === 'object' && sec?.color ? sec.color : footerColor
          const color = isActive ? secActiveColor : footerInactiveColor
          const weight = isActive ? 'font-weight:700;' : 'font-weight:400;'
          return `<span style="color:${color};${weight}">${escapeHtml(secLabel || `Section ${i+1}`)}</span>`
        }).join('')
        const pageSpan = pageLabel ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>` : ''
        footerHtml = `<div style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;font-size:${footerFontSize}px;font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;"><div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
        footerHtml = (sectionLabel || pageLabel)
          ? `<div style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;font-size:${footerFontSize}px;color:${footerColor};font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>`
          : ''
      }
    }

    return `<div class="slide-page" style="${bgStyle}font-size:42px;">\n${elementsHtml}\n${footerHtml}\n</div>`
  }).join('\n')

  const title = escapeHtml(presentation.title || 'Presentation')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — PDF</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Open+Sans:wght@300;400;500;600;700;800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@300;400;700;900&family=Fira+Code:wght@300;400;500;600;700&family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${codeTheme}.min.css">
  <style>
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff2') format('woff2'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff2') format('woff2'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff2') format('woff2'); }
    @page { size: ${slideW}px ${slideH}px; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    html, body { width: ${slideW}px; background: #000; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .slide-page {
      width: ${slideW}px; height: ${slideH}px; position: relative; overflow: hidden;
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
  </style>${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}
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
