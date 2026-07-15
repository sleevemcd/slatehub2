import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function ProjectManager() {
  const { state, createProject, switchProject, deleteProject, updateProject } = useApp()
  const [name, setName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [relayUrl, setRelayUrl] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const demoUrl = 'https://docs.google.com/spreadsheets/d/10GJlo_5HS7Z9z5xm-BM5uNzTyhZ01v5SwPpzu7vtqE4/edit?usp=sharing'

  const handleCreate = async () => {
    if (!name.trim() || !sheetUrl.trim()) return
    await createProject(name.trim(), sheetUrl.trim(), docUrl.trim(), relayUrl.trim())
    setName('')
    setSheetUrl('')
    setDocUrl('')
    setRelayUrl('')
    setShowNewForm(false)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const project = state.projects.find(p => p.id === id)
    if (project && confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteProject(id)
    }
  }

  const handleRename = (id: string) => {
    if (editName.trim()) {
      updateProject(id, { name: editName.trim() })
    }
    setEditingId(null)
  }

  const handleDemo = async () => {
    await createProject('Demo Project', demoUrl, '', '')
  }

  const progress = (p: typeof state.projects[0]) => {
    if (p.id !== state.activeProjectId) return null
    const total = state.shots.length
    if (total === 0) return null
    const done = state.shots.filter(s => s.done).length
    return Math.round((done / total) * 100)
  }

  return (
    <div className="setup-view">
      <div className="setup-card">
        <div className="setup-icon">📁</div>
        <h2>Projects</h2>
        <p className="setup-subtitle">
          Each project bundles a shot list, script, and settings together.
        </p>

        {state.projects.length > 0 && (
          <div className="project-list">
            {state.projects.map(p => (
              <div
                key={p.id}
                className={`project-card ${state.activeProjectId === p.id ? 'active' : ''}`}
                onClick={() => switchProject(p.id)}
              >
                <div className="project-card-left">
                  {editingId === p.id ? (
                    <input
                      className="project-rename-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleRename(p.id)}
                      onKeyDown={e => e.key === 'Enter' && handleRename(p.id)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <h3 className="project-name" onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingId(p.id)
                      setEditName(p.name)
                    }}>{p.name}</h3>
                  )}
                  <div className="project-meta">
                    {p.sheetUrl && <span>📋 Sheet linked</span>}
                    {p.docUrl && <span>📜 Doc linked</span>}
                    {p.relayUrl && <span>📡 Relay linked</span>}
                  </div>
                </div>
                <div className="project-card-right">
                  {progress(p) !== null && (
                    <div className="project-progress">
                      <div className="project-progress-bar">
                        <div className="project-progress-fill" style={{ width: `${progress(p)}%` }} />
                      </div>
                      <span className="project-progress-pct">{progress(p)}%</span>
                    </div>
                  )}
                  <button className="btn-icon btn-icon-sm" onClick={(e) => handleDelete(p.id, e)} title="Delete project">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showNewForm ? (
          <div className="project-form">
            <h3>New Project</h3>
            <div className="setup-form">
              <label className="setup-label">Project Name *</label>
              <input className="setup-input" type="text" placeholder="e.g. Car Shoot 2026" value={name} onChange={e => setName(e.target.value)} />

              <label className="setup-label">Google Sheets URL *</label>
              <input className="setup-input" type="text" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />

              <label className="setup-label">Google Doc URL (optional)</label>
              <input className="setup-input" type="text" placeholder="https://docs.google.com/document/d/..." value={docUrl} onChange={e => setDocUrl(e.target.value)} />

              <label className="setup-label">Relay URL (optional)</label>
              <input className="setup-input" type="text" placeholder="https://script.google.com/macros/s/..." value={relayUrl} onChange={e => setRelayUrl(e.target.value)} />

              <div className="project-form-buttons">
                <button className="btn-primary" onClick={handleCreate} disabled={!name.trim() || !sheetUrl.trim()}>
                  Create Project
                </button>
                <button className="btn-secondary" onClick={() => setShowNewForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="project-actions">
            <button className="btn-primary" onClick={() => setShowNewForm(true)}>
              + New Project
            </button>
            <button className="btn-secondary" onClick={handleDemo}>
              Load Demo Project
            </button>
          </div>
        )}
      </div>

      <div className="setup-card setup-columns-card">
        <h3>How Projects Work</h3>
        <ul>
          <li>Each project stores its own sheet, doc, and relay URLs</li>
          <li>Switch between projects from the header dropdown</li>
          <li>Double-click a project name to rename it</li>
          <li>Projects are saved in your browser's local storage</li>
        </ul>
      </div>
    </div>
  )
}
