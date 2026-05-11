// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect, useCallback } from 'react'
import { Book, FileText, Wrench, ChevronRight } from 'lucide-react'

function renderMarkdown(md) {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  )

  // paragraphs: wrap lines that aren't already wrapped in block elements
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (/^<(h[1-6]|ul|ol|pre|blockquote|li|div|table)/.test(trimmed)) return trimmed
    if (trimmed.startsWith('<')) return trimmed
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`
  }).join('\n')

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
