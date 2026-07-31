import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function ProjectManager() {
  const { state, createProject, switchProject, deleteProject, updateProject, joinProject, leaveProject, regenerateAccessCode } = useApp()
  const [name, setName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [group, setGroup] = useState('')
  const [groupColor, setGroupColor] = useState('#6366f1')
  const [shared, setShared] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [joinInput, setJoinInput] = useState<Record<string, string>>({})
  const [joinError, setJoinError] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const demoUrl = 'https://docs.google.com/spreadsheets/d/10GJlo_5HS7Z9z5xm-BM5uNzTyhZ01v5SwPpzu7vtqE4/edit?usp=sharing'

  const ownerKey = (state.currentUser?.email || state.currentUser?.name || '').toLowerCase()

  const isOwner = (p: typeof state.projects[0]) =>
    !!p.ownerEmail && (p.ownerEmail || '').toLowerCase() === ownerKey

  const isLocked = (p: typeof state.projects[0]) =>
    !isOwner(p) && p.shared !== false && !!p.accessCode && !state.joinedProjects.includes(p.id)

  const handleJoin = (p: typeof state.projects[0]) => {
    const ok = joinProject(p.id, (joinInput[p.id] || '').trim())
    if (ok) {
      setJoinInput(prev => ({ ...prev, [p.id]: '' }))
      setJoinError(prev => ({ ...prev, [p.id]: '' }))
      switchProject(p.id)
    } else {
      setJoinError(prev => ({ ...prev, [p.id]: 'Incorrect access code' }))
    }
  }

  const handleCopyCode = async (p: typeof state.projects[0]) => {
    if (!p.accessCode) return
    try {
      await navigator.clipboard.writeText(p.accessCode)
      setCopiedId(p.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    await createProject(name.trim(), sheetUrl.trim(), docUrl.trim(), '', group.trim(), groupColor, shared)
    setName('')
    setSheetUrl('')
    setDocUrl('')
    setGroup('')
    setGroupColor('#6366f1')
    setShared(true)
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
          <>
            <div className="project-group-filter">
              <select className="filter-select" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
                <option value="">All Groups</option>
                {[...new Set(state.projects.map(p => p.group).filter(Boolean))].sort().map(g => {
                  const proj = state.projects.find(p => p.group === g)
                  return <option key={g} value={g} style={proj ? { color: proj.groupColor } : undefined}>{g}</option>
                })}
              </select>
            </div>
            <div className="project-list">
              {state.projects.filter(p => !groupFilter || p.group === groupFilter).map(p => {
                const locked = isLocked(p)
                const owner = isOwner(p)
                const joined = state.joinedProjects.includes(p.id)
                return (
                <div
                  key={p.id}
                  className={`project-card ${state.activeProjectId === p.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => {
                    if (locked) return
                    switchProject(p.id)
                  }}
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
                        if (!owner && p.shared === false) return
                        setEditingId(p.id)
                        setEditName(p.name)
                      }}>
                        {p.group && <span className="project-group-dot" style={{ backgroundColor: p.groupColor }} title={p.group} />}
                        {p.name}
                      </h3>
                    )}
                    <div className="project-meta">
                      {p.sheetUrl && <span>📋 Sheet linked</span>}
                      {p.docUrl && <span>📜 Doc linked</span>}
                      {p.group && <span className="project-group-tag" style={{ color: p.groupColor }}>{p.group}</span>}
                      {owner ? (
                        <span
                          className={`project-share-tag ${p.shared === false ? 'local' : 'shared'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateProject(p.id, { shared: p.shared === false })
                          }}
                          title={p.shared === false ? 'Private — only visible to you. Click to share with crew.' : 'Shared — click to make private'}
                        >
                          {p.shared === false ? '🔒 Local' : '🌐 Shared'}
                        </span>
                      ) : (
                        <span className={`project-share-tag ${joined ? 'shared' : 'locked'}`}>
                          {locked ? '🔒 Locked' : joined ? '🌐 Joined' : '🌐 Shared'}
                        </span>
                      )}
                    </div>
                    {owner && p.shared !== false && p.accessCode && (
                      <div className="project-access-code" onClick={e => e.stopPropagation()}>
                        <span className="project-access-code-label">Access code</span>
                        <span className="project-access-code-value">{p.accessCode}</span>
                        <button className="btn-icon btn-icon-sm" onClick={() => handleCopyCode(p)} title="Copy access code">
                          {copiedId === p.id ? '✅' : '📋'}
                        </button>
                        <button
                          className="btn-icon btn-icon-sm"
                          onClick={() => {
                            if (confirm('Regenerate the access code? The old code will stop working.')) {
                              regenerateAccessCode(p.id)
                            }
                          }}
                          title="Regenerate access code"
                        >
                          🔄
                        </button>
                      </div>
                    )}
                    {locked && (
                      <div className="project-join-box" onClick={e => e.stopPropagation()}>
                        <input
                          className="project-join-input"
                          type="text"
                          placeholder="Enter access code"
                          value={joinInput[p.id] || ''}
                          onChange={e => setJoinInput(prev => ({ ...prev, [p.id]: e.target.value.toUpperCase() }))}
                          onKeyDown={e => e.key === 'Enter' && handleJoin(p)}
                          maxLength={10}
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => handleJoin(p)}>Join</button>
                        {joinError[p.id] && <span className="project-join-error">{joinError[p.id]}</span>}
                      </div>
                    )}
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
                    {owner && (
                      <button className="btn-icon btn-icon-sm" onClick={(e) => handleDelete(p.id, e)} title="Delete project">
                        🗑️
                      </button>
                    )}
                    {!owner && joined && (
                      <button
                        className="btn-icon btn-icon-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Leave "${p.name}"?`)) leaveProject(p.id)
                        }}
                        title="Leave project"
                      >
                        👋
                      </button>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </>
        )}

        {showNewForm ? (
          <div className="project-form">
            <h3>New Project</h3>
            <div className="setup-form">
              <label className="setup-label">Project Name *</label>
              <input className="setup-input" type="text" placeholder="e.g. Car Shoot 2026" value={name} onChange={e => setName(e.target.value)} />

              <label className="setup-label">
                Google Sheets URL (optional)
                <span className="label-hint">Link the shot list — can be added later</span>
              </label>
              <input className="setup-input" type="text" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />

              <label className="setup-label">Google Doc URL (optional)</label>
              <input className="setup-input" type="text" placeholder="https://docs.google.com/document/d/..." value={docUrl} onChange={e => setDocUrl(e.target.value)} />

              <label className="setup-label">Group</label>
              <input className="setup-input" type="text" placeholder="e.g. Client A, Personal, Work" value={group} onChange={e => setGroup(e.target.value)} />

              <label className="setup-label">
                Group Color
                <span className="color-picker-wrap">
                  <input type="color" value={groupColor} onChange={e => setGroupColor(e.target.value)} className="color-picker" />
                  <span className="color-hex">{groupColor}</span>
                </span>
              </label>

              <label className="setup-label">Sharing</label>
              <div className="project-share-toggle">
                <button
                  className={`btn btn-sm ${shared ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={(e) => { e.preventDefault(); setShared(true) }}
                >
                  🌐 Shared with crew
                </button>
                <button
                  className={`btn btn-sm ${!shared ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={(e) => { e.preventDefault(); setShared(false) }}
                >
                  🔒 Private to me
                </button>
              </div>
              <p className="setup-hint">
                {shared
                  ? 'Shared projects get an access code you send to crew — they unlock and join from any device.'
                  : 'Private projects are only visible to you when logged in.'}
              </p>

              <div className="project-form-buttons">
                <button className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>
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
          <li>Shared projects are locked until you enter the creator's access code</li>
        </ul>
      </div>
    </div>
  )
}
