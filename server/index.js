// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs-extra')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const { execFileSync } = require('child_process')
const os = require('os')

const app = express()
const PORT = process.env.PORT || 3002

// Support custom data directory (used by Electron to write to user's app data folder)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const createStorage = require('./storage')
const storage = createStorage()
const { authStack, requireUser, IS_CLOUD, PLAN_LIMITS } = require('./middleware/auth')
const { isR2Enabled, streamFromR2 } = require('./services/r2')
const { handleUpload: r2Upload, deleteUploadsForPresentation } = require('./services/upload-service')

const DATA_DIR = process.env.SLIDES_DATA_DIR || path.join(__dirname, 'data')
const UPLOADS_BASE = process.env.SLIDES_UPLOADS_DIR || path.join(__dirname, 'uploads')
const UPLOADS_DIR = UPLOADS_BASE
const RCLONE_CONFIG_FILE = path.join(DATA_DIR, 'rclone.conf')
const SYNC_DIR = path.join(DATA_DIR, 'sync-export')

fs.ensureDirSync(DATA_DIR)
fs.ensureDirSync(UPLOADS_DIR)

// Multer storage config
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (isR2Enabled()) {
      const tmpDir = path.join(os.tmpdir(), 'parallax-uploads')
      fs.ensureDirSync(tmpDir)
      cb(null, tmpDir)
    } else {
      const dir = req.params.id ? path.join(UPLOADS_DIR, req.params.id) : UPLOADS_DIR
      fs.ensureDirSync(dir)
      cb(null, dir)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})
const upload = multer({ storage: multerStorage, limits: { fileSize: 500 * 1024 * 1024 } }) // 500MB limit for video

app.use(cors())
app.use(express.json({ limit: '50mb' }))
if (isR2Enabled()) {
  app.get('/uploads/*', async (req, res) => {
    const urlPath = req.path.replace(/^\/uploads\//, '')
    try {
      const { rows } = await storage.query(
        'SELECT storage_key, content_type FROM uploads WHERE filename = $1',
        [urlPath]
      )
      if (!rows.length) return res.status(404).send('Not found')
      const { body, contentType, contentLength } = await streamFromR2(rows[0].storage_key)
      res.setHeader('Content-Type', contentType || rows[0].content_type || 'application/octet-stream')
      if (contentLength) res.setHeader('Content-Length', contentLength)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      body.pipe(res)
    } catch (err) {
      console.error('R2 proxy error:', err.message)
      res.status(500).send('Storage error')
    }
  })
} else {
  app.use('/uploads', express.static(UPLOADS_DIR))
}

// Auth: in cloud mode, parses Clerk session and attaches req.userId
// In self-hosted mode, sets req.userId = null (no-op)
authStack().forEach(mw => app.use(mw))

// User provisioning (cloud mode only): maps Clerk auth ID → internal UUID.
// On first authenticated request, creates a row in the users table.
if (IS_CLOUD) {
  const provisionCache = new Map()
  const CACHE_TTL = 5 * 60 * 1000
  let clerkClient = null
  try { clerkClient = require('@clerk/express').clerkClient } catch {}

  app.use(async (req, res, next) => {
    if (!req.userId) return next()
    const clerkId = req.userId

    const cached = provisionCache.get(clerkId)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      req.userId = cached.id
      req.userPlan = cached.plan
      return next()
    }

    try {
      const { rows } = await storage.query('SELECT id, plan FROM users WHERE auth_id = $1', [clerkId])
      if (rows.length) {
        provisionCache.set(clerkId, { id: rows[0].id, plan: rows[0].plan, cachedAt: Date.now() })
        req.userId = rows[0].id
        req.userPlan = rows[0].plan
        return next()
      }

      let email = `${clerkId}@auth.local`
      let name = ''
      let avatarUrl = ''
      if (clerkClient) {
        try {
          const cu = await clerkClient.users.getUser(clerkId)
          email = cu.emailAddresses?.[0]?.emailAddress || email
          name = [cu.firstName, cu.lastName].filter(Boolean).join(' ')
          avatarUrl = cu.imageUrl || ''
        } catch (e) { console.error('Clerk user fetch failed:', e.message) }
      }

      const id = uuidv4()
      await storage.query(
        'INSERT INTO users (id, email, name, avatar_url, auth_provider, auth_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, email, name, avatarUrl, 'clerk', clerkId]
      )
      provisionCache.set(clerkId, { id, plan: 'free', cachedAt: Date.now() })
      req.userId = id
      req.userPlan = 'free'
    } catch (err) {
      console.error('User provisioning error:', err.message)
      return res.status(500).json({ error: 'User provisioning failed' })
    }
    next()
  })
}

// Protect all /api routes in cloud mode
app.use('/api', requireUser)

