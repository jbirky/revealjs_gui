// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect } from 'react'
import { Pencil, Presentation, Layout, Code2, Download, Server, Check, ArrowRight, BookOpen } from 'lucide-react'
import DocsPage from '../components/DocsPage'

const FEATURES = [
  { icon: Pencil, title: 'WYSIWYG Editor', desc: 'Edit slides visually with a rich text editor. Drag, drop, and resize — no code required.' },
  { icon: Presentation, title: 'Powered by reveal.js', desc: 'Beautiful presentations with smooth transitions, speaker notes, and full-screen mode.' },
  { icon: Layout, title: 'Theme Gallery', desc: 'Start from built-in templates or create your own custom themes and reuse them.' },
  { icon: Code2, title: 'LaTeX & Code', desc: 'First-class support for math equations, syntax-highlighted code blocks, and Markdown.' },
  { icon: Download, title: 'Export Anywhere', desc: 'Export to standalone HTML, push to GitHub, or sync to cloud storage with one click.' },
  { icon: Server, title: 'Self-Hostable', desc: 'Run on your own server with Docker. Full data ownership, no vendor lock-in.' },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: ['3 presentations', '100 MB storage', '30-day expiration'],
    cta: 'Get Started',
    highlighted: false,
  },
]

export default function LandingPage({ onSignIn }) {
  const [tab, setTab] = useState('home')
  const [docsPage, setDocsPage] = useState(null)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#docs')) {
      setTab('docs')
      const page = hash.replace('#docs/', '').replace('#docs', '')
      if (page && page.includes('/')) setDocsPage(page)
    }
    const onHash = () => {
      const h = window.location.hash
      if (h.startsWith('#docs')) {
        setTab('docs')
        const p = h.replace('#docs/', '').replace('#docs', '')
        if (p && p.includes('/')) setDocsPage(p)
      } else {
        setTab('home')
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const switchTab = (t) => {
    setTab(t)
    window.location.hash = t === 'docs' ? 'docs' : ''
  }

  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div className="landing-logo" style={{ cursor: 'pointer' }} onClick={() => switchTab('home')}>
              <span style={{ color: 'var(--accent)' }}>P</span>arallax
            </div>
            <div className="landing-nav-tabs">
              <button className={`landing-nav-tab ${tab === 'home' ? 'landing-nav-tab-active' : ''}`} onClick={() => switchTab('home')}>Home</button>
              <button className={`landing-nav-tab ${tab === 'docs' ? 'landing-nav-tab-active' : ''}`} onClick={() => switchTab('docs')}><BookOpen size={14} /> Docs</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="landing-btn-ghost" onClick={onSignIn}>Sign In</button>
            <button className="landing-btn-primary" onClick={onSignIn}>
              Get Started <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="landing-scroll">
        {tab === 'docs' ? (
          <DocsPage initialPage={docsPage} />
        ) : (<>
        {/* Hero */}
        <section className="landing-hero">
          <h1 className="landing-hero-title">
            Create stunning presentations,<br />
            <span style={{ color: 'var(--accent)' }}>effortlessly.</span>
          </h1>
          <p className="landing-hero-sub">
            A powerful WYSIWYG editor powered by reveal.js. Design beautiful slides
            with drag-and-drop, rich media, and professional themes.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="landing-btn-primary landing-btn-lg" onClick={onSignIn}>
              Get Started Free <ArrowRight size={18} />
            </button>
            <a href="https://github.com/jbirky/revealjs_gui" target="_blank" rel="noopener noreferrer"
              className="landing-btn-ghost landing-btn-lg">
              View on GitHub
            </a>
          </div>

          {/* Hero visual */}
          <div className="landing-hero-visual">
            <div className="landing-mockup">
              <div className="landing-mockup-toolbar">
                <div className="landing-mockup-dot" style={{ background: '#ef4444' }} />
                <div className="landing-mockup-dot" style={{ background: '#eab308' }} />
                <div className="landing-mockup-dot" style={{ background: '#22c55e' }} />
              </div>
              <div className="landing-mockup-slide">
                <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.8)', borderRadius: 6, marginBottom: 12 }} />
                <div style={{ width: '40%', height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 4, marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, height: 60, background: 'rgba(99,102,241,0.2)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)' }} />
                  <div style={{ flex: 1, height: 60, background: 'rgba(99,102,241,0.15)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.2)' }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="landing-section">
          <h2 className="landing-section-title">Everything you need</h2>
          <p className="landing-section-sub">
            From simple slideshows to complex academic presentations — Parallax has you covered.
          </p>
          <div className="landing-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">
                  <f.icon size={24} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Get Started */}
        <section className="landing-section" style={{ textAlign: 'center' }}>
          <h2 className="landing-section-title">Get started</h2>
          <p className="landing-section-sub" style={{ maxWidth: 600, margin: '0 auto' }}>
            For the best experience, we recommend self-hosting Parallax on your own server with Docker.
            You get full data ownership, no usage limits, and no account required.
          </p>
          <a
            href="#docs/guide/installation"
            className="landing-btn-primary"
            style={{ margin: '24px auto 0', justifyContent: 'center', textDecoration: 'none' }}
          >
            <Server size={16} /> Self-Hosting Guide
          </a>
          <p style={{ color: 'var(--text-muted, #888)', fontSize: 14, marginTop: 32, maxWidth: 480, margin: '32px auto 0' }}>
            Want to try it out first? You can demo a prototype of the app by signing up here.
          </p>
          <button
            className="landing-btn-ghost"
            style={{ margin: '12px auto 0', justifyContent: 'center' }}
            onClick={onSignIn}
          >
            Try the Demo <ArrowRight size={16} />
          </button>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="landing-logo" style={{ fontSize: 18 }}>
            <span style={{ color: 'var(--accent)' }}>P</span>arallax
          </div>
          <p>&copy; 2026 Jessica Birky. Licensed under AGPL-3.0.</p>
        </footer>
        </>)}
      </div>
    </div>
  )
}
