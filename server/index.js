const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs-extra')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')

const app = express()
const PORT = process.env.PORT || 3002

const DATA_FILE = path.join(__dirname, 'data', 'presentations.json')
const GITHUB_CONFIG_FILE = path.join(__dirname, 'data', 'github-config.json')
const UPLOADS_DIR = path.join(__dirname, 'uploads')

// Ensure directories exist
fs.ensureDirSync(path.join(__dirname, 'data'))
fs.ensureDirSync(UPLOADS_DIR)

// Initialize data file if missing
if (!fs.existsSync(DATA_FILE)) {
  fs.writeJsonSync(DATA_FILE, [])
}

// Initialize GitHub config if missing
if (!fs.existsSync(GITHUB_CONFIG_FILE)) {
  fs.writeJsonSync(GITHUB_CONFIG_FILE, { token: '', owner: '', repo: '' })
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})
const upload = multer({ storage })

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))

// Helper: read all presentations
async function readPresentations() {
  return fs.readJson(DATA_FILE)
}

// Helper: write all presentations
async function writePresentations(data) {
  return fs.writeJson(DATA_FILE, data, { spaces: 2 })
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
  const totalSlides = (presentation.slides || []).length
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const showPresentGrid = presentation.showPresentGrid || false
  const presentGridSize = presentation.gridSize || 40
  const codeTheme = presentation.codeTheme || 'monokai'

  const slidesHtml = (presentation.slides || []).map((slide, slideIndex) => {
    const bgAttrs = getBackgroundAttrs(slide.background)
    const notes = slide.notes ? `<aside class="notes">${slide.notes}</aside>` : ''

    const elementsHtml = (slide.elements || [])
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(el => {
        const shadowStyle = (el.shadowBlur || el.shadowX || el.shadowY)
          ? `box-shadow:${el.shadowX||0}px ${el.shadowY||0}px ${el.shadowBlur||0}px ${el.shadowColor||'rgba(0,0,0,0.5)'};` : ''
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}`
        const fragClass = el.fragment ? ` class="fragment ${el.fragmentAnimation || 'fade-in'}"` : ''
        const fragIdx = el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${el.fragmentIndex}"` : ''
        if (el.type === 'text') {
          return `<div${fragClass}${fragIdx} style="${style} padding:8px 12px; color:white;">${el.content || ''}</div>`
        }
        if (el.type === 'image') {
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
            return `<div${fragClass}${fragIdx} style="${style}"><img src="${el.src}" alt="${el.alt||''}" style="${imgStyle}" /></div>`
          }
          return `<div${fragClass}${fragIdx} style="${style}"><img src="${el.src}" alt="${el.alt||''}" style="display:block;width:100%;height:100%;object-fit:${el.objectFit||'contain'};${filterStyle}" /></div>`
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
      transition: '${transition}',
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
    const presentations = await readPresentations()
    const summaries = presentations.map(p => ({
      id: p.id,
      title: p.title,
      theme: p.theme,
      transition: p.transition,
      slideCount: (p.slides || []).length,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      thumbnail: (p.slides && p.slides[0]) ? p.slides[0].background : null
    }))
    res.json(summaries)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations - create new
app.post('/api/presentations', async (req, res) => {
  try {
    const { title, theme, transition } = req.body
    const now = new Date().toISOString()
    const presentation = {
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
    const presentations = await readPresentations()
    presentations.push(presentation)
    await writePresentations(presentations)
    res.status(201).json(presentation)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id - get full presentation
app.get('/api/presentations/:id', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const presentation = presentations.find(p => p.id === req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    res.json(presentation)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/presentations/:id - update
app.put('/api/presentations/:id', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const index = presentations.findIndex(p => p.id === req.params.id)
    if (index === -1) return res.status(404).json({ error: 'Not found' })
    presentations[index] = {
      ...presentations[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    }
    await writePresentations(presentations)
    res.json(presentations[index])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id
app.delete('/api/presentations/:id', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const index = presentations.findIndex(p => p.id === req.params.id)
    if (index === -1) return res.status(404).json({ error: 'Not found' })
    presentations.splice(index, 1)
    await writePresentations(presentations)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/duplicate
app.post('/api/presentations/:id/duplicate', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const original = presentations.find(p => p.id === req.params.id)
    if (!original) return res.status(404).json({ error: 'Not found' })
    const now = new Date().toISOString()
    const copy = JSON.parse(JSON.stringify(original))
    copy.id = uuidv4()
    copy.title = (copy.title || 'Untitled') + ' (copy)'
    copy.createdAt = now
    copy.updatedAt = now
    presentations.push(copy)
    await writePresentations(presentations)
    res.status(201).json(copy)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// GET /api/presentations/:id/export - download HTML
app.get('/api/presentations/:id/export', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const presentation = presentations.find(p => p.id === req.params.id)
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
    const presentations = await readPresentations()
    const presentation = presentations.find(p => p.id === req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const html = generateRevealHTML(presentation)
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- GitHub Integration ---

// GET /api/github/config - get saved config (token is masked)
app.get('/api/github/config', async (req, res) => {
  try {
    const config = await fs.readJson(GITHUB_CONFIG_FILE)
    res.json({
      owner: config.owner || '',
      repo: config.repo || '',
      hasToken: !!(config.token),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/github/config - save config
app.post('/api/github/config', async (req, res) => {
  try {
    const existing = await fs.readJson(GITHUB_CONFIG_FILE)
    const updated = {
      token: req.body.token !== undefined ? req.body.token : existing.token,
      owner: req.body.owner !== undefined ? req.body.owner : existing.owner,
      repo: req.body.repo !== undefined ? req.body.repo : existing.repo,
    }
    await fs.writeJson(GITHUB_CONFIG_FILE, updated, { spaces: 2 })
    res.json({ owner: updated.owner, repo: updated.repo, hasToken: !!updated.token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/github/push - push presentation to GitHub
app.post('/api/presentations/:id/github/push', async (req, res) => {
  try {
    const config = await fs.readJson(GITHUB_CONFIG_FILE)
    if (!config.token || !config.owner || !config.repo) {
      return res.status(400).json({ error: 'GitHub not configured. Set token, owner, and repo first.' })
    }

    const presentations = await readPresentations()
    const presentation = presentations.find(p => p.id === req.params.id)
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
  const clientDist = path.join(__dirname, '..', 'client', 'dist')
  app.use(express.static(clientDist))
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
