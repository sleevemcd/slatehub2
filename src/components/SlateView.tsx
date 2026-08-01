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

function formatTcFromDate(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const s = date.getSeconds()
  const f = Math.floor(date.getMilliseconds() / 33.33)
  return [h, m, s, f].map(v => String(v).padStart(2, '0')).join(':')
}

const STRIPES = [
  { cls: 'stripe-green', key: 'green' },
  { cls: 'stripe-yellow', key: 'yellow' },
  { cls: 'stripe-blue', key: 'blue' },
  { cls: 'stripe-red', key: 'red' },
  { cls: 'stripe-dark', key: 'dark' },
  { cls: 'stripe-grey', key: 'grey' },
  { cls: 'stripe-white', key: 'white' },
]

function formatRoll(roll: string): string {
  const r = roll.trim()
  if (/^[A-Za-z]$/.test(r)) return r.toUpperCase() + '001'
  return r
}

export function SlateView() {
  const { state, dispatch, goToView, goToNextShot, goToPrevShot, recordTake, updateTake, updateShotCrew, triggerOnDeck, activeProject } = useApp()
  const { activeShot, takes, activeTake } = state
  const [notes, setNotes] = useState('')
  const [manualTc, setManualTc] = useState('')
  const [tcRunning, setTcRunning] = useState(false)
  const [liveTc, setLiveTc] = useState(() => formatTcFromDate(new Date()))
  const [manualFrames, setManualFrames] = useState(0)
  const [showCrewEditor, setShowCrewEditor] = useState(false)
  const [crewInput, setCrewInput] = useState('')
  const [directors, setDirectors] = useState('')
  const [dop, setDop] = useState('')
  const [noteValue, setNoteValue] = useState('')
  const rafRef = useRef<number>(0)
  const tcRunStartRef = useRef<number | null>(null)
  const tcRunBaseRef = useRef(0)
  const [clapped, setClapped] = useState(false)

  const shotTakes = takes.filter(t => t.shotRow === activeShot?.row)

  useEffect(() => {
    const tick = () => {
      if (tcRunStartRef.current !== null) {
        const elapsed = (Date.now() - tcRunStartRef.current) / 1000
        setManualFrames(tcRunBaseRef.current + Math.floor(elapsed * 30))
      } else {
        setLiveTc(formatTcFromDate(new Date()))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    setDirectors((activeShot?.crew || []).filter(r => /^dir|director/i.test(r)).join(', '))
    setDop((activeShot?.crew || []).filter(r => /dop|camera|cam op|cam op/i.test(r)).join(', '))
    setNoteValue(activeShot?.notes || '')
    setTcRunning(false)
    tcRunStartRef.current = null
  }, [activeShot?.row])

  const doClap = () => {
    setClapped(true)
    playClap()
    setTimeout(() => setClapped(false), 220)
  }

  const startManualTc = (frames: number) => {
    tcRunBaseRef.current = frames
    tcRunStartRef.current = Date.now()
    setManualFrames(frames)
    setTcRunning(true)
  }

  const stopManualTc = () => {
    tcRunStartRef.current = null
    setTcRunning(false)
  }

  const currentTc = tcRunning ? formatTimecode(manualFrames) : liveTc

  const handleRecordTake = (good: boolean) => {
    recordTake(good, currentTc)
    doClap()
    stopManualTc()
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

  const isOnDeck = state.currentUser.role && (activeShot.crew || []).includes(state.currentUser.role)
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
  const rollDisplay = formatRoll(activeShot.roll || activeShot.setup || 'A')
  const sceneDisplay = activeShot.scene || activeShot.type || '—'
  const prodDisplay = activeProject?.name || activeShot.shootDay || '—'

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
        <div className={`slate-stick ${clapped ? 'clapped' : ''}`} onClick={doClap} title="Tap to clap">
          <div className="slate-stick-hinge">
            <span className="slate-stick-screw" />
            <span className="slate-stick-screw" />
            <span className="slate-stick-logo">DEITY</span>
          </div>
          <div className="slate-stick-arms">
            <div className="slate-stick-arm top-arm">
              {STRIPES.map(s => <span key={s.key} className={`stripe ${s.cls}`} />)}
            </div>
            <div className="slate-stick-arm bottom-arm">
              {STRIPES.map(s => <span key={s.key} className={`stripe ${s.cls}`} />)}
            </div>
          </div>
        </div>

        <div className="slate-led">
          <span className="slate-led-label">TC</span>
          <span className="slate-led-value">{currentTc}</span>
          <span className={`slate-led-dot ${tcRunning ? 'rec' : ''}`} />
        </div>

        <div className="slate-grid">
          <div className="sg-row sg-row-1">
            <div className="sg-cell sg-roll">
              <span className="sg-label">Roll</span>
              <span className="sg-value handwritten">{rollDisplay}</span>
            </div>
            <div className="sg-cell sg-scene">
              <span className="sg-label">Scene</span>
              <span className="sg-value handwritten big">{sceneDisplay}</span>
            </div>
            <div className="sg-cell sg-take">
              <span className="sg-label">Take</span>
              <span className="sg-value handwritten big">{activeTake}</span>
            </div>
          </div>
          <div className="sg-row sg-row-2">
            <div className="sg-cell sg-prod">
              <span className="sg-label">Prod</span>
              <span className="sg-value handwritten">{prodDisplay}</span>
            </div>
          </div>
          <div className="sg-row sg-row-3">
            <div className="sg-cell">
              <span className="sg-label">Dirs.</span>
              <input className="sg-input handwritten" value={directors}
                placeholder="—" onChange={e => setDirectors(e.target.value)} />
            </div>
            <div className="sg-cell">
              <span className="sg-label">DOP</span>
              <input className="sg-input handwritten" value={dop}
                placeholder="—" onChange={e => setDop(e.target.value)} />
            </div>
          </div>
          <div className="sg-row sg-row-4">
            <div className="sg-cell sg-note">
              <span className="sg-label">Note</span>
              <input className="sg-input handwritten" value={noteValue}
                placeholder="—" onChange={e => setNoteValue(e.target.value)} />
            </div>
            <div className="sg-cell sg-date">
              <span className="sg-label">Date</span>
              <span className="sg-value handwritten">{today}</span>
            </div>
          </div>
        </div>

        <div className="slate-footer">
          <div className="slate-tc-controls">
            <input className="input tc-input" placeholder="HH:MM:SS:FF"
              value={manualTc} onChange={e => setManualTc(e.target.value)} maxLength={11} />
            <button className="btn btn-sm"
              onClick={() => {
                if (manualTc) {
                  dispatch({ type: 'SET_TIMECODE', timecode: manualTc })
                  const parsed = parseTimecode(manualTc)
                  if (parsed !== null) startManualTc(parsed)
                  setManualTc('')
                }
              }}
              disabled={!manualTc}>Set</button>
            <button className="btn btn-sm" onClick={() => tcRunning ? stopManualTc() : startManualTc(parseTimecode(currentTc) ?? 0)}>
              {tcRunning ? '■ Stop' : '▶ Run'}
            </button>
            <span className="slate-user">{state.currentUser.name || 'Not set'}</span>
          </div>
          <div className="slate-take-actions">
            <button className="btn btn-clap" onClick={doClap} title="Mark shot (clap only)">🎬 Clap</button>
            <button className="btn btn-good" onClick={() => handleRecordTake(true)}>✓ Good Take</button>
            <button className="btn btn-ng" onClick={() => handleRecordTake(false)}>✗ No Good</button>
          </div>
        </div>
      </div>

      <div className="slate-shot-caption">
        {activeShot.location && <span>📍 {activeShot.location}</span>}
        {activeShot.setup && <span>🎥 {activeShot.setup}</span>}
        {activeShot.shootDay && <span>🗓 Day {activeShot.shootDay}</span>}
        {activeShot.subShot && <span>🔀 {activeShot.subShot}</span>}
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
