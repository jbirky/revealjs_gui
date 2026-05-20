// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useState, useMemo } from 'react'
import { X, Plus, Minus, ArrowRight, Move, Maximize2, Palette, Type, ChevronDown, ChevronUp } from 'lucide-react'
import { diffPresentations } from '../utils/presentationDiff'

const STATUS_COLORS = {
  added: '#22c55e',
  removed: '#ef4444',
  modified: '#f59e0b',
  unchanged: '#4b5563',
  moved: '#3b82f6',
  resized: '#8b5cf6',
  'content-changed': '#f59e0b',
  'style-changed': '#a855f7',
}

const STATUS_ICONS = {
  added: Plus,
  removed: Minus,
  moved: Move,
  resized: Maximize2,
  'content-changed': Type,
  'style-changed': Palette,
}

function StatusBadge({ status, small }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: small ? 10 : 11, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: 0.5, color, background: `${color}20`,
      padding: small ? '1px 6px' : '2px 8px', borderRadius: 4,
    }}>
      {status}
    </span>
  )
}

function ElementDiffRow({ el }) {
  const [open, setOpen] = useState(false)
  const Icon = STATUS_ICONS[el.status] || ArrowRight
  const color = STATUS_COLORS[el.status] || '#6b7280'

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div
        onClick={() => el.changes.length > 0 && setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          cursor: el.changes.length > 0 ? 'pointer' : 'default', fontSize: 12,
        }}
      >
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span style={{ color: '#c0c0d0', flex: 1 }}>
          {el.newElement?.type || el.oldElement?.type || 'element'}
        </span>
        <StatusBadge status={el.status} small />
        {el.changes.length > 0 && (
          open ? <ChevronUp size={12} style={{ color: '#666' }} /> : <ChevronDown size={12} style={{ color: '#666' }} />
        )}
      </div>
      {open && el.changes.length > 0 && (
        <div style={{ padding: '4px 10px 8px 32px', fontSize: 11, color: '#888', lineHeight: 1.8 }}>
          {el.changes.map((c, i) => (
            <div key={i} style={{ fontFamily: "'Fira Code', monospace" }}>{c}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DiffViewer({ oldPresentation, newPresentation, oldLabel, newLabel, onClose }) {
  const diff = useMemo(
    () => diffPresentations(oldPresentation, newPresentation),
    [oldPresentation, newPresentation]
  )
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const first = diff.slides.findIndex(s => s.status !== 'unchanged')
    return first >= 0 ? first : 0
  })

  const selected = diff.slides[selectedIdx]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        margin: 'auto', width: '90vw', maxWidth: 1000, height: '85vh',
        background: '#1a1a2e', borderRadius: 12, display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#e0e0e0' }}>Version Diff</h3>
            <span style={{ fontSize: 12, color: '#666' }}>{oldLabel} → {newLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {diff.summary.added > 0 && <StatusBadge status={`+${diff.summary.added} added`} />}
            {diff.summary.removed > 0 && <StatusBadge status={`-${diff.summary.removed} removed`} />}
            {diff.summary.modified > 0 && (
              <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                {diff.summary.modified} modified
              </span>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4,
            }}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Slide list */}
          <div style={{
            width: 220, borderRight: '1px solid rgba(255,255,255,0.08)',
            overflow: 'auto', flexShrink: 0,
          }}>
            {diff.slides.map((s, i) => {
              const color = STATUS_COLORS[s.status]
              const isSelected = i === selectedIdx
              return (
                <div
                  key={s.slideId}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    background: isSelected ? 'rgba(99,102,241,0.12)' : 'none',
                    borderLeft: `3px solid ${isSelected ? '#6366f1' : 'transparent'}`,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#d0d0e0', fontWeight: isSelected ? 600 : 400 }}>
                      Slide {s.status === 'removed' ? s.oldIndex + 1 : s.newIndex + 1}
                    </span>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                    }} />
                  </div>
                  {s.status !== 'unchanged' && (
                    <div style={{ fontSize: 11, color: color, marginTop: 2 }}>
                      {s.status === 'modified' && `${s.elements.length} element${s.elements.length !== 1 ? 's' : ''} changed`}
                      {s.status === 'added' && 'New slide'}
                      {s.status === 'removed' && 'Deleted'}
                    </div>
                  )}
                </div>
              )
            })}
            {diff.slides.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 13 }}>No slides to compare</div>
            )}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: '#d0d0e0' }}>
                    Slide {selected.status === 'removed' ? selected.oldIndex + 1 : selected.newIndex + 1}
                  </h4>
                  <StatusBadge status={selected.status} />
                </div>

                {selected.status === 'added' && (
                  <div style={{ color: '#22c55e', fontSize: 13, padding: '12px 16px', background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.15)' }}>
                    This slide was added. It has {(selected.slide.elements || []).length} element{(selected.slide.elements || []).length !== 1 ? 's' : ''}.
                  </div>
                )}

                {selected.status === 'removed' && (
                  <div style={{ color: '#ef4444', fontSize: 13, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                    This slide was removed. It had {(selected.slide.elements || []).length} element{(selected.slide.elements || []).length !== 1 ? 's' : ''}.
                  </div>
                )}

                {selected.status === 'unchanged' && (
                  <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 16px', background: 'rgba(107,114,128,0.08)', borderRadius: 8 }}>
                    No changes detected on this slide.
                  </div>
                )}

                {selected.status === 'modified' && (
                  <>
                    {selected.otherChanges.length > 0 && (
                      <div style={{
                        marginBottom: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.06)',
                        borderRadius: 8, border: '1px solid rgba(245,158,11,0.12)',
                      }}>
                        <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Slide properties</div>
                        {selected.otherChanges.map((c, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#d4a04a', lineHeight: 1.8 }}>{c}</div>
                        ))}
                      </div>
                    )}

                    {selected.elements.length > 0 && (
                      <div style={{
                        background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
                      }}>
                        <div style={{
                          padding: '8px 12px', fontSize: 11, color: '#888', fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: 0.5,
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          Element changes ({selected.elements.length})
                        </div>
                        {selected.elements.map(el => (
                          <ElementDiffRow key={el.elementId} el={el} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>
                Select a slide to view changes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
