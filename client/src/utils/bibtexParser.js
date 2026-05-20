// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

export function parseBibtex(input) {
  const entries = []
  const re = /@(\w+)\s*\{\s*([^,\s{}]+)\s*,/g
  let match
  while ((match = re.exec(input)) !== null) {
    const type = match[1].toLowerCase()
    if (type === 'string' || type === 'preamble' || type === 'comment') continue
    const key = match[2].trim()
    const start = match.index + match[0].length
    const body = extractBraced(input, start)
    if (!body) continue
    const fields = parseFields(body)
    entries.push({ type, key, ...fields })
  }
  return entries
}

function extractBraced(str, from) {
  let depth = 1
  let i = from
  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') depth--
    i++
  }
  return depth === 0 ? str.slice(from, i - 1) : null
}

function parseFields(body) {
  const fields = {}
  const re = /(\w+)\s*=\s*/g
  let m
  while ((m = re.exec(body)) !== null) {
    const name = m[1].toLowerCase()
    const valStart = m.index + m[0].length
    const val = readValue(body, valStart)
    if (val !== null) fields[name] = cleanLatex(val)
  }
  return fields
}

function readValue(str, from) {
  let i = from
  while (i < str.length && /\s/.test(str[i])) i++
  if (i >= str.length) return null
  if (str[i] === '{') {
    let depth = 1
    let start = i + 1
    i++
    while (i < str.length && depth > 0) {
      if (str[i] === '{') depth++
      else if (str[i] === '}') depth--
      i++
    }
    return str.slice(start, i - 1)
  }
  if (str[i] === '"') {
    let start = i + 1
    i++
    while (i < str.length && str[i] !== '"') {
      if (str[i] === '\\') i++
      i++
    }
    return str.slice(start, i)
  }
  let start = i
  while (i < str.length && /[a-zA-Z0-9]/.test(str[i])) i++
  return str.slice(start, i)
}

function cleanLatex(str) {
  return str
    .replace(/\{([^{}]*)\}/g, '$1')
    .replace(/\\&/g, '&')
    .replace(/~/g, ' ')
    .replace(/``/g, '"')
    .replace(/''/g, '"')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .trim()
}

export function parseAuthors(authorStr) {
  if (!authorStr) return []
  return authorStr.split(/\s+and\s+/i).map(a => {
    a = a.trim()
    if (a.includes(',')) {
      const [last, first] = a.split(',').map(s => s.trim())
      return { first, last }
    }
    const parts = a.split(/\s+/)
    if (parts.length === 1) return { first: '', last: parts[0] }
    return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
  })
}

export function formatAuthorsShort(authors) {
  if (!authors || authors.length === 0) return ''
  if (authors.length === 1) return authors[0].last
  if (authors.length === 2) return `${authors[0].last} & ${authors[1].last}`
  return `${authors[0].last} et al.`
}

export function formatAuthorsFull(authors) {
  if (!authors || authors.length === 0) return ''
  return authors.map(a => a.first ? `${a.first} ${a.last}` : a.last).join(', ')
}

export function formatCitation(entry, style, index) {
  const authors = parseAuthors(entry.author)
  const year = entry.year || ''
  if (style === 'author-year') {
    return `(${formatAuthorsShort(authors)}, ${year})`
  }
  return `[${index + 1}]`
}

export function formatReference(entry, index) {
  const authors = parseAuthors(entry.author)
  const authorStr = formatAuthorsFull(authors)
  const year = entry.year || ''
  const title = entry.title || ''
  const journal = entry.journal || entry.booktitle || ''
  const volume = entry.volume || ''
  const pages = entry.pages || ''
  const doi = entry.doi || ''

  let ref = `[${index + 1}] ${authorStr}`
  if (year) ref += ` (${year})`
  ref += `. ${title}.`
  if (journal) ref += ` <em>${journal}</em>`
  if (volume) ref += `, ${volume}`
  if (pages) ref += `, ${pages}`
  ref += '.'
  if (doi) ref += ` DOI: ${doi}`
  return ref
}
