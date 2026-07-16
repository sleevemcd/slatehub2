import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { AppState, ShotRecord, Take, SortKey, ViewState, TeleprompterConfig, TeleprompterState, Theme, Project, Layout, GroupBy, User, CrewMember, Notification, TeleprompterMarker } from '../types'
import { fetchSheetCsv } from '../utils/sheet'
import { parseCSV, rowsToShotRecords } from '../utils/csv'

const API_BASE = window.location.origin + '/api'

async function loadFromApi(): Promise<Partial<AppState> | null> {
  try {
    const res = await fetch(`${API_BASE}/data`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function saveToApi(state: Partial<AppState>) {
  try {
    await fetch(`${API_BASE}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
  } catch { /* silent fail — fallback to localStorage */ }
}

type Action =
  | { type: 'SET_VIEW'; view: ViewState }
  | { type: 'SET_SHEET_URL'; url: string }
  | { type: 'SET_WRITE_BACK_URL'; url: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_SHOTS'; shots: ShotRecord[] }
  | { type: 'SET_ACTIVE_SHOT'; shot: ShotRecord | null }
  | { type: 'SET_ACTIVE_TAKE'; take: number }
  | { type: 'SET_FILTER'; key: string; value: string }
  | { type: 'SET_SEARCH'; value: string }
  | { type: 'SET_SORT'; key: SortKey }
  | { type: 'TOGGLE_SORT_ASC' }
  | { type: 'TOGGLE_SHOT_DONE'; row: number }
  | { type: 'SET_SHOT_PRIORITY'; row: number; priority: string }
  | { type: 'ADD_SHOT'; shot: ShotRecord }
  | { type: 'ADD_TAKE'; take: Take }
  | { type: 'MARK_TAKE_GOOD'; takeId: string; good: boolean }
  | { type: 'MARK_TAKE_CIRCLED'; takeId: string; circled: boolean }
  | { type: 'SET_TAKE_NOTES'; takeId: string; notes: string }
  | { type: 'UPDATE_TAKE'; id: string; data: Partial<Take> }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'SET_TELEPROMPTER_CONFIG'; config: Partial<TeleprompterConfig> }
  | { type: 'SET_TELEPROMPTER_STATE'; state: Partial<TeleprompterState> }
  | { type: 'SET_USER'; user: User }
  | { type: 'LOGIN'; user: User }
  | { type: 'SET_LAYOUT'; layout: Layout }
  | { type: 'SET_GROUP_BY'; groupBy: GroupBy }
  | { type: 'SET_TIMECODE'; timecode: string }
  | { type: 'SET_SHOW_REF'; show: boolean }
  | { type: 'SET_QUICK_MESSAGES'; messages: string[] }
  | { type: 'ADD_MARKER'; marker: TeleprompterMarker }
  | { type: 'REMOVE_MARKER'; id: string }
  | { type: 'CREATE_PROJECT'; project: Project }
  | { type: 'UPDATE_PROJECT'; id: string; data: Partial<Project> }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'SET_ACTIVE_PROJECT'; id: string | null }
  | { type: 'LOAD_PROJECT_DATA'; shots: ShotRecord[]; takes: Take[]; sheetUrl: string; writeBackUrl: string; teleprompter: TeleprompterConfig }
  | { type: 'SET_SHOT_CREW'; row: number; crew: string[] }
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'ADD_SAVED_USER'; user: User }
  | { type: 'ADD_CREW_MEMBER'; member: CrewMember }
  | { type: 'REMOVE_CREW_MEMBER'; name: string }
  | { type: 'UPDATE_CREW_MEMBER'; name: string; data: Partial<CrewMember> }
  | { type: 'ADD_NOTIFICATION'; notification: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'DELETE_SHOT'; row: number }
  | { type: 'DELETE_SHOTS'; rows: number[] }
  | { type: 'UPDATE_SHOT_ORDER'; rows: { row: number; shootOrder: string }[] }

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

const defaultTeleprompterConfig: TeleprompterConfig = {
  docUrl: '', sessionId: '', relayUrl: '',
}

const defaultTeleprompterState: TeleprompterState = {
  scrollPosition: 0, speed: 5, playing: false, lastUpdate: '', markers: [],
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('slatehub-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem('slatehub-projects')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem('slatehub-projects', JSON.stringify(projects))
}

function getLastProjectId(): string | null {
  return localStorage.getItem('slatehub-active-project')
}

function crewStorageKey(projectId: string | null): string {
  return `slatehub-crew-${projectId || 'default'}`
}

function saveCrewData(projectId: string | null, shots: ShotRecord[], members: CrewMember[]) {
  localStorage.setItem(crewStorageKey(projectId), JSON.stringify({ shots: shots.map(s => ({ row: s.row, crew: s.crew })), members }))
}

function loadSavedUsers(): User[] {
  try {
    const raw = localStorage.getItem('slatehub-saved-users')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSavedUsers(users: User[]) {
  localStorage.setItem('slatehub-saved-users', JSON.stringify(users))
}

function loadCrewData(projectId: string | null): { shotCrew: Record<number, string[]>; members: CrewMember[] } {
  try {
    const raw = localStorage.getItem(crewStorageKey(projectId))
    if (raw) {
      const data = JSON.parse(raw)
      return {
        shotCrew: Object.fromEntries((data.shots || []).map((s: { row: number; crew: string[] }) => [s.row, s.crew])),
        members: data.members || [],
      }
    }
  } catch {}
  return { shotCrew: {}, members: [] }
}

const initialState: AppState = {
  theme: getInitialTheme(),
  view: 'setup',
  projects: loadProjects(),
  activeProjectId: getLastProjectId(),
  sheetUrl: '',
  shots: [],
  takes: [],
  activeShot: null,
  activeTake: 1,
  currentUser: { name: '', role: '' },
  savedUsers: loadSavedUsers(),
  crewMembers: [],
  notifications: [],
  loading: false,
  error: null,
  filters: { type: '', location: '', status: '', search: '', crew: '', priority: '' },
  sortKey: 'shootOrder',
  sortAsc: true,
  layout: 'grid',
  groupBy: '',
  timecode: '',
  showRef: false,
  quickMessages: ['Heads up — next shot soon', 'On deck — get ready', 'Lunch in 15', 'Wrapped for today'],
  writeBackUrl: '',
  teleprompter: defaultTeleprompterConfig,
  teleprompterState: defaultTeleprompterState,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW': return { ...state, view: action.view }
    case 'SET_SHEET_URL': return { ...state, sheetUrl: action.url }
    case 'SET_WRITE_BACK_URL': return { ...state, writeBackUrl: action.url }
    case 'SET_LOADING': return { ...state, loading: action.loading }
    case 'SET_ERROR': return { ...state, error: action.error }
    case 'SET_SHOTS': return { ...state, shots: action.shots }
    case 'SET_ACTIVE_SHOT': return { ...state, activeShot: action.shot }
    case 'SET_ACTIVE_TAKE': return { ...state, activeTake: action.take }
    case 'SET_FILTER':
      return { ...state, filters: { ...state.filters, [action.key]: action.value } }
    case 'SET_SEARCH':
      return { ...state, filters: { ...state.filters, search: action.value } }
    case 'SET_SORT': return { ...state, sortKey: action.key }
    case 'TOGGLE_SORT_ASC': return { ...state, sortAsc: !state.sortAsc }
    case 'TOGGLE_SHOT_DONE':
      return {
        ...state,
        shots: state.shots.map(s =>
          s.row === action.row ? { ...s, done: !s.done } : s
        ),
      }
    case 'SET_SHOT_PRIORITY':
      return {
        ...state,
        shots: state.shots.map(s =>
          s.row === action.row ? { ...s, priority: action.priority } : s
        ),
      }
    case 'ADD_SHOT':
      return { ...state, shots: [...state.shots, action.shot] }
    case 'DELETE_SHOT':
      return { ...state, shots: state.shots.filter(s => s.row !== action.row) }
    case 'DELETE_SHOTS':
      return { ...state, shots: state.shots.filter(s => !action.rows.includes(s.row)) }
    case 'UPDATE_SHOT_ORDER':
      return {
        ...state,
        shots: state.shots.map(s => {
          const update = action.rows.find(u => u.row === s.row)
          return update ? { ...s, shootOrder: update.shootOrder } : s
        }),
      }
    case 'ADD_TAKE':
      return { ...state, takes: [...state.takes, action.take] }
    case 'MARK_TAKE_GOOD':
      return {
        ...state,
        takes: state.takes.map(t =>
          t.id === action.takeId ? { ...t, good: action.good } : t
        ),
      }
    case 'MARK_TAKE_CIRCLED':
      return {
        ...state,
        takes: state.takes.map(t =>
          t.id === action.takeId ? { ...t, circled: action.circled } : t
        ),
      }
    case 'SET_TAKE_NOTES':
      return {
        ...state,
        takes: state.takes.map(t =>
          t.id === action.takeId ? { ...t, notes: action.notes } : t
        ),
      }
    case 'UPDATE_TAKE':
      return {
        ...state,
        takes: state.takes.map(t =>
          t.id === action.id ? { ...t, ...action.data } : t
        ),
      }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_TELEPROMPTER_CONFIG':
      return { ...state, teleprompter: { ...state.teleprompter, ...action.config } }
    case 'SET_TELEPROMPTER_STATE':
      return {
        ...state,
        teleprompterState: { ...state.teleprompterState, ...action.state, lastUpdate: new Date().toISOString() },
      }
    case 'SET_USER':
      return { ...state, currentUser: action.user }
    case 'LOGIN': {
      const exists = state.savedUsers.find(u => u.name === action.user.name)
      const saved = exists ? state.savedUsers : [...state.savedUsers, action.user]
      saveSavedUsers(saved)
      const crewExists = state.crewMembers.find(m => m.name === action.user.name)
      const updatedCrew = crewExists
        ? state.crewMembers.map(m => m.name === action.user.name ? { ...m, role: action.user.role, active: true } : m)
        : [...state.crewMembers, { name: action.user.name, role: action.user.role, active: true }]
      return { ...state, currentUser: action.user, savedUsers: saved, crewMembers: updatedCrew }
    }
    case 'SET_LAYOUT':
      return { ...state, layout: action.layout }
    case 'SET_GROUP_BY':
      return { ...state, groupBy: action.groupBy }
    case 'SET_TIMECODE':
      return { ...state, timecode: action.timecode }
    case 'SET_SHOW_REF':
      return { ...state, showRef: action.show }
    case 'SET_QUICK_MESSAGES':
      return { ...state, quickMessages: action.messages }
    case 'ADD_MARKER':
      return {
        ...state,
        teleprompterState: {
          ...state.teleprompterState,
          markers: [...state.teleprompterState.markers, action.marker],
        },
      }
    case 'REMOVE_MARKER':
      return {
        ...state,
        teleprompterState: {
          ...state.teleprompterState,
          markers: state.teleprompterState.markers.filter(m => m.id !== action.id),
        },
      }
    case 'CREATE_PROJECT':
      return { ...state, projects: [...state.projects, action.project] }
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.id ? { ...p, ...action.data } : p
        ),
      }
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.id),
        activeProjectId: state.activeProjectId === action.id ? null : state.activeProjectId,
        shots: state.activeProjectId === action.id ? [] : state.shots,
        takes: state.activeProjectId === action.id ? [] : state.takes,
      }
    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id }
    case 'LOAD_PROJECT_DATA':
      return {
        ...state,
        shots: action.shots,
        takes: action.takes,
        sheetUrl: action.sheetUrl,
        writeBackUrl: action.writeBackUrl,
        teleprompter: action.teleprompter,
      }
    case 'SET_SHOT_CREW':
      return {
        ...state,
        shots: state.shots.map(s =>
          s.row === action.row ? { ...s, crew: action.crew } : s
        ),
      }
    case 'SET_PROJECTS':
      return { ...state, projects: action.projects }
    case 'ADD_SAVED_USER':
      return { ...state, savedUsers: [...state.savedUsers.filter(u => u.name !== action.user.name), action.user] }
    case 'ADD_CREW_MEMBER':
      return { ...state, crewMembers: [...state.crewMembers, action.member] }
    case 'REMOVE_CREW_MEMBER':
      return { ...state, crewMembers: state.crewMembers.filter(m => m.name !== action.name) }
    case 'UPDATE_CREW_MEMBER':
      return {
        ...state,
        crewMembers: state.crewMembers.map(m =>
          m.name === action.name ? { ...m, ...action.data } : m
        ),
      }
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.notification, ...state.notifications] }
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      }
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] }
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<Action>
  loadShots: (url: string) => Promise<void>
  openSlate: (shot: ShotRecord) => void
  closeSlate: () => void
  goToView: (view: ViewState) => void
  goToNextShot: () => void
  goToPrevShot: () => void
  recordTake: (good: boolean) => void
  updateTake: (id: string, data: Partial<Take>) => void
  toggleDone: (row: number) => void
  setShotPriority: (row: number, priority: string) => void
  deleteShot: (row: number) => void
  deleteShots: (rows: number[]) => void
  reorderShots: (sorted: ShotRecord[]) => void
  toggleTheme: () => void
  createProject: (name: string, sheetUrl: string, docUrl?: string, relayUrl?: string, group?: string, groupColor?: string) => Promise<void>
  switchProject: (id: string) => Promise<void>
  deleteProject: (id: string) => void
  updateProject: (id: string, data: Partial<Project>) => void
  activeProject: Project | null
  login: (user: User) => void
  updateShotCrew: (row: number, crew: string[]) => void
  addCrewMember: (member: CrewMember) => void
  removeCrewMember: (name: string) => void
  updateCrewMember: (name: string, data: Partial<CrewMember>) => void
  addNotification: (message: string, shotId?: number) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  triggerOnDeck: (shot: ShotRecord) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadShots = useCallback(async (url: string) => {
    dispatch({ type: 'SET_LOADING', loading: true })
    dispatch({ type: 'SET_ERROR', error: null })
    try {
      const csvUrl = url.includes('export?format=csv') ? url : `${url.replace(/\/edit.*$/, '')}/export?format=csv`
      const text = await fetchSheetCsv(csvUrl)
      const { headers, rows } = parseCSV(text)
      const shots = rowsToShotRecords(headers, rows)
      dispatch({ type: 'SET_SHOTS', shots })
      dispatch({ type: 'SET_SHEET_URL', url })
      dispatch({ type: 'SET_VIEW', view: 'shots' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'SET_ERROR', error: msg })
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }, [])

  const createProject = useCallback(async (name: string, sheetUrl: string, docUrl = '', relayUrl = '', group = '', groupColor = '#6366f1') => {
    const project: Project = {
      id: generateId(),
      name,
      group,
      groupColor,
      sheetUrl,
      docUrl,
      relayUrl,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'CREATE_PROJECT', project })
    dispatch({ type: 'SET_ACTIVE_PROJECT', id: project.id })
    dispatch({ type: 'SET_TELEPROMPTER_CONFIG', config: { docUrl, relayUrl } })
    dispatch({ type: 'SET_WRITE_BACK_URL', url: relayUrl })
    localStorage.setItem('slatehub-active-project', project.id)
    const projects = [...state.projects, project]
    saveProjects(projects)
    await loadShots(sheetUrl)
  }, [state.projects, loadShots])

  const switchProject = useCallback(async (id: string) => {
    const project = state.projects.find(p => p.id === id)
    if (!project) return
    dispatch({ type: 'SET_ACTIVE_PROJECT', id })
    dispatch({ type: 'SET_TELEPROMPTER_CONFIG', config: { docUrl: project.docUrl, relayUrl: project.relayUrl, sessionId: '' } })
    dispatch({ type: 'SET_WRITE_BACK_URL', url: project.relayUrl })
    dispatch({ type: 'SET_VIEW', view: 'shots' })
    localStorage.setItem('slatehub-active-project', id)
    if (project.sheetUrl) {
      await loadShots(project.sheetUrl)
    }
  }, [state.projects, loadShots])

  const deleteProject = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PROJECT', id })
    const projects = state.projects.filter(p => p.id !== id)
    saveProjects(projects)
    if (state.activeProjectId === id) {
      localStorage.removeItem('slatehub-active-project')
      dispatch({ type: 'SET_VIEW', view: 'project-manager' })
    }
  }, [state.projects, state.activeProjectId])

  const updateProject = useCallback((id: string, data: Partial<Project>) => {
    dispatch({ type: 'UPDATE_PROJECT', id, data })
    const projects = state.projects.map(p => p.id === id ? { ...p, ...data } : p)
    saveProjects(projects)
  }, [state.projects])

  const activeProject = state.projects.find(p => p.id === state.activeProjectId) || null

  const openSlate = useCallback((shot: ShotRecord) => {
    dispatch({ type: 'SET_ACTIVE_SHOT', shot })
    dispatch({ type: 'SET_ACTIVE_TAKE', take: 1 })
    dispatch({ type: 'SET_VIEW', view: 'slate' })
  }, [])

  const closeSlate = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_SHOT', shot: null })
    dispatch({ type: 'SET_VIEW', view: 'shots' })
  }, [])

  const recordTake = useCallback((good: boolean) => {
    if (!state.activeShot) return
    const take: Take = {
      id: `${state.activeShot.row}-${state.activeTake}-${Date.now()}`,
      shotRow: state.activeShot.row,
      takeNumber: state.activeTake,
      good,
      circled: false,
      notes: '',
      timestamp: new Date().toISOString(),
      user: state.currentUser.name || 'Anonymous',
      timecode: state.timecode,
    }
    dispatch({ type: 'ADD_TAKE', take })
    dispatch({ type: 'SET_ACTIVE_TAKE', take: state.activeTake + 1 })
  }, [state.activeShot, state.activeTake, state.currentUser.name, state.timecode])

  const toggleDone = useCallback((row: number) => {
    dispatch({ type: 'TOGGLE_SHOT_DONE', row })
  }, [])

  const setShotPriority = useCallback((row: number, priority: string) => {
    dispatch({ type: 'SET_SHOT_PRIORITY', row, priority })
  }, [])

  const deleteShot = useCallback((row: number) => {
    dispatch({ type: 'DELETE_SHOT', row })
  }, [])

  const deleteShots = useCallback((rows: number[]) => {
    dispatch({ type: 'DELETE_SHOTS', rows })
  }, [])

  const reorderShots = useCallback((sorted: ShotRecord[]) => {
    const updates = sorted.map((s, i) => ({ row: s.row, shootOrder: String(i + 1) }))
    dispatch({ type: 'UPDATE_SHOT_ORDER', rows: updates })
  }, [])

  const toggleTheme = useCallback(() => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    dispatch({ type: 'SET_THEME', theme: next })
    localStorage.setItem('slatehub-theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
  }, [state.theme])

  const login = useCallback((user: User) => {
    dispatch({ type: 'LOGIN', user })
    dispatch({ type: 'SET_VIEW', view: state.activeProjectId ? 'shots' : 'project-manager' })
  }, [state.activeProjectId])

  const goToView = useCallback((view: ViewState) => {
    dispatch({ type: 'SET_VIEW', view })
  }, [])

  const goToNextShot = useCallback(() => {
    if (!state.activeShot) return
    const sorted = [...state.shots].sort((a, b) => (parseInt(a.shootOrder) || 0) - (parseInt(b.shootOrder) || 0))
    const idx = sorted.findIndex(s => s.row === state.activeShot!.row)
    if (idx < sorted.length - 1) {
      dispatch({ type: 'SET_ACTIVE_SHOT', shot: sorted[idx + 1] })
      dispatch({ type: 'SET_ACTIVE_TAKE', take: 1 })
    }
  }, [state.shots, state.activeShot])

  const goToPrevShot = useCallback(() => {
    if (!state.activeShot) return
    const sorted = [...state.shots].sort((a, b) => (parseInt(a.shootOrder) || 0) - (parseInt(b.shootOrder) || 0))
    const idx = sorted.findIndex(s => s.row === state.activeShot!.row)
    if (idx > 0) {
      dispatch({ type: 'SET_ACTIVE_SHOT', shot: sorted[idx - 1] })
      dispatch({ type: 'SET_ACTIVE_TAKE', take: 1 })
    }
  }, [state.shots, state.activeShot])

  const updateTake = useCallback((id: string, data: Partial<Take>) => {
    dispatch({ type: 'UPDATE_TAKE', id, data })
  }, [])

  const updateShotCrew = useCallback((row: number, crew: string[]) => {
    dispatch({ type: 'SET_SHOT_CREW', row, crew })
    saveCrewData(state.activeProjectId, state.shots.map(s => s.row === row ? { ...s, crew } : s), state.crewMembers)
  }, [state.activeProjectId, state.shots, state.crewMembers])

  const addCrewMember = useCallback((member: CrewMember) => {
    dispatch({ type: 'ADD_CREW_MEMBER', member })
    saveCrewData(state.activeProjectId, state.shots, [...state.crewMembers, member])
  }, [state.activeProjectId, state.shots, state.crewMembers])

  const removeCrewMember = useCallback((name: string) => {
    dispatch({ type: 'REMOVE_CREW_MEMBER', name })
    saveCrewData(state.activeProjectId, state.shots, state.crewMembers.filter(m => m.name !== name))
  }, [state.activeProjectId, state.shots, state.crewMembers])

  const updateCrewMember = useCallback((name: string, data: Partial<CrewMember>) => {
    dispatch({ type: 'UPDATE_CREW_MEMBER', name, data })
    saveCrewData(state.activeProjectId, state.shots, state.crewMembers.map(m => m.name === name ? { ...m, ...data } : m))
  }, [state.activeProjectId, state.shots, state.crewMembers])

  const addNotification = useCallback((message: string, shotId?: number) => {
    const notification: Notification = {
      id: generateId(),
      message,
      shotId,
      from: state.currentUser.name || 'System',
      timestamp: new Date().toISOString(),
      read: false,
    }
    dispatch({ type: 'ADD_NOTIFICATION', notification })
  }, [state.currentUser.name])

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', id })
  }, [])

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' })
  }, [])

  const triggerOnDeck = useCallback((shot: ShotRecord) => {
    if (!shot.crew || shot.crew.length === 0) return
    const relayUrl = state.writeBackUrl || state.teleprompter.relayUrl
    if (relayUrl) {
      fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ondeck',
          shot: shot.shootOrder,
          description: shot.description,
          needs: shot.crew,
          from: state.currentUser.name,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {})
    }
    addNotification(`On deck: ${shot.description} (needs ${shot.crew.join(', ')})`, shot.row)
  }, [state.writeBackUrl, state.teleprompter.relayUrl, state.currentUser.name, addNotification])

  useEffect(() => {
    document.documentElement.classList.toggle('light', state.theme === 'light')
  }, [state.theme])

  useEffect(() => {
    if (state.shots.length > 0) {
      const crewData = loadCrewData(state.activeProjectId)
      if (crewData.members.length > 0 && state.crewMembers.length === 0) {
        crewData.members.forEach(m => dispatch({ type: 'ADD_CREW_MEMBER', member: m }))
      }
      if (Object.keys(crewData.shotCrew).length > 0) {
        Object.entries(crewData.shotCrew).forEach(([rowStr, crew]) => {
          const row = Number(rowStr)
          if (!state.shots.find(s => s.row === row)?.crew?.length) {
            dispatch({ type: 'SET_SHOT_CREW', row, crew })
          }
        })
      }
    }
  }, [state.shots.length, state.activeProjectId])

  useEffect(() => {
    if (state.projects.length > 0 && state.activeProjectId) {
      dispatch({ type: 'SET_VIEW', view: 'shots' })
    } else if (state.projects.length === 0) {
      dispatch({ type: 'SET_VIEW', view: 'setup' })
    }
  }, [])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const prevSaveRef = useRef('')
  useEffect(() => {
    const snapshot = JSON.stringify({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      crewMembers: state.crewMembers,
      quickMessages: state.quickMessages,
      savedUsers: state.savedUsers,
      theme: state.theme,
    })
    if (snapshot === prevSaveRef.current) return
    prevSaveRef.current = snapshot
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveToApi(JSON.parse(snapshot)), 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [state.projects, state.activeProjectId, state.crewMembers, state.quickMessages, state.savedUsers, state.theme])

  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadFromApi().then(apiData => {
      if (!apiData) return
      if (apiData.projects && apiData.projects.length > 0) {
        dispatch({ type: 'SET_PROJECTS', projects: apiData.projects })
      }
      if (apiData.activeProjectId) {
        dispatch({ type: 'SET_ACTIVE_PROJECT', id: apiData.activeProjectId })
      }
      if (apiData.crewMembers) {
        apiData.crewMembers.forEach(m => dispatch({ type: 'ADD_CREW_MEMBER', member: m }))
      }
      if (apiData.savedUsers) {
        apiData.savedUsers.forEach(u => dispatch({ type: 'ADD_SAVED_USER', user: u }))
      }
      if (apiData.quickMessages) {
        dispatch({ type: 'SET_QUICK_MESSAGES', messages: apiData.quickMessages })
      }
      if (apiData.theme) {
        dispatch({ type: 'SET_THEME', theme: apiData.theme })
      }
    })
  }, [])

  return (
    <AppContext.Provider value={{
      state, dispatch, loadShots, openSlate, closeSlate, goToView, goToNextShot, goToPrevShot,
      recordTake, updateTake, toggleDone, setShotPriority, deleteShot, deleteShots, reorderShots,
      toggleTheme, createProject, switchProject, deleteProject, updateProject, activeProject, login,
      updateShotCrew, addCrewMember, removeCrewMember, updateCrewMember,
      addNotification, markNotificationRead, clearNotifications, triggerOnDeck,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
