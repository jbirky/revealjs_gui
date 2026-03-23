import { useState, useRef } from 'react'
import { Plus, Copy, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || '#1e1e2e' }
  if (bg.type === 'image' && bg.image) return { backgroundImage: `url(${bg.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { backgroundColor: '#1e1e2e' }
}

export default function SlidePanel({ slides, currentIndex, onSelect, onAdd, onDelete, onDuplicate, onMove }) {
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragIndexRef = useRef(null)

  return (
    <div className="slide-panel">
      <div className="slide-panel-header">
        <span>Slides</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{slides.length}</span>
      </div>

      <div className="slide-list">
        {slides.map((slide, index) => {
          return (
            <div
              key={slide.id || index}
              className={`slide-item ${index === currentIndex ? 'active' : ''}`}
              style={dragOverIndex === index ? { outline: '2px solid var(--accent)', outlineOffset: '-2px' } : undefined}
              draggable
              onDragStart={() => { dragIndexRef.current = index }}
              onDragOver={e => { e.preventDefault(); setDragOverIndex(index) }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={e => {
                e.preventDefault()
                setDragOverIndex(null)
                const from = dragIndexRef.current
                if (from !== null && from !== index) onMove(from, index)
                dragIndexRef.current = null
              }}
              onDragEnd={() => { setDragOverIndex(null); dragIndexRef.current = null }}
              onClick={() => onSelect(index)}
            >
              <span className="slide-number">{index + 1}</span>

              {slide.section && (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2, paddingLeft: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  § {slide.section}
                </div>
              )}
              <div className="slide-thumbnail" style={{ ...getBgStyle(slide.background), position: 'relative', overflow: 'hidden' }}>
                {(slide.elements || []).map(el => (
                  <div key={el.id} style={{
                    position: 'absolute',
                    left: `${(el.x / 960) * 100}%`,
                    top: `${(el.y / 540) * 100}%`,
                    width: `${(el.width / 960) * 100}%`,
                    height: `${(el.height / 540) * 100}%`,
                    overflow: 'hidden',
                    fontSize: '4px',
                    lineHeight: 1.3,
                    color: 'white',
                    zIndex: el.zIndex || 1
                  }}>
                    {el.type === 'text' && (
                      <div dangerouslySetInnerHTML={{ __html: el.content || '' }} />
                    )}
                    {el.type === 'image' && (
                      <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
                    )}
                    {el.type === 'html' && (
                      <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: 'rgba(255,255,255,0.4)' }}>
                        &lt;/&gt;
                      </div>
                    )}
                    {el.type === 'code' && (
                      <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 5, color: 'rgba(180,220,120,0.7)', fontFamily: 'monospace' }}>
                        {el.language || 'code'}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="slide-actions">
                <button
                  className="slide-action-btn"
                  title="Duplicate"
                  onClick={e => { e.stopPropagation(); onDuplicate(index) }}
                >
                  <Copy size={10} />
                </button>
                <button
                  className="slide-action-btn"
                  title="Move up"
                  onClick={e => { e.stopPropagation(); onMove(index, index - 1) }}
                  disabled={index === 0}
                >
                  <ArrowUp size={10} />
                </button>
                <button
                  className="slide-action-btn"
                  title="Move down"
                  onClick={e => { e.stopPropagation(); onMove(index, index + 1) }}
                  disabled={index === slides.length - 1}
                >
                  <ArrowDown size={10} />
                </button>
                <button
                  className="slide-action-btn"
                  title="Delete"
                  onClick={e => {
                    e.stopPropagation()
                    if (slides.length > 1) onDelete(index)
                  }}
                  style={{ color: slides.length > 1 ? 'white' : 'rgba(255,255,255,0.3)' }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="slide-panel-footer">
        <button className="add-slide-btn" onClick={onAdd}>
          <Plus size={14} />
          Add Slide
        </button>
      </div>
    </div>
  )
}
