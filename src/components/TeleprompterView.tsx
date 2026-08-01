import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { docUrlToTxtUrl, fetchDocText, fetchTeleprompterState, getDeviceId, htmlToPlainText, sendTeleprompterState } from '../utils/sheet'

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

const FONTS = ['Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'monospace']

export function TeleprompterView() {
  const { state, dispatch } = useApp()
  const { teleprompter } = state
  const [text, setText] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [speed, setSpeed] = useState(state.teleprompterState.speed)
  const [playing, setPlaying] = useState(state.teleprompterState.playing)
  const [mirror, setMirror] = useState(false)
  const [fontSize, setFontSize] = useState(28)
  const [lineHeight, setLineHeight] = useState(1.7)
  const [fontFamily, setFontFamily] = useState('Inter')
  const [marginX, setMarginX] = useState(40)
  const [maxWidth, setMaxWidth] = useState(800)
  const [showSettings, setShowSettings] = useState(false)
  const [connected, setConnected] = useState(false)
  const [docError, setDocError] = useState('')
  const [hideUI, setHideUI] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const posRef = useRef(state.teleprompterState.scrollPosition)
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const relayTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const applyingRemoteRef = useRef(false)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const deviceId = useMemo(() => getDeviceId(), [])

  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartScroll = useRef(0)
  const tapStartRef = useRef<{ x: number; y: number } | null>(null)
  const tapMovedRef = useRef(false)

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { speedRef.current = speed }, [speed])

  const fetchDoc = useCallback(async (showLoader = false) => {
    if (state.scriptContent) {
      const content = htmlToPlainText(state.scriptContent)
      if (content) {
        setText(content)
        setDocError('')
        setInitialLoading(false)
        setRefreshing(false)
        return
      }
    }
    if (!teleprompter.docUrl) return
    if (showLoader) setInitialLoading(true)
    else setRefreshing(true)
    setDocError('')
    try {
      const txtUrl = docUrlToTxtUrl(teleprompter.docUrl)
      if (!txtUrl) {
        setDocError('Invalid Google Doc URL')
        setInitialLoading(false)
        setRefreshing(false)
        return
      }
      const content = await fetchDocText(txtUrl)
      setText(content || '(empty document)')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setDocError(msg)
    } finally {
      setInitialLoading(false)
      setRefreshing(false)
    }
  }, [teleprompter.docUrl, state.scriptContent])

  useEffect(() => {
    fetchDoc(true)
    const interval = setInterval(() => fetchDoc(false), 10000)
    return () => clearInterval(interval)
  }, [fetchDoc])

  const sendRelay = useCallback((partial: { scrollPosition?: number; speed?: number; playing?: boolean }) => {
    if (!teleprompter.relayUrl || !teleprompter.sessionId) return
    sendTeleprompterState(teleprompter.relayUrl, teleprompter.sessionId, { ...partial, writer: deviceId })
  }, [teleprompter.relayUrl, teleprompter.sessionId, deviceId])

  const sendRelayDebounced = useCallback((partial: { scrollPosition?: number; speed?: number; playing?: boolean }) => {
    if (relayTimerRef.current) clearTimeout(relayTimerRef.current)
    relayTimerRef.current = setTimeout(() => sendRelay(partial), 120)
  }, [sendRelay])

  const pollRemote = useCallback(async () => {
    if (!teleprompter.relayUrl || !teleprompter.sessionId) {
      setConnected(false)
      return
    }
    const remoteState = await fetchTeleprompterState(teleprompter.relayUrl, teleprompter.sessionId)
    if (remoteState) {
      const fresh = remoteState.age !== undefined && remoteState.age !== null && remoteState.age < 4000
      setConnected(fresh)
      if (fresh && remoteState.writer !== deviceId) {
        if (remoteState.playing !== undefined && remoteState.playing !== playingRef.current) {
          setPlaying(remoteState.playing)
        }
        if (remoteState.speed !== undefined && remoteState.speed !== speedRef.current) {
          setSpeed(remoteState.speed)
          dispatch({ type: 'SET_TELEPROMPTER_STATE', state: { speed: remoteState.speed } })
        }
        if (remoteState.scrollPosition !== undefined && scrollRef.current) {
          const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight
          if (maxScroll > 0) {
            applyingRemoteRef.current = true
            scrollRef.current.scrollTop = remoteState.scrollPosition * maxScroll
            posRef.current = remoteState.scrollPosition
            setTimeout(() => { applyingRemoteRef.current = false }, 150)
          }
        }
      }
    } else {
      setConnected(false)
    }
  }, [teleprompter.relayUrl, teleprompter.sessionId, deviceId, dispatch])

  useEffect(() => {
    if (!teleprompter.relayUrl) return
    pollingRef.current = setInterval(pollRemote, 500)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (relayTimerRef.current) clearTimeout(relayTimerRef.current)
    }
  }, [pollRemote, teleprompter.relayUrl])

  useEffect(() => {
    if (!playing || !scrollRef.current) return
    const el = scrollRef.current
    const step = () => {
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return
      el.scrollTop += speed * 0.15
      if (el.scrollTop >= maxScroll) {
        el.scrollTop = maxScroll
        setPlaying(false)
        return
      }
      animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, speed])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault()
      togglePlay()
    }
    if (e.key === 'ArrowUp') {
      const v = Math.max(1, speedRef.current - 1)
      speedRef.current = v
      setSpeed(v)
      sendRelay({ speed: v, playing: playingRef.current, scrollPosition: posRef.current })
    }
    if (e.key === 'ArrowDown') {
      const v = Math.min(20, speedRef.current + 1)
      speedRef.current = v
      setSpeed(v)
      sendRelay({ speed: v, playing: playingRef.current, scrollPosition: posRef.current })
    }
    if (e.key === 'Escape') {
      if (hideUI) setHideUI(false)
      else if (showSettings) setShowSettings(false)
    }
    if (e.key === 'h' || e.key === 'H') setHideUI(h => !h)
  }

  const togglePlay = useCallback(() => {
    const np = !playingRef.current
    playingRef.current = np
    setPlaying(np)
    sendRelay({ playing: np, speed: speedRef.current, scrollPosition: posRef.current })
  }, [sendRelay])

  const handlePointerStart = (x: number, y: number) => {
    tapStartRef.current = { x, y }
    tapMovedRef.current = false
    if (playing) return
    isDragging.current = true
    dragStartY.current = y
    dragStartScroll.current = scrollRef.current?.scrollTop ?? 0
  }

  const handlePointerMove = (x: number, y: number) => {
    if (tapStartRef.current && !tapMovedRef.current) {
      const dx = x - tapStartRef.current.x
      const dy = y - tapStartRef.current.y
      if (Math.abs(dx) + Math.abs(dy) > 6) tapMovedRef.current = true
    }
    if (!isDragging.current || !scrollRef.current) return
    const dy = y - dragStartY.current
    scrollRef.current.scrollTop = dragStartScroll.current - dy
    handleScroll()
  }

  const handlePointerEnd = (e: { target: EventTarget | null }) => {
    const wasTap = !tapMovedRef.current
    isDragging.current = false
    tapStartRef.current = null
    if (wasTap) {
      const t = e.target as HTMLElement | null
      if (t && t.closest('button, input, select, textarea, a, .tp-controls, .tp-bottom-bar, .tp-sidebar-overlay')) return
      togglePlay()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handlePointerStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY)
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    handlePointerEnd(e)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    handlePointerStart(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    handlePointerEnd(e)
  }

  const handleScroll = () => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const maxScroll = el.scrollHeight - el.clientHeight
    const pos = maxScroll > 0 ? el.scrollTop / maxScroll : 0
    posRef.current = pos
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }
    dispatch({ type: 'SET_TELEPROMPTER_STATE', state: { scrollPosition: pos } })
    sendRelayDebounced({ scrollPosition: pos, speed: speedRef.current, playing: playingRef.current })
  }

  const jumpTo = (pct: number) => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const maxScroll = el.scrollHeight - el.clientHeight
    el.scrollTop = pct * maxScroll
    posRef.current = pct
  }

  const [showMarkerInput, setShowMarkerInput] = useState(false)
  const [markerLabel, setMarkerLabel] = useState('')

  const addMarker = () => {
    if (!markerLabel.trim()) return
    dispatch({ type: 'ADD_TELEPROMPTER_MARKER', marker: { id: generateId(), label: markerLabel.trim(), scrollPosition: posRef.current } })
    setMarkerLabel('')
    setShowMarkerInput(false)
  }

  const jumpToMarker = (pos: number) => {
    setPlaying(false)
    playingRef.current = false
    jumpTo(pos)
  }

  const goBack = () => {
    dispatch({ type: 'SET_VIEW', view: 'teleprompter-setup' })
  }

  const lines = useMemo(() => text.split('\n'), [text])

  if (initialLoading) {
    return (
      <div className="tp-view tp-loading">
        <div className="tp-loading-text">Loading script...</div>
      </div>
    )
  }

  if (docError) {
    return (
      <div className="tp-view tp-error-view">
        <div className="setup-error" style={{ maxWidth: 500, margin: '40px auto' }}>
          <strong>Failed to load document:</strong> {docError}
          <p className="setup-hint">Make sure the doc is published to the web (File → Share → Publish to web → Plain text)</p>
        </div>
        <button className="btn-secondary" onClick={goBack}>Back to Setup</button>
      </div>
    )
  }

  return (
    <div
      className={`tp-view ${mirror ? 'tp-mirrored' : ''} ${hideUI ? 'tp-hide-ui' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {hideUI && (
        <button className="tp-exit-btn" onClick={() => setHideUI(false)} title="Show controls (Esc)">⋯</button>
      )}
      <div className="tp-controls">
        <div className="tp-controls-left">
          <button className="btn-icon tp-btn" onClick={goBack} title="Back">←</button>
          <button className={`btn-icon tp-btn ${playing ? 'active' : ''}`} onClick={togglePlay} title="Play (Space)">
            {playing ? '⏸' : '▶'}
          </button>
          <button className={`btn-icon tp-btn ${mirror ? 'active' : ''}`} onClick={() => setMirror(m => !m)} title="Mirror flip">
            {mirror ? '↔' : '↕'}
          </button>
          <button className="btn-icon tp-btn" onClick={() => fetchDoc(false)} title="Reload doc">⟳</button>
          <button className={`btn-icon tp-btn ${showMarkerInput ? 'active' : ''}`}
            onClick={() => setShowMarkerInput(!showMarkerInput)} title="Add marker">
            📌
          </button>
        </div>
        <div className="tp-controls-center">
          <input type="range" min="1" max="20" value={speed}
            onChange={e => {
              const v = Number(e.target.value)
              setSpeed(v)
              sendRelay({ speed: v, playing: playingRef.current, scrollPosition: posRef.current })
            }}
            className="tp-speed-slider" title="Scroll speed" />
          <span className="tp-speed-label">{speed}</span>
        </div>
        <div className="tp-controls-right">
          <button className="btn-icon tp-btn" onClick={() => setHideUI(h => !h)} title="Hide UI (H)">
            ⛶
          </button>
          <button className={`btn-icon tp-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)} title="Settings">
            ⚙
          </button>
          <button className="btn-icon tp-btn" onClick={() => setFontSize(s => Math.max(14, s - 2))} title="Smaller text">A-</button>
          <button className="btn-icon tp-btn" onClick={() => setFontSize(s => Math.min(72, s + 2))} title="Larger text">A+</button>
          {teleprompter.relayUrl && (
            <span className={`tp-connection ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '●' : '○'}
            </span>
          )}
          {refreshing && <span className="tp-refreshing" title="Refreshing script...">⋯</span>}
        </div>
      </div>

      <div className={`tp-scroll-container ${hideUI ? 'tp-scroll-fullscreen' : ''}`}
        ref={scrollRef} onScroll={handleScroll}
        style={{ padding: `20px ${marginX}px` }}>
        <div className="tp-text" style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily, maxWidth: `${maxWidth}px`, margin: '0 auto' }}>
          {lines.map((line, i) => (
            <p key={i} className={`tp-line ${line.trim() === '' ? 'tp-empty' : ''}`}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      </div>

      {showSettings && (
        <div className="tp-sidebar-overlay" onClick={() => setShowSettings(false)}>
          <div className="tp-sidebar" onClick={e => e.stopPropagation()}>
            <div className="tp-sidebar-header">
              <h3>Display Settings</h3>
              <button className="btn-icon tp-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>

            <div className="tp-sidebar-body">
              <label className="tp-sidebar-field">
                <span>Font</span>
                <select className="filter-select" value={fontFamily}
                  onChange={e => setFontFamily(e.target.value)}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>

              <label className="tp-sidebar-field">
                <span>Text Size: {fontSize}px</span>
                <input type="range" min="14" max="72" value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))} />
              </label>

              <label className="tp-sidebar-field">
                <span>Line Spacing: {lineHeight.toFixed(1)}</span>
                <input type="range" min="1" max="3" step="0.1" value={lineHeight}
                  onChange={e => setLineHeight(Number(e.target.value))} />
              </label>

              <label className="tp-sidebar-field">
                <span>Max Width: {maxWidth}px</span>
                <input type="range" min="400" max="1200" step="50" value={maxWidth}
                  onChange={e => setMaxWidth(Number(e.target.value))} />
              </label>

              <label className="tp-sidebar-field">
                <span>Side Margins: {marginX}px</span>
                <input type="range" min="10" max="120" value={marginX}
                  onChange={e => setMarginX(Number(e.target.value))} />
              </label>

              <label className="tp-sidebar-field">
                <span>Scroll Speed: {speed}</span>
                <input type="range" min="1" max="20" value={speed}
                  onChange={e => {
                    const v = Number(e.target.value)
                    setSpeed(v)
                    sendRelay({ speed: v, playing: playingRef.current, scrollPosition: posRef.current })
                  }} />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="tp-bottom-bar">
        {showMarkerInput && (
          <div className="tp-marker-input">
            <input className="input" placeholder="Marker name..." value={markerLabel}
              onChange={e => setMarkerLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMarker() }}
              autoFocus />
            <button className="btn btn-sm" onClick={addMarker} disabled={!markerLabel.trim()}>Add</button>
          </div>
        )}
        <div className="tp-progress-row">
          <div className="tp-progress-bar" onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            jumpTo(pct)
          }}>
            <div className="tp-progress-fill" style={{ width: `${posRef.current * 100}%` }} />
            {state.teleprompterState.markers.map(m => (
              <div key={m.id} className="tp-marker-dot" style={{ left: `${m.scrollPosition * 100}%` }}
                title={m.label} onClick={e => { e.stopPropagation(); jumpToMarker(m.scrollPosition) }} />
            ))}
          </div>
        </div>
        {state.teleprompterState.markers.length > 0 && (
          <div className="tp-marker-list">
            {state.teleprompterState.markers.map(m => (
              <button key={m.id} className="tp-marker-btn" onClick={() => jumpToMarker(m.scrollPosition)}>
                📌 {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
