import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { docUrlToTxtUrl } from '../utils/sheet'

let nextRow = 1000

function extractDocBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return ''
  let content = bodyMatch[1]
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  content = content.replace(/<meta[^>]*>/gi, '')
  content = content.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
  content = content.replace(/<span[^>]*>/gi, '<span>')
  return content
}

function wrapParagraphs(html: string): string[] {
  const div = document.createElement('div')
  div.innerHTML = html
  const blocks: string[] = []
  for (const child of div.children) {
    if (child.tagName === 'P' || child.tagName === 'H1' || child.tagName === 'H2' || child.tagName === 'H3' || child.tagName === 'H4') {
      blocks.push(child.outerHTML)
    }
  }
  return blocks
}

export function ScriptReview() {
  const { state, dispatch, activeProject } = useApp()
  const [rawHtml, setRawHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [docUrl, setDocUrl] = useState(activeProject?.docUrl || '')
  const [selection, setSelection] = useState('')

  const fetchScript = useCallback(async (url: string) => {
    setLoading(true)
    try {
      const txtUrl = docUrlToTxtUrl(url)
      if (!txtUrl) return
      const htmlUrl = txtUrl.replace('export?format=txt', 'export?format=html')
      const res = await fetch(htmlUrl, { cache: 'no-cache' })
      if (!res.ok) return
      const html = await res.text()
      const body = extractDocBody(html)
      setRawHtml(body)
    } catch { } finally {
      setLoading(false)
    }
  }, [])

  const paragraphs = useMemo(() => {
    if (!rawHtml) return []
    return wrapParagraphs(rawHtml)
  }, [rawHtml])

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
        priority: '',
        graphic: '',
        title: '',
        effect: '',
        crew: [],
      },
    })
    dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), message: `Added shot #${state.shots.length + 1}: "${desc.slice(0, 60)}${desc.length > 60 ? '...' : ''}"`, from: 'Script Review', timestamp: new Date().toISOString(), read: false } })
    setSelection('')
  }

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
        {!rawHtml && !loading && (
          <div className="empty-state">
            <p>Enter a published Google Doc URL and click Load Script.</p>
            <p className="empty-hint">Go to File → Share → Publish to web in your Google Doc first.</p>
          </div>
        )}
        {loading && <div className="loading">Loading script...</div>}
        {paragraphs.map((p, i) => (
          <div key={i} className="script-paragraph" data-paragraph={i + 1}>
            <span className="script-paragraph-num">{i + 1}</span>
            <button className="script-add-shot" title="Add to shot list" onClick={() => addShot(p.replace(/<[^>]*>/g, ''))}>+</button>
            <div className="script-para-content" dangerouslySetInnerHTML={{ __html: p }} />
          </div>
        ))}
      </div>
    </div>
  )
}
