import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function SetupView() {
  const { updateProject, activeProject } = useApp()
  const p = activeProject
  const [sheetUrl, setSheetUrl] = useState(p?.sheetUrl || '')
  const [docUrl, setDocUrl] = useState(p?.docUrl || '')
  const [relayUrl, setRelayUrl] = useState(p?.relayUrl || '')

  const handleSave = () => {
    if (!p) return
    updateProject(p.id, { sheetUrl: sheetUrl.trim(), docUrl: docUrl.trim(), relayUrl: relayUrl.trim() })
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

          <button className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>

      <div className="setup-card setup-columns-card">
        <h3>Expected Shot List Columns</h3>
        <p>Your sheet headers should include any of these:</p>
        <div className="setup-columns">
          {['type', 'description', 'sub shot', 'location', 'setup', 'notes', 'reference link', 'shoot day', 'shoot order', 'done y/n', 'scene', 'int/ext', 'day/night', 'shot size', 'camera move', 'priority'].map(col => (
            <span key={col} className="column-badge">{col}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
