// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Presentation, Copy, Sun, Moon, Layout, ExternalLink } from 'lucide-react'
import { api } from '../utils/api'

import { UserButton } from '@clerk/clerk-react'
const isCloud = import.meta.env.VITE_PARALLAX_MODE === 'cloud'

const THEMES = ['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula']
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

// ── Preset themes (built-in, not stored on server) ──────────────────────────
const PRESET_THEMES = [
  {
    id: '__preset_minimal_dark',
    title: 'Minimal Dark',
    theme: 'black',
    transition: 'fade',
    slides: [
      { id: 's1', elements: [
        { type: 'text', x: 80, y: 180, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center; color:white">Presentation Title</h1>' },
        { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:rgba(255,255,255,0.5)">Your Name &middot; Date</p>' },
      ], background: { type: 'color', color: '#0f0f1a' } },
      { id: 's2', elements: [
        { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:white">Section Title</h2>' },
        { type: 'shape', shape: 'rect', x: 60, y: 110, width: 840, height: 2, zIndex: 2, fill: '#6366f1', stroke: 'none', strokeWidth: 0, locked: true },
        { type: 'text', x: 60, y: 130, width: 840, height: 360, zIndex: 3, content: '<p style="color:rgba(255,255,255,0.8)">Content goes here</p>' },
      ], background: { type: 'color', color: '#0f0f1a' } },
    ],
    thumbnail: { type: 'color', color: '#0f0f1a' },
    description: 'Clean dark theme with indigo accents',
  },
  {
    id: '__preset_minimal_light',
    title: 'Minimal Light',
    theme: 'white',
    transition: 'fade',
    slides: [
      { id: 's1', elements: [
        { type: 'text', x: 80, y: 180, width: 800, height: 100, zIndex: 1, content: '<h1 style="text-align:center; color:#1a1a2e">Presentation Title</h1>' },
        { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:#666">Your Name &middot; Date</p>' },
      ], background: { type: 'color', color: '#fafafa' } },
      { id: 's2', elements: [
        { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:#1a1a2e">Section Title</h2>' },
        { type: 'shape', shape: 'rect', x: 60, y: 110, width: 840, height: 2, zIndex: 2, fill: '#3b82f6', stroke: 'none', strokeWidth: 0, locked: true },
        { type: 'text', x: 60, y: 130, width: 840, height: 360, zIndex: 3, content: '<p style="color:#333">Content goes here</p>' },
      ], background: { type: 'color', color: '#fafafa' } },
    ],
    thumbnail: { type: 'color', color: '#fafafa' },
    description: 'Clean light theme with blue accents',
  },
  {
    id: '__preset_academic',
    title: 'Academic',
    theme: 'white',
    transition: 'slide',
    footerMode: 'sequence',
    sequenceSections: ['Introduction', 'Methods', 'Results', 'Discussion'],
    showFooter: true,
    showPageNumbers: true,
    footerFontFamily: "'Latin Modern Roman',serif",
    footerColor: '#1a1a2e',
    footerInactiveColor: '#b0b0c0',
    slides: [
      { id: 's1', elements: [
        { type: 'text', x: 60, y: 120, width: 840, height: 120, zIndex: 1, content: '<h1 style="text-align:center; font-family: Latin Modern Roman, serif; color:#1a1a2e">Research Paper Title</h1>' },
        { type: 'text', x: 160, y: 260, width: 640, height: 50, zIndex: 2, content: '<p style="text-align:center; font-family: Latin Modern Roman, serif; color:#444">Author Name<br>Institution</p>' },
        { type: 'text', x: 260, y: 360, width: 440, height: 40, zIndex: 3, content: '<p style="text-align:center; font-family: Latin Modern Roman, serif; color:#888; font-size:18px">Conference / Date</p>' },
      ], background: { type: 'color', color: '#ffffff' }, activeSection: 0 },
      { id: 's2', elements: [
        { type: 'text', x: 60, y: 30, width: 840, height: 60, zIndex: 1, content: '<h2 style="font-family: Latin Modern Roman, serif; color:#1a1a2e">Outline</h2>' },
        { type: 'shape', shape: 'rect', x: 60, y: 90, width: 840, height: 1, zIndex: 2, fill: '#ccc', stroke: 'none', strokeWidth: 0, locked: true },
        { type: 'text', x: 60, y: 110, width: 840, height: 380, zIndex: 3, content: '<ul style="font-family: Latin Modern Roman, serif; color:#333; font-size:24px"><li>Introduction &amp; Motivation</li><li>Methods</li><li>Results</li><li>Discussion &amp; Conclusion</li></ul>' },
      ], background: { type: 'color', color: '#ffffff' }, activeSection: 0 },
    ],
    thumbnail: { type: 'color', color: '#ffffff' },
    description: 'Serif fonts, sequence footer, academic layout',
  },
  {
    id: '__preset_gradient',
    title: 'Gradient',
    theme: 'black',
    transition: 'slide',
    slides: [
      { id: 's1', elements: [
        { type: 'text', x: 80, y: 160, width: 800, height: 120, zIndex: 1, content: '<h1 style="text-align:center; color:white">Bold Statement</h1>' },
        { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:rgba(255,255,255,0.6)">Supporting context</p>' },
      ], background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' } },
      { id: 's2', elements: [
        { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:white">Topic</h2>' },
        { type: 'text', x: 60, y: 130, width: 420, height: 360, zIndex: 2, content: '<p style="color:rgba(255,255,255,0.85)">Left column</p>' },
        { type: 'text', x: 520, y: 130, width: 400, height: 360, zIndex: 3, content: '<p style="color:rgba(255,255,255,0.85)">Right column</p>' },
      ], background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' } },
    ],
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
    description: 'Teal-to-dark gradient backgrounds',
  },
  {
    id: '__preset_corporate',
    title: 'Corporate',
    theme: 'white',
    transition: 'slide',
    showFooter: true,
    showPageNumbers: true,
    footerColor: '#334155',
    slides: [
      { id: 's1', elements: [
        { type: 'shape', shape: 'rect', x: 0, y: 0, width: 960, height: 200, zIndex: 0, fill: '#1e293b', stroke: 'none', strokeWidth: 0, locked: true },
        { type: 'text', x: 60, y: 50, width: 840, height: 100, zIndex: 1, content: '<h1 style="text-align:center; color:white">Company Name</h1>' },
        { type: 'text', x: 60, y: 150, width: 840, height: 40, zIndex: 2, content: '<p style="text-align:center; color:rgba(255,255,255,0.6); font-size:18px">Quarterly Business Review</p>' },
        { type: 'text', x: 200, y: 280, width: 560, height: 100, zIndex: 3, content: '<p style="text-align:center; color:#334155">Presented by Team Lead<br>Q1 2026</p>' },
      ], background: { type: 'color', color: '#f8fafc' } },
      { id: 's2', elements: [
        { type: 'shape', shape: 'rect', x: 0, y: 0, width: 960, height: 60, zIndex: 0, fill: '#1e293b', stroke: 'none', strokeWidth: 0, locked: true },
        { type: 'text', x: 30, y: 10, width: 900, height: 40, zIndex: 1, content: '<h3 style="color:white">Agenda</h3>' },
        { type: 'text', x: 60, y: 80, width: 840, height: 400, zIndex: 2, content: '<ul style="color:#334155; font-size:22px"><li>Key Metrics</li><li>Achievements</li><li>Challenges</li><li>Next Steps</li></ul>' },
      ], background: { type: 'color', color: '#f8fafc' } },
    ],
    thumbnail: { type: 'color', color: '#1e293b' },
    description: 'Professional with navy header bar',
  },
  {
    id: '__preset_neon',
    title: 'Neon',
    theme: 'black',
    transition: 'zoom',
    slides: [
      { id: 's1', elements: [
        { type: 'text', x: 80, y: 160, width: 800, height: 120, zIndex: 1, content: '<h1 style="text-align:center; color:#e879f9">Neon Title</h1>' },
        { type: 'text', x: 200, y: 300, width: 560, height: 60, zIndex: 2, content: '<p style="text-align:center; color:#22d3ee">Subtitle goes here</p>' },
      ], background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' } },
      { id: 's2', elements: [
        { type: 'text', x: 60, y: 40, width: 840, height: 70, zIndex: 1, content: '<h2 style="color:#e879f9">Topic</h2>' },
        { type: 'shape', shape: 'rect', x: 60, y: 110, width: 840, height: 2, zIndex: 2, fill: '#22d3ee', stroke: 'none', strokeWidth: 0, locked: true },
        { type: 'text', x: 60, y: 130, width: 840, height: 360, zIndex: 3, content: '<p style="color:rgba(255,255,255,0.8)">Content</p>' },
      ], background: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' } },
    ],
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' },
    description: 'Dark purple with neon pink & cyan',
  },
]

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCardBg(thumbnail) {
  if (!thumbnail) return '#1e1e2e'
  if (thumbnail.type === 'color' && thumbnail.color) return thumbnail.color
  if (thumbnail.type === 'gradient' && thumbnail.gradient) return thumbnail.gradient
  if (thumbnail.type === 'image' && thumbnail.image) return `url(${thumbnail.image})`
  return '#1e1e2e'
}

function isGradientOrImage(thumbnail) {
  return thumbnail && (thumbnail.type === 'gradient' || thumbnail.type === 'image')
}

export default function HomePage({ onOpen, theme, onToggleTheme }) {
  const [presentations, setPresentations] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', theme: 'black', transition: 'slide', templateId: null })
  const [creating, setCreating] = useState(false)
  const [planInfo, setPlanInfo] = useState(null)

  const atLimit = isCloud && planInfo && planInfo.limits?.maxPresentations != null
    && planInfo.presentationCount >= planInfo.limits.maxPresentations

  async function handleUpgrade() {
    try {
      const data = await api.createCheckout()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    }
  }

  async function handleManageBilling() {
    try {
      const data = await api.createPortal()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Portal error:', err)
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Cancel your Pro subscription? You\'ll keep access until the end of your billing period.')) return
    try {
      const result = await api.cancelSubscription()
      alert(`Subscription will cancel on ${new Date(result.cancelAt).toLocaleDateString()}. You keep Pro access until then.`)
    } catch (err) {
      console.error('Cancel error:', err)
      alert(err.message || 'Failed to cancel subscription')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [presData, tmplData] = await Promise.all([
        api.getPresentations(),
        api.getTemplates(),
      ])
      setPresentations(Array.isArray(presData) ? presData : [])
      setTemplates(Array.isArray(tmplData) ? tmplData : [])
      if (isCloud) api.getMe().then(setPlanInfo).catch(() => {})
    } catch (err) {
      console.error('Failed to load data', err)
      setPresentations([])
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const pres = await api.createPresentation(form)
      setShowModal(false)
      setForm({ title: '', theme: 'black', transition: 'slide', templateId: null })
      onOpen(pres.id)
    } catch (err) {
      if (err.message.includes('limit')) alert(err.message)
      else console.error('Failed to create presentation', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateFromTemplate(templateId, isPreset = false) {
    setCreating(true)
    try {
      if (isPreset) {
        // Preset templates: send the full slide data directly
        const preset = PRESET_THEMES.find(p => p.id === templateId)
        if (!preset) return
        const { id, thumbnail, description, ...data } = preset
        const pres = await api.createPresentation({
          ...data,
          title: data.title,
          slides: data.slides.map(s => ({
            ...s,
            id: crypto.randomUUID(),
            elements: (s.elements || []).map(el => ({ ...el, id: crypto.randomUUID() }))
          }))
        })
        onOpen(pres.id)
      } else {
        const pres = await api.createPresentation({ templateId })
        onOpen(pres.id)
      }
    } catch (err) {
      console.error('Failed to create from template', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDuplicate(e, id) {
    e.stopPropagation()
    try {
      await api.duplicatePresentation(id)
      loadData()
    } catch (err) {
      console.error('Failed to duplicate', err)
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this presentation? This cannot be undone.')) return
    try {
      await api.deletePresentation(id)
      setPresentations(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Failed to delete presentation', err)
    }
  }

  async function handleDeleteTemplate(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this template?')) return
    try {
      await api.deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Failed to delete template', err)
    }
  }

  async function handleCreateTemplate() {
    try {
      const template = await api.createTemplate({
        title: 'New Template',
        theme: 'black',
        transition: 'slide',
        slides: [
          {
            id: crypto.randomUUID(),
            elements: [{
              id: crypto.randomUUID(),
              type: 'text',
              x: 80, y: 160, width: 800, height: 220, zIndex: 1,
              content: '<h2 style="text-align: center">Template Title</h2><p style="text-align: center">Edit this template</p>'
            }],
            notes: '',
            background: { type: 'color', color: '#1e1e2e' }
          }
        ]
      })
      onOpen(template.id, true) // open in editor as template
    } catch (err) {
      console.error('Failed to create template', err)
    }
  }

  function handleOpenModal() {
    setForm({ title: '', theme: 'black', transition: 'slide', templateId: null })
    setShowModal(true)
  }

  const allTemplates = [...PRESET_THEMES, ...templates.map(t => ({ ...t, isUser: true }))]

  return (
    <div className="home-page">
      <div className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h1><span>P</span>arallax</h1>
          <a href="/" target="_blank" rel="noopener noreferrer" title="Landing page" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', transition: 'color 0.15s, border-color 0.15s' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
            <ExternalLink size={12} /> Site
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            style={{ padding: '6px 10px' }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal} disabled={atLimit}
            title={atLimit ? 'Presentation limit reached' : ''}>
            <Plus size={16} />
            New Presentation
          </button>
          {isCloud && planInfo && (
            <button
              onClick={planInfo.plan === 'free' && planInfo.billing ? handleUpgrade : planInfo.plan !== 'free' ? handleManageBilling : undefined}
              style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: planInfo.billing ? 'pointer' : 'default',
                background: planInfo.plan === 'pro' ? 'rgba(99,102,241,0.15)' : planInfo.plan === 'team' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                color: planInfo.plan === 'pro' ? '#818cf8' : planInfo.plan === 'team' ? '#22c55e' : 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}
              title={planInfo.plan === 'free' ? 'Upgrade to Pro' : 'Manage subscription'}
            >{planInfo.plan === 'free' && planInfo.billing ? 'Upgrade' : planInfo.plan || 'free'}</button>
          )}
          {isCloud && (
            <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }}>
              <UserButton.MenuItems>
                {planInfo?.billing && planInfo?.plan === 'free' && (
                  <UserButton.Action label="Upgrade to Pro — $5/mo" labelIcon={<span style={{ fontSize: 14 }}>&#x2B06;</span>} onClick={handleUpgrade} />
                )}
                {planInfo?.billing && planInfo?.plan !== 'free' && (
                  <UserButton.Action label="Manage subscription" labelIcon={<span style={{ fontSize: 14 }}>&#x2699;</span>} onClick={handleManageBilling} />
                )}
                {planInfo?.billing && planInfo?.plan !== 'free' && (
                  <UserButton.Action label="Cancel renewal" labelIcon={<span style={{ fontSize: 14 }}>&#x2715;</span>} onClick={handleCancelSubscription} />
                )}
              </UserButton.MenuItems>
            </UserButton>
          )}
        </div>
      </div>

      <div className="home-content">
        {atLimit && (
          <div style={{
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)',
          }}>
            You've reached the {planInfo.limits.maxPresentations}-presentation limit on the Free plan.
            {planInfo.limits.expirationDays && ` Presentations expire after ${planInfo.limits.expirationDays} days.`}
            {planInfo.billing && (
              <button onClick={handleUpgrade} style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Upgrade to Pro — $5/mo
              </button>
            )}
          </div>
        )}
        <h2>My Presentations</h2>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : (
          <div className="presentations-grid">
            <div className="new-card" onClick={handleOpenModal}>
              <Plus size={32} />
              <span>New Presentation</span>
            </div>

            {presentations.length === 0 ? (
              <div className="empty-state">
                <Presentation size={48} />
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No presentations yet</p>
                <p style={{ fontSize: 14 }}>Create your first presentation to get started</p>
              </div>
            ) : (
              presentations.map(pres => {
                const bg = getCardBg(pres.thumbnail)
                const bgProp = isGradientOrImage(pres.thumbnail)
                  ? { background: bg }
                  : { backgroundColor: bg }

                return (
                  <div
                    key={pres.id}
                    className="presentation-card"
                    onClick={() => onOpen(pres.id)}
                  >
                    <div className="card-preview" style={bgProp}>
                      {(!pres.thumbnail || pres.thumbnail.type === 'none') && (
                        <Presentation size={40} />
                      )}
                    </div>
                    <div className="card-info">
                      <h3>{pres.title || 'Untitled'}</h3>
                      <p>{pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot; {formatDate(pres.updatedAt)}</p>
                      {isCloud && pres.expiresAt && (() => {
                        const days = Math.ceil((new Date(pres.expiresAt) - Date.now()) / 86400000)
                        return (
                          <p style={{ fontSize: 11, color: days <= 7 ? '#ef4444' : '#f59e0b', margin: '2px 0 0' }}>
                            {days <= 0 ? 'Expired' : `Expires in ${days} day${days !== 1 ? 's' : ''}`}
                          </p>
                        )
                      })()}
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={(e) => { e.stopPropagation(); onOpen(pres.id) }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Duplicate"
                        onClick={(e) => handleDuplicate(e, pres.id)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete"
                        onClick={(e) => handleDelete(e, pres.id)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* My Templates Section */}
        <h2 style={{ marginTop: 40 }}>My Templates</h2>
        <div className="presentations-grid">
          <div className="new-card" onClick={handleCreateTemplate}>
            <Plus size={32} />
            <span>New Template</span>
          </div>

          {templates.map(tmpl => {
            const bg = getCardBg(tmpl.thumbnail)
            const bgProp = isGradientOrImage(tmpl.thumbnail)
              ? { background: bg }
              : { backgroundColor: bg }

            return (
              <div
                key={tmpl.id}
                className="presentation-card"
                onClick={() => onOpen(tmpl.id, true)}
              >
                <div className="card-preview" style={bgProp}>
                  <Layout size={24} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.5 }} />
                </div>
                <div className="card-info">
                  <h3>{tmpl.title || 'Untitled Template'}</h3>
                  <p>{tmpl.slideCount} slide{tmpl.slideCount !== 1 ? 's' : ''} &middot; {formatDate(tmpl.updatedAt)}</p>
                </div>
                <div className="card-actions">
                  <button
                    className="btn-icon"
                    title="Edit template"
                    onClick={(e) => { e.stopPropagation(); onOpen(tmpl.id, true) }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    title="Use template"
                    onClick={(e) => { e.stopPropagation(); handleCreateFromTemplate(tmpl.id) }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    title="Delete template"
                    onClick={(e) => handleDeleteTemplate(e, tmpl.id)}
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Preset Themes Section */}
        <h2 style={{ marginTop: 40 }}>Preset Themes</h2>
        <div className="presentations-grid">
          {PRESET_THEMES.map(preset => {
            const bg = getCardBg(preset.thumbnail)
            const bgProp = isGradientOrImage(preset.thumbnail)
              ? { background: bg }
              : { backgroundColor: bg }

            return (
              <div
                key={preset.id}
                className="presentation-card"
                onClick={() => handleCreateFromTemplate(preset.id, true)}
                style={{ cursor: creating ? 'wait' : 'pointer' }}
              >
                <div className="card-preview" style={bgProp}>
                  <Layout size={24} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.3 }} />
                </div>
                <div className="card-info">
                  <h3>{preset.title}</h3>
                  <p>{preset.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h2>New Presentation</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Title</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="My Presentation"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Template selector */}
              <div className="form-group">
                <label>Start from</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, templateId: null }))}
                    style={{
                      padding: '10px 8px', background: !form.templateId ? 'var(--accent)' : 'var(--bg-card)',
                      border: '2px solid ' + (!form.templateId ? 'var(--accent)' : 'var(--border)'),
                      borderRadius: 6, cursor: 'pointer', color: !form.templateId ? 'white' : 'var(--text-primary)',
                      fontSize: 12, fontWeight: 500, textAlign: 'center',
                    }}
                  >
                    Blank
                  </button>
                  {allTemplates.map(tmpl => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        templateId: tmpl.id,
                        theme: tmpl.theme || f.theme,
                        transition: tmpl.transition || f.transition,
                      }))}
                      style={{
                        padding: '6px 8px', textAlign: 'center', cursor: 'pointer',
                        background: form.templateId === tmpl.id ? 'var(--accent)' : 'var(--bg-card)',
                        border: '2px solid ' + (form.templateId === tmpl.id ? 'var(--accent)' : 'var(--border)'),
                        borderRadius: 6, color: form.templateId === tmpl.id ? 'white' : 'var(--text-primary)',
                        fontSize: 11, fontWeight: 500, overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        height: 28, borderRadius: 3, marginBottom: 4,
                        ...(isGradientOrImage(tmpl.thumbnail) ? { background: getCardBg(tmpl.thumbnail) } : { backgroundColor: getCardBg(tmpl.thumbnail) }),
                      }} />
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {!form.templateId && (
                <>
                  <div className="form-group">
                    <label>Theme</label>
                    <select
                      className="form-select"
                      value={form.theme}
                      onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
                    >
                      {THEMES.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Transition</label>
                    <select
                      className="form-select"
                      value={form.transition}
                      onChange={e => setForm(f => ({ ...f, transition: e.target.value }))}
                    >
                      {TRANSITIONS.map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
