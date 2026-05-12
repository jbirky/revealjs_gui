// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect, useCallback } from 'react'
import { Book, FileText, Wrench, ChevronRight } from 'lucide-react'

function renderMarkdown(md) {
  // extract code blocks first to protect their content
  const codeBlocks = []
  let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    return `\n%%CODEBLOCK_${idx}%%\n`
  })

  // extract raw HTML blocks (divs, iframes, etc.)
  const htmlBlocks = []
  html = html.replace(/^(<(?:div|iframe|details|summary)[^>]*>[\s\S]*?<\/(?:div|iframe|details|summary)>)/gm, (block) => {
    const idx = htmlBlocks.length
    htmlBlocks.push(block)
    return `\n%%HTMLBLOCK_${idx}%%\n`
  })

  // VitePress ::: containers (tip, warning, info, danger)
  html = html.replace(/::: (\w+)\n([\s\S]*?):::/g, (_, type, content) => {
    const label = type.charAt(0).toUpperCase() + type.slice(1)
    return `<div class="docs-callout docs-callout-${type}"><strong>${label}</strong><br/>${content.trim()}</div>`
  })

  // tables
  html = html.replace(/((?:^\|.+\|[ \t]*\n)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim())
    if (rows.length < 2) return tableBlock
    const parseRow = (row) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
    const isSep = (row) => /^\|?[\s:-]+\|/.test(row)
    let headerRow = null
    let bodyRows = []
    if (isSep(rows[1])) {
      headerRow = parseRow(rows[0])
      bodyRows = rows.slice(2).map(parseRow)
    } else {
      bodyRows = rows.filter(r => !isSep(r)).map(parseRow)
    }
    let t = '<table>'
    if (headerRow) {
      t += '<thead><tr>' + headerRow.map(c => `<th>${c}</th>`).join('') + '</tr></thead>'
    }
    t += '<tbody>' + bodyRows.map(cells => '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody>'
    t += '</table>'
    return '\n' + t + '\n'
  })

  // headings
  html = html
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

  // inline formatting (bold before italic to avoid conflicts)
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // blockquotes (consecutive lines)
  html = html.replace(/((?:^> .+\n?)+)/gm, (block) => {
    const inner = block.replace(/^> /gm, '').trim()
    return `<blockquote>${inner}</blockquote>`
  })

  // list items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // horizontal rules
  html = html.replace(/^---+$/gm, '<hr/>')

  // paragraphs
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (/^<(h[1-6]|ul|ol|pre|blockquote|li|div|table|hr|img|iframe)/.test(trimmed)) return trimmed
    if (/^%%(?:CODEBLOCK|HTMLBLOCK)_\d+%%$/.test(trimmed)) return trimmed
    if (trimmed.startsWith('<')) return trimmed
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`
  }).join('\n')

  // restore preserved blocks
  codeBlocks.forEach((block, i) => {
    html = html.replace(`%%CODEBLOCK_${i}%%`, block)
  })
  htmlBlocks.forEach((block, i) => {
    html = html.replace(`%%HTMLBLOCK_${i}%%`, block)
  })

  return html
}

const SECTION_META = {
  guide: { label: 'Guide', icon: Book, group: 'Getting Started' },
  features: { label: 'Features', icon: FileText, group: 'Features' },
  tutorials: { label: 'Tutorials', icon: Wrench, group: 'Tutorials' },
}

export default function DocsPage({ initialPage }) {
  const [sidebar, setSidebar] = useState(null)
  const [activePage, setActivePage] = useState(initialPage || 'guide/getting-started')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/docs/sidebar').then(r => r.json()).then(setSidebar).catch(() => {})
  }, [])

  useEffect(() => {
    if (initialPage && initialPage !== activePage) setActivePage(initialPage)
  }, [initialPage])

  const loadPage = useCallback((link) => {
    setActivePage(link)
    setLoading(true)
    const [section, page] = link.split('/')
    fetch(`/api/docs/${section}/${page}`)
      .then(r => r.ok ? r.text() : '# Not Found\n\nThis documentation page could not be loaded.')
      .then(md => { setContent(renderMarkdown(md)); setLoading(false) })
      .catch(() => { setContent('<p>Failed to load documentation.</p>'); setLoading(false) })
  }, [])

  useEffect(() => { loadPage(activePage) }, [activePage, loadPage])

  if (!sidebar) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading docs...</div>

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        {Object.entries(SECTION_META).map(([key, meta]) => {
          const items = sidebar[key] || []
          if (!items.length) return null
          const Icon = meta.icon
          return (
            <div key={key} className="docs-sidebar-section">
              <div className="docs-sidebar-heading"><Icon size={14} /> {meta.label}</div>
              {items.map(item => (
                <button
                  key={item.link}
                  className={`docs-sidebar-item ${activePage === item.link ? 'docs-sidebar-active' : ''}`}
                  onClick={() => loadPage(item.link)}
                >
                  <ChevronRight size={12} className="docs-sidebar-chevron" />
                  {item.text}
                </button>
              ))}
            </div>
          )
        })}
      </aside>
      <main className="docs-content">
        {loading
          ? <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>
          : <div className="docs-markdown" dangerouslySetInnerHTML={{ __html: content }} />
        }
      </main>
    </div>
  )
}
