import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { MARKER_PRESETS } from '../types'
import type { ShotMarker, MarkerSession } from '../types'

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

const FPS = 30

function formatFrames(frames: number): string {
  const h = Math.floor(frames / (3600 * FPS))
  const m = Math.floor((frames % (3600 * FPS)) / (60 * FPS))
  const s = Math.floor((frames % (60 * FPS)) / FPS)
  const f = frames % FPS
  return [h, m, s, f].map(v => String(v).padStart(2, '0')).join(':')
}

interface MarkerRowProps {
  marker: ShotMarker
  onUpdate: (id: string, data: Partial<ShotMarker>) => void
  onDelete: (id: string) => void
}

function MarkerRow({ marker, onUpdate, onDelete }: MarkerRowProps) {
  const [editing, setEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState(marker.note)
  const preset = MARKER_PRESETS.find(p => p.color === marker.color) || MARKER_PRESETS[7]

  return (
    <div className="marker-recent-entry">
      <span className="marker-recent-tc" style={{ color: marker.color }}>{marker.timecode}</span>
      <span className="marker-recent-dot" style={{ background: marker.color }} />
      <span className="marker-recent-type">{preset.icon} {marker.markerType}</span>
      {marker.rangeEnd && <span className="marker-recent-range">→ {marker.rangeEnd}</span>}
      <span className="marker-note-text" onClick={() => { setEditing(true); setNoteDraft(marker.note) }}
        title="Edit note">
        {marker.note || <span className="marker-note-placeholder">+ note</span>}
      </span>
      {editing ? (
        <span className="marker-note-edit">
          <input className="input marker-note-input-sm" value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { onUpdate(marker.id, { note: noteDraft }); setEditing(false) }
              if (e.key === 'Escape') { setEditing(false); setNoteDraft(marker.note) }
            }}
            onBlur={() => { onUpdate(marker.id, { note: noteDraft }); setEditing(false) }}
            autoFocus />
        </span>
      ) : null}
      <button className="marker-del-btn" onClick={() => onDelete(marker.id)}
        title="Delete marker">✕</button>
    </div>
  )
}

