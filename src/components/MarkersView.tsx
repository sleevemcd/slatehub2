import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { MARKER_PRESETS } from '../types'
import type { ShotMarker } from '../types'

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

export function MarkersView() {
  const { state, dispatch, goToView } = useApp()
  const [showCreate, setShowCreate] = useState(false)
  const [tc, setTc] = useState('')
  const [markerType, setMarkerType] = useState(MARKER_PRESETS[0].name)
  const [note, setNote] = useState('')
  const tcRef = useRef<HTMLInputElement>(null)

  const sorted = [...state.markers].sort((a, b) => a.timecode.localeCompare(b.timecode))

  const currentPreset = MARKER_PRESETS.find(p => p.name === markerType) || MARKER_PRESETS[7]

  const createMarker = () => {
    const tcVal = tc.trim()
    if (!tcVal) return
    const preset = MARKER_PRESETS.find(p => p.name === markerType) || MARKER_PRESETS[7]
    const marker: ShotMarker = {
      id: generateId(),
      projectId: state.activeProjectId,
      timecode: tcVal,
      color: preset.color,
      markerType: markerType,
      note: note.trim(),
      shotId: null,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_MARKER', marker })
    setTc('')
    setNote('')
    setShowCreate(false)
    tcRef.current?.focus()
  }

  const deleteMarker = (id: string) => {
    if (confirm('Delete this marker?')) {
      dispatch({ type: 'REMOVE_MARKER', id })
    }
  }

  return (
    <div className="markers-view">
      <div className="markers-header">
        <div className="markers-header-top">
          <button className="btn-icon tp-btn" onClick={() => goToView('dashboard')}>←</button>
          <h2>Markers</h2>
          <span className="shot-count">{state.markers.length} total</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setMarkerType(MARKER_PRESETS[0].name); setTc(''); setNote('') }}>
            + New Marker
          </button>
        </div>
      </div>

      <div className="marker-presets-bar">
        {MARKER_PRESETS.map(p => (
          <button key={p.name}
            className={`marker-preset-chip ${markerType === p.name && showCreate ? 'active' : ''}`}
            style={{ '--preset-color': p.color } as React.CSSProperties}
            onClick={() => {
              setMarkerType(p.name)
              if (!showCreate) { setShowCreate(true); setTc(''); setNote('') }
            }}>
            <span className="marker-preset-dot" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="marker-create-form">
          <div className="marker-create-row">
            <div className="marker-create-preset"
              style={{ background: currentPreset.color, color: '#000' }}>
              {currentPreset.icon} {currentPreset.name}
            </div>
          </div>
          <div className="marker-create-row">
            <input className="input marker-tc-input" ref={tcRef}
              placeholder="Timecode (HH:MM:SS:FF)"
              value={tc} onChange={e => setTc(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') createMarker() }} />
            <input className="input marker-note-input"
              placeholder="Optional note..."
              value={note} onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createMarker() }} />
            <button className="btn btn-primary btn-sm" onClick={createMarker}
              disabled={!tc.trim()}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {state.markers.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <p>No markers yet.</p>
          <p className="empty-hint">Add timecode-based markers to track moments during your shoot.</p>
        </div>
      ) : (
        <div className="markers-timeline">
          {sorted.map(m => {
            const preset = MARKER_PRESETS.find(p => p.color === m.color) || MARKER_PRESETS[7]
            const shot = state.shots.find(s => s.row === m.shotId)
            return (
              <div key={m.id} className="marker-entry">
                <span className="marker-tc" style={{ color: m.color }}>{m.timecode}</span>
                <span className="marker-dot" style={{ background: m.color }} />
                <div className="marker-body">
                  <div className="marker-type" style={{ color: m.color }}>
                    {preset.icon} {m.markerType}
                  </div>
                  {m.note && <div className="marker-note">{m.note}</div>}
                  {shot && <div className="marker-shot">→ {shot.description || shot.type}</div>}
                </div>
                <button className="btn-icon marker-del-btn" onClick={() => deleteMarker(m.id)}
                  title="Delete marker">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
