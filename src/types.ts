export interface Project {
  id: string
  name: string
  group: string
  groupColor: string
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
  priority: string
  graphic: string
  title: string
  effect: string
}

export type Priority = 'must-have' | 'nice-to-have' | 'b-roll' | ''

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'must-have', label: 'Must-Have', color: '#e74c3c' },
  { value: 'nice-to-have', label: 'Nice-to-Have', color: '#f39c12' },
  { value: 'b-roll', label: 'B-Roll', color: '#7f8c8d' },
]

export function getPriorityStyle(priority: string): { label: string; color: string } {
  const p = PRIORITIES.find(p => p.value === priority)
  return p ? { label: p.label, color: p.color } : { label: '', color: '' }
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

export type SortKey = 'shootOrder' | 'type' | 'location' | 'description' | 'shootDay' | 'priority'
export type ViewState = 'setup' | 'shots' | 'slate' | 'dashboard' | 'crew' | 'teleprompter-setup' | 'teleprompter-view' | 'teleprompter-remote' | 'project-manager' | 'script-review' | 'shoot-schedule'

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
export type GroupBy = '' | 'type' | 'location' | 'shootDay' | 'priority'

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
    priority: string
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
