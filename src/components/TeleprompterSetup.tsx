import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

function generateSessionId(): string {
  return 'tp-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36)
}

export function TeleprompterSetup() {
  const { state, dispatch } = useApp()
  const [docUrl, setDocUrl] = useState(state.teleprompter.docUrl || '')
  const [relayUrl, setRelayUrl] = useState(state.teleprompter.relayUrl || '')
  const [sessionId, setSessionId] = useState(state.teleprompter.sessionId || generateSessionId())
  const [mode, setMode] = useState<'display' | 'remote'>('display')

  useEffect(() => {
    const saved = localStorage.getItem('slatehub-tp-doc-url')
    if (saved) setDocUrl(saved)
    const savedRelay = localStorage.getItem('slatehub-tp-relay-url')
    if (savedRelay) setRelayUrl(savedRelay)
  }, [])

  const start = () => {
    const trimmed = docUrl.trim()
    if (!trimmed) return

    localStorage.setItem('slatehub-tp-doc-url', trimmed)
    if (relayUrl.trim()) {
      localStorage.setItem('slatehub-tp-relay-url', relayUrl.trim())
    }

    dispatch({ type: 'SET_TELEPROMPTER_CONFIG', config: { docUrl: trimmed, sessionId, relayUrl: relayUrl.trim() } })
    dispatch({ type: 'SET_VIEW', view: mode === 'display' ? 'teleprompter-view' : 'teleprompter-remote' })
  }

  const regenerateSession = () => {
    setSessionId(generateSessionId())
  }

  const demoDocUrl = 'https://docs.google.com/document/d/1VhhvPkTNhyjQWxZWpZbZxQSlOueuSKPh4CzOXsOujqo/edit'

  return (
    <div className="setup-view">
      <div className="setup-card">
        <div className="setup-icon">📜</div>
        <h2>Teleprompter Setup</h2>
        <p className="setup-subtitle">
          Link a Google Doc for your script. It updates live as you make changes.
        </p>

        <div className="setup-form">
          <label className="setup-label">Google Doc URL</label>
          <input
            className="setup-input"
            type="text"
            placeholder="https://docs.google.com/document/d/..."
            value={docUrl}
            onChange={e => setDocUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && start()}
          />

          <label className="setup-label">
            Relay URL (optional — for remote scroll)
            <span className="label-hint">Paste your Apps Script web app URL</span>
          </label>
          <input
            className="setup-input"
            type="text"
            placeholder="https://script.google.com/macros/s/..."
            value={relayUrl}
            onChange={e => setRelayUrl(e.target.value)}
          />

          <label className="setup-label">Session ID</label>
          <div className="session-row">
            <input
              className="setup-input session-input"
              type="text"
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
            />
            <button className="btn-secondary btn-smallish" onClick={regenerateSession}>
              New
            </button>
          </div>
        </div>

        <div className="tp-mode-select">
          <button
            className={`tp-mode-btn ${mode === 'display' ? 'active' : ''}`}
            onClick={() => setMode('display')}
          >
            📺 Display
            <span className="tp-mode-desc">Full-screen scrolling prompter</span>
          </button>
          <button
            className={`tp-mode-btn ${mode === 'remote' ? 'active' : ''}`}
            onClick={() => setMode('remote')}
          >
            🎮 Remote Control
            <span className="tp-mode-desc">Scroll & control from another device</span>
          </button>
        </div>

        <button className="btn-primary" onClick={start} disabled={!docUrl.trim()}>
          {mode === 'display' ? 'Start Teleprompter' : 'Start Remote Control'}
        </button>

        {state.error && (
          <div className="setup-error">
            <strong>Error:</strong> {state.error}
          </div>
        )}

        <div className="setup-steps">
          <h3>How it works</h3>
          <ol>
            <li>Create your script in Google Docs</li>
            <li>Go to <strong>File → Share → Publish to web</strong></li>
            <li>Choose <strong>Entire Document</strong> as <strong>Plain text (.txt)</strong></li>
            <li>Copy the published URL and paste it above</li>
            <li>Share the <strong>Session ID</strong> with your remote controller</li>
          </ol>
        </div>

        <div className="setup-demo">
          <p>No document yet?</p>
          <button className="btn-secondary" onClick={() => {
            setDocUrl(demoDocUrl)
          }}>
            Use Demo Script
          </button>
        </div>
      </div>

      <div className="setup-card setup-columns-card">
        <h3>Remote Scroll Setup</h3>
        <p>
          For remote scroll, both devices need the <strong>same Session ID</strong> and the
          <strong>Relay URL</strong> from your deployed Apps Script.
        </p>
        <p>
          Deploy <code className="inline-code">apps-script/Code.gs</code> as a Web App to
          enable the relay.
        </p>
      </div>
    </div>
  )
}
