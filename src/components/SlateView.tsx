import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'

function formatTimecode(frames: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(frames / (3600 * 30))
  const m = Math.floor((frames % (3600 * 30)) / (60 * 30))
  const s = Math.floor((frames % (60 * 30)) / 30)
  const f = Math.floor(frames % 30)
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
}

function parseTimecode(tc: string): number | null {
  const parts = tc.split(':').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return parts[0] * 3600 * 30 + parts[1] * 60 * 30 + parts[2] * 30 + parts[3]
}

export function SlateView() {
  const { state, dispatch, goToView, goToNextShot, goToPrevShot, recordTake, updateTake, updateShotCrew, triggerOnDeck } = useApp()
  const { activeShot, takes, activeTake } = state
  const [notes, setNotes] = useState('')
  const [manualTc, setManualTc] = useState('')
  const [tcRunning, setTcRunning] = useState(false)
  const [tcFrames, setTcFrames] = useState(0)
  const [showCrewEditor, setShowCrewEditor] = useState(false)
  const [crewInput, setCrewInput] = useState('')
  const tcRef = useRef<number | null>(null)

  const shotTakes = takes.filter(t => t.shotRow === activeShot?.row)

  useEffect(() => {
    if (!tcRunning) return
    const initial = state.timecode ? (parseTimecode(state.timecode) ?? 0) : tcFrames
    setTcFrames(initial)
    tcRef.current = window.setInterval(() => {
      setTcFrames(prev => prev + 1)
    }, 1000 / 30)
    return () => { if (tcRef.current !== null) clearInterval(tcRef.current) }
  }, [tcRunning])

  const handleRecordTake = (good: boolean) => {
    recordTake(good)
    setTcRunning(false)
    setTcFrames(0)
  }

  const handleToggleCircled = (takeNum: number) => {
    const t = shotTakes.find(st => st.takeNumber === takeNum)
    if (t) updateTake(t.id, { circled: !t.circled })
  }

  const handleUpdateNotes = (takeNum: number) => {
    const t = shotTakes.find(st => st.takeNumber === takeNum)
    if (t && notes.trim()) {
      updateTake(t.id, { notes: notes.trim() })
      setNotes('')
    }
  }

  const addCrewReq = () => {
    if (!crewInput.trim() || !activeShot) return
    const existing = activeShot.crew || []
    if (!existing.includes(crewInput.trim())) {
      updateShotCrew(activeShot.row, [...existing, crewInput.trim()])
    }
    setCrewInput('')
  }

  const removeCrewReq = (role: string) => {
    if (!activeShot) return
    updateShotCrew(activeShot.row, (activeShot.crew || []).filter(r => r !== role))
  }

  if (!activeShot) {
    return (
      <div className="slate-empty">
        <h2>No Shot Selected</h2>
        <p>Select a shot from the shot list to start slating.</p>
        <button className="btn" onClick={() => goToView('shots')}>Go to Shot List</button>
      </div>
    )
  }

  const currentTc = tcRunning ? formatTimecode(tcFrames) : (state.timecode || '--:--:--:--')
  const isOnDeck = state.currentUser.role && (activeShot.crew || []).includes(state.currentUser.role)

  return (
    <div className="slate-view">
      <div className="slate-header">
        <div className="slate-nav">
          <button className="btn" onClick={goToPrevShot}>← Prev</button>
          <span className="slate-title">Digital Slate — #{activeShot.shootOrder}</span>
          <button className="btn" onClick={goToNextShot}>Next →</button>
        </div>
        <button className="btn btn-ghost" onClick={() => goToView('shots')}>Back to List</button>
      </div>

      {isOnDeck && (
        <div className="ondeck-banner">
          <span className="ondeck-icon">🎯</span>
          <span>You're on deck! This shot needs <strong>{state.currentUser.role}</strong></span>
        </div>
      )}

      <div className="slate-card">
        <div className="slate-display">
          <div className="slate-info-row">
            <div className="slate-field"><label>Scene</label><span>{activeShot.type}</span></div>
            <div className="slate-field"><label>Take</label><span className="slate-take-num">{activeTake}</span></div>
          </div>
          <div className="slate-description">{activeShot.description}</div>
          {activeShot.location && (
            <div className="slate-info-row">
              <div className="slate-field"><label>Location</label><span>{activeShot.location}</span></div>
              {activeShot.shootDay && (
                <div className="slate-field"><label>Day</label><span>{activeShot.shootDay}</span></div>
              )}
            </div>
          )}

          <div className="slate-timecode">
            <label>Timecode</label>
            <div className="tc-display">{currentTc}</div>
            <div className="tc-controls">
              <input className="input tc-input" placeholder="HH:MM:SS:FF"
                value={manualTc} onChange={e => setManualTc(e.target.value)} maxLength={11} />
              <button className="btn btn-sm"
                onClick={() => {
                  if (manualTc) {
                    dispatch({ type: 'SET_TIMECODE', timecode: manualTc })
                    const parsed = parseTimecode(manualTc)
                    if (parsed !== null) setTcFrames(parsed)
                    setTcRunning(true)
                    setManualTc('')
                  }
                }}
                disabled={!manualTc}>Set</button>
              <button className="btn btn-sm" onClick={() => setTcRunning(!tcRunning)}>
                {tcRunning ? '■ Stop' : '▶ Run'}
              </button>
            </div>
          </div>

          <div className="slate-user-indicator">
            User: <strong>{state.currentUser.name || 'Not set'}</strong>
            {state.currentUser.role && <span className="user-role"> ({state.currentUser.role})</span>}
          </div>
        </div>

        <div className="slate-actions">
          <button className="btn btn-good" onClick={() => handleRecordTake(true)}>Good Take</button>
          <button className="btn btn-ng" onClick={() => handleRecordTake(false)}>No Good</button>
        </div>
      </div>

      <div className="slate-crew-section">
        <div className="slate-crew-header">
          <h3>Crew Requirements</h3>
          <button className="btn btn-sm btn-ghost"
            onClick={() => setShowCrewEditor(!showCrewEditor)}>
            {showCrewEditor ? 'Done' : 'Edit'}
          </button>
        </div>
        {activeShot.crew && activeShot.crew.length > 0 ? (
          <div className="slate-crew-badges">
            {activeShot.crew.map(r => (
              <span key={r} className="crew-badge">
                {r}
                {showCrewEditor && (
                  <button className="crew-badge-remove" onClick={() => removeCrewReq(r)}>✕</button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-hint">No crew requirements set for this shot.</p>
        )}
        {showCrewEditor && (
          <div className="slate-crew-add">
            <input className="input" placeholder="Add role (e.g. 2nd Shooter)"
              value={crewInput} onChange={e => setCrewInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCrewReq() }} />
            <button className="btn btn-sm" onClick={addCrewReq} disabled={!crewInput.trim()}>Add</button>
          </div>
        )}
        {(activeShot.crew || []).length > 0 && (
          <button className="btn btn-sm btn-ghost slate-notify-btn"
            onClick={() => triggerOnDeck(activeShot)}>
            Notify Crew
          </button>
        )}
      </div>

      <div className="take-log">
        <h3>Take Log</h3>
        {shotTakes.length === 0 ? (
          <p className="empty-hint">No takes recorded yet.</p>
        ) : (
          <div className="take-list">
            {shotTakes.sort((a, b) => a.takeNumber - b.takeNumber).map(t => (
              <div key={t.id} className={`take-entry ${t.good ? 'good' : 'bad'}`}>
                <div className="take-header">
                  <span className="take-num">Take {t.takeNumber}</span>
                  <span className={`take-verdict ${t.good ? 'good' : 'bad'}`}>
                    {t.good ? '✓ Good' : '✗ NG'}
                  </span>
                  <label className="circled-toggle" title="Circle this take">
                    <input type="checkbox" checked={t.circled}
                      onChange={() => handleToggleCircled(t.takeNumber)} />
                    <span className="circle-indicator">{t.circled ? '●' : '○'}</span>
                  </label>
                </div>
                {t.user && <div className="take-user">by {t.user}</div>}
                {t.timecode && <div className="take-tc">@ {t.timecode}</div>}
                <div className="take-note">{t.notes || '—'}</div>
              </div>
            ))}
          </div>
        )}

        <div className="take-note-form">
          <input className="input" placeholder="Add note for take..."
            value={notes} onChange={e => setNotes(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const lastTake = [...shotTakes].sort((a, b) => b.takeNumber - a.takeNumber)[0]
                if (lastTake) handleUpdateNotes(lastTake.takeNumber)
              }
            }} />
          <button className="btn btn-sm" onClick={() => {
            const lastTake = [...shotTakes].sort((a, b) => b.takeNumber - a.takeNumber)[0]
            if (lastTake) handleUpdateNotes(lastTake.takeNumber)
          }}>Add Note</button>
        </div>
      </div>
    </div>
  )
}
