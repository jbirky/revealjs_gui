// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { shapeSvgString } from './shapeUtils'
import { pointsToPath } from './drawingUtils'

function buildHtmlEmbed(userHtml, embedW, embedH) {
  const initScript = `<script>const EMBED_WIDTH=${embedW},EMBED_HEIGHT=${embedH};(function(){function fit(){document.querySelectorAll('svg').forEach(function(s){if(s._vb)return;var w=s.getAttribute('width'),h=s.getAttribute('height');if(w&&h&&!s.getAttribute('viewBox'))s.setAttribute('viewBox','0 0 '+parseFloat(w)+' '+parseFloat(h));if(s.getAttribute('viewBox')){s.setAttribute('width','100%');s.setAttribute('height','100%');s._vb=1;}});}window.addEventListener('load',fit);setTimeout(fit,100);setTimeout(fit,400);new MutationObserver(fit).observe(document.documentElement,{childList:true,subtree:true});})();<\/script>`
  const resetStyle = `<style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;box-sizing:border-box;}canvas{display:block;}svg{display:block;}<\/style>`
  const injection = initScript + resetStyle
  if (/<head[^>]*>/i.test(userHtml))
    return userHtml.replace(/<head[^>]*>/i, m => m + injection)
  if (/<html[^>]*>/i.test(userHtml))
    return userHtml.replace(/<html[^>]*>/i, m => m + injection)
  if (/<!doctype[^>]*>/i.test(userHtml))
    return userHtml.replace(/(<!doctype[^>]*>)/i, '$1' + injection)
  return injection + userHtml
}

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

const CUSTOM_TRANSITIONS = ['differential-rotation']

