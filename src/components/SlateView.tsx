import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'

function playClap() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const noise = ctx.createBufferSource()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40) * (t < 0.005 ? 1 : Math.exp(-(t - 0.005) * 20))
    }
    noise.buffer = buf
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.8, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(3000, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1)
    noise.connect(filter).connect(gain).connect(ctx.destination)
    noise.start()
    setTimeout(() => ctx.close(), 200)
  } catch {}
}

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
  const { state, dispatch, goToView, goToNextShot, goToPrevShot, recordTake, updateTake, updateShotCrew, triggerOnDeck, activeProject } = useApp()
  const { activeShot, takes, activeTake } = state
  const [notes, setNotes] = useState('')
  const [manualTc, setManualTc] = useState('')
  const [tcRunning, setTcRunning] = useState(false)
  const [tcFrames, setTcFrames] = useState(0)
  const [showCrewEditor, setShowCrewEditor] = useState(false)
  const [crewInput, setCrewInput] = useState('')
  const tcRef = useRef<number | null>(null)
  const [clapped, setClapped] = useState(false)

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
    setClapped(true)
    playClap()
    setTimeout(() => setClapped(false), 200)
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
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })

  return (
    <div className="slate-view">
      <div className="slate-nav">
        <button className="btn" onClick={goToPrevShot} title="Previous shot">←</button>
        <span className="slate-title">Slate — {activeShot.description || activeShot.type || `#${activeShot.shootOrder || activeShot.row}`}</span>
        <button className="btn" onClick={goToNextShot} title="Next shot">→</button>
        <button className="btn btn-ghost" onClick={() => goToView('shots')}>List</button>
      </div>

      {isOnDeck && (
        <div className="ondeck-banner">
          <span className="ondeck-icon">🎯</span>
          <span>You're on deck! Needs <strong>{state.currentUser.role}</strong></span>
        </div>
      )}

      <div className="traditional-slate">
        <div className="slate-top-stripe">
          <div className={`slate-clapper ${clapped ? 'clapped' : ''}`}
            onClick={() => { setClapped(true); playClap(); setTimeout(() => setClapped(false), 200) }}
            title="Tap to clap">
            <div className="clapper-top" />
            <div className="clapper-bottom" />
          </div>
          <div className="slate-top-text">
            <span className="slate-prod">PROD: <strong>{activeProject?.name || activeShot.shootDay || '—'}</strong></span>
            <span className="slate-roll">CAM ROLL: <strong>{activeShot.roll || activeShot.setup || 'A'}</strong></span>
          </div>
        </div>

        <div className="slate-body">
          <div className="slate-main-row">
            <div className="slate-scene-take">
              <div className="slate-field-block">
                <span className="slate-field-label">SCENE</span>
                <span className="slate-field-value slate-scene-value">{activeShot.scene || activeShot.type || '—'}</span>
              </div>
              <div className="slate-field-block">
                <span className="slate-field-label">TAKE</span>
                <span className="slate-field-value slate-take-value">{activeTake}</span>
              </div>
            </div>
            <div className="slate-timecode-block">
              <span className="slate-field-label">TIMECODE</span>
              <span className="slate-tc-display">{currentTc}</span>
              <div className="slate-tc-controls">
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
          </div>

          <div className="slate-desc">{activeShot.description}</div>

          <div className="slate-info-grid">
            <div className="slate-field-block">
              <span className="slate-field-label">LOCATION</span>
              <span className="slate-field-value">{activeShot.location || '—'}</span>
            </div>
            <div className="slate-field-block">
              <span className="slate-field-label">CAM</span>
              <span className="slate-field-value">{activeShot.setup || 'A'}</span>
            </div>
            <div className="slate-field-block">
              <span className="slate-field-label">DATE</span>
              <span className="slate-field-value">{today}</span>
            </div>
            <div className="slate-field-block">
              <span className="slate-field-label">DAY</span>
              <span className="slate-field-value">{activeShot.shootDay || '—'}</span>
            </div>
            <div className="slate-field-block">
              <span className="slate-field-label">RIG</span>
              <span className="slate-field-value">{activeShot.setup || '—'}</span>
            </div>
            {activeShot.subShot && (
              <div className="slate-field-block">
                <span className="slate-field-label">SUB</span>
                <span className="slate-field-value">{activeShot.subShot}</span>
              </div>
            )}
          </div>
        </div>

        <div className="slate-footer">
          <div className="slate-user">{state.currentUser.name || 'Not set'}{state.currentUser.role ? ` (${state.currentUser.role})` : ''}</div>
          <div className="slate-take-actions">
            <button className="btn btn-clap" onClick={() => { setClapped(true); playClap(); setTimeout(() => setClapped(false), 200) }} title="Mark shot (clap only)">🎬 Clap</button>
            <button className="btn btn-good" onClick={() => handleRecordTake(true)}>✓ Good Take</button>
            <button className="btn btn-ng" onClick={() => handleRecordTake(false)}>✗ No Good</button>
          </div>
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
        <div className="take-log-header">
          <h3>Take Log</h3>
          {shotTakes.length > 0 && (
            <button className="btn btn-sm btn-ghost take-clear-btn"
              onClick={() => {
                if (confirm(`Clear all ${shotTakes.length} take${shotTakes.length !== 1 ? 's' : ''} for this shot?`)) {
                  shotTakes.forEach(t => dispatch({ type: 'DELETE_TAKE', id: t.id }))
                }
              }}>
              Clear All
            </button>
          )}
        </div>
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
