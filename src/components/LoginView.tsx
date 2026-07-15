import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function LoginView() {
  const { state, login } = useApp()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  const commonRoles = [
    'Director', 'DP', '1st AC', '2nd AC', 'Sound Op',
    'Gaffer', 'Grip', 'Script Supervisor', 'BTS', 'PA',
  ]

  const handleLogin = (user: { name: string; role: string }) => {
    login({ name: user.name.trim(), role: user.role.trim() })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) handleLogin({ name: name.trim(), role: role.trim() })
  }

  return (
    <div className="login-view">
      <div className="login-card">
        <div className="login-icon">🎬</div>
        <h1 className="login-title">SlateHub</h1>
        <p className="login-subtitle">Digital Slating & Crew Coordination</p>

        {state.savedUsers.length > 0 && (
          <div className="login-saved">
            <p className="login-label">Welcome back</p>
            <div className="login-users">
              {state.savedUsers.map(u => (
                <button key={u.name} className="login-user-btn" onClick={() => handleLogin(u)}>
                  <span className="login-user-avatar">{u.name[0].toUpperCase()}</span>
                  <span className="login-user-name">{u.name}</span>
                  {u.role && <span className="login-user-role">{u.role}</span>}
                </button>
              ))}
            </div>
            <div className="login-divider"><span>or new face</span></div>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <p className="login-label">Who are you?</p>
          <input className="input login-input" placeholder="Your name" value={name}
            onChange={e => setName(e.target.value)} autoFocus={state.savedUsers.length === 0}
            required />
          <div className="login-role-row">
            <input className="input login-input" placeholder="Role (optional)" value={role}
              onChange={e => setRole(e.target.value)} list="common-roles" />
            <datalist id="common-roles">
              {commonRoles.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
          <button className="btn login-btn" type="submit" disabled={!name.trim()}>
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
