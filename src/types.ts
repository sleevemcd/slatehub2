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
  duration: string
  roll: string
  scene: string
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
export type ViewState = 'setup' | 'shots' | 'slate' | 'dashboard' | 'crew' | 'teleprompter-setup' | 'teleprompter-view' | 'teleprompter-remote' | 'project-manager' | 'script-review' | 'shoot-schedule' | 'highlights' | 'remove-highlights' | 'markers'

export interface TeleprompterConfig {
  docUrl: string
  sessionId: string
  relayUrl: string
  googleApiKey: string
  googleClientId: string
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

export interface ScriptHighlight {
  id: string
  paragraphIndex: number
  text: string
  color: string
  shotId: number | null
  createdAt: string
  startOffset: number
  endOffset: number
  note: string
}

export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffe600' },
  { name: 'Orange', value: '#ff9f00' },
  { name: 'Green', value: '#4caf50' },
  { name: 'Blue', value: '#42a5f5' },
  { name: 'Pink', value: '#ec407a' },
  { name: 'Purple', value: '#ab47bc' },
  { name: 'Red', value: '#ef5350' },
]

export interface ShotMarker {
  id: string
  projectId: string | null
  timecode: string
  color: string
  markerType: string
  note: string
  shotId: number | null
  createdAt: string
  rangeEnd: string
}

export interface MarkerSession {
  id: string
  name: string
  type: 'time-of-day' | 'rec-run'
  startedAt: string
  endedAt: string | null
  markerCount: number
  cameraBrand: string
  cameraModel: string
}

export const MARKER_PRESETS = [
  { name: 'Good Take', color: '#4caf50', icon: '✓' },
  { name: 'Highlight', color: '#ffe600', icon: '★' },
  { name: 'Mistake', color: '#ef5350', icon: '✗' },
  { name: 'Cut Point', color: '#42a5f5', icon: '✂' },
  { name: 'Note to Self', color: '#ab47bc', icon: '📝' },
  { name: 'Audio Issue', color: '#ff9800', icon: '🎤' },
  { name: 'Lighting', color: '#ff9f00', icon: '💡' },
  { name: 'Custom', color: '#78909c', icon: '●' },
]

export type Theme = 'dark' | 'light'

export type Layout = 'grid' | 'list'
export type GroupBy = '' | 'type' | 'location' | 'shootDay' | 'priority' | 'highlight' | 'scene'

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
  highlights: ScriptHighlight[]
  markers: ShotMarker[]
  sessions: MarkerSession[]
  sessionActive: boolean
  scriptContent: string
}
