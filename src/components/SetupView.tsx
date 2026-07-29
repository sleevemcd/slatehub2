import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function SetupView() {
  const { state, dispatch, updateProject, activeProject } = useApp()
  const p = activeProject
  const [sheetUrl, setSheetUrl] = useState(p?.sheetUrl || '')
  const [docUrl, setDocUrl] = useState(p?.docUrl || '')
  const [relayUrl, setRelayUrl] = useState(p?.relayUrl || '')
  const [googleApiKey, setGoogleApiKey] = useState(state.teleprompter.googleApiKey || '')
  const [googleClientId, setGoogleClientId] = useState(state.teleprompter.googleClientId || '')

  const handleSave = () => {
    if (!p) return
    updateProject(p.id, { sheetUrl: sheetUrl.trim(), docUrl: docUrl.trim(), relayUrl: relayUrl.trim() })
    dispatch({ type: 'SET_TELEPROMPTER_CONFIG', config: { googleApiKey: googleApiKey.trim(), googleClientId: googleClientId.trim() } })
  }

  if (!p) {
    return (
      <div className="setup-view">
        <div className="setup-card">
          <div className="setup-icon">🎬</div>
          <h2>No Project Selected</h2>
          <p className="setup-subtitle">Create or select a project to get started.</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Go to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="setup-view">
      <div className="setup-card">
        <div className="setup-icon">⚙️</div>
        <h2>Project Settings</h2>
        <p className="setup-subtitle">{p.name}</p>

        <div className="setup-form">
          <label className="setup-label">Google Sheets URL (shot list)</label>
          <input className="setup-input" type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />

          <label className="setup-label">Google Doc URL (teleprompter script)</label>
          <input className="setup-input" type="text" value={docUrl} onChange={e => setDocUrl(e.target.value)} />

          <label className="setup-label">Apps Script Relay URL (write-back + remote)</label>
          <input className="setup-input" type="text" value={relayUrl} onChange={e => setRelayUrl(e.target.value)} />

          <h3 style={{ margin: '20px 0 8px', fontSize: 14, color: 'var(--text-primary)' }}>Google Integration</h3>

          <label className="setup-label">Google API Key</label>
          <input className="setup-input" type="text" value={googleApiKey} onChange={e => setGoogleApiKey(e.target.value)}
            placeholder="AIza..." />
          <p className="setup-hint" style={{ fontSize: 11, margin: '-4px 0 12px' }}>
            Create at Google Cloud Console → APIs & Services → Credentials → API Key (enable Picker API + Docs API)
          </p>

          <label className="setup-label">Google OAuth Client ID</label>
          <input className="setup-input" type="text" value={googleClientId} onChange={e => setGoogleClientId(e.target.value)}
            placeholder="xxx.apps.googleusercontent.com" />
          <p className="setup-hint" style={{ fontSize: 11, margin: '-4px 0 12px' }}>
            Create OAuth 2.0 Web Client ID, add your domain as Authorized Redirect URI
          </p>

          <button className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>

      <div className="setup-card setup-columns-card">
        <h3>Expected Shot List Columns</h3>
        <p>Your sheet headers should include any of these:</p>
        <div className="setup-columns">
          {['type', 'description', 'sub shot', 'location', 'setup', 'notes', 'reference link', 'shoot day', 'shoot order', 'done y/n', 'priority', 'scene', 'int/ext', 'day/night', 'shot size', 'camera move'].map(col => (
            <span key={col} className="column-badge">{col}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
