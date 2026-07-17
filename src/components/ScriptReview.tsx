import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { docUrlToTxtUrl } from '../utils/sheet'
import { getPlainText, buildHighlightedNodes } from '../utils/highlight'
import type { ScriptHighlight } from '../types'
import { HIGHLIGHT_COLORS } from '../types'

let nextRow = 1000

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

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
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerPos, setColorPickerPos] = useState({ x: 0, y: 0 })
  const [activeHighlight, setActiveHighlight] = useState<{ id: string; text: string; x: number; y: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const paragraphs = useMemo(() => {
    if (!rawHtml) return []
    return wrapParagraphs(rawHtml)
  }, [rawHtml])

  const plainParagraphs = useMemo(() => {
    return paragraphs.map(p => getPlainText(p))
  }, [paragraphs])

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

  const handleSelectionEnd = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setShowColorPicker(false)
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const parentEl = contentRef.current
    if (!parentEl) return

    const paraEl = range.startContainer?.nodeType === 3
      ? (range.startContainer as Node).parentElement?.closest('[data-para-idx]')
      : (range.startContainer as Element)?.closest('[data-para-idx]')

    if (!paraEl) return

    const paraIdx = parseInt(paraEl.getAttribute('data-para-idx') || '-1', 10)
    if (paraIdx < 0) return

    setColorPickerPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
    setShowColorPicker(true)
  }

  const applyHighlight = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return

    const text = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const paraEl = range.startContainer?.nodeType === 3
      ? (range.startContainer as Node).parentElement?.closest('[data-para-idx]')
      : (range.startContainer as Element)?.closest('[data-para-idx]')

    if (!paraEl) return
    const paraIdx = parseInt(paraEl.getAttribute('data-para-idx') || '-1', 10)
    if (paraIdx < 0) return

    const plain = plainParagraphs[paraIdx]
    const searchStart = plain.indexOf(text)
    if (searchStart < 0) return

    const highlight: ScriptHighlight = {
      id: generateId(),
      paragraphIndex: paraIdx,
      text,
      color: selectedColor,
      shotId: null,
      createdAt: new Date().toISOString(),
      startOffset: searchStart,
      endOffset: searchStart + text.length,
    }

    dispatch({ type: 'ADD_HIGHLIGHT', highlight })
    sel.removeAllRanges()
    setShowColorPicker(false)
  }

  const addShotFromHighlight = (hlId: string, text: string) => {
    const existingHl = state.highlights.find(h => h.id === hlId)
    const row = nextRow++
    dispatch({
      type: 'ADD_SHOT',
      shot: {
        row,
        type: 'CU',
        description: text,
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
        duration: '',
        crew: [],
      },
    })
    dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), message: `Added shot #${state.shots.length + 1}: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`, from: 'Script Review', timestamp: new Date().toISOString(), read: false } })
    if (existingHl) {
      dispatch({ type: 'UPDATE_HIGHLIGHT', id: hlId, data: { shotId: row } })
    }
    setActiveHighlight(null)
  }

  const removeHighlight = (hlId: string) => {
    dispatch({ type: 'REMOVE_HIGHLIGHT', id: hlId })
    setActiveHighlight(null)
  }

  const handleParaClick = (paraIdx: number) => {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return
    addShotFromParagraph(paraIdx)
  }

  const addShotFromParagraph = (paraIdx: number) => {
    const text = plainParagraphs[paraIdx]
    if (!text) return
    const row = nextRow++
    dispatch({
      type: 'ADD_SHOT',
      shot: {
        row,
        type: 'CU',
        description: text,
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
        duration: '',
        crew: [],
      },
    })
    dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), message: `Added shot #${state.shots.length + 1}: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`, from: 'Script Review', timestamp: new Date().toISOString(), read: false } })
  }

  const highlightsForPara = useMemo(() => {
    const map = new Map<number, ScriptHighlight[]>()
    for (const h of state.highlights) {
      if (!map.has(h.paragraphIndex)) map.set(h.paragraphIndex, [])
      map.get(h.paragraphIndex)!.push(h)
    }
    return map
  }, [state.highlights])

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

      <div className={`script-hl-legend ${state.highlights.length > 0 ? 'has-highlights' : ''}`}>
        {HIGHLIGHT_COLORS.map(c => {
          const count = state.highlights.filter(h => h.color === c.value).length
          return (
            <span key={c.value} className="hl-legend-item">
              <span className="hl-swatch" style={{ background: c.value }} />
              {c.name}
              {count > 0 && <span className="hl-count">{count}</span>}
            </span>
          )
        })}
      </div>

      <div className="script-content" ref={contentRef}
        onMouseUp={handleSelectionEnd}
        onTouchEnd={handleSelectionEnd}>
        {!rawHtml && !loading && (
          <div className="empty-state">
            <p>Enter a published Google Doc URL and click Load Script.</p>
            <p className="empty-hint">Go to File → Share → Publish to web in your Google Doc first.</p>
          </div>
        )}
        {loading && <div className="loading">Loading script...</div>}
        {plainParagraphs.map((text, i) => {
          const paraHls = highlightsForPara.get(i) || []
          const spans = paraHls.map(h => ({ start: h.startOffset, end: h.endOffset, color: h.color, id: h.id }))
          const nodes = buildHighlightedNodes(text, spans, `p${i}`, (id, t) => {
            const el = contentRef.current?.querySelector(`[data-hl-id="${id}"]`)
            if (el) {
              const r = el.getBoundingClientRect()
              setActiveHighlight({ id, text: t, x: r.left + r.width / 2, y: r.top - 8 })
            }
          })
          return (
            <div key={i} className="script-paragraph" data-para-idx={i}
              onClick={() => handleParaClick(i)}>
              <span className="script-paragraph-num">{i + 1}</span>
              <span className="script-add-shot" title="Add to shot list">+</span>
              <div className="script-para-content">
                {nodes}
              </div>
            </div>
          )
        })}
      </div>

      {showColorPicker && (
        <div className="hl-color-picker-overlay" onClick={() => setShowColorPicker(false)}>
          <div className="hl-color-picker" style={{ left: colorPickerPos.x, top: colorPickerPos.y }}
            onClick={e => e.stopPropagation()}>
            <div className="hl-color-swatches">
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c.value}
                  className={`hl-color-btn ${selectedColor === c.value ? 'active' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => { setSelectedColor(c.value); applyHighlight() }}
                  title={c.name} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeHighlight && (
        <div className="hl-action-overlay" onClick={() => setActiveHighlight(null)}>
          <div className="hl-action-bar" style={{ left: activeHighlight.x, top: activeHighlight.y }}
            onClick={e => e.stopPropagation()}>
            <span className="hl-action-text" title={activeHighlight.text}>
              "{activeHighlight.text.slice(0, 50)}{activeHighlight.text.length > 50 ? '...' : ''}"
            </span>
            <div className="hl-action-btns">
              <button className="btn btn-primary btn-sm" onClick={() => addShotFromHighlight(activeHighlight.id, activeHighlight.text)}>
                + Shot
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => removeHighlight(activeHighlight.id)}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
