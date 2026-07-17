import { useState } from 'react'
import { useApp } from '../context/AppContext'

export function Header() {
  const { state, dispatch, goToView, toggleTheme, activeProject } = useApp()
  const [showUser, setShowUser] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const unread = state.notifications.filter(n => !n.read).length

  const handleLogout = () => {
    dispatch({ type: 'SET_USER', user: { name: '', role: '' } })
    setShowUser(false)
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="hamburger" onClick={() => setShowMenu(s => !s)} aria-label="Menu">
          <span className={`hamburger-line ${showMenu ? 'open' : ''}`} />
        </button>
        <h1 className="header-title" onClick={() => goToView('project-manager')}>
          🎬 SlateHub
        </h1>
        {activeProject && (
          <span className="header-project" onClick={() => goToView('project-manager')}>
            {activeProject.name}
          </span>
        )}
      </div>

      <nav className={`header-nav ${showMenu ? 'open' : ''}`}>
        <button className={`nav-btn ${state.view === 'shots' ? 'active' : ''}`}
          onClick={() => { goToView('shots'); setShowMenu(false) }}>Shots</button>
        <button className={`nav-btn ${state.view === 'shoot-schedule' ? 'active' : ''}`}
          onClick={() => { goToView('shoot-schedule'); setShowMenu(false) }}>Schedule</button>
        <button className={`nav-btn ${state.view === 'slate' ? 'active' : ''}`}
          onClick={() => { goToView('slate'); setShowMenu(false) }}>Slate</button>
        <button className={`nav-btn ${state.view === 'crew' ? 'active' : ''}`}
          onClick={() => { goToView('crew'); setShowMenu(false) }}>Crew</button>
        {activeProject?.docUrl && (
          <button className={`nav-btn ${state.view.startsWith('teleprompter') ? 'active' : ''}`}
            onClick={() => { goToView('teleprompter-setup'); setShowMenu(false) }}>Prompter</button>
        )}
        <button className={`nav-btn ${state.view === 'script-review' ? 'active' : ''}`}
          onClick={() => { goToView('script-review'); setShowMenu(false) }}>Script</button>
        <button className={`nav-btn ${state.view === 'dashboard' ? 'active' : ''}`}
          onClick={() => { goToView('dashboard'); setShowMenu(false) }}>Dashboard</button>
      </nav>

      <div className="header-right">
        <div className="notif-bell" onClick={() => setShowNotif(!showNotif)}>
          <span className="bell-icon">{unread > 0 ? '🔔' : '🔕'}</span>
          {unread > 0 && <span className="notif-count">{unread}</span>}
        </div>

        <div className="user-badge" onClick={() => setShowUser(!showUser)}>
          <span className="user-avatar">
            {(state.currentUser.name || '?')[0].toUpperCase()}
          </span>
          <span className="user-name-mini">{state.currentUser.name}</span>
        </div>

        <button className="btn-icon theme-btn" onClick={toggleTheme} title="Toggle theme">
          {state.theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {showNotif && (
        <div className="notif-overlay" onClick={() => setShowNotif(false)}>
          <div className="notif-panel" onClick={e => e.stopPropagation()}>
            <div className="notif-panel-header">
              <h3>Notifications</h3>
              {state.notifications.length > 0 && (
                <button className="btn btn-sm btn-ghost"
                  onClick={() => { dispatch({ type: 'CLEAR_NOTIFICATIONS' }); setShowNotif(false) }}>
                  Clear
                </button>
              )}
            </div>
            {state.notifications.length === 0 ? (
              <p className="empty-hint">No notifications yet.</p>
            ) : (
              <div className="notif-list">
                {state.notifications.map(n => (
                  <div key={n.id}
                    className={`notif-item ${n.read ? 'read' : 'unread'}`}
                    onClick={() => dispatch({ type: 'MARK_NOTIFICATION_READ', id: n.id })}>
                    <div className="notif-msg">{n.message}</div>
                    <div className="notif-meta">
                      <span>{n.from}</span>
                      <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showUser && (
        <div className="user-modal-overlay" onClick={() => setShowUser(false)}>
          <div className="user-modal" onClick={e => e.stopPropagation()}>
            <h3>{state.currentUser.name}</h3>
            {state.currentUser.role && <p className="user-modal-hint">{state.currentUser.role}</p>}
            <div className="user-modal-actions">
              <button className="btn btn-ghost" onClick={handleLogout}>Switch User</button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
