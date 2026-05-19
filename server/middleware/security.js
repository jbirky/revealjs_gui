// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = rateLimit

const IS_CLOUD = process.env.PARALLAX_MODE === 'cloud'
const IS_PROD = process.env.NODE_ENV === 'production'

const ALLOWED_ORIGINS = [
  'https://parallax-presentations.com',
  'https://dev.parallax-presentations.com',
]

function corsConfig() {
  if (!IS_CLOUD) {
    return { origin: true, credentials: true }
  }
  return {
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  }
}

function helmetConfig() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
}

function userOrIpKey(req) {
  return req.userId || ipKeyGenerator(req)
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 300 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: () => !IS_CLOUD,
})

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 60 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: () => !IS_CLOUD,
  message: { error: 'Too many uploads, please try again later' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_CLOUD ? 30 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !IS_CLOUD,
  message: { error: 'Too many requests, please try again later' },
})

// --- Validation helpers ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const SHA_RE = /^[0-9a-f]{4,40}$/i

function isValidUUID(s) { return typeof s === 'string' && UUID_RE.test(s) }
function isValidSlug(s) { return typeof s === 'string' && SAFE_SLUG_RE.test(s) }
function isValidSHA(s) { return typeof s === 'string' && SHA_RE.test(s) }

function requireValidId(paramName = 'id') {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !isValidUUID(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}` })
    }
    next()
  }
}

function requireValidSlug(paramName = 'slug') {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !isValidSlug(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}` })
    }
    next()
  }
}

function requireValidSHA(paramName = 'sha') {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !isValidSHA(val)) {
      return res.status(400).json({ error: `Invalid ${paramName}` })
    }
    next()
  }
}

// --- Upload validation ---

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac', 'audio/aac',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
])

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv',
  '.mp3', '.wav', '.flac', '.aac',
  '.pdf', '.pptx', '.ppt',
  '.woff', '.woff2', '.ttf', '.otf',
])

function validateUpload(req, res, next) {
  if (!req.file) return next()
  const ext = require('path').extname(req.file.originalname).toLowerCase()
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    require('fs-extra').removeSync(req.file.path)
    return res.status(400).json({ error: `File type not allowed: ${ext}` })
  }
  next()
}

// --- HTML generation sanitization ---

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return ''
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeAttr(val) {
  if (val == null) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeCSSValue(val) {
  if (val == null) return ''
  return String(val).replace(/[<>"'`;{}()\\]/g, '')
}

function sanitizeCustomCSS(css) {
  if (!css || typeof css !== 'string') return ''
  return css
    .replace(/<\/style/gi, '&lt;/style')
    .replace(/<script/gi, '&lt;script')
    .replace(/@import\s/gi, '/* @import blocked */ ')
    .replace(/expression\s*\(/gi, '/* expression blocked */ (')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(/* blocked */')
}

// --- Error handling ---

function safeErrorMessage(err) {
  if (!IS_PROD) return err.message
  if (err.statusCode && err.statusCode < 500) return err.message
  return 'Internal server error'
}

module.exports = {
  corsConfig,
  helmetConfig,
  apiLimiter,
  uploadLimiter,
  authLimiter,
  requireValidId,
  requireValidSlug,
  requireValidSHA,
  validateUpload,
  sanitizeUrl,
  sanitizeAttr,
  sanitizeCSSValue,
  sanitizeCustomCSS,
  safeErrorMessage,
  isValidUUID,
  isValidSlug,
  ALLOWED_ORIGINS,
}
