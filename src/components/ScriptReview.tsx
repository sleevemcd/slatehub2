import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { docUrlToTxtUrl } from '../utils/sheet'
import { getPlainText, buildHighlightedNodes, getTextOffsetInParagraph } from '../utils/highlight'
import type { ScriptHighlight } from '../types'
import { HIGHLIGHT_COLORS } from '../types'
import { openGooglePicker, fetchDocViaDriveApi } from '../utils/googlePicker'

let nextRow = 1000
const DEFAULT_COLOR = HIGHLIGHT_COLORS[0].value

function generateId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8)
}

function extractDocBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) {
    let content = bodyMatch[1]
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    content = content.replace(/<meta[^>]*>/gi, '')
    content = content.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    content = content.replace(/<span[^>]*>/gi, '<span>')
    return content
  }
  let content = html
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  content = content.replace(/<meta[^>]*>/gi, '')
  content = content.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
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

function textToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function ScriptReview() {
  const { state, dispatch, goToView, activeProject } = useApp()
  const [rawHtml, setRawHtml] = useState(state.scriptContent || '')
  const [loading, setLoading] = useState(false)
  const [scriptError, setScriptError] = useState('')
  const [docUrl, setDocUrl] = useState(activeProject?.docUrl || '')
  const [inputMode, setInputMode] = useState<'url' | 'paste'>('url')
  const [pasteText, setPasteText] = useState('')

  const contentElRef = useRef<HTMLDivElement>(null)

  const [showNoteInput, setShowNoteInput] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const [selStart, setSelStart] = useState<{ paraIdx: number; offset: number } | null>(null)
  const [selEnd, setSelEnd] = useState<{ paraIdx: number; offset: number } | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [actionsPos, setActionsPos] = useState({ x: 0, y: 0 })

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
    setScriptError('')
    try {
      const txtUrl = docUrlToTxtUrl(url)
      if (!txtUrl) { setScriptError('Invalid Google Doc URL'); return }
      const htmlUrl = txtUrl.replace('export?format=txt', 'export?format=html')
      const res = await fetch(htmlUrl, { cache: 'no-cache' })
      if (!res.ok) { setScriptError(`Failed to fetch doc (${res.status}). Try publishing the doc first.`); return }
      const html = await res.text()
      const body = extractDocBody(html)
      setRawHtml(body)
      dispatch({ type: 'SET_SCRIPT_CONTENT', content: body })
    } catch {
      setScriptError('Network error fetching script.')
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    if (activeProject?.docUrl) {
      setDocUrl(activeProject.docUrl)
    }
  }, [activeProject?.docUrl])

  const handleFetch = () => {
    if (!docUrl) return
    fetchScript(docUrl)
    if (activeProject) {
      dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, data: { docUrl } })
    }
  }

  const handlePasteLoad = () => {
    if (!pasteText.trim()) return
    setScriptError('')
    const html = textToHtml(pasteText)
    setRawHtml(html)
    dispatch({ type: 'SET_SCRIPT_CONTENT', content: html })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) {
      e.preventDefault()
      const body = extractDocBody(html)
      if (body) {
        setPasteText(text)
        setRawHtml(body)
        dispatch({ type: 'SET_SCRIPT_CONTENT', content: body })
        setScriptError('')
        return
      }
    }
  }

  const handlePointerUp = () => {
    if (!rawHtml || colorPickerHL) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
    const range = sel.getRangeAt(0)

    const startNode = range.startContainer
    const startEl = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode as HTMLElement
    const paraEl = startEl?.closest?.('[data-para-idx]') as HTMLElement | null
    if (!paraEl) return
    if (!contentElRef.current?.contains(paraEl)) return

    const paraIdx = parseInt(paraEl.getAttribute('data-para-idx') || '-1', 10)
    if (paraIdx < 0) return

    const contentEl = paraEl.querySelector('.script-para-content') as HTMLElement
    if (!contentEl) return

    const endNode = range.endContainer
    const endEl = endNode.nodeType === Node.TEXT_NODE ? endNode.parentElement : endNode as HTMLElement
    const endParaEl = endEl?.closest?.('[data-para-idx]') as HTMLElement | null
    if (!endParaEl || endParaEl !== paraEl) return

    const startOffset = getTextOffsetInParagraph(contentEl, range.startContainer as Text, range.startOffset)
    const endOffset = getTextOffsetInParagraph(contentEl, range.endContainer as Text, range.endOffset)
    if (startOffset >= endOffset) return

    setSelStart({ paraIdx, offset: startOffset })
    setSelEnd({ paraIdx, offset: endOffset })

    const rect = range.getBoundingClientRect()
    setActionsPos({ x: rect.left + rect.width / 2, y: rect.top - 12 })
    setShowActions(true)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
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

    if (showActions || colorPickerHL) {
      setShowActions(false)
      setSelStart(null)
      setSelEnd(null)
      setColorPickerHL(null)
    }
  }

  const applyHighlight = (color: string = DEFAULT_COLOR) => {
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
      color,
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
        done: false, priority: '', graphic: '', title: '', effect: '', duration: '', roll: '', scene: '', crew: [],
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
    <div className="script-review" ref={contentElRef}>
      <div className="script-review-header">
        <h2>Script Review</h2>
        <div className="script-review-header-actions">
          {state.teleprompter.googleApiKey && state.teleprompter.googleClientId && (
            <button className="btn btn-ghost btn-sm" onClick={() =>
              openGooglePicker(state.teleprompter.googleApiKey, state.teleprompter.googleClientId, async (url, name) => {
                setDocUrl(url)
                setScriptError('')
                const result = await fetchDocViaDriveApi(url)
                if (result.html) {
                  setRawHtml(result.html)
                  dispatch({ type: 'SET_SCRIPT_CONTENT', content: result.html })
                } else if (result.error) {
                  setScriptError(result.error)
                }
                if (activeProject) {
                  dispatch({ type: 'UPDATE_PROJECT', id: activeProject.id, data: { docUrl: url } })
                }
              })
            }>
              📁 Browse
            </button>
          )}
          <span className="shot-count">{state.highlights.length} highlights</span>
          {state.highlights.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => goToView('highlights')}>
              All Highlights
            </button>
          )}
        </div>
      </div>

      <div className="script-input-section">
        <div className="input-mode-tabs">
          <button className={`btn btn-sm ${inputMode === 'url' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInputMode('url')}>From URL</button>
          <button className={`btn btn-sm ${inputMode === 'paste' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInputMode('paste')}>Paste Text</button>
        </div>
        {inputMode === 'url' ? (
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
        ) : (
          <div className="script-paste-area">
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Paste your script text here... (formatting preserved from rich sources)"
              className="input"
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <button className="btn btn-primary" onClick={handlePasteLoad} disabled={!pasteText.trim()}>
              Load Script
            </button>
          </div>
        )}
      </div>

      {scriptError && <div className="script-error">{scriptError}</div>}

      <div className="script-content"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}>
        {!rawHtml && !loading && (
          <div className="empty-state">
            <p>Enter a published Google Doc URL or paste script text directly.</p>
            <p className="empty-hint">For URL: File → Share → Publish to web in your Google Doc first.</p>
            <p className="empty-hint">For paste: use the Paste Text tab above.</p>
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
      </div>

      {isActionMenuOpen && (
        <div className="hl-overlay" onClick={() => { setShowActions(false); setSelStart(null); setSelEnd(null) }}>
          <div className="hl-color-menu" style={{ left: actionsPos.x, top: actionsPos.y }}
            onClick={e => e.stopPropagation()}>
            <div className="hl-color-swatches">
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c.value}
                  className="hl-color-btn"
                  style={{ background: c.value }}
                  onClick={() => applyHighlight(c.value)}
                  title={c.name} />
              ))}
            </div>
            <div className="hl-color-label">Pick a color to highlight</div>
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
