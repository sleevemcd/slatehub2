import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { docUrlToTxtUrl } from '../utils/sheet'
import { getPlainText, buildHighlightedNodes, getBoundingRectAtOffset, caretRangeFromPoint } from '../utils/highlight'
import type { ScriptHighlight } from '../types'
import { HIGHLIGHT_COLORS } from '../types'

let nextRow = 1000
const DEFAULT_COLOR = HIGHLIGHT_COLORS[0].value

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
  const { state, dispatch, goToView, activeProject } = useApp()
  const [rawHtml, setRawHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [docUrl, setDocUrl] = useState(activeProject?.docUrl || '')

  const contentRef = useRef<HTMLDivElement>(null)
  const contentElRef = useRef<HTMLDivElement>(null)

  const [showNoteInput, setShowNoteInput] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressTriggered = useRef(false)

  const [selStart, setSelStart] = useState<{ paraIdx: number; offset: number } | null>(null)
  const [selEnd, setSelEnd] = useState<{ paraIdx: number; offset: number } | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [actionsPos, setActionsPos] = useState({ x: 0, y: 0 })

  const [dragHandle, setDragHandle] = useState<'start' | 'end' | null>(null)

  const [colorPickerHL, setColorPickerHL] = useState<string | null>(null)
  const [colorPickerPos2, setColorPickerPos2] = useState({ x: 0, y: 0 })

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

  useEffect(() => {
    const onPointerUp = () => {
      setDragHandle(null)
    }
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [])

  const getParaIdxFromEl = (el: EventTarget | null): number | null => {
    const paraEl = (el as HTMLElement)?.closest?.('[data-para-idx]') as HTMLElement | null
    if (!paraEl) return null
    const idx = parseInt(paraEl.getAttribute('data-para-idx') || '-1', 10)
    return idx >= 0 ? idx : null
  }

  const findOffsetAtPoint = (paraIdx: number, x: number, y: number): number | null => {
    const paraEl = contentElRef.current?.querySelector(`[data-para-idx="${paraIdx}"]`) as HTMLElement
    if (!paraEl) return null
    const range = caretRangeFromPoint(x, y)
    if (!range) return null

    let offset = 0
    const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT, null)
    let node: Text | null = walker.firstChild() as Text | null
    while (node) {
      if (node === range.startContainer) {
        return offset + range.startOffset
      }
      offset += (node.textContent || '').length
      node = walker.nextNode() as Text | null
    }
    return offset + range.startOffset
  }

  const getHandleRects = useCallback(() => {
    if (selStart === null || selEnd === null || selStart.paraIdx !== selEnd.paraIdx) {
      return { start: null, end: null }
    }
    const paraEl = contentElRef.current?.querySelector(`[data-para-idx="${selStart.paraIdx}"]`) as HTMLElement
    if (!paraEl) return { start: null, end: null }

    const startRect = getBoundingRectAtOffset(paraEl, selStart.offset)
    const endOffset = Math.max(selEnd.offset, selStart.offset + 1)
    const endRect = getBoundingRectAtOffset(paraEl, Math.min(endOffset, plainParagraphs[selStart.paraIdx].length))
    return { start: startRect, end: endRect }
  }, [selStart, selEnd, plainParagraphs])

  const handlePointerDown = (e: React.PointerEvent) => {
    const paraIdx = getParaIdxFromEl(e.target)
    if (paraIdx === null) return

    const hlEl = (e.target as HTMLElement)?.closest?.('.script-hl') as HTMLElement
    if (hlEl) {
      const hlId = hlEl.getAttribute('data-hl-id')
      if (hlId) {
        const rect = hlEl.getBoundingClientRect()
        setColorPickerHL(hlId)
        setColorPickerPos2({ x: rect.left + rect.width / 2, y: rect.top - 8 })
        return
      }
    }

    if (showActions || colorPickerHL) return

    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      const offset = findOffsetAtPoint(paraIdx, e.clientX, e.clientY)
      if (offset === null) return

      const text = plainParagraphs[paraIdx]
      let start = offset
      while (start > 0 && !/\s/.test(text[start - 1])) start--
      let end = offset
      while (end < text.length && !/\s/.test(text[end])) end++

      if (start >= end) return

      setSelStart({ paraIdx, offset: start })
      setSelEnd({ paraIdx, offset: end })

      setTimeout(() => {
        const rect = getBoundingRectAtOffset(
          contentElRef.current?.querySelector(`[data-para-idx="${paraIdx}"]`) as HTMLElement,
          start
        )
        if (rect) {
          setActionsPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
          setShowActions(true)
        }
      }, 50)
    }, 600)

    const onUp = () => {
      clearTimeout(longPressTimer.current)
      if (!longPressTriggered.current && colorPickerHL === null) {
        setShowActions(false)
        setSelStart(null)
        setSelEnd(null)
      }
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointerup', onUp)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragHandle || selStart === null || selEnd === null) return
    e.preventDefault()

    const paraIdx = getParaIdxFromEl(e.target)
    if (paraIdx === null || paraIdx !== selStart.paraIdx) return

    const offset = findOffsetAtPoint(paraIdx, e.clientX, e.clientY)
    if (offset === null) return

    if (dragHandle === 'start' && offset < selEnd.offset) {
      setSelStart({ paraIdx, offset })
    } else if (dragHandle === 'end' && offset > selStart.offset) {
      setSelEnd({ paraIdx, offset })
    }
  }

  const handleDragStart = (handle: 'start' | 'end') => {
    setDragHandle(handle)
    setShowActions(false)
  }

  const applyHighlight = () => {
    if (selStart === null || selEnd === null || selStart.paraIdx !== selEnd.paraIdx) return
    const text = plainParagraphs[selStart.paraIdx].slice(selStart.offset, selEnd.offset)
    if (!text.trim()) return

    const existing = state.highlights.find(h =>
      h.paragraphIndex === selStart.paraIdx &&
      h.startOffset === selStart.offset &&
      h.endOffset === selEnd.offset
    )
    if (existing) return

    const highlight: ScriptHighlight = {
      id: generateId(),
      paragraphIndex: selStart.paraIdx,
      text: text.trim(),
      color: DEFAULT_COLOR,
      shotId: null,
      createdAt: new Date().toISOString(),
      startOffset: selStart.offset,
      endOffset: selEnd.offset,
      note: '',
    }
    dispatch({ type: 'ADD_HIGHLIGHT', highlight })
    setShowActions(false)
    setSelStart(null)
    setSelEnd(null)
    setColorPickerHL(null)
  }

  const undoHighlight = () => {
    setSelStart(null)
    setSelEnd(null)
    setShowActions(false)
  }

  const addShotFromHighlight = (hlId: string) => {
    const hl = state.highlights.find(h => h.id === hlId)
    const text = hl?.text || ''
    const row = nextRow++
    dispatch({
      type: 'ADD_SHOT',
      shot: {
        row,
        type: 'CU',
        description: text,
        subShot: '', location: '', setup: '', notes: '',
        referenceLink: '', shootDay: '', shootOrder: String(state.shots.length + 1),
        done: false, priority: '', graphic: '', title: '', effect: '', duration: '', crew: [],
      },
    })
    dispatch({
      type: 'ADD_NOTIFICATION',
      notification: { id: Date.now().toString(), message: `Added shot #${state.shots.length + 1}: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`, from: 'Script Review', timestamp: new Date().toISOString(), read: false },
    })
    if (hl) {
      dispatch({ type: 'UPDATE_HIGHLIGHT', id: hlId, data: { shotId: row } })
    }
    setColorPickerHL(null)
  }

  const changeHighlightColor = (hlId: string, color: string) => {
    dispatch({ type: 'UPDATE_HIGHLIGHT', id: hlId, data: { color } })
  }

  const removeHighlight = (hlId: string) => {
    const hl = state.highlights.find(h => h.id === hlId)
    if (hl?.note) {
      if (!confirm('This highlight has a note. Delete anyway?')) return
    }
    dispatch({ type: 'REMOVE_HIGHLIGHT', id: hlId })
    setColorPickerHL(null)
  }

  const addNote = (hlId: string) => {
    setShowNoteInput(hlId)
    const hl = state.highlights.find(h => h.id === hlId)
    setNoteText(hl?.note || '')
  }

  const saveNote = () => {
    if (showNoteInput) {
      dispatch({ type: 'ADD_HIGHLIGHT_NOTE', id: showNoteInput, note: noteText })
      setShowNoteInput(null)
      setNoteText('')
      setColorPickerHL(null)
    }
  }

  const searchHighlight = (text: string, target: 'book' | 'wikipedia' | 'google') => {
    const q = encodeURIComponent(text)
    if (target === 'book') {
      if (contentElRef.current) {
        contentElRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    } else if (target === 'wikipedia') {
      window.open(`https://en.wikipedia.org/wiki/${q}`, '_blank')
    } else {
      window.open(`https://www.google.com/search?q=${q}`, '_blank')
    }
    setColorPickerHL(null)
  }

  const highlightsForPara = useMemo(() => {
    const map = new Map<number, ScriptHighlight[]>()
    for (const h of state.highlights) {
      if (!map.has(h.paragraphIndex)) map.set(h.paragraphIndex, [])
      map.get(h.paragraphIndex)!.push(h)
    }
    return map
  }, [state.highlights])

  const pendingSelText = useMemo(() => {
    if (selStart === null || selEnd === null || selStart.paraIdx !== selEnd.paraIdx) return ''
    return plainParagraphs[selStart.paraIdx]?.slice(selStart.offset, selEnd.offset) || ''
  }, [selStart, selEnd, plainParagraphs])

  const isActionMenuOpen = showActions && pendingSelText.length > 0

  return (
    <div className="script-review" ref={contentRef}>
      <div className="script-review-header">
        <h2>Script Review</h2>
        <div className="script-review-header-actions">
          <span className="shot-count">{state.highlights.length} highlights</span>
          {state.highlights.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => goToView('highlights')}>
              All Highlights
            </button>
          )}
        </div>
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

      <div className="script-content" ref={contentElRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        style={{ userSelect: dragHandle ? 'none' : undefined }}>
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

          const pendingHL = (selStart?.paraIdx === i && selEnd?.paraIdx === i && isActionMenuOpen)
            ? [{ start: selStart.offset, end: selEnd.offset, color: DEFAULT_COLOR, id: 'pending' }]
            : []

          const allSpans = [...pendingHL, ...spans]
          const nodes = allSpans.length > 0
            ? buildHighlightedNodes(text, allSpans, `p${i}`, (id) => {
                if (id === 'pending') return
                const el = contentElRef.current?.querySelector(`[data-hl-id="${id}"]`)
                if (el) {
                  const r = el.getBoundingClientRect()
                  setColorPickerHL(id)
                  setColorPickerPos2({ x: r.left + r.width / 2, y: r.top - 8 })
                }
              })
            : text

          return (
            <div key={i} className="script-paragraph" data-para-idx={i}>
              <span className="script-paragraph-num">{i + 1}</span>
              <div className="script-para-content">{nodes}</div>
            </div>
          )
        })}

        {(isActionMenuOpen) && (() => {
          const { start: startRect } = getHandleRects()
          if (!startRect) return null
          return (
            <div className="hl-handles-layer">
              <div
                className="hl-handle hl-handle-start"
                style={{ left: startRect.left - 12, top: startRect.top - 12 }}
                onPointerDown={(e) => { e.stopPropagation(); handleDragStart('start') }}
              />
              <div className="hl-handle-line"
                style={{ left: startRect.left - 1, top: startRect.top, width: 2, height: startRect.height }} />
            </div>
          )
        })()}

        {(isActionMenuOpen) && (() => {
          const { end: endRect } = getHandleRects()
          if (!endRect) return null
          return (
            <div className="hl-handles-layer">
              <div
                className="hl-handle hl-handle-end"
                style={{ left: endRect.left - 12, top: endRect.top - 12 }}
                onPointerDown={(e) => { e.stopPropagation(); handleDragStart('end') }}
              />
              <div className="hl-handle-line"
                style={{ left: endRect.left - 1, top: endRect.top, width: 2, height: endRect.height }} />
            </div>
          )
        })()}
      </div>

      {isActionMenuOpen && (
        <div className="hl-overlay" onClick={() => { setShowActions(false); setSelStart(null); setSelEnd(null) }}>
          <div className="hl-action-menu" style={{ left: actionsPos.x, top: actionsPos.y }}
            onClick={e => e.stopPropagation()}>
          <button className="hl-action-btn" onClick={applyHighlight}>
            <span className="hl-action-icon">✓</span> Highlight
          </button>
          {state.highlights.filter(h =>
            h.paragraphIndex === selStart?.paraIdx &&
            h.startOffset === selStart?.offset &&
            h.endOffset === selEnd?.offset
          ).length === 0 && (
            <button className="hl-action-btn" onClick={undoHighlight}>
              <span className="hl-action-icon">↩</span> Undo
            </button>
          )}
          </div>
        </div>
      )}

      {colorPickerHL && !showNoteInput && (
        <div className="hl-overlay" onClick={() => setColorPickerHL(null)}>
          <div className="hl-color-menu" style={{ left: colorPickerPos2.x, top: colorPickerPos2.y }}
            onClick={e => e.stopPropagation()}>
            <div className="hl-color-swatches">
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c.value}
                  className={`hl-color-btn ${state.highlights.find(h => h.id === colorPickerHL)?.color === c.value ? 'active' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => changeHighlightColor(colorPickerHL, c.value)}
                  title={c.name} />
              ))}
            </div>
            <div className="hl-color-actions">
              <button className="hl-action-btn" onClick={() => addShotFromHighlight(colorPickerHL)}>
                <span className="hl-action-icon">+</span> Shot
              </button>
              <button className="hl-action-btn" onClick={() => addNote(colorPickerHL)}>
                <span className="hl-action-icon">📝</span> Note
              </button>
              <button className="hl-action-btn" onClick={() => {
                const hl = state.highlights.find(h => h.id === colorPickerHL)
                if (hl) searchHighlight(hl.text, 'wikipedia')
              }}>
                <span className="hl-action-icon">🌐</span> Search
              </button>
              <button className="hl-action-btn danger" onClick={() => removeHighlight(colorPickerHL)}>
                <span className="hl-action-icon">🗑</span> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteInput && (
        <div className="hl-overlay" onClick={() => { setShowNoteInput(null); setNoteText('') }}>
          <div className="hl-note-dialog" onClick={e => e.stopPropagation()}>
            <h3>Annotation Note</h3>
            <textarea className="hl-note-input"
              placeholder="Add a note for this highlight..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
              rows={4} />
            <div className="hl-note-actions">
              <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={!noteText.trim()}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowNoteInput(null); setNoteText('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
