import type { ShotRecord, Layout } from '../types'
import { getShotTypeInfo, getMediaTypeIcon } from '../utils/reference'

interface ShotCardProps {
  shot: ShotRecord
  takeCount: number
  showRef: boolean
  onSelect: (shot: ShotRecord) => void
  onToggleDone: () => void
  layout: Layout
}

function CrewBadges({ crew }: { crew: string[] }) {
  if (!crew || crew.length === 0) return null
  return (
    <div className="crew-badges">
      {crew.map(r => <span key={r} className="crew-badge">{r}</span>)}
    </div>
  )
}

export function ShotCard({ shot, takeCount, showRef, onSelect, onToggleDone, layout }: ShotCardProps) {
  const info = getShotTypeInfo(shot.type)
  const mediaIcon = getMediaTypeIcon(shot.type)

  const typeDisplay = (
    <span className="shot-type-icon" title={`${info.fullName}: ${info.description}`}>
      <span className="shot-icon">{mediaIcon}</span>
      <span className="shot-abbr">{shot.type}</span>
    </span>
  )

  if (layout === 'list') {
    return (
      <div className={`shot-card shot-card-list ${shot.done ? 'done' : ''}`}
        onClick={() => onSelect(shot)}>
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
            <span className="shot-takes">{takeCount} take{takeCount !== 1 ? 's' : ''}</span>
            <CrewBadges crew={shot.crew} />
          </div>
        </div>
        <div className="shot-actions">
          <label className="done-toggle" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={shot.done} onChange={onToggleDone} />
            <span className="checkmark">{shot.done ? '✓' : ''}</span>
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className={`shot-card ${shot.done ? 'done' : ''}`}
      onClick={() => onSelect(shot)}>
      <div className="shot-card-header">
        <span className="shot-order">#{shot.shootOrder || '—'}</span>
        {shot.shootDay && <span className="shot-day">Day {shot.shootDay}</span>}
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
      </div>
    </div>
  )
}
