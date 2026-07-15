import { AppProvider, useApp } from './context/AppContext'
import { Header } from './components/Header'
import { SetupView } from './components/SetupView'
import { ShotList } from './components/ShotList'
import { SlateView } from './components/SlateView'
import { Dashboard } from './components/Dashboard'
import { TeleprompterSetup } from './components/TeleprompterSetup'
import { TeleprompterView } from './components/TeleprompterView'
import { TeleprompterRemote } from './components/TeleprompterRemote'
import { ProjectManager } from './components/ProjectManager'
import { CrewView } from './components/CrewView'
import { LoginView } from './components/LoginView'
import { ScriptReview } from './components/ScriptReview'
import './App.css'

function AppContent() {
  const { state } = useApp()

  if (!state.currentUser.name) {
    return (
      <div className="app">
        <LoginView />
      </div>
    )
  }

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        {state.view === 'project-manager' && <ProjectManager />}
        {state.view === 'setup' && <SetupView />}
        {state.view === 'crew' && <CrewView />}
        {state.view === 'shots' && <ShotList />}
        {state.view === 'slate' && <SlateView />}
        {state.view === 'dashboard' && <Dashboard />}
        {state.view === 'teleprompter-setup' && <TeleprompterSetup />}
        {state.view === 'teleprompter-view' && <TeleprompterView />}
        {state.view === 'teleprompter-remote' && <TeleprompterRemote />}
        {state.view === 'script-review' && <ScriptReview />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
