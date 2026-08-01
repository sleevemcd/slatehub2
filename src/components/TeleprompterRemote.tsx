import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { fetchTeleprompterState, getDeviceId, sendTeleprompterState } from '../utils/sheet'

export function TeleprompterRemote() {
  const { state, dispatch } = useApp()
  const { teleprompter } = state
  const [scrollPos, setScrollPos] = useState(0)
  const [speed, setSpeed] = useState(state.teleprompterState.speed || 5)
  const [playing, setPlaying] = useState(state.teleprompterState.playing || false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const applyingRemoteRef = useRef(false)
  const dragStartY = useRef(0)
  const dragStartScroll = useRef(0)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const scrollPosRef = useRef(scrollPos)
  const deviceId = useMemo(() => getDeviceId(), [])

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { scrollPosRef.current = scrollPos }, [scrollPos])

  const sendState = useCallback(async (partial: { scrollPosition?: number; speed?: number; playing?: boolean }) => {
    if (!teleprompter.relayUrl || !teleprompter.sessionId) return
    setSending(true)
    const ok = await sendTeleprompterState(teleprompter.relayUrl, teleprompter.sessionId, partial)
    setSending(false)
    setStatus(ok ? 'sent' : 'error')
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => setStatus('idle'), 1500)
  }, [teleprompter.relayUrl, teleprompter.sessionId])

  const debouncedSend = useCallback((partial: { scrollPosition?: number; speed?: number; playing?: boolean }) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => sendState(partial), 100)
  }, [sendState])

  const pollRemote = useCallback(async () => {
    if (!teleprompter.relayUrl || !teleprompter.sessionId) return
    const remoteState = await fetchTeleprompterState(teleprompter.relayUrl, teleprompter.sessionId)
    if (!remoteState) return
    const fresh = remoteState.age !== undefined && remoteState.age !== null && remoteState.age < 4000
    if (!fresh || remoteState.writer === deviceId) return
    if (remoteState.playing !== undefined && remoteState.playing !== playingRef.current) {
      setPlaying(remoteState.playing)
    }
    if (remoteState.speed !== undefined && remoteState.speed !== speedRef.current) {
      setSpeed(remoteState.speed)
    }
    if (remoteState.scrollPosition !== undefined && scrollAreaRef.current) {
      const maxScroll = scrollAreaRef.current.scrollHeight - scrollAreaRef.current.clientHeight
      if (maxScroll > 0) {
        applyingRemoteRef.current = true
        scrollAreaRef.current.scrollTop = remoteState.scrollPosition * maxScroll
        setScrollPos(remoteState.scrollPosition)
        setTimeout(() => { applyingRemoteRef.current = false }, 150)
      }
    }
  }, [teleprompter.relayUrl, teleprompter.sessionId, deviceId])

  useEffect(() => {
    if (!teleprompter.relayUrl) return
    pollingRef.current = setInterval(pollRemote, 500)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [pollRemote, teleprompter.relayUrl])

  useEffect(() => {
    return () => {
      if (sendTimer.current) clearTimeout(sendTimer.current)
    }
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    const pos = maxScroll > 0 ? el.scrollTop / maxScroll : 0
    setScrollPos(pos)
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }
    debouncedSend({ scrollPosition: pos, playing: playingRef.current, speed: speedRef.current })
  }, [debouncedSend])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartScroll.current = scrollAreaRef.current?.scrollTop ?? 0
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollAreaRef.current) return
    const dy = e.clientY - dragStartY.current
    scrollAreaRef.current.scrollTop = dragStartScroll.current - dy
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true
    dragStartY.current = e.touches[0].clientY
    dragStartScroll.current = scrollAreaRef.current?.scrollTop ?? 0
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollAreaRef.current) return
    const dy = e.touches[0].clientY - dragStartY.current
    scrollAreaRef.current.scrollTop = dragStartScroll.current - dy
  }, [])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = scrollAreaRef.current
    if (el) el.scrollTop += e.deltaY
  }, [])

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    debouncedSend({ speed: newSpeed, playing, scrollPosition: scrollPosRef.current })
  }

  const togglePlay = () => {
    const newPlaying = !playing
    setPlaying(newPlaying)
    sendState({ playing: newPlaying, speed, scrollPosition: scrollPosRef.current })
  }

  const jumpToMarker = (marker: typeof state.teleprompterState.markers[0]) => {
    jumpTo(marker.scrollPosition)
  }

  const jumpTo = (pct: number) => {
    const el = scrollAreaRef.current
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    el.scrollTop = pct * maxScroll
  }

  const goBack = () => {
    dispatch({ type: 'SET_VIEW', view: 'teleprompter-setup' })
  }

  return (
    <div className="tp-remote">
      <div className="tp-remote-header">
        <button className="btn-back" onClick={goBack}>← Back</button>
        <div className="tp-remote-session">
          Session: <code className="inline-code">{teleprompter.sessionId}</code>
        </div>
      </div>

      <div className="tp-remote-scroll-wrap">
        <div
          className="tp-remote-scroll-area"
          ref={scrollAreaRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <div className="tp-remote-scroll-fill">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className="tp-remote-line" />
            ))}
          </div>
        </div>
        <div className="tp-remote-scroll-handle" style={{ top: `${scrollPos * 100}%` }}>
          <span className="tp-remote-pct">{Math.round(scrollPos * 100)}%</span>
        </div>
        <div className="tp-remote-instruction">
          Drag or scroll to control position
        </div>
      </div>

      <div className="tp-remote-controls">
        <button className={`tp-remote-play-btn ${playing ? 'playing' : ''}`} onClick={togglePlay}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>

        <div className="tp-remote-speed">
          <label>Speed</label>
          <input
            type="range"
            min="1"
            max="20"
            value={speed}
            onChange={e => handleSpeedChange(Number(e.target.value))}
          />
          <span className="tp-speed-label">{speed}</span>
        </div>

        {state.teleprompterState.markers.length > 0 && (
          <div className="tp-remote-markers">
            <p className="tp-remote-markers-label">📌 Markers</p>
            <div className="tp-remote-marker-list">
              {state.teleprompterState.markers.map(m => (
                <button key={m.id} className="btn-small tp-remote-marker-btn"
                  onClick={() => jumpToMarker(m)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="tp-remote-jumps">
          <button className="btn-small" onClick={() => jumpTo(0)}>Top</button>
          <button className="btn-small" onClick={() => jumpTo(0.25)}>25%</button>
          <button className="btn-small" onClick={() => jumpTo(0.5)}>50%</button>
          <button className="btn-small" onClick={() => jumpTo(0.75)}>75%</button>
          <button className="btn-small" onClick={() => jumpTo(1)}>End</button>
        </div>
      </div>

      <div className="tp-remote-status">
        {status === 'sent' && <span className="tp-status-ok">✓ Sent</span>}
        {status === 'error' && <span className="tp-status-err">✗ Failed to send</span>}
        {sending && <span className="tp-status-sending">Sending...</span>}
        {!teleprompter.relayUrl && (
          <span className="tp-status-err">No relay URL configured — remote unavailable</span>
        )}
      </div>
    </div>
  )
}
