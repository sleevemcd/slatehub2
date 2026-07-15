import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function CrewView() {
  const { state, dispatch, addCrewMember, removeCrewMember, updateCrewMember, goToView } = useApp()
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [editName, setEditName] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')

  const allRoles = [...new Set([
    ...state.crewMembers.map(m => m.role).filter(Boolean),
    '2nd Shooter',
    'Sound Op',
    'Grip',
    'Director',
    'DP',
    'Script Supervisor',
    'BTS',
    'PA',
  ])]

  const roleNeeds = state.shots.reduce<Record<string, number>>((acc, s) => {
    ;(s.crew || []).forEach(r => { acc[r] = (acc[r] || 0) + 1 })
    return acc
  }, {})

  const handleAdd = () => {
    if (!newName.trim()) return
    addCrewMember({ name: newName.trim(), role: newRole.trim(), active: true })
    setNewName('')
    setNewRole('')
  }

  return (
    <div className="crew-view">
      <div className="crew-header">
        <h2>Crew</h2>
        <button className="btn btn-ghost" onClick={() => goToView('shots')}>← Back</button>
      </div>

      <div className="crew-add-form">
        <input className="input" placeholder="Name" value={newName}
          onChange={e => setNewName(e.target.value)} />
        <select className="filter-select" value={newRole}
          onChange={e => setNewRole(e.target.value)}>
          <option value="">Select role...</option>
          {allRoles.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="btn" onClick={handleAdd} disabled={!newName.trim()}>Add</button>
      </div>

      {state.crewMembers.length === 0 ? (
        <div className="empty-state">
          <p>No crew members added yet.</p>
          <p className="empty-hint">Add crew members and their roles, then tag shots with needed roles.</p>
        </div>
      ) : (
        <div className="crew-list">
          {state.crewMembers.map(m => (
            <div key={m.name} className="crew-member-card">
              {editName === m.name ? (
                <div className="crew-edit-form">
                  <span className="crew-edit-label">{m.name}</span>
                  <select className="filter-select crew-role-select"
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}>
                    <option value="">No role</option>
                    {allRoles.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="btn btn-sm" onClick={() => {
                    updateCrewMember(m.name, { role: editRole })
                    setEditName(null)
                  }}>Save</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditName(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="crew-member-info">
                    <span className="crew-member-name">{m.name}</span>
                    <span className="crew-member-role">{m.role || 'No role'}</span>
                  </div>
                  <div className="crew-member-actions">
                    <label className="crew-active-toggle">
                      <input type="checkbox" checked={m.active}
                        onChange={() => updateCrewMember(m.name, { active: !m.active })} />
                      <span className={`crew-status ${m.active ? 'on' : 'off'}`}>
                        {m.active ? 'On' : 'Off'}
                      </span>
                    </label>
                    <button className="btn-icon crew-edit-btn" title="Edit role"
                      onClick={() => { setEditName(m.name); setEditRole(m.role) }}>✎</button>
                    <button className="btn-icon crew-remove-btn" title="Remove"
                      onClick={() => removeCrewMember(m.name)}>✕</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="crew-msgs-section">
        <h3>Quick Messages</h3>
        <p className="crew-msgs-hint">These appear as one-tap buttons in the slate view.</p>
        {state.quickMessages.map((msg, i) => (
          <div key={i} className="crew-msg-row">
            <input className="input" value={msg}
              onChange={e => {
                const next = [...state.quickMessages]
                next[i] = e.target.value
                dispatch({ type: 'SET_QUICK_MESSAGES', messages: next })
              }} />
          </div>
        ))}
      </div>

      {Object.keys(roleNeeds).length > 0 && (
        <div className="crew-needs-section">
          <h3>Shot Requirements by Role</h3>
          <div className="crew-needs-grid">
            {Object.entries(roleNeeds).sort(([a], [b]) => a.localeCompare(b)).map(([role, count]) => (
              <div key={role} className="crew-need-card">
                <span className="crew-need-role">{role}</span>
                <span className="crew-need-count">{count} shot{count !== 1 ? 's' : ''}</span>
                <span className="crew-need-assigned">
                  {state.crewMembers.filter(m => m.role === role && m.active).map(m => m.name).join(', ') || 'Unassigned'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
