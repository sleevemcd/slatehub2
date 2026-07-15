import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { FilterBar } from './FilterBar'
import { ShotCard } from './ShotCard'

export function ShotList() {
  const { state, dispatch, openSlate, toggleDone } = useApp()

  const { filtered, groups } = useMemo(() => {
    let result = [...state.shots]
    const { type, location, status, search } = state.filters

    if (type) result = result.filter(s => s.type === type)
    if (location) result = result.filter(s => s.location === location)
    if (status === 'done') result = result.filter(s => s.done)
    if (status === 'pending') result = result.filter(s => !s.done)
    if (state.filters.crew) result = result.filter(s => s.crew?.includes(state.filters.crew))
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.description.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      )
    }

    const { sortKey, sortAsc } = state
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'shootOrder':
          cmp = (parseInt(a.shootOrder) || 0) - (parseInt(b.shootOrder) || 0)
          break
        case 'type': cmp = a.type.localeCompare(b.type); break
        case 'location': cmp = a.location.localeCompare(b.location); break
        case 'description': cmp = a.description.localeCompare(b.description); break
        case 'shootDay': cmp = a.shootDay.localeCompare(b.shootDay); break
      }
      return sortAsc ? cmp : -cmp
    })

    let groups: { label: string; shots: typeof result }[] = []
    if (state.groupBy) {
      const map = new Map<string, typeof result>()
      for (const s of result) {
        const key = s[state.groupBy] || '(none)'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(s)
      }
      groups = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, shots]) => ({ label, shots }))
    }

    return { filtered: result, groups }
  }, [state.shots, state.filters, state.sortKey, state.sortAsc, state.groupBy])

  const allRoles = [...new Set(state.shots.flatMap(s => s.crew || []).filter(Boolean))].sort()
  const hasCrewData = allRoles.length > 0

  const getTakeCount = (row: number) =>
    state.takes.filter(t => t.shotRow === row).length

  const renderCard = (shot: typeof state.shots[0]) => (
    <ShotCard
      key={shot.row}
      shot={shot}
      takeCount={getTakeCount(shot.row)}
      showRef={state.showRef}
      onSelect={openSlate}
      onToggleDone={() => toggleDone(shot.row)}
      layout={state.layout}
    />
  )

  return (
    <div className="shot-list-view">
      <FilterBar />
      <div className="shot-list-stats">
        <span>Showing {filtered.length} of {state.shots.length} shots
        {state.filters.search && ` (matching "${state.filters.search}")`}</span>
        <label className="ref-toggle" title="Show shot type reference instead of description">
          <input type="checkbox" checked={state.showRef}
            onChange={e => dispatch({ type: 'SET_SHOW_REF', show: e.target.checked })} />
          <span className="ref-toggle-label">📖 Ref</span>
        </label>
      </div>

      {groups.length > 0 ? (
        <div className={`shot-groups ${state.layout}`}>
          {groups.map(g => (
            <div key={g.label} className="shot-group">
              <div className="shot-group-header">{g.label}</div>
              <div className={`shot-container ${state.layout}`}>
                {g.shots.map(renderCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`shot-container ${state.layout}`}>
          {filtered.map(renderCard)}
          {filtered.length === 0 && (
            <div className="empty-state">
              <p>No shots match your filters.</p>
              <p className="empty-hint">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