// Plan quota check helper
async function checkPresentationQuota(req, res) {
  if (!IS_CLOUD || !req.userId) return true
  const plan = req.userPlan || 'free'
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free
  if (limits.maxPresentations === Infinity) return true
  const { rows } = await storage.query(
    'SELECT COUNT(*)::int as count FROM presentations WHERE user_id = $1 AND is_template = false AND (expires_at IS NULL OR expires_at > NOW())',
    [req.userId]
  )
  if (rows[0].count >= limits.maxPresentations) {
    res.status(403).json({
      error: 'presentation_limit_reached',
      message: `Free plan is limited to ${limits.maxPresentations} presentations. Upgrade to Pro for unlimited.`,
      limit: limits.maxPresentations, current: rows[0].count,
    })
    return false
  }
  return true
}

// GET /api/me — returns user plan and usage
app.get('/api/me', async (req, res) => {
  if (!IS_CLOUD) return res.json({ plan: null, presentationCount: 0, limits: null })
  try {
    const plan = req.userPlan || 'free'
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free
    const { rows } = await storage.query(
      'SELECT COUNT(*)::int as count FROM presentations WHERE user_id = $1 AND is_template = false AND (expires_at IS NULL OR expires_at > NOW())',
      [req.userId]
    )
    res.json({
      plan,
      presentationCount: rows[0].count,
      limits: {
        maxPresentations: limits.maxPresentations === Infinity ? null : limits.maxPresentations,
        expirationDays: limits.expirationDays,
      },
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Transcode a video file to H.264 MP4 if its codec isn't web-compatible.
// Returns the (possibly new) filename. Deletes the original on success.
const WEB_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1', 'hevc', 'vp08', 'vp09'])
function transcodeVideoIfNeeded(filePath) {
  try {
    const codec = execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { encoding: 'utf8' }).trim().toLowerCase()

    if (!codec || WEB_VIDEO_CODECS.has(codec)) return filePath

    const dir = path.dirname(filePath)
    const base = path.basename(filePath, path.extname(filePath))
    const outPath = path.join(dir, `${base}.mp4`)
    execFileSync('ffmpeg', [
      '-i', filePath,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y', outPath
    ])
    if (outPath !== filePath) fs.removeSync(filePath)
    return outPath
  } catch (e) {
    console.error('Video transcode error:', e.message)
    return filePath
  }
}



// Shape SVG rendering helper (mirrors client/src/utils/shapeUtils.js)
function shapeSvgString(el) {
  const w = el.width, h = el.height
  const fill = el.fill || '#6366f1'
  const stroke = el.stroke || 'none'
  const sw = el.strokeWidth || 0
  const shape = el.shape || 'rect'
  let inner = ''
  if (shape === 'line') {
    const lw = el.strokeWidth || 3
    inner = `<line x1="${lw}" y1="${h/2}" x2="${w-lw}" y2="${h/2}" stroke="${fill}" stroke-width="${lw}" fill="none" />`
  } else {
    let shapeEl = ''
    switch(shape) {
      case 'rect': shapeEl = `<rect x="${sw/2}" y="${sw/2}" width="${w-sw}" height="${h-sw}" rx="${el.borderRadius||0}" />`; break
      case 'rounded-rect': shapeEl = `<rect x="${sw/2}" y="${sw/2}" width="${w-sw}" height="${h-sw}" rx="${Math.min(w,h)*0.15}" />`; break
      case 'circle': shapeEl = `<ellipse cx="${w/2}" cy="${h/2}" rx="${Math.max(0,w/2-sw/2)}" ry="${Math.max(0,h/2-sw/2)}" />`; break
      case 'triangle': shapeEl = `<polygon points="${w/2},${sw} ${w-sw},${h-sw} ${sw},${h-sw}" />`; break
      case 'diamond': shapeEl = `<polygon points="${w/2},${sw} ${w-sw},${h/2} ${w/2},${h-sw} ${sw},${h/2}" />`; break
      case 'arrow-right': shapeEl = `<polygon points="${sw},${h*0.35} ${w*0.6},${h*0.35} ${w*0.6},${sw} ${w-sw},${h/2} ${w*0.6},${h-sw} ${w*0.6},${h*0.65} ${sw},${h*0.65}" />`; break
      case 'star': {
        const cx=w/2,cy=h/2,outerR=Math.min(w,h)/2-sw,innerR=outerR*0.4,pts=[]
        for(let i=0;i<10;i++){const a=(Math.PI/5)*i-Math.PI/2;const r=i%2===0?outerR:innerR;pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`)}
        shapeEl = `<polygon points="${pts.join(' ')}" />`; break
      }
      default: shapeEl = `<rect x="${sw/2}" y="${sw/2}" width="${w-sw}" height="${h-sw}" />`
    }
    inner = `<g fill="${fill}" stroke="${stroke}" stroke-width="${sw}">${shapeEl}</g>`
  }
  let textEl = ''
  if (el.text) {
    const fs = el.fontSize || 16
    const tc = el.textColor || '#ffffff'
    textEl = `<text x="${w/2}" y="${h/2}" dominant-baseline="middle" text-anchor="middle" font-size="${fs}" fill="${tc}">${el.text}</text>`
  }
  return `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible;">${inner}${textEl}</svg>`
}

// Generate reveal.js HTML
function generateRevealHTML(presentation) {
  const theme = presentation.theme || 'black'
  const transition = presentation.transition || 'slide'
  const slideW = presentation.slideWidth || 960
  const slideH = presentation.slideHeight || 540
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerMode = presentation.footerMode || 'basic'
  const sequenceSections = presentation.sequenceSections || []
  const footerInactiveColor = presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'
  const _seenGroups = new Set()
  const totalNumberedSlides = (presentation.slides || []).filter(s => {
    if (s.showPageNumber === false) return false
    if (s.slideGroup) {
      if (_seenGroups.has(s.slideGroup)) return false
      _seenGroups.add(s.slideGroup)
    }
    return true
  }).length
  let pageCounter = 0
  const pageGroupSeen = new Set()
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const showPresentGrid = presentation.showPresentGrid || false
  const presentGridSize = presentation.gridSize || 40
  const codeTheme = presentation.codeTheme || 'monokai'

  const slidesHtml = (presentation.slides || []).map((slide, slideIndex) => {
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
          ? `box-shadow:${el.shadowX||0}px ${el.shadowY||0}px ${el.shadowBlur||0}px ${el.shadowColor||'rgba(0,0,0,0.5)'};` : ''
        const borderRadiusStyle = (el.type === 'image' || el.type === 'code') && el.borderRadius ? `border-radius:${el.borderRadius}px;` : ''
        const rotationStyle = el.rotation ? `transform:rotate(${el.rotation}deg);` : ''
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}${borderRadiusStyle}${rotationStyle}`
        const fragClass = el.fragment ? ` class="fragment ${el.fragmentAnimation || 'fade-in'}"` : ''
        const fragIdx = el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${el.fragmentIndex}"` : ''
        if (el.type === 'text') {
          const textStyle = el.sizeMode === 'auto'
            ? `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:auto;z-index:${el.zIndex||1};overflow:visible;box-sizing:border-box;${shadowStyle}${rotationStyle}`
            : style
          return `<div${fragClass}${fragIdx} style="${textStyle} padding:8px 12px; color:white;">${el.content || ''}</div>`
        }
        if (el.type === 'image') {
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
            return `<div${fragClass}${fragIdx}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${el.src}" alt="${el.alt||''}" style="${imgStyle}" />${clipClose}${capHtml}${sup}</div>`
          }
          return `<div${fragClass}${fragIdx}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${el.src}" alt="${el.alt||''}" style="display:block;width:100%;height:100%;object-fit:${el.objectFit||'contain'};${filterStyle}" />${clipClose}${capHtml}${sup}</div>`
        }
        if (el.type === 'shape') {
          const opacityStyle = el.opacity !== undefined && el.opacity !== 1 ? `opacity:${el.opacity};` : ''
          return `<div${fragClass}${fragIdx} style="${style}${opacityStyle}">${shapeSvgString(el)}</div>`
        }
        if (el.type === 'html') {
          const srcdoc = (el.content || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${fragClass}${fragIdx} srcdoc="${srcdoc}" style="${style}border:none;" scrolling="no"></iframe>`
        }
        if (el.type === 'code') {
          const lang = el.language || 'plaintext'
          const codeContent = escapeHtml(el.content || '')
          return `<div${fragClass}${fragIdx} style="${style}"><pre style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`
        }
        if (el.type === 'markdown') {
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:18px;line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>document.getElementById('out').innerHTML=marked.parse(${JSON.stringify(el.content || '')});<\/script></body></html>`
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
          const chartSrc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style></head><body><canvas id="c" style="width:100%;height:100%"></canvas><script>new Chart(document.getElementById('c'),{type:'${chartType}',data:{labels:${labels},datasets:${datasets}},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},scales:${scalesOpt}}});<\/script></body></html>`
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
            srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:auto;color:white}svg{max-width:100%;max-height:100%}</style></head><body><script type="text/tikz">${content}<\/script></body></html>`
          } else if (hasTable) {
            const wrapped = content.includes('\\begin{document}') ? content
              : `\\documentclass{article}\n\\usepackage{booktabs}\n\\usepackage{array}\n\\begin{document}\n${content}\n\\end{document}`
            srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/latex.js"><\/script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/base.css"><style>*{box-sizing:border-box}html,body{margin:0;padding:8px;background:transparent;color:white!important;width:100%;height:100%;overflow:auto;font-family:'Computer Modern',Georgia,serif}table{border-collapse:collapse;color:white}td,th{padding:3px 10px;color:white!important}p,span,div{color:white!important}</style></head><body><div id="out"></div><script>try{var generator=new HtmlGenerator({hyphenate:false});var doc=parse(${JSON.stringify(wrapped)},{generator:generator});document.getElementById('out').appendChild(doc.domFragment())}catch(e){document.getElementById('out').innerHTML='<span style="color:#f87171">Error: '+e.message+'<\/span>'}<\/script></body></html>`
          } else {
            srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:white}.katex{font-size:1.4em}svg{max-width:100%;max-height:100%}</style></head><body><div id="m"></div><script>try{katex.render(${JSON.stringify(content)},document.getElementById('m'),{displayMode:true,throwOnError:false})}catch(e){document.getElementById('m').textContent=e.message}<\/script></body></html>`
          }
          const escaped = srcdoc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          return `<iframe${fragClass}${fragIdx} srcdoc="${escaped}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
        }
        if (el.type === 'video') {
          const attrs = []
          if (el.controls !== false) attrs.push('controls')
          if (el.autoplay) attrs.push('autoplay')
          if (el.loop) attrs.push('loop')
          if (el.muted) attrs.push('muted')
          const posterAttr = el.poster ? ` poster="${el.poster}"` : ''
          const videoMime = /\.webm$/i.test(el.src) ? 'video/webm' : /\.ogg$/i.test(el.src) ? 'video/ogg' : 'video/mp4'
          return `<div${fragClass}${fragIdx} style="${style}"><video ${attrs.join(' ')}${posterAttr} style="width:100%;height:100%;object-fit:${el.objectFit||'contain'};display:block;"><source src="${el.src}" type="${videoMime}"></video></div>`
        }
        if (el.type === 'audio') {
          const attrs = ['controls']
          if (el.autoplay) attrs.push('autoplay')
          if (el.loop) attrs.push('loop')
          if (el.muted) attrs.push('muted')
          return `<div${fragClass}${fragIdx} style="${style}display:flex;align-items:center;justify-content:center;"><audio src="${el.src}" ${attrs.join(' ')} style="width:90%;"></audio></div>`
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

    // Per-slide page numbering: grouped slides share the same number
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
    if (footerMode === 'sequence' && sequenceSections.length > 0 && showFooter) {
      const activeIdx = slide.activeSection
      const seqSpans = sequenceSections.map((sec, i) => {
        const isActive = activeIdx === i
        const color = isActive ? (footerColor || 'rgba(255,255,255,0.9)') : footerInactiveColor
        const weight = isActive ? 'font-weight:700;' : 'font-weight:400;'
        return `<span style="color:${color};${weight}">${escapeHtml(sec || 'Section ' + (i+1))}</span>`
      }).join('')
      const pageSpan = pageLabel ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>` : ''
      footerHtml = `      <div class="reveal-footer" style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;pointer-events:none;box-sizing:border-box;"><div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
    } else {
      const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
      footerHtml = (sectionLabel || pageLabel) ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>` : ''
    }
    const gridHtml = showPresentGrid ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>` : ''

    const _customTrans = ['differential-rotation']
    const _isCustom = _customTrans.includes(slide.transition)
    const perSlideTransition = slide.transition ? ` data-transition="${_isCustom ? 'none' : slide.transition}"` : ''
    const customTransAttr = _isCustom ? ` data-custom-transition="${slide.transition}"` : ''
    const perSlideSpeed = slide.transitionSpeed ? ` data-transition-speed="${slide.transitionSpeed}"` : ''
    return `    <section${bgAttrs}${perSlideTransition}${customTransAttr}${perSlideSpeed} style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">\n${elementsHtml}\n${footerHtml}\n${gridHtml}\n${sideCitationsHtml}\n      ${notes}\n    </section>`
  }).join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(presentation.title || 'Presentation')}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${theme}.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${codeTheme}.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Source+Sans+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&family=Fira+Code:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css">
  <style>
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff2') format('woff2'), url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-regular.woff') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff2') format('woff2'), url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-bold.woff') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff2') format('woff2'), url('https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-italic.woff') format('woff'); }
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
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script>
    var _customTransitions = ['differential-rotation'];
    var _globalTransition = '${transition}';
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
  </script>
</body>
</html>`
}

function getBackgroundAttrs(bg) {
  if (!bg) return ''
  if (bg.type === 'color' && bg.color) return ` data-background-color="${bg.color}"`
  if (bg.type === 'image' && bg.image) return ` data-background-image="${bg.image}" data-background-size="${bg.size || 'cover'}" data-background-position="${bg.position || 'center'}"`
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

// GET /api/presentations - list summaries
app.get('/api/presentations', async (req, res) => {
  try {
    const excludeExpired = IS_CLOUD && (req.userPlan || 'free') === 'free'
    res.json(await storage.listPresentations(req.userId, { excludeExpired }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations - create new (optionally from template)
app.post('/api/presentations', async (req, res) => {
  try {
    if (!(await checkPresentationQuota(req, res))) return
    const { title, theme, transition, templateId, slides: providedSlides, ...extraFields } = req.body
    const now = new Date().toISOString()
    let presentation

    if (providedSlides && Array.isArray(providedSlides)) {
      // Create from provided slide data (preset templates)
      presentation = {
        ...extraFields,
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || extraFields.theme || 'black',
        transition: transition || extraFields.transition || 'slide',
        slides: providedSlides.map(s => ({
          ...s,
          id: s.id || uuidv4(),
          elements: (s.elements || []).map(el => ({ ...el, id: el.id || uuidv4() }))
        })),
        createdAt: now,
        updatedAt: now
      }
      delete presentation.isTemplate
      delete presentation.description
      delete presentation.thumbnail
    } else if (templateId) {
      // Create from template
      const template = await storage.getTemplate(templateId, req.userId)
      if (template) {
        const cloned = JSON.parse(JSON.stringify(template))
        presentation = {
          ...cloned,
          id: uuidv4(),
          title: title || cloned.title || 'Untitled Presentation',
          createdAt: now,
          updatedAt: now,
          slides: (cloned.slides || []).map(s => ({
            ...s,
            id: uuidv4(),
            elements: (s.elements || []).map(el => ({ ...el, id: uuidv4() }))
          }))
        }
        // Remove template-specific fields
        delete presentation.isTemplate
      }
    }

    if (!presentation) {
      presentation = {
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || 'black',
        transition: transition || 'slide',
        slides: [
          {
            id: uuidv4(),
            elements: [{
              id: uuidv4(),
              type: 'text',
              x: 80, y: 160, width: 800, height: 220, zIndex: 1,
              content: '<h2 style="text-align: center">Welcome to your presentation</h2><p style="text-align: center">Double-click to start editing</p>'
            }],
            notes: '',
            background: { type: 'color', color: '#1e1e2e' }
          }
        ],
        createdAt: now,
        updatedAt: now
      }
    }

    const plan = req.userPlan || 'free'
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free
    const expiresAt = limits.expirationDays
      ? new Date(Date.now() + limits.expirationDays * 86400000).toISOString()
      : null
    const created = await storage.createPresentation(presentation, req.userId, expiresAt)
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Templates ---

// GET /api/templates
app.get('/api/templates', async (req, res) => {
  try {
    res.json(await storage.listTemplates(req.userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/templates - create new template
app.post('/api/templates', async (req, res) => {
  try {
    const template = await storage.createTemplate(req.body, req.userId)
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/templates/:id
app.get('/api/templates/:id', async (req, res) => {
  try {
    const template = await storage.getTemplate(req.params.id, req.userId)
    if (!template) return res.status(404).json({ error: 'Not found' })
    res.json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/templates/:id
app.put('/api/templates/:id', async (req, res) => {
  try {
    const updated = await storage.updateTemplate(req.params.id, req.body, req.userId)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/templates/:id
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const deleted = await storage.deleteTemplate(req.params.id, req.userId)
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/save-as-template
app.post('/api/presentations/:id/save-as-template', async (req, res) => {
  try {
    const template = await storage.saveAsTemplate(req.params.id, req.body.title, req.userId)
    if (!template) return res.status(404).json({ error: 'Not found' })
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id - get full presentation
app.get('/api/presentations/:id', async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    res.json(presentation)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/presentations/:id - update
app.put('/api/presentations/:id', async (req, res) => {
  try {
    const updated = await storage.updatePresentation(req.params.id, req.body, req.userId)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id
app.delete('/api/presentations/:id', async (req, res) => {
  try {
    if (isR2Enabled()) {
      await deleteUploadsForPresentation(req.params.id, storage)
    }
    const deleted = await storage.deletePresentation(req.params.id, req.userId)
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/duplicate
app.post('/api/presentations/:id/duplicate', async (req, res) => {
  try {
    if (!(await checkPresentationQuota(req, res))) return
    const copy = await storage.duplicatePresentation(req.params.id, req.userId)
    if (!copy) return res.status(404).json({ error: 'Not found' })
    res.status(201).json(copy)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/upload (legacy global upload)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    let filePath = req.file.path
    if (req.file.mimetype.startsWith('video/')) {
      filePath = transcodeVideoIfNeeded(filePath)
    }
    if (isR2Enabled()) {
      const result = await r2Upload(filePath, req.file.originalname, req.file.mimetype, {
        presentationId: null, userId: req.userId, storage,
      })
      return res.json(result)
    }
    res.json({ url: `/uploads/${path.basename(filePath)}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/upload (per-presentation upload)
app.post('/api/presentations/:id/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  try {
    let filePath = req.file.path
    if (req.file.mimetype.startsWith('video/')) {
      filePath = transcodeVideoIfNeeded(filePath)
    }
    if (isR2Enabled()) {
      const result = await r2Upload(filePath, req.file.originalname, req.file.mimetype, {
        presentationId: req.params.id, userId: req.userId, storage,
      })
      return res.json(result)
    }
    res.json({ url: `/uploads/${req.params.id}/${path.basename(filePath)}` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/import-pptx — convert PPTX to per-slide PNG images
app.post('/api/presentations/:id/import-pptx', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const tmpDir = path.join(os.tmpdir(), uuidv4())
  try {
    fs.ensureDirSync(tmpDir)
    const pptxPath = path.join(tmpDir, 'presentation.pptx')
    fs.moveSync(req.file.path, pptxPath)

    // Convert PPTX → PDF
    execFileSync('libreoffice', [
      '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmpDir, pptxPath
    ], { timeout: 120000, env: { ...process.env, HOME: '/tmp' } })

    const pdfPath = path.join(tmpDir, 'presentation.pdf')
    if (!fs.existsSync(pdfPath)) throw new Error('LibreOffice PDF conversion failed')

    // Convert PDF pages → PNG images at 150 dpi
    execFileSync('pdftoppm', ['-r', '150', '-png', pdfPath, path.join(tmpDir, 'slide')], { timeout: 120000 })

    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => /^slide-?\d+\.png$/.test(f))
      .sort((a, b) => {
        const n = s => parseInt(s.match(/(\d+)/)[1])
        return n(a) - n(b)
      })

    if (isR2Enabled()) {
      const urls = []
      for (const f of pngFiles) {
        const result = await r2Upload(path.join(tmpDir, f), f, 'image/png', {
          presentationId: req.params.id, userId: req.userId, storage,
        })
        urls.push(result.url)
      }
      res.json({ urls })
    } else {
      const uploadDir = path.join(UPLOADS_DIR, req.params.id)
      fs.ensureDirSync(uploadDir)
      const urls = pngFiles.map(f => {
        const id = uuidv4()
        fs.copySync(path.join(tmpDir, f), path.join(uploadDir, `${id}.png`))
        return `/uploads/${req.params.id}/${id}.png`
      })
      res.json({ urls })
    }
  } catch (err) {
    console.error('PPTX import error:', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    fs.removeSync(tmpDir)
  }
})

// POST /api/render-manim — proxy to manim-renderer sidecar
app.post('/api/render-manim', express.json(), async (req, res) => {
  const { code, sceneName, quality } = req.body || {}
  if (!code || !sceneName) return res.status(400).json({ error: 'Missing code or sceneName' })

  const rendererUrl = process.env.MANIM_RENDERER_URL || 'http://manim-renderer:5000'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 200000) // 200s safety net

  try {
    const upstream = await fetch(`${rendererUrl}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, sceneName, quality }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await upstream.json()
    res.status(upstream.ok ? 200 : 500).json(data)
  } catch (err) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Render timed out' })
    res.status(503).json({ error: `Manim renderer unreachable: ${err.message}` })
  }
})

// GET /api/presentations/:id/export - download HTML
app.get('/api/presentations/:id/export', async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const html = generateRevealHTML(presentation)
    const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/present - serve in browser
app.get('/api/presentations/:id/present', async (req, res) => {
  try {
    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const html = generateRevealHTML(presentation)
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Share Links ---

// Helper: read/write share tokens


// POST /api/presentations/:id/share - enable sharing, return token
app.post('/api/presentations/:id/share', async (req, res) => {
  try {
    const result = await storage.createShareToken(req.params.id, req.userId)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id/share - disable sharing
app.delete('/api/presentations/:id/share', async (req, res) => {
  try {
    res.json(await storage.deleteShareToken(req.params.id, req.userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/share - get share status
app.get('/api/presentations/:id/share', async (req, res) => {
  try {
    res.json(await storage.getShareStatus(req.params.id, req.userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /share/:token - public view of shared presentation
app.get('/share/:token', async (req, res) => {
  try {
    const presentation = await storage.getSharedPresentation(req.params.token)
    if (!presentation) return res.status(404).send('Presentation not found or sharing disabled')

    const html = generateRevealHTML(presentation)
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Version History ---

// POST /api/presentations/:id/snapshot
app.post('/api/presentations/:id/snapshot', async (req, res) => {
  try {
    const result = await storage.createSnapshot(req.params.id, req.body.name, req.userId)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/presentations/:id/snapshots - list snapshots
app.get('/api/presentations/:id/snapshots', async (req, res) => {
  try {
    res.json(await storage.listSnapshots(req.params.id, req.userId))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/presentations/:id/restore/:snapshotId - restore a snapshot
app.post('/api/presentations/:id/restore/:snapshotId', async (req, res) => {
  try {
    const restored = await storage.restoreSnapshot(req.params.id, req.params.snapshotId, req.userId)
    if (!restored) return res.status(404).json({ error: 'Snapshot or presentation not found' })
    res.json(restored)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/presentations/:id/snapshots/:snapshotId
app.delete('/api/presentations/:id/snapshots/:snapshotId', async (req, res) => {
  try {
    await storage.deleteSnapshot(req.params.id, req.params.snapshotId, req.userId)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// --- Rclone / Proton Drive Sync ---

const { execFile } = require('child_process')

function runRclone(args, env = {}) {
  return new Promise((resolve, reject) => {
    const mergedEnv = { ...process.env, RCLONE_CONFIG: RCLONE_CONFIG_FILE, ...env }
    execFile('rclone', args, { env: mergedEnv, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve(stdout.trim())
    })
  })
}

// GET /api/rclone/status - check if rclone is available and configured
app.get('/api/rclone/status', async (req, res) => {
  try {
    let installed = false
    let version = ''
    try {
      version = await runRclone(['version'])
      installed = true
    } catch { }
    const hasConfig = fs.existsSync(RCLONE_CONFIG_FILE)
    let remotes = []
    if (installed && hasConfig) {
      try {
        const out = await runRclone(['listremotes'])
        remotes = out.split('\n').filter(Boolean).map(r => r.replace(/:$/, ''))
      } catch { }
    }
    res.json({ installed, version: version.split('\n')[0] || '', hasConfig, remotes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/config - save rclone config for Proton Drive
app.post('/api/rclone/config', async (req, res) => {
  try {
    const { username, password, remoteName } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
    const name = remoteName || 'protondrive'
    const configContent = `[${name}]
type = protondrive
username = ${username}
password = ${password}
`
    await fs.writeFile(RCLONE_CONFIG_FILE, configContent)
    // Verify connection
    try {
      await runRclone(['lsd', `${name}:`])
    } catch (err) {
      return res.status(400).json({ error: 'Connection failed: ' + err.message })
    }
    res.json({ success: true, remote: name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/sync - sync presentations to remote
app.post('/api/rclone/sync', async (req, res) => {
  try {
    const { remote, remotePath } = req.body
    if (!remote) return res.status(400).json({ error: 'Remote name required' })
    const dest = remotePath || '/slides-backup'

    // Export all presentations as HTML + JSON into sync dir
    fs.ensureDirSync(SYNC_DIR)
    // Clean sync dir
    fs.emptyDirSync(SYNC_DIR)

    const _sums = await storage.listPresentations(req.userId)
    const presentations = []
    for (const s of _sums) { const p = await storage.getPresentation(s.id, req.userId); if (p) presentations.push(p) }
    for (const pres of presentations) {
      const folderName = (pres.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
      const folder = path.join(SYNC_DIR, folderName)
      fs.ensureDirSync(folder)
      // Write HTML
      const html = generateRevealHTML(pres)
      fs.writeFileSync(path.join(folder, 'presentation.html'), html)
      // Write JSON
      fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(pres, null, 2))
    }

    // Copy local uploads (skip in R2 mode — files are already in cloud storage)
    if (!isR2Enabled()) {
      const uploadsSync = path.join(SYNC_DIR, '_uploads')
      if (fs.existsSync(UPLOADS_DIR)) {
        fs.copySync(UPLOADS_DIR, uploadsSync)
      }
    }

    // Run rclone sync
    const remoteDest = `${remote}:${dest}`
    await runRclone(['sync', SYNC_DIR, remoteDest, '--progress'])

    // Cleanup
    fs.removeSync(SYNC_DIR)

    res.json({ success: true, synced: presentations.length, destination: remoteDest })
  } catch (err) {
    // Cleanup on error
    try { fs.removeSync(SYNC_DIR) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/sync-single - sync a single presentation
app.post('/api/rclone/sync-single', async (req, res) => {
  try {
    const { remote, remotePath, presentationId } = req.body
    if (!remote || !presentationId) return res.status(400).json({ error: 'Remote and presentationId required' })
    const dest = remotePath || '/slides-backup'

    const pres = await storage.getPresentation(presentationId, req.userId)
    if (!pres) return res.status(404).json({ error: 'Presentation not found' })

    fs.ensureDirSync(SYNC_DIR)
    const folderName = (pres.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const folder = path.join(SYNC_DIR, folderName)
    fs.ensureDirSync(folder)

    const html = generateRevealHTML(pres)
    fs.writeFileSync(path.join(folder, 'presentation.html'), html)
    fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(pres, null, 2))

    const remoteDest = `${remote}:${dest}/${folderName}`
    await runRclone(['sync', folder, remoteDest])

    fs.removeSync(SYNC_DIR)
    res.json({ success: true, destination: remoteDest })
  } catch (err) {
    try { fs.removeSync(SYNC_DIR) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// --- GitHub Integration ---

// GET /api/github/config - get saved config (token is masked)
app.get('/api/github/config', async (req, res) => {
  try {
    const config = await storage.getGithubConfig(req.userId)
    res.json({ owner: config.owner || '', repo: config.repo || '', hasToken: !!config.token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/github/config - save config
app.post('/api/github/config', async (req, res) => {
  try {
    const updated = await storage.setGithubConfig(req.body, req.userId)
    res.json({ owner: updated.owner || '', repo: updated.repo || '', hasToken: !!updated.token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/github/push - push presentation to GitHub
app.post('/api/presentations/:id/github/push', async (req, res) => {
  try {
    const config = await storage.getGithubConfig(req.userId)
    if (!config.token || !config.owner || !config.repo) {
      return res.status(400).json({ error: 'GitHub not configured. Set token, owner, and repo first.' })
    }

    const presentation = await storage.getPresentation(req.params.id, req.userId)
    if (!presentation) return res.status(404).json({ error: 'Presentation not found' })

    const { token, owner, repo } = config
    const gh = (endpoint, opts = {}) => fetch(`https://api.github.com${endpoint}`, {
      ...opts,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    }).then(async r => {
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.message || `GitHub API ${r.status}`)
      return body
    })

    // Folder name from presentation title
    const folderName = (presentation.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const htmlContent = generateRevealHTML(presentation)
    const jsonContent = JSON.stringify(presentation, null, 2)

    // Get default branch
    const repoInfo = await gh(`/repos/${owner}/${repo}`)
    const branch = repoInfo.default_branch || 'main'

    // Check if repo has any commits (empty repo)
    let latestCommitSha = null
    let baseTreeSha = null
    try {
      const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
      latestCommitSha = refData.object.sha
      const commitData = await gh(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
      baseTreeSha = commitData.tree.sha
    } catch {
      // Repo is empty — bootstrap with an initial commit via the Contents API
      // (the Git Data API doesn't work on repos with zero commits)
      await gh(`/repos/${owner}/${repo}/contents/.gitkeep`, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Initial commit', content: '' }),
      })
      const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
      latestCommitSha = refData.object.sha
      const commitData = await gh(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`)
      baseTreeSha = commitData.tree.sha
    }

    // Discover existing presentation folders in the repo tree
    const existingFolders = new Set()
    if (baseTreeSha) {
      const rootTree = await gh(`/repos/${owner}/${repo}/git/trees/${baseTreeSha}`)
      for (const item of rootTree.tree || []) {
        if (item.type === 'tree' && item.path !== '.github') {
          existingFolders.add(item.path)
        }
      }
    }
    existingFolders.add(folderName)

    // Build README with links to all presentations
    const readmeLines = [`# Presentations\n`]
    const sortedFolders = [...existingFolders].sort()
    for (const folder of sortedFolders) {
      const displayName = folder.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const viewUrl = `https://htmlpreview.github.io/?https://github.com/${owner}/${repo}/blob/${branch}/${encodeURIComponent(folder)}/presentation.html`
      readmeLines.push(`- [${displayName}](${viewUrl})`)
    }
    const readmeContent = readmeLines.join('\n') + '\n'

    // Create blobs for our files
    const htmlBlob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: Buffer.from(htmlContent).toString('base64'), encoding: 'base64' }),
    })
    const jsonBlob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: Buffer.from(jsonContent).toString('base64'), encoding: 'base64' }),
    })
    const readmeBlob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: Buffer.from(readmeContent).toString('base64'), encoding: 'base64' }),
    })

    // Create a new tree with our files + README
    const treePayload = {
      tree: [
        { path: `${folderName}/presentation.html`, mode: '100644', type: 'blob', sha: htmlBlob.sha },
        { path: `${folderName}/presentation.json`, mode: '100644', type: 'blob', sha: jsonBlob.sha },
        { path: 'README.md', mode: '100644', type: 'blob', sha: readmeBlob.sha },
      ],
    }
    if (baseTreeSha) treePayload.base_tree = baseTreeSha
    const newTree = await gh(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(treePayload),
    })

    // Create a commit (no parents for initial commit)
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const defaultMessage = `${presentation.title || 'Untitled'} [${dateStr} ${timeStr}]`
    const commitMessage = (req.body && req.body.message) ? req.body.message : defaultMessage
    const commitPayload = {
      message: commitMessage,
      tree: newTree.sha,
      parents: latestCommitSha ? [latestCommitSha] : [],
    }
    const newCommit = await gh(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify(commitPayload),
    })

    // Update or create the branch reference
    if (latestCommitSha) {
      await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommit.sha }),
      })
    } else {
      await gh(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
      })
    }

    res.json({
      success: true,
      commitSha: newCommit.sha,
      url: `https://github.com/${owner}/${repo}/tree/${branch}/${folderName}`,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// In production, serve client build with SPA fallback
if (process.env.NODE_ENV === 'production') {
  // Support both Docker layout (../client/dist) and Electron layout (resourcesPath/client/dist)
  let clientDist = path.join(__dirname, '..', 'client', 'dist')
  if (!fs.existsSync(clientDist) && process.resourcesPath) {
    clientDist = path.join(process.resourcesPath, 'client', 'dist')
  }
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }
}

// When required as a module (Electron), export startServer. Otherwise start directly.
function startServer(port) {
  const p = port || PORT
  return new Promise((resolve) => {
    const server = app.listen(p, () => {
      console.log(`Server running on http://localhost:${p}`)
      resolve(server)
    })
  })
}

// Periodic cleanup: hard-delete free-tier presentations expired > 7 days
if (IS_CLOUD) {
  setInterval(async () => {
    try {
      const { rowCount } = await storage.query(
        "DELETE FROM presentations WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '7 days'"
      )
      if (rowCount > 0) console.log(`Cleanup: deleted ${rowCount} expired presentations`)
    } catch (err) { console.error('Cleanup error:', err.message) }
  }, 60 * 60 * 1000)
}

if (require.main === module) {
  startServer()
}

module.exports = { app, startServer }
