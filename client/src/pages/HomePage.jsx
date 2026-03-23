import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Presentation, Copy, Sun, Moon } from 'lucide-react'
import { api } from '../utils/api'

const THEMES = ['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula']
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

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
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', theme: 'black', transition: 'slide' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadPresentations()
  }, [])

  async function loadPresentations() {
    try {
      const data = await api.getPresentations()
      setPresentations(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load presentations', err)
      setPresentations([])
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
      setForm({ title: '', theme: 'black', transition: 'slide' })
      onOpen(pres.id)
    } catch (err) {
      console.error('Failed to create presentation', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDuplicate(e, id) {
    e.stopPropagation()
    try {
      await api.duplicatePresentation(id)
      loadPresentations()
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

  function handleOpenModal() {
    setForm({ title: '', theme: 'black', transition: 'slide' })
    setShowModal(true)
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <h1><span>S</span>lides Editor</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            style={{ padding: '6px 10px' }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={16} />
            New Presentation
          </button>
        </div>
      </div>

      <div className="home-content">
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
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
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
