import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { MARKER_PRESETS } from '../types'
import type { ShotMarker, MarkerSession } from '../types'

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

function formatTcFromDate(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const s = date.getSeconds()
  const f = Math.floor(date.getMilliseconds() / 33.33)
  return [h, m, s, f].map(v => String(v).padStart(2, '0')).join(':')
}

export function MarkersView() {
  const { state, dispatch, goToView } = useApp()
  const [tab, setTab] = useState<'live' | 'history' | 'setup'>('live')
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [currentTc, setCurrentTc] = useState(formatTcFromDate(new Date()))
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [holding, setHolding] = useState(false)
  const [holdMarkerType, setHoldMarkerType] = useState('')
  const [holdStartTc, setHoldStartTc] = useState('')

  const animRef = useRef<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentSession = state.sessions.find(s => !s.endedAt) || null

  const startSession = () => {
    const now = new Date()
    const name = sessionName.trim() || `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    const session: MarkerSession = {
      id: generateId(),
      name,
      type: 'time-of-day',
      startedAt: now.toISOString(),
      endedAt: null,
      markerCount: 0,
      cameraBrand: '',
      cameraModel: '',
    }
    dispatch({ type: 'ADD_SESSION', session })
    setSessionActive(true)
  }

  const stopSession = () => {
    if (currentSession) {
      dispatch({ type: 'END_SESSION', id: currentSession.id })
      if (sessionActive) {
        dispatch({ type: 'ADD_MARKER', marker: {
          id: generateId(),
          projectId: state.activeProjectId,
          timecode: currentTc,
          color: '#ef5350',
          markerType: 'Session End',
          note: '',
          shotId: null,
          createdAt: new Date().toISOString(),
          rangeEnd: '',
        }})
      }
    }
    setSessionActive(false)
    cancelAnimationFrame(animRef.current)
  }

  useEffect(() => {
    if (!sessionActive) {
      cancelAnimationFrame(animRef.current)
      return
    }
    const tick = () => {
      setCurrentTc(formatTcFromDate(new Date()))
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [sessionActive])

  const addMarker = useCallback((presetName: string) => {
    const preset = MARKER_PRESETS.find(p => p.name === presetName) || MARKER_PRESETS[7]
    const marker: ShotMarker = {
      id: generateId(),
      projectId: state.activeProjectId,
      timecode: currentTc,
      color: preset.color,
      markerType: presetName,
      note: '',
      shotId: null,
      createdAt: new Date().toISOString(),
      rangeEnd: '',
    }
    dispatch({ type: 'ADD_MARKER', marker })
    if (currentSession) {
      dispatch({ type: 'UPDATE_SESSION', id: currentSession.id, updates: { markerCount: currentSession.markerCount + 1 } })
    }
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 50)
  }, [currentTc, state.activeProjectId, currentSession, dispatch])

  const addRangeMarker = useCallback((presetName: string, startTc: string, endTc: string) => {
    const preset = MARKER_PRESETS.find(p => p.name === presetName) || MARKER_PRESETS[7]
    const marker: ShotMarker = {
      id: generateId(),
      projectId: state.activeProjectId,
      timecode: startTc,
      color: preset.color,
      markerType: presetName + ' (Range)',
      note: `${startTc} → ${endTc}`,
      shotId: null,
      createdAt: new Date().toISOString(),
      rangeEnd: endTc,
    }
    dispatch({ type: 'ADD_MARKER', marker })
    if (currentSession) {
      dispatch({ type: 'UPDATE_SESSION', id: currentSession.id, updates: { markerCount: currentSession.markerCount + 1 } })
    }
  }, [state.activeProjectId, currentSession, dispatch])

  const handlePointerDown = (presetName: string) => {
    if (!sessionActive) return
    setHoldMarkerType(presetName)
    setHoldStartTc(currentTc)
    setHolding(false)
    const timer = setTimeout(() => {
      setHolding(true)
    }, 400)
    setHoldTimer(timer)
  }

  const handlePointerUp = (presetName: string) => {
    clearTimeout(holdTimer)
    if (holding) {
      addRangeMarker(presetName, holdStartTc, currentTc)
    } else {
      addMarker(presetName)
    }
    setHolding(false)
  }

  const handlePointerLeave = () => {
    clearTimeout(holdTimer)
    setHolding(false)
  }

  const sessionMarkers = state.markers.filter(m => m.projectId === state.activeProjectId)
  const sorted = [...sessionMarkers].sort((a, b) => a.timecode.localeCompare(b.timecode))

  const exportMarkers = () => {
    let csv = 'Timecode,Type,Color,Note,Range End\n'
    for (const m of sorted) {
      csv += `${m.timecode},${m.markerType},${m.color},"${m.note}",${m.rangeEnd}\n`
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `markers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="markers-view">
      <div className="markers-header">
        <div className="markers-header-top">
          <button className="btn-icon tp-btn" onClick={() => goToView('dashboard')}>←</button>
          <h2>Markers</h2>
          <div className="markers-header-tabs">
            <button className={`markers-tab ${tab === 'live' ? 'active' : ''}`} onClick={() => setTab('live')}>Live</button>
            <button className={`markers-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
            <button className={`markers-tab ${tab === 'setup' ? 'active' : ''}`} onClick={() => setTab('setup')}>Setup</button>
          </div>
          {sorted.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={exportMarkers}>Export</button>
          )}
        </div>
      </div>

      {tab === 'live' && (
        <>
          {!sessionActive ? (
            <div className="marker-session-start">
              <div className="marker-session-start-content">
                <div className="marker-tc-big">{currentTc}</div>
                <p className="marker-tc-sub">Device time — sync your camera to this</p>
                <input className="input marker-session-name-input"
                  placeholder="Session name (optional)"
                  value={sessionName} onChange={e => setSessionName(e.target.value)} />
                <button className="btn btn-danger marker-start-btn" onClick={startSession}>
                  ● Start Session
                </button>
              </div>
            </div>
          ) : (
            <div className="marker-recording">
              <div className="marker-rec-header">
                <div className="marker-rec-indicator">
                  <span className="rec-dot" /> RECORDING
                </div>
                <div className="marker-tc-display">{currentTc}</div>
                <button className="btn btn-ghost btn-sm" onClick={stopSession}>■ Stop</button>
              </div>

              <div className="marker-session-info">
                {currentSession?.name}
              </div>

              <div className="marker-buttons-grid">
                {MARKER_PRESETS.slice(0, 4).map(p => (
                  <button key={p.name}
                    className="marker-btn"
                    style={{ '--btn-color': p.color } as React.CSSProperties}
                    onPointerDown={() => handlePointerDown(p.name)}
                    onPointerUp={() => handlePointerUp(p.name)}
                    onPointerLeave={handlePointerLeave}
                    onContextMenu={e => e.preventDefault()}>
                    <span className="marker-btn-icon">{p.icon}</span>
                    <span className="marker-btn-label">{p.name}</span>
                    <span className="marker-btn-hint">{holding && holdMarkerType === p.name ? 'Release to set end' : 'Tap · Hold for range'}</span>
                  </button>
                ))}
              </div>

              <div className="marker-quick-bar">
                {MARKER_PRESETS.slice(4).map(p => (
                  <button key={p.name}
                    className="marker-quick-btn"
                    style={{ '--btn-color': p.color } as React.CSSProperties}
                    onClick={() => addMarker(p.name)}
                    title={p.name}>
                    {p.icon}
                  </button>
                ))}
              </div>

              <div className="marker-recent" ref={scrollRef}>
                <div className="marker-recent-title">This Session</div>
                {sorted.filter(m => m.createdAt > (currentSession?.startedAt || '')).length === 0 ? (
                  <div className="marker-recent-empty">Tap a marker button to mark the current timecode</div>
                ) : (
                  sorted.filter(m => m.createdAt > (currentSession?.startedAt || '')).reverse().slice(0, 20).map(m => {
                    const preset = MARKER_PRESETS.find(p => p.color === m.color) || MARKER_PRESETS[7]
                    return (
                      <div key={m.id} className="marker-recent-entry">
                        <span className="marker-recent-tc" style={{ color: m.color }}>{m.timecode}</span>
                        <span className="marker-recent-dot" style={{ background: m.color }} />
                        <span className="marker-recent-type">{preset.icon} {m.markerType}</span>
                        {m.rangeEnd && <span className="marker-recent-range">→ {m.rangeEnd}</span>}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="marker-history">
          <div className="marker-history-sessions">
            {state.sessions.filter(s => s.endedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(s => {
              const sessionMarks = sessionMarkers.filter(m =>
                m.createdAt > s.startedAt && (!s.endedAt || m.createdAt < s.endedAt)
              )
              return (
                <div key={s.id} className="marker-history-session">
                  <div className="marker-history-session-header">
                    <div className="marker-history-session-name">{s.name}</div>
                    <div className="marker-history-session-meta">
                      <span>{new Date(s.startedAt).toLocaleDateString()}</span>
                      <span>{sessionMarks.length} markers</span>
                    </div>
                  </div>
                  {sessionMarks.length > 0 && (
                    <div className="marker-history-marks">
                      {sessionMarks.map(m => {
                        const preset = MARKER_PRESETS.find(p => p.color === m.color) || MARKER_PRESETS[7]
                        return (
                          <div key={m.id} className="marker-recent-entry">
                            <span className="marker-recent-tc" style={{ color: m.color }}>{m.timecode}</span>
                            <span className="marker-recent-dot" style={{ background: m.color }} />
                            <span className="marker-recent-type">{preset.icon} {m.markerType}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {state.sessions.filter(s => s.endedAt).length === 0 && (
              <div className="empty-state" style={{ marginTop: 40 }}>
                <p>No completed sessions yet.</p>
                <p className="empty-hint">Start a Live session and markers will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'setup' && (
        <div className="marker-setup">
          <div className="setup-card">
            <h3>How Marker Works</h3>
            <ol className="setup-steps">
              <li><strong>Start a Session</strong> — Matches your device's real-world clock.</li>
              <li><strong>Sync your camera</strong> — Set your camera's timecode to match your device time.</li>
              <li><strong>Tap to mark</strong> — Tap a marker button to place a marker at the current timecode. Hold for 400ms to create an In/Out range marker.</li>
              <li><strong>Export</strong> — Export markers as CSV to import into your editing software.</li>
            </ol>
          </div>

          <div className="setup-card">
            <h3>Camera Timecode Setup</h3>
            <p className="setup-hint">Set your camera's timecode to Free Run / Time-of-Day to match your device.</p>
            <div className="setup-camera-tips">
              <div className="setup-camera-brand">
                <h4>Sony</h4>
                <ul>
                  <li>Menu → TC/UB → TC Preset → Set to current time</li>
                  <li>Set TC Run to Free Run</li>
                  <li>Set TC Format to 30fps (or your project framerate)</li>
                </ul>
              </div>
              <div className="setup-camera-brand">
                <h4>Canon</h4>
                <ul>
                  <li>Menu → Time Code → Set to Free Run</li>
                  <li>Set timecode to current real time</li>
                  <li>Set to 30fps or match project framerate</li>
                </ul>
              </div>
              <div className="setup-camera-brand">
                <h4>RED</h4>
                <ul>
                  <li>Menu → Settings → Timecode → Set to Free Run</li>
                  <li>Set time of day</li>
                  <li>Ensure frame rate matches project</li>
                </ul>
              </div>
              <div className="setup-camera-brand">
                <h4>Blackmagic</h4>
                <ul>
                  <li>Menu → Timecode → Set to Free Run</li>
                  <li>Set to current time</li>
                  <li>Match project framerate (23.98, 24, 30)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="setup-card">
            <h3>Export</h3>
            <p className="setup-hint">Export markers as CSV for import into DaVinci Resolve, Premiere Pro, or Final Cut Pro.</p>
            <button className="btn" onClick={exportMarkers} disabled={sorted.length === 0}>
              Export as CSV ({sorted.length} markers)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