export function MarkersView() {
  const { state, dispatch, goToView } = useApp()
  const [tab, setTab] = useState<'live' | 'history' | 'setup'>('live')
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [currentFrames, setCurrentFrames] = useState(0)
  const [holdTimer, setHoldTimer] = useState<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [holding, setHolding] = useState(false)
  const [holdMarkerType, setHoldMarkerType] = useState('')
  const [holdStartFrames, setHoldStartFrames] = useState(0)

  const animRef = useRef<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionStartRef = useRef(0)

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
    sessionStartRef.current = performance.now()
    setCurrentFrames(0)
    setSessionActive(true)
  }

  const stopSession = () => {
    if (currentSession) {
      dispatch({ type: 'END_SESSION', id: currentSession.id })
      if (sessionActive) {
        dispatch({ type: 'ADD_MARKER', marker: {
          id: generateId(),
          projectId: state.activeProjectId,
          timecode: formatFrames(currentFrames),
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
      const elapsed = (performance.now() - sessionStartRef.current) / 1000
      setCurrentFrames(Math.floor(elapsed * FPS))
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
      timecode: formatFrames(currentFrames),
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
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 50)
  }, [currentFrames, state.activeProjectId, currentSession, dispatch])

  const addRangeMarker = useCallback((presetName: string, startFrames: number, endFrames: number) => {
    const preset = MARKER_PRESETS.find(p => p.name === presetName) || MARKER_PRESETS[7]
    const startTc = formatFrames(startFrames)
    const endTc = formatFrames(endFrames)
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

  const updateMarker = useCallback((id: string, data: Partial<ShotMarker>) => {
    dispatch({ type: 'UPDATE_MARKER', id, data })
  }, [dispatch])

  const deleteMarker = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MARKER', id })
  }, [dispatch])

  const deleteSession = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SESSION', id })
  }, [dispatch])

  const handlePointerDown = (presetName: string) => {
    if (!sessionActive) return
    setHoldMarkerType(presetName)
    setHoldStartFrames(currentFrames)
    setHolding(false)
    const timer = setTimeout(() => { setHolding(true) }, 400)
    setHoldTimer(timer)
  }

  const handlePointerUp = (presetName: string) => {
    clearTimeout(holdTimer)
    if (holding) {
      addRangeMarker(presetName, holdStartFrames, currentFrames)
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

  function tcToFrames(tc: string): number {
    const p = tc.split(':').map(Number)
    if (p.length !== 4 || p.some(isNaN)) return 0
    return ((p[0] * 3600) + (p[1] * 60) + p[2]) * FPS + p[3]
  }

  function hexToResolveColor(hex: string): string {
    const map: Record<string, string> = {
      '#4caf50': 'Green', '#ffeb3b': 'Yellow', '#f44336': 'Red',
      '#2196f3': 'Cyan', '#9c27b0': 'Purple', '#ff6b35': 'Orange',
      '#00bcd4': 'Cyan', '#e91e63': 'Magenta', '#ffffff': 'White',
      '#ff9800': 'Orange', '#8bc34a': 'Green', '#607d8b': 'Blue',
      '#795548': 'Purple', '#ef5350': 'Red',
    }
    return map[hex.toLowerCase()] || 'Orange'
  }

  const exportCsv = () => {
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

  const exportEdl = () => {
    let edl = `TITLE: SlateHub Markers Export\nFCM: NON-DROP FRAME\n\n`
    sorted.forEach((m, i) => {
      const num = String(i + 1).padStart(3, '0')
      const end = m.rangeEnd || m.timecode
      const sanitizedType = m.markerType.replace(/[^a-zA-Z0-9 _-]/g, '')
      const sanitizedNote = m.note.replace(/[^a-zA-Z0-9 _-]/g, '')
      edl += `${num}  AX       V     C        ${m.timecode} ${end} ${m.timecode} ${end}\n* MARKER: ${sanitizedType}\n`
      if (sanitizedNote) edl += `* COMMENT: ${sanitizedNote}\n`
      edl += '\n'
    })
    const blob = new Blob([edl], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `markers-${new Date().toISOString().slice(0, 10)}.edl`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportResolveScript = () => {
    const markersJson = sorted.map(m => ({
      tc: m.timecode,
      end: m.rangeEnd || m.timecode,
      type: m.markerType,
      note: m.note,
      color: hexToResolveColor(m.color),
    }))
    const script = `# SlateHub Clip Markers — generated ${new Date().toISOString().slice(0, 10)}
# Place this file in: DaVinci Resolve/Fusion/Scripts/Comp/
# Run in Resolve: Workspace > Scripts > Comp > this_file.py

resolve = bmd.scriptapp("Resolve")
if not resolve:
  raise Exception("Resolve not found")
project = resolve.GetProjectManager().GetCurrentProject()
timeline = project.GetCurrentTimeline()
if not timeline:
  raise Exception("No timeline open")

FPS = 30
markers = ${JSON.stringify(markersJson)}

def tc_to_frames(tc):
  p = tc.split(":")
  return (int(p[0])*3600 + int(p[1])*60 + int(p[2])) * FPS + int(p[3])

for track in range(1, timeline.GetTrackCount("video") + 1):
  for idx in range(1, timeline.GetItemCountInTrack("video", track) + 1):
    clip = timeline.GetItemByTrackAndIndex("video", track, idx)
    clip_start = clip.GetStart()
    clip_dur = clip.GetDuration()
    clip_end = clip_start + clip_dur
    for m in markers:
      mf = tc_to_frames(m["tc"])
      if clip_start <= mf < clip_end:
        frame_offset = mf - clip_start
        clip.AddMarker(frame_offset, m["color"], m["type"], m["note"], 1, "")
        print(f"  Added marker '{m['type']}' at frame {frame_offset} on {clip.GetName()}")

print("Done — markers added to clips")
`
    const blob = new Blob([script], { type: 'text/x-python' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slatehub-markers-${new Date().toISOString().slice(0, 10)}.py`
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
            <span className="marker-export-group">
              <button className="btn btn-ghost btn-sm" onClick={exportCsv}>CSV</button>
              <button className="btn btn-ghost btn-sm" onClick={exportEdl}>EDL</button>
              <button className="btn btn-ghost btn-sm" onClick={exportResolveScript}>Resolve</button>
            </span>
          )}
        </div>
      </div>

      {tab === 'live' && (
        <>
          {!sessionActive ? (
            <div className="marker-session-start">
              <div className="marker-session-start-content">
                <div className="marker-tc-big">00:00:00:00</div>
                <p className="marker-tc-sub">Timecode counts up from 0 when you start</p>
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
                <div className="marker-tc-display">{formatFrames(currentFrames)}</div>
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
                  sorted.filter(m => m.createdAt > (currentSession?.startedAt || '')).reverse().slice(0, 20).map(m => (
                    <MarkerRow key={m.id} marker={m} onUpdate={updateMarker} onDelete={deleteMarker} />
                  ))
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
                      <button className="marker-del-btn marker-del-show"
                        onClick={() => deleteSession(s.id)} title="Delete session">✕</button>
                    </div>
                  </div>
                  {sessionMarks.length > 0 && (
                    <div className="marker-history-marks">
                      {sessionMarks.map(m => (
                        <MarkerRow key={m.id} marker={m} onUpdate={updateMarker} onDelete={deleteMarker} />
                      ))}
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
              <li><strong>Start a Session</strong> — Timecode starts at 00:00:00:00 and counts up.</li>
              <li><strong>Tap to mark</strong> — Tap a marker button to place a marker at the current timecode. Hold for 400ms to create an In/Out range marker.</li>
              <li><strong>Export</strong> — Export as EDL and import into your editing software. Markers appear at the timecodes they were recorded.</li>
            </ol>
          </div>

          <div className="setup-card">
            <h3>Camera Setup</h3>
            <p className="setup-hint">For markers to align with your footage, set your camera to record timecode starting at 00:00:00:00 (Rec Run mode) and start your camera at the same time as you start the session.</p>
            <div className="setup-camera-tips">
              <div className="setup-camera-brand">
                <h4>Sony</h4>
                <ul>
                  <li>Menu → TC/UB → TC Preset → Set to 00:00:00:00</li>
                  <li>Set TC Run to Record Run (starts/stops with recording)</li>
                </ul>
              </div>
              <div className="setup-camera-brand">
                <h4>Canon</h4>
                <ul>
                  <li>Menu → Time Code → Preset → 00:00:00:00</li>
                  <li>Set to Record Run mode</li>
                </ul>
              </div>
              <div className="setup-camera-brand">
                <h4>Blackmagic</h4>
                <ul>
                  <li>Menu → Timecode → Set to 00:00:00:00</li>
                  <li>Set to Record Run</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="setup-card">
            <h3>Export</h3>
            <p className="setup-hint">Export markers for import into DaVinci Resolve, Premiere Pro, or Final Cut Pro.</p>
            <div className="setup-export-btns">
              <button className="btn" onClick={exportCsv} disabled={sorted.length === 0}>
                Export CSV
              </button>
              <button className="btn" onClick={exportEdl} disabled={sorted.length === 0}>
                Export EDL
              </button>
              <button className="btn" onClick={exportResolveScript} disabled={sorted.length === 0}>
                Resolve Script
              </button>
            </div>
            <p className="setup-hint" style={{ marginTop: 8 }}>
              <strong>CSV/EDL</strong> — Timeline markers. Import via right-click timeline → Timelines → Import → Timeline Markers from EDL.
            </p>
            <p className="setup-hint">
              <strong>Resolve Script</strong> — Clip markers (stick to clips). Save the .py file to <code>Fusion/Scripts/Comp/</code> in your Resolve user folder, then run via Workspace → Scripts → Comp → filename.py.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
