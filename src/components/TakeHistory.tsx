import { useApp } from '../context/AppContext'

export function TakeHistory() {
  const { state, dispatch } = useApp()
  const shotTakes = state.takes
    .filter(t => t.shotRow === state.activeShot?.row)
    .sort((a, b) => b.takeNumber - a.takeNumber)

  if (shotTakes.length === 0) return null

  return (
    <div className="take-history">
      <h3>Take History</h3>
      <div className="take-list">
        {shotTakes.map(take => (
          <div key={take.id} className={`take-entry ${take.good ? 'good' : 'ng'}`}>
            <div className="take-entry-header">
              <span className="take-number">Take {take.takeNumber}</span>
              <span className={`take-verdict ${take.good ? 'good' : 'ng'}`}>
                {take.good ? '✓ GOOD' : '✗ NG'}
              </span>
              <button
                className={`btn-small ${take.circled ? 'circled' : ''}`}
                onClick={() => dispatch({ type: 'MARK_TAKE_CIRCLED', takeId: take.id, circled: !take.circled })}
              >
                {take.circled ? '⭕ Circled' : '○ Circle'}
              </button>
            </div>
            <input
              className="take-notes-input"
              type="text"
              placeholder="Take notes..."
              value={take.notes}
              onClick={e => e.stopPropagation()}
              onChange={e => dispatch({ type: 'SET_TAKE_NOTES', takeId: take.id, notes: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
