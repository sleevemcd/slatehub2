import { useState } from 'react'
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
  onEditShot?: (row: number, data: Partial<ShotRecord>) => void
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

export function ShotCard({ shot, takeCount, showRef, onSelect, onToggleDone, onSetPriority, onEditShot, layout, selected, onToggleSelect, selectMode, onDragStart, onDragOver, onDrop }: ShotCardProps) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<ShotRecord>>({})

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

  const shotNum = shot.shootOrder || String(shot.row)

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditForm({
      type: shot.type,
      description: shot.description,
      location: shot.location,
      setup: shot.setup,
      shootDay: shot.shootDay,
      shootOrder: shot.shootOrder,
      notes: shot.notes,
      subShot: shot.subShot,
      graphic: shot.graphic,
      title: shot.title,
      effect: shot.effect,
      referenceLink: shot.referenceLink,
      duration: shot.duration,
      roll: shot.roll,
      scene: shot.scene,
    })
    setEditing(true)
  }

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEditShot) {
      const cleaned: Partial<ShotRecord> = {}
      for (const [k, v] of Object.entries(editForm)) {
        if (v !== (shot as any)[k]) {
          (cleaned as any)[k] = v
        }
      }
      if (Object.keys(cleaned).length > 0) {
        onEditShot(shot.row, cleaned)
      }
    }
    setEditing(false)
  }

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(false)
  }

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
    editing ? 'editing' : '',
  ].filter(Boolean).join(' ')

  const cardContent = editing ? (
    <div className="shot-edit-form" onClick={e => e.stopPropagation()}>
      <div className="shot-edit-field">
        <label>Type</label>
        <input className="input" value={editForm.type || ''}
          onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} />
      </div>
      <div className="shot-edit-field">
        <label>Description</label>
        <textarea className="input shot-edit-textarea" value={editForm.description || ''}
          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="shot-edit-row">
        <div className="shot-edit-field">
          <label>Location</label>
          <input className="input" value={editForm.location || ''}
            onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="shot-edit-field">
          <label>Setup</label>
          <input className="input" value={editForm.setup || ''}
            onChange={e => setEditForm(f => ({ ...f, setup: e.target.value }))} />
        </div>
      </div>
      <div className="shot-edit-row">
        <div className="shot-edit-field">
          <label>Shoot Day</label>
          <input className="input" value={editForm.shootDay || ''}
            onChange={e => setEditForm(f => ({ ...f, shootDay: e.target.value }))} />
        </div>
        <div className="shot-edit-field">
          <label>Order</label>
          <input className="input" value={editForm.shootOrder || ''}
            onChange={e => setEditForm(f => ({ ...f, shootOrder: e.target.value }))} />
        </div>
        <div className="shot-edit-field">
          <label>Sub-Shot</label>
          <input className="input" value={editForm.subShot || ''}
            onChange={e => setEditForm(f => ({ ...f, subShot: e.target.value }))} />
        </div>
      </div>
      <div className="shot-edit-row">
        <div className="shot-edit-field">
          <label>Graphic</label>
          <input className="input" placeholder="Lower Third, Full Screen, etc." value={editForm.graphic || ''}
            onChange={e => setEditForm(f => ({ ...f, graphic: e.target.value }))} />
        </div>
        <div className="shot-edit-field">
          <label>Effect</label>
          <input className="input" placeholder="Fade, Wipe, etc." value={editForm.effect || ''}
            onChange={e => setEditForm(f => ({ ...f, effect: e.target.value }))} />
        </div>
      </div>
      <div className="shot-edit-row">
        <div className="shot-edit-field">
          <label>Duration</label>
          <input className="input" placeholder="e.g. 0:30, 1:15" value={editForm.duration || ''}
            onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} />
        </div>
        <div className="shot-edit-field">
          <label>Reference Link</label>
          <input className="input" value={editForm.referenceLink || ''}
            onChange={e => setEditForm(f => ({ ...f, referenceLink: e.target.value }))} />
        </div>
      </div>
      <div className="shot-edit-field">
        <label>Title / Overlay Text</label>
        <input className="input" value={editForm.title || ''}
          onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="shot-edit-row">
        <div className="shot-edit-field">
          <label>Roll</label>
          <input className="input" placeholder="e.g. 1, A" value={editForm.roll || ''}
            onChange={e => setEditForm(f => ({ ...f, roll: e.target.value }))} />
        </div>
        <div className="shot-edit-field">
          <label>Scene</label>
          <input className="input" placeholder="e.g. 1, 1A" value={editForm.scene || ''}
            onChange={e => setEditForm(f => ({ ...f, scene: e.target.value }))} />
        </div>
      </div>
      <div className="shot-edit-field">
        <label>Notes</label>
        <textarea className="input shot-edit-textarea" value={editForm.notes || ''}
          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="shot-edit-actions">
        <button className="btn btn-sm" onClick={saveEdit}>Save</button>
        <button className="btn btn-sm btn-ghost" onClick={cancelEdit}>Cancel</button>
      </div>
    </div>
  ) : (
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
      <div className="shot-edit-btn" onClick={startEditing} title="Edit fields">✎</div>
      {layout === 'list' ? (
        <>
          <div className="shot-order">{'#' + shotNum}</div>
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
              {shot.graphic && <span className="shot-tag shot-tag-graphic">🎨 {shot.graphic}</span>}
              {shot.effect && <span className="shot-tag shot-tag-effect">⚡ {shot.effect}</span>}
              {shot.title && <span className="shot-tag shot-tag-title">📝 {shot.title}</span>}
              {shot.duration && <span className="shot-tag shot-tag-duration">⏱ {shot.duration}</span>}
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
            <span className="shot-order">#{shotNum}</span>
            {shot.shootDay && <span className="shot-day">Day {shot.shootDay}</span>}
            {shot.graphic && <span className="shot-tag shot-tag-graphic">🎨 {shot.graphic}</span>}
            {shot.effect && <span className="shot-tag shot-tag-effect">⚡ {shot.effect}</span>}
            {shot.duration && <span className="shot-tag shot-tag-duration">⏱ {shot.duration}</span>}
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
            {shot.title && <p className="shot-title-overlay">📝 {shot.title}</p>}
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
