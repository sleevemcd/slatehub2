import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { docUrlToTxtUrl, fetchDocText } from '../utils/sheet'

let nextRow = 1000

export function ScriptReview() {
  const { state, dispatch, activeProject } = useApp()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [docUrl, setDocUrl] = useState(activeProject?.docUrl || '')
  const [selection, setSelection] = useState('')

  const fetchScript = useCallback(async (url: string) => {
    setLoading(true)
    try {
      const txtUrl = docUrlToTxtUrl(url)
      if (!txtUrl) return
      const content = await fetchDocText(txtUrl)
      setText(content)
    } catch { } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeProject?.docUrl) {
      setDocUrl(activeProject.docUrl)
      fetchScript(activeProject.docUrl)
    }
  }, [activeProject?.docUrl, fetchScript])

  const handleFetch = () => {
    if (!docUrl) return
    fetchScript(docUrl)
    if (activeProject) {
      dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, data: { docUrl } })
    }
  }

  const handleSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.toString().trim()) {
      setSelection(sel.toString().trim())
    }
  }

  const addShot = (desc: string) => {
    const row = nextRow++
    dispatch({
      type: 'ADD_SHOT',
      shot: {
        row,
        type: 'CU',
        description: desc,
        subShot: '',
        location: '',
        setup: '',
        notes: '',
        referenceLink: '',
        shootDay: '',
        shootOrder: String(state.shots.length + 1),
        done: false,
        crew: [],
      },
    })
    dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), message: `Added shot #${state.shots.length + 1}: "${desc.slice(0, 60)}${desc.length > 60 ? '...' : ''}"`, from: 'Script Review', timestamp: new Date().toISOString(), read: false } })
    setSelection('')
  }

  const paragraphs = text.split('\n').filter(p => p.trim())

  return (
    <div className="script-review">
      <div className="script-review-header">
        <h2>Script Review</h2>
        <span className="shot-count">{state.shots.length} shots in list</span>
      </div>

      <div className="script-url-bar">
        <input
          type="text"
          value={docUrl}
          onChange={e => setDocUrl(e.target.value)}
          placeholder="Google Doc URL (File > Share > Publish to web)"
          className="input"
        />
        <button className="btn btn-primary" onClick={handleFetch} disabled={loading || !docUrl}>
          {loading ? 'Loading...' : 'Load Script'}
        </button>
      </div>

      {selection && (
        <div className="script-selection-bar">
          <p className="script-selection-text">"{selection.slice(0, 120)}{selection.length > 120 ? '...' : ''}"</p>
          <button className="btn btn-primary btn-sm" onClick={() => addShot(selection)}>
            + Add to Shot List
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelection('')}>✕</button>
        </div>
      )}

      <div className="script-content" onMouseUp={handleSelection}>
        {!text && !loading && (
          <div className="empty-state">
            <p>Enter a published Google Doc URL and click Load Script.</p>
            <p className="empty-hint">Go to File → Share → Publish to web in your Google Doc first.</p>
          </div>
        )}
        {loading && <div className="loading">Loading script...</div>}
        {paragraphs.map((p, i) => (
          <div key={i} className="script-paragraph" data-paragraph={i + 1}>
            <span className="script-paragraph-num">{i + 1}</span>
            <button className="script-add-shot" title="Add to shot list" onClick={() => addShot(p)}>+</button>
            <p>{p}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
