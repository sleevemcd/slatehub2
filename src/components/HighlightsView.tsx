import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { HIGHLIGHT_COLORS } from '../types'

export function HighlightsView() {
  const { state, dispatch, goToView } = useApp()
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const sorted = [...state.highlights].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getColorName = (color: string) => HIGHLIGHT_COLORS.find(c => c.value === color)?.name || color

  const handleRemove = (id: string) => {
    const hl = state.highlights.find(h => h.id === id)
    if (hl?.note && confirmRemove !== id) {
      setConfirmRemove(id)
      return
    }
    dispatch({ type: 'REMOVE_HIGHLIGHT', id })
    setConfirmRemove(null)
  }

  const handleRemoveAll = () => {
    if (state.highlights.some(h => h.note)) {
      if (!confirm('Some highlights have notes. Remove all highlights?')) return
    }
    dispatch({ type: 'SET_HIGHLIGHTS', highlights: [] })
  }

  return (
    <div className="highlights-view">
      <div className="highlights-view-header">
        <button className="btn-icon tp-btn" onClick={() => goToView('script-review')}>←</button>
        <h2>All Highlights</h2>
        <span className="shot-count">{state.highlights.length} total</span>
        <div className="highlights-header-actions">
          {state.highlights.length > 0 && (
            <button className="btn btn-sm btn-danger" onClick={handleRemoveAll}>
              Remove All
            </button>
          )}
        </div>
      </div>

      {state.highlights.length === 0 ? (
        <div className="empty-state">
          <p>No highlights yet.</p>
          <p className="empty-hint">Press and hold text in the Script Review to create highlights.</p>
          <button className="btn" onClick={() => goToView('script-review')}>Back to Script</button>
        </div>
      ) : (
        <div className="highlights-list">
          {sorted.map(hl => (
            <div key={hl.id} className="highlights-item">
              <div className="highlights-item-color" style={{ background: hl.color }} />
              <div className="highlights-item-body">
                <div className="highlights-item-text">"{hl.text}"</div>
                <div className="highlights-item-meta">
                  <span className="highlights-item-color-label">{getColorName(hl.color)}</span>
                  <span className="highlights-item-date">
                    {new Date(hl.createdAt).toLocaleDateString()}
                  </span>
                  {hl.shotId && <span className="highlights-item-shot">Shot #{hl.shotId}</span>}
                  {hl.note && <span className="highlights-item-has-note">Has note</span>}
                </div>
                {hl.note && <div className="highlights-item-note">{hl.note}</div>}
              </div>
              <div className="highlights-item-actions">
                {confirmRemove === hl.id ? (
                  <>
                    <button className="btn btn-sm btn-danger" onClick={() => handleRemove(hl.id)}>Confirm</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(null)}>No</button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-ghost" onClick={() => handleRemove(hl.id)}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
