import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { hashPassword } from '../utils/auth'

export function LoginView() {
  const { state, login, registerUser } = useApp()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required')
      return
    }
    if (isRegister && !name.trim()) {
      setError('Name is required')
      return
    }
    try {
      const hashed = hashPassword(password.trim())
      if (isRegister) {
        const existing = state.savedUsers.find(u => u.email === email.trim())
        if (existing) {
          setError('An account with this email already exists')
          return
        }
        registerUser({ name: name.trim(), role: '', email: email.trim(), password: hashed })
      } else {
        const user = state.savedUsers.find(u => u.email === email.trim())
        if (!user) {
          setError('No account found with this email')
          return
        }
        if (user.password !== hashed) {
          setError('Incorrect password')
          return
        }
        login({ name: user.name, role: user.role || '', email: user.email })
      }
    } catch {
      setError('Something went wrong. Try again.')
    }
  }

  const fillUser = (u: { email?: string; name?: string }) => {
    setEmail(u.email || '')
    setName(u.name || '')
    setPassword('')
    setError('')
  }

  return (
    <div className="login-view">
      <div className="login-card">
        <div className="login-logo">SLATEHUB</div>
        <p className="login-subtitle">Production Management</p>

        {state.savedUsers.length > 0 && !isRegister && (
          <div className="login-users">
            <p className="login-hint">Registered users</p>
            <div className="login-user-list">
              {state.savedUsers.map((u, i) => (
                <button key={i} className="login-user-btn" onClick={() => fillUser(u)}>
                  <span className="login-user-avatar">{(u.name || '?')[0].toUpperCase()}</span>
                  <span className="login-user-name">{u.name}</span>
                  <span className="login-user-email">{u.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label">
            Email
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </label>

          {isRegister && (
            <label className="login-label">
              Name
              <input
                className="login-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          )}

          <label className="login-label">
            Password
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isRegister ? 'Create a password' : 'Enter your password'}
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="btn-primary login-btn" type="submit">
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button className="login-toggle" onClick={() => { setIsRegister(!isRegister); setError('') }}>
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  )
}
