import { useApp } from '../context/AppContext'
import type { SortKey } from '../types'
import { PRIORITIES } from '../types'

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'shootOrder', label: 'Order' },
  { key: 'priority', label: 'Priority' },
  { key: 'type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'description', label: 'Description' },
  { key: 'shootDay', label: 'Day' },
]

const groupOptions: { key: '' | 'type' | 'location' | 'shootDay' | 'priority'; label: string }[] = [
  { key: '', label: 'No Group' },
  { key: 'priority', label: 'By Priority' },
  { key: 'type', label: 'By Type' },
  { key: 'location', label: 'By Location' },
  { key: 'shootDay', label: 'By Day' },
]

export function FilterBar() {
  const { state, dispatch } = useApp()
  const { shots, filters } = state

  const types = [...new Set(shots.map(s => s.type).filter(Boolean))].sort()
  const locations = [...new Set(shots.map(s => s.location).filter(Boolean))].sort()
  const crewRoles = [...new Set(shots.flatMap(s => s.crew || []).filter(Boolean))].sort()

  return (
    <div className="filter-bar">
      <div className="filter-row filter-row-main">
        <input
          className="filter-search"
          type="text"
          placeholder="Search shots..."
          value={filters.search}
          onChange={e => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
        />

        <select
          className="filter-select"
          value={filters.type}
          onChange={e => dispatch({ type: 'SET_FILTER', key: 'type', value: e.target.value })}
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          className="filter-select"
          value={filters.location}
          onChange={e => dispatch({ type: 'SET_FILTER', key: 'location', value: e.target.value })}
        >
          <option value="">All Locations</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          className="filter-select"
          value={filters.status}
          onChange={e => dispatch({ type: 'SET_FILTER', key: 'status', value: e.target.value })}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div className="filter-row filter-row-secondary">
        {crewRoles.length > 0 && (
          <select className="filter-select"
            value={filters.crew}
            onChange={e => dispatch({ type: 'SET_FILTER', key: 'crew', value: e.target.value })}
          >
            <option value="">All Crew Needs</option>
            {crewRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}

        <select className="filter-select"
          value={filters.priority}
          onChange={e => dispatch({ type: 'SET_FILTER', key: 'priority', value: e.target.value })}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select
          className="filter-select"
          value={state.groupBy}
          onChange={e => dispatch({ type: 'SET_GROUP_BY', groupBy: e.target.value as typeof state.groupBy })}
        >
          {groupOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <select
          className="filter-select"
          value={state.sortKey}
          onChange={e => dispatch({ type: 'SET_SORT', key: e.target.value as SortKey })}
        >
          {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <button
          className="btn-icon sort-btn"
          onClick={() => dispatch({ type: 'TOGGLE_SORT_ASC' })}
          title={state.sortAsc ? 'Ascending' : 'Descending'}
        >
          {state.sortAsc ? '↑' : '↓'}
        </button>

        <button className="btn-icon sort-btn"
          onClick={() => {
            dispatch({ type: 'SET_FILTER', key: 'type', value: '' })
            dispatch({ type: 'SET_FILTER', key: 'location', value: '' })
            dispatch({ type: 'SET_FILTER', key: 'status', value: '' })
            dispatch({ type: 'SET_FILTER', key: 'crew', value: '' })
            dispatch({ type: 'SET_FILTER', key: 'priority', value: '' })
            dispatch({ type: 'SET_SEARCH', value: '' })
          }}
          title="Clear all filters">✕</button>

        <div className="layout-toggle">
          <button
            className={`layout-btn ${state.layout === 'grid' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_LAYOUT', layout: 'grid' })}
            title="Grid view"
          >▦</button>
          <button
            className={`layout-btn ${state.layout === 'list' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_LAYOUT', layout: 'list' })}
            title="List view"
          >≡</button>
        </div>
      </div>
    </div>
  )
}