export function generateRevealHTML(presentation) {
  const slideW = presentation.slideWidth || 960
  const slideH = presentation.slideHeight || 540
  const globalFont = presentation.globalFont || ''
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const footerTimeMode = presentation.footerTimeMode || 'none'
  const timerDuration = presentation.timerDuration ?? 20
  const showTimeWidget = footerTimeMode !== 'none'
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
  // Compute page numbers: grouped slides share the same number
  const seenGroups = new Set()
  const totalNumberedSlides = (presentation.slides || []).filter(s => {
    if (s.showPageNumber === false) return false
    if (s.slideGroup) {
      if (seenGroups.has(s.slideGroup)) return false
      seenGroups.add(s.slideGroup)
    }
    return true
  }).length
  let pageCounter = 0
  const pageGroupSeen = new Set()

  // Build per-slide section HTML (preserving pageCounter increment order via flat array)
  const slideSectionHtmlByIndex = new Map()
  presentation.slides.forEach((slide, slideIndex) => {
    const bgAttrs = getBackgroundAttrs(slide.background)
    const notes = slide.notes ? `<aside class="notes">${slide.notes}</aside>` : ''

    const sideCitations = (slide.elements || [])
      .filter(el => el.type === 'image' && (el.citationText || el.citationLink) && el.citationMode === 'side')
      .map(el => ({ id: el.id, text: el.citationText, link: el.citationLink }))

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
        const dataId = slide.autoAnimate ? ` data-id="${el.id}"` : ''
        const fragClass = el.fragment ? ` class="fragment ${el.fragmentAnimation || 'fade-in'}"` : ''
        const fragIdx = el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${el.fragmentIndex}"` : ''
        const gsapAttrs = (el.animationEnter && el.animationEnter !== 'none')
          ? ` data-gsap-enter="${el.animationEnter}" data-gsap-delay="${el.animationDelay || 0}" data-gsap-duration="${el.animationDuration || 600}"`
          : ''
        if (el.type === 'text') {
          const spacingStyle = `${globalFont ? `font-family:${globalFont};` : ''}line-height:${el.lineHeight ?? 1.5};${el.letterSpacing ? `letter-spacing:${el.letterSpacing}px;` : ''}${el.wordSpacing ? `word-spacing:${el.wordSpacing}px;` : ''}`
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style} padding:8px 12px; color:white;${spacingStyle}">${el.content || ''}</div>`
        }
        if (el.type === 'image') {
          const src = absoluteSrc(el.src)
          const imgFilterParts = [
            (el.filterBrightness != null && el.filterBrightness !== 100) ? `brightness(${el.filterBrightness}%)` : '',
            (el.filterContrast != null && el.filterContrast !== 100) ? `contrast(${el.filterContrast}%)` : '',
            el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
          ].filter(Boolean).join(' ')
          const filterStyle = imgFilterParts ? `filter:${imgFilterParts};` : ''
          const expandAttr = el.clickToExpand ? ' data-expand="true"' : ''
          const popupAttr = el.popupText ? ` data-popup="${el.popupText.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" data-popup-pos="${el.popupPosition || 'below'}" data-popup-fs="${el.popupFontSize || 15}"` : ''
          const interactiveCursor = (el.clickToExpand || el.popupText) ? 'cursor:pointer;' : ''
          const hasCite = el.citationText || el.citationLink
          const citeCaption = hasCite && (el.citationMode || 'caption') === 'caption'
          const citeSide = hasCite && el.citationMode === 'side'
          const cStyle = citeCaption ? style.replace('overflow:hidden;', 'overflow:visible;') : style
          let capHtml = ''
          if (citeCaption) {
            const align = el.citationAlign || 'left'
            const ct = (el.citationText || el.citationLink || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            capHtml = el.citationLink
              ? `<div class="image-caption" style="text-align:${align};"><a href="${el.citationLink.replace(/"/g,'&quot;')}" target="_blank" rel="noopener">${ct}</a></div>`
              : `<div class="image-caption" style="text-align:${align};">${ct}</div>`
          }
          const sIdx = citeSide ? sideCitations.findIndex(c => c.id === el.id) : -1
          const sup = sIdx >= 0 ? `<span class="cite-sup">${sIdx + 1}</span>` : ''
          const clipOpen = citeCaption ? `<div style="width:100%;height:100%;overflow:hidden;position:relative;${borderRadiusStyle}">` : ''
          const clipClose = citeCaption ? '</div>' : ''
          if (el.imageW != null) {
            const offX = el.imageOffsetX ?? 0
            const offY = el.imageOffsetY ?? 0
            const imgStyle = `position:absolute;left:${offX}px;top:${offY}px;width:${el.imageW}px;height:${el.imageH}px;object-fit:${el.objectFit||'contain'};${filterStyle}`
            return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${src}" alt="${el.alt||''}" style="${imgStyle}" />${clipClose}${capHtml}${sup}</div>`
          }
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${src}" alt="${el.alt||''}" style="display:block;width:100%;height:100%;object-fit:${el.objectFit||'contain'};${filterStyle}" />${clipClose}${capHtml}${sup}</div>`
        }
        if (el.type === 'shape') {
          const opacityStyle = el.opacity !== undefined && el.opacity !== 1 ? `opacity:${el.opacity};` : ''
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}${opacityStyle}">${shapeSvgString(el)}</div>`
        }
        if (el.type === 'html') {
          const srcdoc = buildHtmlEmbed(el.content || '', el.width, el.height).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${dataId}${fragClass}${fragIdx}${gsapAttrs} srcdoc="${srcdoc}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'p5') {
          const p5Doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;overflow:hidden;}canvas{display:block;}</style><script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"><\/script></head><body><script>${el.content || ''}<\/script></body></html>`
          const srcdoc = p5Doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${dataId}${fragClass}${fragIdx}${gsapAttrs} srcdoc="${srcdoc}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'code') {
          const lang = el.language || 'plaintext'
          const codeContent = escapeHtml(el.content || '')
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}"><pre style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`
        }
        if (el.type === 'markdown') {
          const md = (el.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:18px;line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>document.getElementById('out').innerHTML=marked.parse(${JSON.stringify(el.content || '')});<\\/script></body></html>`
          const escaped = srcdoc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${dataId}${fragClass}${fragIdx}${gsapAttrs} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
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
          return `<iframe${dataId}${fragClass}${fragIdx}${gsapAttrs} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'callout') {
          const bg = el.calloutColor || '#ef4444'
          const tc = el.calloutTextColor || '#ffffff'
          const fs = el.fontSize || 16
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:${fs}px;font-weight:700;font-family:-apple-system,sans-serif;">${el.calloutNumber || 1}</div>`
        }
        if (el.type === 'icon') {
          const color = el.iconColor || '#ffffff'
          const sw = el.iconStrokeWidth || 2
          const iconPaths = { Star:'<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>', Heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', Check:'<polyline points="20,6 9,17 4,12"/>', X:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', Zap:'<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>', Target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' }
          const path = iconPaths[el.iconName] || iconPaths['Star']
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`
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
          return `<iframe${dataId}${fragClass}${fragIdx}${gsapAttrs} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'video' || (el.type === 'manim' && el.rendered)) {
          const src = absoluteSrc(el.type === 'manim' ? el.rendered : el.src)
          const attrs = []
          if (el.type === 'manim') { if (el.controls) attrs.push('controls'); if (el.autoplay !== false) attrs.push('autoplay'); if (el.loop !== false) attrs.push('loop'); if (el.muted !== false) attrs.push('muted') }
          else { if (el.controls !== false) attrs.push('controls'); if (el.autoplay) attrs.push('autoplay'); if (el.loop) attrs.push('loop'); if (el.muted) attrs.push('muted') }
          const posterAttr = el.poster ? ` poster="${absoluteSrc(el.poster)}"` : ''
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}"><video src="${src}" ${attrs.join(' ')}${posterAttr} style="width:100%;height:100%;object-fit:contain;display:block;background:#000;"></video></div>`
        }
        if (el.type === 'manim' && !el.rendered) return '' // not yet rendered — omit from export
        if (el.type === 'audio') {
          const src = absoluteSrc(el.src)
          const attrs = ['controls']
          if (el.autoplay) attrs.push('autoplay')
          if (el.loop) attrs.push('loop')
          if (el.muted) attrs.push('muted')
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}display:flex;align-items:center;justify-content:center;"><audio src="${src}" ${attrs.join(' ')} style="width:90%;"></audio></div>`
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
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}overflow:auto;"><table style="width:100%;height:100%;border-collapse:collapse;">${rows}</table></div>`
        }
        if (el.type === 'textpath') {
          const fontSize = el.fontSize || 64
          const w = el.width
          const pathSide = el.pathSide || 'bottom'
          const ff = (el.fontFamily || globalFont || 'sans-serif').replace(/"/g, '\'')
          const baseTextAttrs = `font-size="${fontSize}" font-family="${ff}" fill="${el.color || '#ffffff'}" font-weight="${el.fontWeight || 'normal'}" font-style="${el.fontStyle || 'normal'}" letter-spacing="${el.letterSpacing || 0}"${el.wordSpacing ? ` word-spacing="${el.wordSpacing}"` : ''}`
          let svg, svgH
          if (pathSide === 'leftedge' || pathSide === 'rightedge') {
            const pad = Math.ceil(fontSize * 0.6)
            const pathX0 = pathSide === 'leftedge' ? pad : (w - pad)
            svgH = el.height || 300
            const lineH = fontSize * (el.lineHeight ?? 1.35)
            const tanA = Math.tan(((el.angle || 0) * Math.PI) / 180)
            const lines = (el.content || '').split('\n')
            const lineXAt = (i) => pathX0 + (fontSize + i * lineH) * tanA
            const guideX2 = pathX0 + svgH * tanA
            const tspans = lines.map((line, i) =>
              `<tspan x="${lineXAt(i)}" dy="${i === 0 ? fontSize : lineH}">${escapeHtml(line || ' ')}</tspan>`
            ).join('')
            const guideLine = el.showPath !== false
              ? `<line x1="${pathX0}" y1="0" x2="${guideX2}" y2="${svgH}" stroke="rgba(34,211,238,0.4)" stroke-width="1"/>`
              : ''
            const anchor = pathSide === 'leftedge' ? 'start' : 'end'
            svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${guideLine}<text ${baseTextAttrs} text-anchor="${anchor}">${tspans}</text></svg>`
          } else {
            const angle = el.angle || 0
            const angleRad = (angle * Math.PI) / 180
            const dy = w * Math.tan(angleRad)
            const pad = Math.ceil(fontSize * 1.2)
            const minY = Math.min(0, dy)
            svgH = Math.ceil(Math.abs(dy) + pad * 2)
            const baselineY = pad - minY
            const pathD = `M 0,${baselineY} L ${w},${baselineY + dy}`
            const pathId = `tp-${el.id}`
            const capHeight = Math.round(fontSize * 0.72)
            const textDy = (pathSide === 'left' || pathSide === 'right') ? capHeight : 0
            const tpSide = (pathSide === 'top' || pathSide === 'right') ? 'right' : 'left'
            const dyAttr = textDy ? ` dy="${textDy}"` : ''
            svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible"><defs><path id="${pathId}" d="${pathD}"/></defs><text ${baseTextAttrs}${dyAttr}><textPath href="#${pathId}" startOffset="${el.startOffset || 0}%" textAnchor="${el.textAnchor || 'start'}" side="${tpSide}">${escapeHtml(el.content || '')}</textPath></text></svg>`
          }
          const elStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${svgH}px;z-index:${el.zIndex || 1};overflow:visible;${el.rotation ? `transform:rotate(${el.rotation}deg);` : ''}`
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${elStyle}">${svg}</div>`
        }
        if (el.type === 'drawing') {
          const svgPaths = (el.paths || []).map(path => {
            const d = pointsToPath(path.points, el.smooth !== false)
            return `<path d="${d}" stroke="${path.color || '#ffffff'}" stroke-width="${path.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${path.opacity ?? 1}"/>`
          }).join('')
          return `<svg${dataId}${fragClass}${fragIdx}${gsapAttrs} style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`
        }
        return ''
      }).join('\n')

    let sideCitationsHtml = ''
    if (sideCitations.length > 0) {
      const items = sideCitations.map((c, i) => {
        const t = (c.text || c.link || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        const content = c.link
          ? `<a href="${c.link.replace(/"/g,'&quot;')}" target="_blank" rel="noopener">${t}</a>`
          : t
        return `${i + 1}. ${content}`
      }).join('&ensp;&middot;&ensp;')
      sideCitationsHtml = `      <div class="slide-citations"><div class="slide-citations-text">${items}</div></div>`
    }

    // Page numbering: grouped slides share the same number
    const slideHasPageNum = slide.showPageNumber !== false
    if (slideHasPageNum) {
      if (slide.slideGroup && pageGroupSeen.has(slide.slideGroup)) {
        // same group — reuse current counter value
      } else {
        pageCounter++
        if (slide.slideGroup) pageGroupSeen.add(slide.slideGroup)
      }
    }
    const pageLabel = showPageNumbers && slideHasPageNum
      ? (pageNumberFormat === 'c/t' ? `${pageCounter} / ${totalNumberedSlides}` : `${pageCounter}`)
      : ''

    let footerHtml = ''
    if (slide.showSlideFooter !== false && !slide.hideFooter) {
      const timeSpan = showTimeWidget ? `<span class="reveal-time-widget" style="flex-shrink:0;"></span>` : ''
      if (footerMode === 'sequence' && sequenceSections.length > 0 && (showFooter || showTimeWidget)) {
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
        const timePart = timeSpan ? `${timeSpan}` : ''
        footerHtml = `      <div class="reveal-footer" style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;pointer-events:none;box-sizing:border-box;">${timePart}<div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
        const leftContent = [timeSpan, sectionLabel].filter(Boolean).join(' — ')
        footerHtml = (leftContent || pageLabel) ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${leftContent}</span><span>${pageLabel}</span></div>` : ''
      }
    }
    const slideShowGrid = slide.showPresentGrid != null ? slide.showPresentGrid : showPresentGrid
    const gridHtml = slideShowGrid ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>` : ''

    const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate' : ''
    const autoAnimateDurAttr = slide.autoAnimate && slide.autoAnimateDuration ? ` data-auto-animate-duration="${slide.autoAnimateDuration}"` : ''
    const autoAnimateEasingAttr = slide.autoAnimate && slide.autoAnimateEasing ? ` data-auto-animate-easing="${slide.autoAnimateEasing}"` : ''
    const isCustomTrans = CUSTOM_TRANSITIONS.includes(slide.transition)
    const perSlideTransition = slide.transition ? ` data-transition="${isCustomTrans ? 'none' : slide.transition}"` : ''
    const customTransAttr = isCustomTrans ? ` data-custom-transition="${slide.transition}"` : ''
    const perSlideSpeed = slide.transitionSpeed ? ` data-transition-speed="${slide.transitionSpeed}"` : ''
    slideSectionHtmlByIndex.set(slideIndex, `    <section${bgAttrs}${autoAnimateAttr}${autoAnimateDurAttr}${autoAnimateEasingAttr}${perSlideTransition}${customTransAttr}${perSlideSpeed} style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">\n${elementsHtml}\n${footerHtml}\n${gridHtml}\n${sideCitationsHtml}\n      ${notes}\n    </section>`)
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Questrial&family=Didact+Gothic&family=Nunito:wght@300;400;500;600;700;800;900&family=Nunito+Sans:wght@300;400;500;600;700;800;900&family=Quicksand:wght@300;400;500;600;700&family=Dosis:wght@300;400;500;600;700;800&family=M+PLUS+Rounded+1c:wght@300;400;500;700;900&family=Jura:wght@300;400;500;600;700&family=Codystar:wght@300;400&family=Barlow:wght@300;400;500;600;700;800;900&family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Asap+Condensed:wght@400;500;600;700;900&family=Istok+Web:wght@400;700&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@300;400;500;600;700;800;900&family=Source+Sans+3:wght@300;400;500;600;700;800;900&family=Fira+Sans:wght@300;400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;500;700&family=Roboto+Mono:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700;800;900&family=Ubuntu:wght@300;400;500;700&family=Manrope:wght@300;400;500;600;700;800&family=Bebas+Neue&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Roboto+Flex:wght@300;400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Geist:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Figtree:wght@300;400;500;600;700;800;900&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/futura-pt">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/bauhaus-93">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/national-park">
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
    .reveal .slides section p  { margin: 0 0 0.4em; }
    .reveal .slides section ul,
    .reveal .slides section ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .reveal .slides section li { margin-bottom: 0.2em; }
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
    [data-expand] { transition:box-shadow 0.2s, outline 0.2s; outline:2px solid transparent; outline-offset:2px; }
    [data-expand]:hover { outline-color:rgba(99,102,241,0.6); box-shadow:0 0 16px rgba(99,102,241,0.25); }
    .expand-overlay { position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.2s; }
    .expand-overlay.active { opacity:1; }
    .expand-overlay img { max-width:90vw;max-height:90vh;object-fit:contain;cursor:default;border-radius:4px; }
    .image-popup { position:fixed;z-index:10001;background:rgba(20,20,30,0.95);color:#fff;padding:12px 18px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.5;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);opacity:0;transition:opacity 0.2s;white-space:pre-wrap;pointer-events:auto; }
    .image-popup.active { opacity:1; }
    [data-popup] { transition:box-shadow 0.2s, outline 0.2s; outline:2px solid transparent; outline-offset:2px; }
    [data-popup]:hover { outline-color:rgba(251,191,36,0.5); box-shadow:0 0 12px rgba(251,191,36,0.2); }
    .image-caption { position:absolute;left:0;right:0;top:100%;font-size:10px;color:rgba(255,255,255,0.5);font-family:-apple-system,sans-serif;line-height:1.3;padding:3px 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .image-caption a { color:rgba(255,255,255,0.5);text-decoration:underline;text-decoration-color:rgba(255,255,255,0.25); }
    .cite-sup { position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);color:rgba(255,255,255,0.85);font-size:10px;font-weight:700;font-family:-apple-system,sans-serif;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;line-height:1; }
    .slide-citations { position:absolute;right:2px;top:0;bottom:0;z-index:890;display:flex;align-items:center;pointer-events:none; }
    .slide-citations-text { writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;line-height:1.3;white-space:nowrap; }
    .slide-citations-text a { color:rgba(255,255,255,0.45);text-decoration:underline; }
    /* Custom fragment animations */
    .fragment.slide-up { transform:translateY(40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-down { transform:translateY(-40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-left { transform:translateX(40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-right { transform:translateX(-40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-up,.fragment.slide-down,.fragment.slide-left,.fragment.slide-right { opacity:0; }
    .fragment.slide-up.visible,.fragment.slide-down.visible,.fragment.slide-left.visible,.fragment.slide-right.visible { transform:none; opacity:1; }
    .fragment.flip-up { transform:perspective(600px) rotateX(90deg); opacity:0; transition:transform 0.6s ease, opacity 0.3s ease; }
    .fragment.flip-down { transform:perspective(600px) rotateX(-90deg); opacity:0; transition:transform 0.6s ease, opacity 0.3s ease; }
    .fragment.flip-up.visible,.fragment.flip-down.visible { transform:none; opacity:1; }
    /* Slide overview panel */
    #overview-toggle { position:fixed;top:16px;left:16px;z-index:9999;background:rgba(0,0,0,0.5);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px;backdrop-filter:blur(4px);transition:background 0.15s; }
    #overview-toggle:hover { background:rgba(0,0,0,0.75); }
    :fullscreen #overview-toggle, :-webkit-full-screen #overview-toggle { display:none; }
    #overview-panel { position:fixed;top:0;left:0;bottom:0;z-index:9998;background:rgba(15,15,25,0.95);backdrop-filter:blur(8px);border-right:1px solid rgba(255,255,255,0.1);transform:translateX(-100%);transition:transform 0.25s ease;overflow:hidden;display:flex;flex-direction:column; }
    #overview-panel.open { transform:translateX(0); }
    #overview-panel .ov-header { padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.5);font-family:-apple-system,sans-serif;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between; }
    #overview-panel .ov-body { flex:1;overflow:auto;padding:10px; }
    #overview-panel .ov-body.linear { display:flex;flex-direction:column;gap:8px;width:180px; }
    #overview-panel .ov-body.sections { display:flex;flex-direction:row;gap:16px;min-width:min-content;padding:10px 14px; }
    #overview-panel .ov-section-col { display:flex;flex-direction:column;gap:8px;min-width:140px; }
    #overview-panel .ov-section-label { font-size:10px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;text-transform:uppercase;letter-spacing:0.04em;padding:0 4px 4px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;white-space:nowrap; }
    #overview-panel .ov-thumb { position:relative;border-radius:4px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s,box-shadow 0.15s;flex-shrink:0; }
    #overview-panel .ov-thumb:hover { border-color:rgba(99,102,241,0.5);box-shadow:0 0 8px rgba(99,102,241,0.2); }
    #overview-panel .ov-thumb.active { border-color:rgba(99,102,241,0.9);box-shadow:0 0 12px rgba(99,102,241,0.35); }
    #overview-panel .ov-thumb-num { position:absolute;top:3px;left:3px;font-size:9px;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.6);padding:1px 4px;border-radius:3px;font-family:-apple-system,sans-serif;z-index:2; }
  </style>${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6; Fullscreen</button>
  <button id="overview-toggle" title="Slide overview (G)">&#x25A6; Overview</button>
  <div id="overview-panel"><div class="ov-header"><span>Slides</span><span id="ov-count"></span></div><div class="ov-body ${presentation.overviewLayout || 'linear'}" id="ov-body"></div></div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script>
    var _customTransitions = ['differential-rotation'];
    var _globalTransition = '${presentation.transition || 'slide'}';
    var _isGlobalCustom = _customTransitions.indexOf(_globalTransition) !== -1;
    Reveal.initialize({
      hash: true,
      width: ${slideW},
      height: ${slideH},
      margin: 0,
      minScale: 0,
      maxScale: 10,
      center: false,
      transition: _isGlobalCustom ? 'none' : _globalTransition,
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

    // ── GSAP element entry animations ─────────────────────────────────────────
    var GSAP_PRESETS = {
      fadeIn:     function(el, dur, delay) { gsap.fromTo(el, { opacity: 0 },                              { opacity: 1,            duration: dur, delay: delay, ease: 'power2.out', clearProps: 'opacity' }); },
      fadeUp:     function(el, dur, delay) { gsap.fromTo(el, { opacity: 0, y: 48 },                       { opacity: 1, y: 0,      duration: dur, delay: delay, ease: 'power3.out', clearProps: 'opacity,transform' }); },
      fadeDown:   function(el, dur, delay) { gsap.fromTo(el, { opacity: 0, y: -48 },                      { opacity: 1, y: 0,      duration: dur, delay: delay, ease: 'power3.out', clearProps: 'opacity,transform' }); },
      fadeLeft:   function(el, dur, delay) { gsap.fromTo(el, { opacity: 0, x: 48 },                       { opacity: 1, x: 0,      duration: dur, delay: delay, ease: 'power3.out', clearProps: 'opacity,transform' }); },
      fadeRight:  function(el, dur, delay) { gsap.fromTo(el, { opacity: 0, x: -48 },                      { opacity: 1, x: 0,      duration: dur, delay: delay, ease: 'power3.out', clearProps: 'opacity,transform' }); },
      zoomIn:     function(el, dur, delay) { gsap.fromTo(el, { opacity: 0, scale: 0.7 },                  { opacity: 1, scale: 1,  duration: dur, delay: delay, ease: 'back.out(1.4)', clearProps: 'opacity,transform' }); },
      zoomOut:    function(el, dur, delay) { gsap.fromTo(el, { opacity: 0, scale: 1.3 },                  { opacity: 1, scale: 1,  duration: dur, delay: delay, ease: 'power2.out', clearProps: 'opacity,transform' }); },
      slideUp:    function(el, dur, delay) { gsap.fromTo(el, { y: 560 },                                  { y: 0,                  duration: dur, delay: delay, ease: 'power3.out', clearProps: 'transform' }); },
      slideDown:  function(el, dur, delay) { gsap.fromTo(el, { y: -560 },                                 { y: 0,                  duration: dur, delay: delay, ease: 'power3.out', clearProps: 'transform' }); },
      slideLeft:  function(el, dur, delay) { gsap.fromTo(el, { x: 980 },                                  { x: 0,                  duration: dur, delay: delay, ease: 'power3.out', clearProps: 'transform' }); },
      slideRight: function(el, dur, delay) { gsap.fromTo(el, { x: -980 },                                 { x: 0,                  duration: dur, delay: delay, ease: 'power3.out', clearProps: 'transform' }); },
      flipX:      function(el, dur, delay) { gsap.fromTo(el, { rotationX: 90, opacity: 0, transformPerspective: 600 }, { rotationX: 0, opacity: 1, duration: dur, delay: delay, ease: 'power2.out', clearProps: 'opacity,transform' }); },
      flipY:      function(el, dur, delay) { gsap.fromTo(el, { rotationY: 90, opacity: 0, transformPerspective: 600 }, { rotationY: 0, opacity: 1, duration: dur, delay: delay, ease: 'power2.out', clearProps: 'opacity,transform' }); },
    };
    function runSlideAnimations(slide) {
      if (!slide) return;
      slide.querySelectorAll('[data-gsap-enter]').forEach(function(el) {
        var type     = el.getAttribute('data-gsap-enter');
        var delay    = parseFloat(el.getAttribute('data-gsap-delay')    || 0)   / 1000;
        var duration = parseFloat(el.getAttribute('data-gsap-duration') || 600) / 1000;
        var fn = GSAP_PRESETS[type];
        if (fn) fn(el, duration, delay);
      });
    }
    Reveal.on('ready',        function(e) { runSlideAnimations(e.currentSlide); });
    Reveal.on('slidechanged', function(e) { runSlideAnimations(e.currentSlide); });

    // Dispatch resize into HTML/p5 iframes when their slide becomes active,
    // so D3 figures that use window.addEventListener('resize', ...) re-render.
    function notifyIframes(slide) {
      if (!slide) return;
      slide.querySelectorAll('iframe').forEach(function(fr) {
        try { fr.contentWindow.dispatchEvent(new Event('resize')); } catch(ex) {}
      });
    }
    Reveal.on('ready',        function(e) { notifyIframes(e.currentSlide); });
    Reveal.on('slidechanged', function(e) { notifyIframes(e.currentSlide); });

    // ── Custom transitions (differential rotation) ───────────────────────
    (function() {
      var prevH = 0, prevV = 0;
      Reveal.on('ready', function(e) { prevH = e.indexh || 0; prevV = e.indexv || 0; });
      Reveal.on('slidechanged', function(e) {
        var prev = e.previousSlide;
        var transName = null;
        if (prev && prev.getAttribute('data-custom-transition'))
          transName = prev.getAttribute('data-custom-transition');
        else if (_isGlobalCustom)
          transName = _globalTransition;
        var dir = 1;
        if ((e.indexh || 0) < prevH || ((e.indexh || 0) === prevH && (e.indexv || 0) < prevV)) dir = -1;
        prevH = e.indexh || 0;
        prevV = e.indexv || 0;
        if (transName === 'differential-rotation') drTransition(dir);
      });
      function drTransition(dir) {
        var N = 16;
        var vw = window.innerWidth, vh = window.innerHeight;
        var bh = vh / N;
        var BAUHAUS = ['#CC0000', '#003399', '#FFCC00'];
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;pointer-events:none;overflow:hidden;';
        var pending = N;
        for (var i = 0; i < N; i++) {
          var band = document.createElement('div');
          band.style.cssText = 'position:absolute;left:0;width:100%;background:#000;box-sizing:border-box;';
          band.style.top = (i * bh) + 'px';
          band.style.height = (bh + 0.5) + 'px';
          if (i < N - 1) {
            band.style.borderBottom = '1.5px solid ' + BAUHAUS[i % 3];
          }
          overlay.appendChild(band);
          var lat = Math.PI * ((i + 0.5) / N - 0.5);
          var cos2 = Math.cos(lat); cos2 = cos2 * cos2;
          var dur = 0.4 + 1.0 * (1 - cos2);
          gsap.to(band, {
            x: dir * (vw + 20),
            duration: dur,
            ease: 'none',
            onComplete: function() { pending--; if (pending <= 0) overlay.remove(); }
          });
        }
        document.body.appendChild(overlay);
      }
    })();

    // ── Image click interactions (popup + expand) ─────────────────────
    (function() {
      function dismissAll() {
        var p = document.querySelector('.image-popup');
        if (p) { p.classList.remove('active'); setTimeout(function() { p.remove(); }, 200); }
        var ov = document.querySelector('.expand-overlay');
        if (ov) { ov.classList.remove('active'); setTimeout(function() { ov.remove(); }, 200); }
      }
      function showPopup(el, anchor) {
        var old = document.querySelector('.image-popup');
        if (old) old.remove();
        var text = el.getAttribute('data-popup');
        var pos = el.getAttribute('data-popup-pos') || 'below';
        var fs = el.getAttribute('data-popup-fs') || '15';
        var rect = anchor.getBoundingClientRect();
        var p = document.createElement('div');
        p.className = 'image-popup';
        p.textContent = text;
        p.style.fontSize = fs + 'px';
        if (pos === 'center') {
          p.style.left = (rect.left + rect.width/2) + 'px';
          p.style.top = (rect.top + rect.height/2) + 'px';
          p.style.transform = 'translate(-50%,-50%)';
        } else if (pos === 'side') {
          p.style.top = (rect.top + rect.height/2) + 'px';
          if (rect.right + 320 < window.innerWidth) {
            p.style.left = (rect.right + 12) + 'px';
            p.style.transform = 'translateY(-50%)';
          } else {
            p.style.left = (rect.left - 12) + 'px';
            p.style.transform = 'translate(-100%,-50%)';
          }
        } else {
          p.style.left = (rect.left + rect.width/2) + 'px';
          p.style.top = (rect.bottom + 12) + 'px';
          p.style.transform = 'translateX(-50%)';
        }
        document.body.appendChild(p);
        requestAnimationFrame(function() { p.classList.add('active'); });
      }
      document.addEventListener('click', function(e) {
        if (e.target.closest('.image-popup')) return;
        var ov = e.target.closest('.expand-overlay');
        if (ov) {
          if (e.target.tagName === 'IMG') return;
          dismissAll(); return;
        }
        var el = e.target.closest('[data-popup],[data-expand]');
        if (!el) { dismissAll(); return; }
        e.stopPropagation();
        dismissAll();
        var hasPopup = el.hasAttribute('data-popup');
        var hasExpand = el.hasAttribute('data-expand');
        var img = el.querySelector('img');
        if (hasExpand && img) {
          var overlay = document.createElement('div');
          overlay.className = 'expand-overlay';
          var big = document.createElement('img');
          big.src = img.src;
          big.onclick = function(ev) { ev.stopPropagation(); };
          overlay.appendChild(big);
          document.body.appendChild(overlay);
          requestAnimationFrame(function() {
            overlay.classList.add('active');
            if (hasPopup) showPopup(el, big);
          });
        } else if (hasPopup) {
          showPopup(el, el);
        }
      });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') dismissAll(); });
    })();

${(() => {
  const overviewLayout = presentation.overviewLayout || 'linear'
  const colsData = columns.map((colSlides, h) => colSlides.map((slide, v) => {
    const flatIdx = presentation.slides.indexOf(slide)
    return { h, v, flatIdx, section: slide.section || '' }
  }))
  const flatSlides = colsData.flat()
  return `
    // ── Slide overview panel ──────────────────────────────────────────
    (function() {
      var LAYOUT = '${overviewLayout}';
      var SLIDES = ${JSON.stringify(flatSlides)};
      var panel = document.getElementById('overview-panel');
      var body = document.getElementById('ov-body');
      var toggle = document.getElementById('overview-toggle');
      var countEl = document.getElementById('ov-count');
      var thumbs = [];
      var THUMB_W = LAYOUT === 'sections' ? 130 : 150;
      var slideW = ${slideW}, slideH = ${slideH};
      var thumbH = Math.round(THUMB_W * slideH / slideW);
      var isOpen = false;

      countEl.textContent = SLIDES.length;

      function buildThumbnails() {
        var allSections = document.querySelectorAll('.reveal .slides > section');
        var slideEls = [];
        allSections.forEach(function(sec) {
          var nested = sec.querySelectorAll(':scope > section');
          if (nested.length > 0) {
            nested.forEach(function(s) { slideEls.push(s); });
          } else {
            slideEls.push(sec);
          }
        });

        if (LAYOUT === 'sections') {
          var groups = {};
          var order = [];
          SLIDES.forEach(function(s, i) {
            var key = s.section || '(No Section)';
            if (!groups[key]) { groups[key] = []; order.push(key); }
            groups[key].push({ meta: s, idx: i, el: slideEls[i] });
          });
          order.forEach(function(key) {
            var col = document.createElement('div');
            col.className = 'ov-section-col';
            var label = document.createElement('div');
            label.className = 'ov-section-label';
            label.textContent = key;
            col.appendChild(label);
            groups[key].forEach(function(item) {
              col.appendChild(makeThumb(item.meta, item.idx, item.el));
            });
            body.appendChild(col);
          });
        } else {
          SLIDES.forEach(function(s, i) {
            body.appendChild(makeThumb(s, i, slideEls[i]));
          });
        }
      }

      function makeThumb(meta, idx, srcEl) {
        var wrap = document.createElement('div');
        wrap.className = 'ov-thumb';
        wrap.style.width = THUMB_W + 'px';
        wrap.style.height = thumbH + 'px';
        var num = document.createElement('div');
        num.className = 'ov-thumb-num';
        num.textContent = idx + 1;
        wrap.appendChild(num);
        if (srcEl) {
          var clone = srcEl.cloneNode(true);
          clone.style.cssText = 'position:absolute;top:0;left:0;width:' + slideW + 'px;height:' + slideH + 'px;transform:scale(' + (THUMB_W/slideW) + ');transform-origin:top left;pointer-events:none;overflow:hidden;';
          clone.querySelectorAll('.reveal-footer').forEach(function(f) { f.remove(); });
          clone.querySelectorAll('iframe').forEach(function(f) { f.remove(); });
          clone.querySelectorAll('video').forEach(function(v) { v.pause(); v.removeAttribute('autoplay'); });
          wrap.appendChild(clone);
        } else {
          wrap.style.background = 'rgba(30,30,46,0.8)';
        }
        wrap.onclick = function() { Reveal.slide(meta.h, meta.v); updateActive(); };
        thumbs.push({ el: wrap, h: meta.h, v: meta.v });
        return wrap;
      }

      function updateActive() {
        var state = Reveal.getIndices();
        thumbs.forEach(function(t) {
          if (t.h === state.h && t.v === state.v) t.el.classList.add('active');
          else t.el.classList.remove('active');
        });
        var active = body.querySelector('.ov-thumb.active');
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }

      function togglePanel() {
        isOpen = !isOpen;
        if (isOpen) panel.classList.add('open');
        else panel.classList.remove('open');
      }

      toggle.onclick = togglePanel;
      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); togglePanel(); }
      });

      Reveal.on('ready', function() { buildThumbnails(); updateActive(); });
      Reveal.on('slidechanged', function() { updateActive(); });
    })();
`
})()}
${showTimeWidget ? `
    // Time widget (clock or timer)
    (function() {
      var mode = '${footerTimeMode}';
      var timerDur = ${timerDuration} * 60;
      var timerStart = Date.now();
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      function fmt() {
        if (mode === 'clock12') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        if (mode === 'clock24') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        var elapsed = Math.floor((Date.now() - timerStart) / 1000);
        var secs = mode === 'timer-down' ? Math.max(0, timerDur - elapsed) : elapsed;
        var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
        return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
      }
      function update() { document.querySelectorAll('.reveal-time-widget').forEach(function(el) { el.textContent = fmt(); }); }
      update();
      setInterval(update, 1000);
    })();
` : ''}
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

export function downloadSlideHTML(presentation, slideIndex) {
  const slide = presentation.slides[slideIndex]
  if (!slide) return
  const singleSlide = { ...presentation, slides: [slide] }
  const html = generateRevealHTML(singleSlide)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const title = (presentation.title || 'slide').replace(/[^a-z0-9]/gi, '_')
  a.download = `${title}_slide_${slideIndex + 1}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export function previewSlideInWindow(presentation, slideIndex) {
  const slide = presentation.slides[slideIndex]
  if (!slide) return
  const singleSlide = { ...presentation, slides: [slide] }
  const html = generateRevealHTML(singleSlide)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
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
  const globalFont = presentation.globalFont || ''
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const footerTimeMode = presentation.footerTimeMode || 'none'
  const showTimeWidget = footerTimeMode !== 'none'
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const footerMode = presentation.footerMode || 'basic'
  const sequenceSections = presentation.sequenceSections || []
  const footerInactiveColor = presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'
  const printTimeLabel = (() => {
    if (!showTimeWidget) return ''
    if (footerTimeMode === 'clock12') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    if (footerTimeMode === 'clock24') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    const dur = (presentation.timerDuration ?? 20) * 60
    const m = Math.floor(dur / 60), s = dur % 60
    return footerTimeMode === 'timer-down' ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : '00:00'
  })()

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
          const spacingStyle = `${globalFont ? `font-family:${globalFont};` : ''}line-height:${el.lineHeight ?? 1.5};${el.letterSpacing ? `letter-spacing:${el.letterSpacing}px;` : ''}${el.wordSpacing ? `word-spacing:${el.wordSpacing}px;` : ''}`
          return `<div style="${style}${vis}padding:8px 12px;color:white;${spacingStyle}">${el.content || ''}</div>`
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
        if (el.type === 'p5') {
          return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.15);border:1px dashed rgba(99,102,241,0.4);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:16px;">p5</div>`
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
        if (el.type === 'textpath') {
          const fontSize = el.fontSize || 64
          const w = el.width
          const pathSide = el.pathSide || 'bottom'
          const ff = (el.fontFamily || globalFont || 'sans-serif').replace(/"/g, '\'')
          const baseTextAttrs = `font-size="${fontSize}" font-family="${ff}" fill="${el.color || '#ffffff'}" font-weight="${el.fontWeight || 'normal'}" font-style="${el.fontStyle || 'normal'}" letter-spacing="${el.letterSpacing || 0}"${el.wordSpacing ? ` word-spacing="${el.wordSpacing}"` : ''}`
          let svg, svgH
          if (pathSide === 'leftedge' || pathSide === 'rightedge') {
            const pad = Math.ceil(fontSize * 0.6)
            const pathX0 = pathSide === 'leftedge' ? pad : (w - pad)
            svgH = el.height || 300
            const lineH = fontSize * (el.lineHeight ?? 1.35)
            const tanA = Math.tan(((el.angle || 0) * Math.PI) / 180)
            const lines = (el.content || '').split('\n')
            const lineXAt = (i) => pathX0 + (fontSize + i * lineH) * tanA
            const guideX2 = pathX0 + svgH * tanA
            const tspans = lines.map((line, i) =>
              `<tspan x="${lineXAt(i)}" dy="${i === 0 ? fontSize : lineH}">${escapeHtml(line || ' ')}</tspan>`
            ).join('')
            const guideLine = el.showPath !== false
              ? `<line x1="${pathX0}" y1="0" x2="${guideX2}" y2="${svgH}" stroke="rgba(34,211,238,0.4)" stroke-width="1"/>`
              : ''
            const anchor = pathSide === 'leftedge' ? 'start' : 'end'
            svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${guideLine}<text ${baseTextAttrs} text-anchor="${anchor}">${tspans}</text></svg>`
          } else {
            const angle = el.angle || 0
            const angleRad = (angle * Math.PI) / 180
            const dy = w * Math.tan(angleRad)
            const pad = Math.ceil(fontSize * 1.2)
            const minY = Math.min(0, dy)
            svgH = Math.ceil(Math.abs(dy) + pad * 2)
            const baselineY = pad - minY
            const pathD = `M 0,${baselineY} L ${w},${baselineY + dy}`
            const pathId = `tp-${el.id}`
            const capHeight = Math.round(fontSize * 0.72)
            const textDy = (pathSide === 'left' || pathSide === 'right') ? capHeight : 0
            const tpSide = (pathSide === 'top' || pathSide === 'right') ? 'right' : 'left'
            const dyAttr = textDy ? ` dy="${textDy}"` : ''
            svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible"><defs><path id="${pathId}" d="${pathD}"/></defs><text ${baseTextAttrs}${dyAttr}><textPath href="#${pathId}" startOffset="${el.startOffset || 0}%" textAnchor="${el.textAnchor || 'start'}" side="${tpSide}">${escapeHtml(el.content || '')}</textPath></text></svg>`
          }
          const elStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${svgH}px;z-index:${el.zIndex || 1};overflow:visible;${el.rotation ? `transform:rotate(${el.rotation}deg);` : ''}`
          return `<div style="${elStyle}">${svg}</div>`
        }
        if (el.type === 'drawing') {
          const svgPaths = (el.paths || []).map(path => {
            const d = pointsToPath(path.points, el.smooth !== false)
            return `<path d="${d}" stroke="${path.color || '#ffffff'}" stroke-width="${path.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${path.opacity ?? 1}"/>`
          }).join('')
          return `<svg style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`
        }
        if (el.type && el.type.startsWith('plugin:')) {
          const data = JSON.stringify(el.pluginData || {}).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<div${dataId}${fragClass}${fragIdx}${gsapAttrs} style="${style}" data-plugin-type="${el.type}" data-plugin-id="${el.pluginId || ''}" data-plugin-data="${data}"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:14px;">Plugin: ${escapeHtml(el.type.replace('plugin:', ''))}</div></div>`
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
    if (slide.showSlideFooter !== false && !slide.hideFooter) {
      const timeLabel = printTimeLabel
      if (footerMode === 'sequence' && sequenceSections.length > 0 && (showFooter || showTimeWidget)) {
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
        const timePart = timeLabel ? `<span style="flex-shrink:0;margin-right:12px;">${timeLabel}</span>` : ''
        footerHtml = `<div style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;font-size:${footerFontSize}px;font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;">${timePart}<div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
        const leftContent = [timeLabel, sectionLabel].filter(Boolean).join(' — ')
        footerHtml = (leftContent || pageLabel)
          ? `<div style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;font-size:${footerFontSize}px;color:${footerColor};font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;"><span>${leftContent}</span><span>${pageLabel}</span></div>`
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
    .slide-page p  { margin: 0 0 0.4em; }
    .slide-page ul, .slide-page ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .slide-page li { margin-bottom: 0.2em; }
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

export function presenterInWindow(presentation) {
  const html = generatePresenterHTML(presentation)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}

export function generatePresenterHTML(presentation) {
  const slideW = presentation.slideWidth || 960
  const slideH = presentation.slideHeight || 540
  const slides = presentation.slides || []

  const slideMeta = JSON.stringify(slides.map(s => ({
    notes: s.notes || '',
    section: s.section || '',
  })))

  const revealHTML = generateRevealHTML({
    ...presentation,
    _presenterEmbed: true,
  })
  const revealDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(revealHTML)}`

  const thumbScale = 140 / slideW
  const thumbH = Math.round(140 * slideH / slideW)
  const thumbEntries = slides.map((slide, i) => {
    const bgStyle = (() => {
      const bg = slide.background
      if (!bg) return 'background:#1e1e2e;'
      if (bg.type === 'color') return `background:${bg.color || '#1e1e2e'};`
      if (bg.type === 'gradient') return `background:${bg.gradient || '#1e1e2e'};`
      if (bg.type === 'image' && bg.image) return `background-image:url(${absoluteSrc(bg.image)});background-size:${bg.size||'cover'};background-position:${bg.position||'center'};`
      return 'background:#1e1e2e;'
    })()
    const textEls = (slide.elements || [])
      .filter(el => el.type === 'text')
      .sort((a, b) => a.y - b.y)
      .slice(0, 3)
      .map(el => {
        const plain = (el.content || '').replace(/<[^>]*>/g, '').trim()
        return plain ? `<div style="font-size:7px;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;">${escapeHtml(plain.substring(0, 60))}</div>` : ''
      }).join('')
    return `<div class="pv-thumb" data-idx="${i}" style="width:140px;height:${thumbH}px;${bgStyle}">${textEls}<span class="pv-thumb-num">${i + 1}</span></div>`
  }).join('\n          ')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Presenter — ${escapeHtml(presentation.title || 'Presentation')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0d0d14; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .pv-layout { display: flex; width: 100%; height: 100%; }
    .pv-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .pv-header { height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: #13131d; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
    .pv-header-title { font-size: 12px; color: rgba(255,255,255,0.5); }
    .pv-header-slide { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 600; }
    .pv-header-time { font-size: 12px; color: rgba(255,255,255,0.45); font-variant-numeric: tabular-nums; }
    .pv-iframe-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px; overflow: hidden; }
    .pv-iframe-wrap iframe { border: none; border-radius: 6px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); }
    .pv-sidebar { width: 320px; min-width: 260px; max-width: 400px; display: flex; flex-direction: column; border-left: 1px solid rgba(255,255,255,0.06); background: #111119; overflow: hidden; resize: horizontal; }
    .pv-notes { flex: 1; overflow-y: auto; padding: 16px; min-height: 0; }
    .pv-notes-label { font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .pv-notes-text { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.85); white-space: pre-wrap; }
    .pv-notes-empty { font-size: 13px; color: rgba(255,255,255,0.25); font-style: italic; }
    .pv-upcoming { flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); padding: 12px; overflow-x: auto; overflow-y: hidden; }
    .pv-upcoming-label { font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .pv-upcoming-row { display: flex; gap: 8px; }
    .pv-thumb { position: relative; border-radius: 4px; overflow: hidden; flex-shrink: 0; border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s; display: flex; flex-direction: column; justify-content: center; }
    .pv-thumb:hover { border-color: rgba(99,102,241,0.4); }
    .pv-thumb.active { border-color: rgba(99,102,241,0.9); }
    .pv-thumb.current { border-color: rgba(34,197,94,0.8); }
    .pv-thumb-num { position: absolute; top: 2px; left: 2px; font-size: 8px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.6); padding: 1px 4px; border-radius: 2px; z-index: 2; }
    .pv-nav { display: flex; gap: 6px; }
    .pv-nav button { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #e0e0e0; border-radius: 4px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
    .pv-nav button:hover { background: rgba(255,255,255,0.14); }
  </style>
</head>
<body>
  <div class="pv-layout">
    <div class="pv-main">
      <div class="pv-header">
        <span class="pv-header-title">${escapeHtml(presentation.title || 'Presentation')}</span>
        <span class="pv-header-slide" id="pv-slide-indicator">Slide 1 / ${slides.length}</span>
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="pv-header-time" id="pv-elapsed">00:00</span>
          <div class="pv-nav">
            <button id="pv-prev" title="Previous (←)">← Prev</button>
            <button id="pv-next" title="Next (→)">Next →</button>
          </div>
        </div>
      </div>
      <div class="pv-iframe-wrap" id="pv-iframe-wrap">
        <iframe id="pv-iframe" src="${revealDataUrl}"></iframe>
      </div>
    </div>
    <div class="pv-sidebar">
      <div class="pv-notes" id="pv-notes">
        <div class="pv-notes-label">Speaker Notes</div>
        <div class="pv-notes-text" id="pv-notes-text"></div>
      </div>
      <div class="pv-upcoming" id="pv-upcoming">
        <div class="pv-upcoming-label">Upcoming Slides</div>
        <div class="pv-upcoming-row" id="pv-upcoming-row">
          ${thumbEntries}
        </div>
      </div>
    </div>
  </div>
  <script>
    var SLIDES = ${slideMeta};
    var TOTAL = SLIDES.length;
    var currentFlat = 0;
    var iframe = document.getElementById('pv-iframe');
    var notesText = document.getElementById('pv-notes-text');
    var indicator = document.getElementById('pv-slide-indicator');
    var elapsedEl = document.getElementById('pv-elapsed');
    var thumbs = document.querySelectorAll('.pv-thumb');
    var Reveal = null;
    var startTime = Date.now();

    // Elapsed timer
    setInterval(function() {
      var s = Math.floor((Date.now() - startTime) / 1000);
      var m = Math.floor(s / 60); s = s % 60;
      var h = Math.floor(m / 60); m = m % 60;
      elapsedEl.textContent = h > 0
        ? h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
        : (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);

    // Size the iframe to fit the available space while maintaining aspect ratio
    function sizeIframe() {
      var wrap = document.getElementById('pv-iframe-wrap');
      var maxW = wrap.clientWidth - 24;
      var maxH = wrap.clientHeight - 24;
      var aspect = ${slideW} / ${slideH};
      var w, h;
      if (maxW / maxH > aspect) { h = maxH; w = Math.round(h * aspect); }
      else { w = maxW; h = Math.round(w / aspect); }
      iframe.style.width = w + 'px';
      iframe.style.height = h + 'px';
    }
    window.addEventListener('resize', sizeIframe);

    function updateState(flatIdx) {
      currentFlat = flatIdx;
      var meta = SLIDES[flatIdx] || {};
      notesText.innerHTML = meta.notes
        ? '<span>' + meta.notes.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>') + '</span>'
        : '<span class="pv-notes-empty">No notes for this slide</span>';
      var section = meta.section ? '  —  ' + meta.section : '';
      indicator.textContent = 'Slide ' + (flatIdx + 1) + ' / ' + TOTAL + section;
      thumbs.forEach(function(t, i) {
        t.classList.toggle('current', i === flatIdx);
        t.classList.toggle('active', i > flatIdx && i <= flatIdx + 3);
      });
      // Scroll upcoming to show current context
      var activeThumb = thumbs[Math.min(flatIdx + 1, TOTAL - 1)];
      if (activeThumb) activeThumb.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
    }

    // Build flat index map from Reveal's h,v coordinates
    var flatMap = {}; // "h,v" -> flatIdx
    iframe.addEventListener('load', function() {
      sizeIframe();
      try {
        var iWin = iframe.contentWindow;
        Reveal = iWin.Reveal;
        // Wait for Reveal to be ready
        function tryInit() {
          if (!Reveal || !Reveal.isReady || !Reveal.isReady()) {
            setTimeout(tryInit, 100);
            return;
          }
          // Build flat map
          var slides = Reveal.getSlides();
          slides.forEach(function(s, i) {
            var idx = Reveal.getIndices(s);
            flatMap[idx.h + ',' + idx.v] = i;
          });
          Reveal.on('slidechanged', function(e) {
            var key = (e.indexh || 0) + ',' + (e.indexv || 0);
            var fi = flatMap[key];
            if (fi != null) updateState(fi);
          });
          updateState(0);
        }
        tryInit();
      } catch(e) { console.warn('Presenter: could not access iframe Reveal', e); }
    });

    // Navigation
    function goFlat(fi) {
      fi = Math.max(0, Math.min(TOTAL - 1, fi));
      if (Reveal) {
        var slides = Reveal.getSlides();
        if (slides[fi]) {
          var idx = Reveal.getIndices(slides[fi]);
          Reveal.slide(idx.h, idx.v);
        }
      }
    }
    document.getElementById('pv-prev').onclick = function() { goFlat(currentFlat - 1); };
    document.getElementById('pv-next').onclick = function() { goFlat(currentFlat + 1); };
    thumbs.forEach(function(t) {
      t.onclick = function() { goFlat(parseInt(t.getAttribute('data-idx'))); };
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goFlat(currentFlat + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goFlat(currentFlat - 1); }
    });
  </script>
</body>
</html>`
}
