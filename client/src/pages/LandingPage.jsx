// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { Pencil, Presentation, Layout, Code2, Download, Server, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: Pencil, title: 'WYSIWYG Editor', desc: 'Edit slides visually with a rich text editor. Drag, drop, and resize — no code required.' },
  { icon: Presentation, title: 'Powered by reveal.js', desc: 'Beautiful presentations with smooth transitions, speaker notes, and full-screen mode.' },
  { icon: Layout, title: 'Theme Gallery', desc: 'Start from built-in templates or create your own custom themes and reuse them.' },
  { icon: Code2, title: 'LaTeX & Code', desc: 'First-class support for math equations, syntax-highlighted code blocks, and Markdown.' },
  { icon: Download, title: 'Export Anywhere', desc: 'Export to standalone HTML, push to GitHub, or sync to cloud storage with one click.' },
  { icon: Server, title: 'Self-Hostable', desc: 'Run on your own server with Docker. Full data ownership, no vendor lock-in.' },
]


export default function LandingPage({ onSignIn }) {
  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span style={{ color: 'var(--accent)' }}>P</span>arallax
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
          <h2 className="landing-section-title">Get started for free</h2>
          <p className="landing-section-sub">
            Create presentations with no account required in self-hosted mode, or sign in to save to the cloud.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="landing-btn-primary landing-btn-lg" onClick={onSignIn}>
              Get Started <ArrowRight size={18} />
            </button>
            <a href="https://github.com/jbirky/revealjs_gui" target="_blank" rel="noopener noreferrer"
              className="landing-btn-ghost landing-btn-lg">
              View on GitHub
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="landing-logo" style={{ fontSize: 18 }}>
            <span style={{ color: 'var(--accent)' }}>P</span>arallax
          </div>
          <p>&copy; 2026 Jessica Birky. Licensed under AGPL-3.0.</p>
        </footer>
      </div>
    </div>
  )
}
