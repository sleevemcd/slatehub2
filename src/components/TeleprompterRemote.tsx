import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { sendTeleprompterState } from '../utils/sheet'

export function TeleprompterRemote() {
  const { state, dispatch } = useApp()
  const { teleprompter } = state
  const [scrollPos, setScrollPos] = useState(0)
  const [speed, setSpeed] = useState(state.teleprompterState.speed || 5)
  const [playing, setPlaying] = useState(state.teleprompterState.playing || false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  useEffect(() => {
    return () => {
      if (sendTimer.current) clearTimeout(sendTimer.current)
    }
  }, [])

  const handleScroll = useCallback((e: React.MouseEvent | React.TouchEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect()
    let clientY: number
    if ('touches' in e) {
      clientY = e.touches[0].clientY
    } else {
      clientY = e.clientY
    }
    const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    setScrollPos(pct)
    debouncedSend({ scrollPosition: pct, playing, speed })
  }, [debouncedSend, playing, speed])

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    debouncedSend({ speed: newSpeed, playing, scrollPosition: scrollPos })
  }

  const togglePlay = () => {
    const newPlaying = !playing
    setPlaying(newPlaying)
    sendState({ playing: newPlaying, speed, scrollPosition: scrollPos })
  }

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.03 : -0.03
    const newPos = Math.max(0, Math.min(1, scrollPos + delta))
    setScrollPos(newPos)
    debouncedSend({ scrollPosition: newPos, playing, speed })
  }

  const jumpToMarker = (marker: typeof state.teleprompterState.markers[0]) => {
    setScrollPos(marker.scrollPosition)
    sendState({ scrollPosition: marker.scrollPosition, playing, speed })
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

      <div
        className="tp-remote-scroll-area"
        onMouseDown={e => handleScroll(e, e.currentTarget)}
        onTouchMove={e => handleScroll(e, e.currentTarget)}
        onWheel={handleWheel}
      >
        <div className="tp-remote-scroll-fill" style={{ height: `${scrollPos * 100}%` }} />
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
          <button className="btn-small" onClick={() => {
            setScrollPos(0)
            sendState({ scrollPosition: 0, playing, speed })
          }}>Top</button>
          <button className="btn-small" onClick={() => {
            setScrollPos(0.25)
            sendState({ scrollPosition: 0.25, playing, speed })
          }}>25%</button>
          <button className="btn-small" onClick={() => {
            setScrollPos(0.5)
            sendState({ scrollPosition: 0.5, playing, speed })
          }}>50%</button>
          <button className="btn-small" onClick={() => {
            setScrollPos(0.75)
            sendState({ scrollPosition: 0.75, playing, speed })
          }}>75%</button>
          <button className="btn-small" onClick={() => {
            setScrollPos(1)
            sendState({ scrollPosition: 1, playing, speed })
          }}>End</button>
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
