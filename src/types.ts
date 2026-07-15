export interface Project {
  id: string
  name: string
  sheetUrl: string
  docUrl: string
  relayUrl: string
  createdAt: string
}

export interface CrewMember {
  name: string
  role: string
  active: boolean
}

export interface Notification {
  id: string
  message: string
  shotId?: number
  from: string
  timestamp: string
  read: boolean
}

export interface ShotRecord {
  row: number
  type: string
  description: string
  subShot: string
  location: string
  setup: string
  notes: string
  referenceLink: string
  shootDay: string
  shootOrder: string
  done: boolean
  crew: string[]
}

export interface Take {
  id: string
  shotRow: number
  takeNumber: number
  good: boolean
  circled: boolean
  notes: string
  timestamp: string
  user: string
  timecode: string
}

export type SortKey = 'shootOrder' | 'type' | 'location' | 'description' | 'shootDay'
export type ViewState = 'setup' | 'shots' | 'slate' | 'dashboard' | 'crew' | 'teleprompter-setup' | 'teleprompter-view' | 'teleprompter-remote' | 'project-manager' | 'script-review'

export interface TeleprompterConfig {
  docUrl: string
  sessionId: string
  relayUrl: string
}

export interface TeleprompterMarker {
  id: string
  label: string
  scrollPosition: number
}

export interface TeleprompterState {
  scrollPosition: number
  speed: number
  playing: boolean
  lastUpdate: string
  markers: TeleprompterMarker[]
}

export type Theme = 'dark' | 'light'

export type Layout = 'grid' | 'list'
export type GroupBy = '' | 'type' | 'location' | 'shootDay'

export interface User {
  name: string
  role: string
}

export interface AppState {
  theme: Theme
  view: ViewState
  projects: Project[]
  activeProjectId: string | null
  sheetUrl: string
  shots: ShotRecord[]
  takes: Take[]
  activeShot: ShotRecord | null
  activeTake: number
  currentUser: User
  savedUsers: User[]
  loading: boolean
  error: string | null
  crewMembers: CrewMember[]
  notifications: Notification[]
  filters: {
    type: string
    location: string
    status: '' | 'done' | 'pending'
    search: string
    crew: string
  }
  sortKey: SortKey
  sortAsc: boolean
  layout: Layout
  groupBy: GroupBy
  timecode: string
  showRef: boolean
  quickMessages: string[]
  writeBackUrl: string
  teleprompter: TeleprompterConfig
  teleprompterState: TeleprompterState
}
