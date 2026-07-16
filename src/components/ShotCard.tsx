import type { ShotRecord, Layout } from '../types'
import { PRIORITIES, getPriorityStyle } from '../types'
import { getShotTypeInfo, getMediaTypeIcon } from '../utils/reference'

interface ShotCardProps {
  shot: ShotRecord
  takeCount: number
  showRef: boolean
  onSelect: (shot: ShotRecord) => void
  onToggleDone: () => void
  onSetPriority?: (row: number, priority: string) => void
  layout: Layout
  selected?: boolean
  onToggleSelect?: (row: number) => void
  selectMode?: boolean
  onDragStart?: (e: React.DragEvent, row: number) => void
  onDragOver?: (e: React.DragEvent, row: number) => void
  onDrop?: (e: React.DragEvent, row: number) => void
}

function CrewBadges({ crew }: { crew: string[] }) {
  if (!crew || crew.length === 0) return null
  return (
    <div className="crew-badges">
      {crew.map(r => <span key={r} className="crew-badge">{r}</span>)}
    </div>
  )
}

export function ShotCard({ shot, takeCount, showRef, onSelect, onToggleDone, onSetPriority, layout, selected, onToggleSelect, selectMode, onDragStart, onDragOver, onDrop }: ShotCardProps) {
  const info = getShotTypeInfo(shot.type)
  const mediaIcon = getMediaTypeIcon(shot.type)
  const pri = getPriorityStyle(shot.priority)

  const typeDisplay = (
    <span className="shot-type-icon" title={`${info.fullName}: ${info.description}`}>
      <span className="shot-icon">{mediaIcon}</span>
      <span className="shot-abbr">{shot.type}</span>
    </span>
  )

  const priorityBadge = pri.color ? (
    <span className="shot-priority-badge" style={{ backgroundColor: pri.color }} title={pri.label}>
      {pri.label}
    </span>
  ) : null

  const prioritySelect = (
    <select className="filter-select shot-priority-select"
      value={shot.priority}
      onChange={e => onSetPriority?.(shot.row, e.target.value)}
      onClick={e => e.stopPropagation()}>
      <option value="">Priority</option>
      {PRIORITIES.map(p => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  )

  const handleClick = () => {
    if (selectMode) {
      onToggleSelect?.(shot.row)
    } else {
      onSelect(shot)
    }
  }

  const classes = [
    layout === 'list' ? 'shot-card shot-card-list' : 'shot-card',
    shot.done ? 'done' : '',
    selected ? 'selected' : '',
    selectMode ? 'select-mode' : '',
  ].filter(Boolean).join(' ')

  const cardContent = (
    <>
      {selectMode && (
        <div className="shot-select-box" onClick={e => { e.stopPropagation(); onToggleSelect?.(shot.row) }}>
          <span className={`shot-select-check ${selected ? 'checked' : ''}`}>
            {selected ? '✓' : ''}
          </span>
        </div>
      )}
      <div className="shot-drag-handle"
        draggable
        onDragStart={e => onDragStart?.(e, shot.row)}
        onDragOver={e => onDragOver?.(e, shot.row)}
        onDrop={e => onDrop?.(e, shot.row)}
        title="Drag to reorder">
        ⋮⋮
      </div>
      {layout === 'list' ? (
        <>
          <div className="shot-order">{shot.shootOrder || '—'}</div>
          <div className="shot-info">
            {showRef ? (
              <div className="shot-ref-text">{info.fullName}: {info.description}</div>
            ) : (
              <div className="shot-desc">{shot.description}</div>
            )}
            <div className="shot-meta">
              {typeDisplay}
              {shot.location && <span className="shot-location">{shot.location}</span>}
              {shot.shootDay && <span className="shot-day">Day {shot.shootDay}</span>}
              {priorityBadge}
              <span className="shot-takes">{takeCount} take{takeCount !== 1 ? 's' : ''}</span>
              <CrewBadges crew={shot.crew} />
            </div>
          </div>
          <div className="shot-actions">
            {prioritySelect}
            <label className="done-toggle" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={shot.done} onChange={onToggleDone} />
              <span className="checkmark">{shot.done ? '✓' : ''}</span>
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="shot-card-header">
            <span className="shot-order">#{shot.shootOrder || '—'}</span>
            {shot.shootDay && <span className="shot-day">Day {shot.shootDay}</span>}
            {priorityBadge}
            <label className="done-toggle" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={shot.done} onChange={onToggleDone} />
              <span className="checkmark">{shot.done ? '✓' : ''}</span>
            </label>
          </div>
          <div className="shot-card-body">
            {typeDisplay}
            {shot.location && <span className="shot-location">{shot.location}</span>}
            {showRef ? (
              <p className="shot-ref-text">{info.fullName}: {info.description}</p>
            ) : (
              <p className="shot-description">{shot.description}</p>
            )}
            {shot.notes && <p className="shot-notes">{shot.notes}</p>}
            <CrewBadges crew={shot.crew} />
          </div>
          <div className="shot-card-footer">
            <span className="shot-takes">{takeCount} take{takeCount !== 1 ? 's' : ''}</span>
            {prioritySelect}
          </div>
        </>
      )}
    </>
  )

  return (
    <div className={classes}
      onClick={handleClick}
      style={pri.color ? { borderLeftColor: pri.color } : undefined}
      draggable={false}>
      {cardContent}
    </div>
  )
}
