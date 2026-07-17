import { useMemo } from 'react'
import { useApp } from '../context/AppContext'

export function Dashboard() {
  const { state, activeProject } = useApp()
  const { shots, takes } = state

  const stats = useMemo(() => {
    const total = shots.length
    const done = shots.filter(s => s.done).length
    const pending = total - done
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    const byType: Record<string, { total: number; done: number }> = {}
    const byLocation: Record<string, { total: number; done: number }> = {}
    const byDay: Record<string, { total: number; done: number }> = {}
    const circled = takes.filter(t => t.circled).length

    for (const s of shots) {
      if (s.type) {
        if (!byType[s.type]) byType[s.type] = { total: 0, done: 0 }
        byType[s.type].total++
        if (s.done) byType[s.type].done++
      }
      if (s.location) {
        if (!byLocation[s.location]) byLocation[s.location] = { total: 0, done: 0 }
        byLocation[s.location].total++
        if (s.done) byLocation[s.location].done++
      }
      if (s.shootDay) {
        if (!byDay[s.shootDay]) byDay[s.shootDay] = { total: 0, done: 0 }
        byDay[s.shootDay].total++
        if (s.done) byDay[s.shootDay].done++
      }
    }

    const totalTakes = takes.length
    const goodTakes = takes.filter(t => t.good).length
    const recentTakes = [...takes].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10)

    return { total, done, pending, pct, byType, byLocation, byDay, totalTakes, goodTakes, circled, recentTakes }
  }, [shots, takes])

  if (shots.length === 0) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <h2>No shots loaded</h2>
          <p>Connect a Google Sheet to see your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h2>{activeProject?.name || 'Production'} Dashboard</h2>
      </div>

      <div className="dash-cards">
        <div className="dash-card total">
          <div className="dash-card-value">{stats.total}</div>
          <div className="dash-card-label">Total Shots</div>
        </div>
        <div className="dash-card done">
          <div className="dash-card-value">{stats.done}</div>
          <div className="dash-card-label">Completed</div>
        </div>
        <div className="dash-card pending">
          <div className="dash-card-value">{stats.pending}</div>
          <div className="dash-card-label">Remaining</div>
        </div>
        <div className="dash-card pct">
          <div className="dash-card-value">{stats.pct}%</div>
          <div className="dash-card-label">Progress</div>
        </div>
        <div className="dash-card takes">
          <div className="dash-card-value">{stats.totalTakes}</div>
          <div className="dash-card-label">Total Takes</div>
        </div>
        <div className="dash-card good-takes">
          <div className="dash-card-value">{stats.goodTakes}</div>
          <div className="dash-card-label">Good Takes</div>
        </div>
        {stats.circled > 0 && (
          <div className="dash-card circled">
            <div className="dash-card-value">{stats.circled}</div>
            <div className="dash-card-label">Circled</div>
          </div>
        )}
      </div>

      <div className="dash-progress-section">
        <div className="dash-progress-header">
          <span>Overall Progress</span>
          <span className="dash-progress-pct">{stats.pct}%</span>
        </div>
        <div className="dash-progress-bar">
          <div className="dash-progress-fill" style={{ width: `${stats.pct}%` }} />
        </div>
      </div>

      <div className="dash-sections">
        {Object.keys(stats.byDay).length > 0 && (
          <div className="dash-section">
            <h3>By Day</h3>
            <div className="dash-list">
              {Object.entries(stats.byDay).sort().map(([day, data]) => (
                <div key={day} className="dash-list-item">
                  <span className="dash-list-label">Day {day}</span>
                  <div className="dash-list-bar-bg">
                    <div className="dash-list-bar-fill" style={{ width: `${data.total > 0 ? (data.done / data.total) * 100 : 0}%` }} />
                  </div>
                  <span className="dash-list-count">{data.done}/{data.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(stats.byType).length > 0 && (
          <div className="dash-section">
            <h3>By Type</h3>
            <div className="dash-list">
              {Object.entries(stats.byType).map(([type, data]) => (
                <div key={type} className="dash-list-item">
                  <span className="dash-list-label">{type}</span>
                  <div className="dash-list-bar-bg">
                    <div className="dash-list-bar-fill" style={{ width: `${data.total > 0 ? (data.done / data.total) * 100 : 0}%` }} />
                  </div>
                  <span className="dash-list-count">{data.done}/{data.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(stats.byLocation).length > 0 && (
          <div className="dash-section">
            <h3>By Location</h3>
            <div className="dash-list">
              {Object.entries(stats.byLocation).map(([loc, data]) => (
                <div key={loc} className="dash-list-item">
                  <span className="dash-list-label">{loc}</span>
                  <div className="dash-list-bar-bg">
                    <div className="dash-list-bar-fill" style={{ width: `${data.total > 0 ? (data.done / data.total) * 100 : 0}%` }} />
                  </div>
                  <span className="dash-list-count">{data.done}/{data.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {stats.recentTakes.length > 0 && (
        <div className="dash-section dash-recent-takes">
          <h3>Recent Takes</h3>
          <div className="dash-take-list">
            {stats.recentTakes.map(t => {
              const shot = shots.find(s => s.row === t.shotRow)
              return (
                <div key={t.id} className={`dash-take-item ${t.good ? 'good' : 'ng'}`}>
                  <span className="dash-take-shot">{shot?.description || shot?.type || `Shot #${t.shotRow}`}</span>
                  <span className={`dash-take-verdict ${t.good ? 'good' : 'ng'}`}>
                    {t.good ? '✓' : '✗'} Take {t.takeNumber}
                  </span>
                  {t.circled && <span className="dash-take-circled">⭕</span>}
                  <span className="dash-take-time">{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
