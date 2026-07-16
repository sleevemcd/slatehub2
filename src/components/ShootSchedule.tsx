import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import type { ShotRecord } from '../types'

function daySort(a: string, b: string) {
  const an = parseInt(a.replace(/\D/g, ''), 10)
  const bn = parseInt(b.replace(/\D/g, ''), 10)
  if (!isNaN(an) && !isNaN(bn)) return an - bn
  return a.localeCompare(b)
}

function orderSort(a: string, b: string) {
  const an = parseInt(a, 10)
  const bn = parseInt(b, 10)
  if (!isNaN(an) && !isNaN(bn)) return an - bn
  return a.localeCompare(b)
}

export function ShootSchedule() {
  const { state, openSlate, toggleDone, goToView } = useApp()
  const { shots } = state

  const { days, stats } = useMemo(() => {
    const dayMap = new Map<string, ShotRecord[]>()
    for (const shot of shots) {
      const day = shot.shootDay || 'Unscheduled'
      if (!dayMap.has(day)) dayMap.set(day, [])
      dayMap.get(day)!.push(shot)
    }
    for (const [, list] of dayMap) {
      list.sort((a, b) => orderSort(a.shootOrder, b.shootOrder))
    }
    const sortedDays = [...dayMap.entries()].sort(([a], [b]) => daySort(a, b))
    const total = shots.length
    const done = shots.filter(s => s.done).length
    return { days: sortedDays, stats: { total, done } }
  }, [shots])

  if (shots.length === 0) {
    return (
      <div className="shoot-schedule-view">
        <div className="empty-state">
          <h2>No shots yet</h2>
          <p>Import a project from the project manager to get started.</p>
          <button className="btn" onClick={() => goToView('project-manager')}>Project Manager</button>
        </div>
      </div>
    )
  }

  return (
    <div className="shoot-schedule-view">
      <div className="schedule-header">
        <h2>Shoot Schedule</h2>
        <div className="schedule-stats">
          <span className="schedule-stat">{stats.total} shots</span>
          <span className="schedule-stat">{stats.done} done</span>
          <span className="schedule-stat pending">{stats.total - stats.done} pending</span>
        </div>
      </div>

      <div className="schedule-progress">
        <div className="schedule-progress-bar">
          <div className="schedule-progress-fill" style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} />
        </div>
        <span className="schedule-progress-label">{Math.round(stats.total ? (stats.done / stats.total) * 100 : 0)}%</span>
      </div>

      <div className="schedule-days">
        {days.map(([day, dayShots]) => {
          const dayDone = dayShots.filter(s => s.done).length
          return (
            <div key={day} className="schedule-day">
              <div className="schedule-day-header">
                <h3 className="schedule-day-title">{day}</h3>
                <div className="schedule-day-stats">
                  <span className="schedule-day-progress">
                    <span className="progress-done">{dayDone}</span>
                    <span className="progress-sep">/</span>
                    <span className="progress-total">{dayShots.length}</span>
                  </span>
                  <div className="schedule-day-bar">
                    <div className="schedule-day-fill" style={{ width: `${(dayDone / dayShots.length) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="schedule-shot-list">
                {dayShots.map(shot => (
                  <div key={shot.row} className={`schedule-shot ${shot.done ? 'shot-done' : ''}`}>
                    <button className="schedule-shot-done"
                      onClick={() => toggleDone(shot.row)}
                      title={shot.done ? 'Mark pending' : 'Mark done'}>
                      {shot.done ? '✓' : '○'}
                    </button>
                    <div className="schedule-shot-info" onClick={() => openSlate(shot)}>
                      <div className="schedule-shot-top">
                        <span className="schedule-shot-order">#{shot.shootOrder}</span>
                        <span className="schedule-shot-type">{shot.type}</span>
                        {shot.priority && (
                          <span className="schedule-shot-priority"
                            style={{
                              background: shot.priority === 'must-have' ? '#e74c3c'
                                : shot.priority === 'nice-to-have' ? '#f39c12'
                                : shot.priority === 'b-roll' ? '#7f8c8d' : undefined,
                              color: '#fff'
                            }}>
                            {shot.priority === 'must-have' ? 'Must' : shot.priority === 'nice-to-have' ? 'Nice' : 'B-Roll'}
                          </span>
                        )}
                      </div>
                      <div className="schedule-shot-desc">{shot.description}</div>
                      <div className="schedule-shot-meta">
                        {shot.location && <span className="meta-location">{shot.location}</span>}
                        {shot.setup && <span className="meta-setup">Cam {shot.setup}</span>}
                        {shot.subShot && <span className="meta-sub">{shot.subShot}</span>}
                        {shot.crew && shot.crew.length > 0 && (
                          <span className="meta-crew">{shot.crew.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
