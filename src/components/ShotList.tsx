import { useState, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { FilterBar } from './FilterBar'
import { ShotCard } from './ShotCard'
import type { ShotRecord } from '../types'

export function ShotList() {
  const { state, dispatch, openSlate, toggleDone, setShotPriority, deleteShot, deleteShots, reorderShots } = useApp()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dragRow, setDragRow] = useState<number | null>(null)

  const { filtered, groups } = useMemo(() => {
    let result = [...state.shots]
    const { type, location, status, search } = state.filters

    if (type) result = result.filter(s => s.type === type)
    if (location) result = result.filter(s => s.location === location)
    if (status === 'done') result = result.filter(s => s.done)
    if (status === 'pending') result = result.filter(s => !s.done)
    if (state.filters.crew) result = result.filter(s => s.crew?.includes(state.filters.crew))
    if (state.filters.priority) result = result.filter(s => s.priority === state.filters.priority)
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
        case 'priority': cmp = a.priority.localeCompare(b.priority); break
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

  const getTakeCount = (row: number) =>
    state.takes.filter(t => t.shotRow === row).length

  const toggleSelect = useCallback((row: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map(s => s.row)))
  }, [filtered])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
  }, [])

  const handleDeleteSelected = useCallback(() => {
    if (selected.size === 0) return
    const msg = `Delete ${selected.size} shot${selected.size !== 1 ? 's' : ''}?`
    if (!confirm(msg)) return
    deleteShots(Array.from(selected))
    setSelected(new Set())
  }, [selected, deleteShots])

  const handleDeleteShot = useCallback((row: number) => {
    if (!confirm('Delete this shot?')) return
    deleteShot(row)
  }, [deleteShot])

  const handleDragStart = useCallback((e: React.DragEvent, row: number) => {
    setDragRow(row)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, _row: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetRow: number) => {
    e.preventDefault()
    if (dragRow === null || dragRow === targetRow) return
    const sorted = [...state.shots].sort((a, b) =>
      (parseInt(a.shootOrder) || 0) - (parseInt(b.shootOrder) || 0)
    )
    const fromIdx = sorted.findIndex(s => s.row === dragRow)
    const toIdx = sorted.findIndex(s => s.row === targetRow)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = sorted.splice(fromIdx, 1)
    sorted.splice(toIdx, 0, moved)
    reorderShots(sorted)
    setDragRow(null)
  }, [dragRow, state.shots, reorderShots])

  const renderCard = (shot: ShotRecord) => (
    <ShotCard
      key={shot.row}
      shot={shot}
      takeCount={getTakeCount(shot.row)}
      showRef={state.showRef}
      onSelect={openSlate}
      onToggleDone={() => toggleDone(shot.row)}
      onSetPriority={setShotPriority}
      layout={state.layout}
      selected={selected.has(shot.row)}
      onToggleSelect={toggleSelect}
      selectMode={selectMode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
  )

  return (
    <div className="shot-list-view">
      <FilterBar />
      <div className="shot-list-stats">
        <span>Showing {filtered.length} of {state.shots.length} shots
        {state.filters.search && ` (matching "${state.filters.search}")`}</span>
        <div className="shot-list-actions">
          <button className={`btn btn-sm btn-ghost ${selectMode ? 'active' : ''}`}
            onClick={() => { setSelectMode(!selectMode); clearSelection() }}>
            {selectMode ? 'Done' : 'Select'}
          </button>
          <label className="ref-toggle" title="Show shot type reference instead of description">
            <input type="checkbox" checked={state.showRef}
              onChange={e => dispatch({ type: 'SET_SHOW_REF', show: e.target.checked })} />
            <span className="ref-toggle-label">📖 Ref</span>
          </label>
        </div>
      </div>

      {selectMode && selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} selected</span>
          <button className="btn btn-sm" onClick={selectAll}>Select All</button>
          <button className="btn btn-sm btn-ghost" onClick={clearSelection}>Clear</button>
          <div className="bulk-spacer" />
          <button className="btn btn-sm btn-danger" onClick={handleDeleteSelected}>
            Delete {selected.size > 1 ? 'Selected' : ''}
          </button>
        </div>
      )}

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
