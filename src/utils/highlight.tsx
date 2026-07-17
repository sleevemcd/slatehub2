export interface HighlightSpan {
  start: number
  end: number
  color: string
  id: string
}

export function getPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '')
  const d = document.createElement('div')
  d.innerHTML = html
  return d.textContent || ''
}

export function caretRangeFromPoint(x: number, y: number): Range | null {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y)
  }
  if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y)
    if (pos) {
      const range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      return range
    }
  }
  return null
}

export function getWordAtPoint(x: number, y: number): { text: string; startOffset: number; endOffset: number } | null {
  const range = caretRangeFromPoint(x, y)
  if (!range) return null

  const textNode = range.startContainer
  if (textNode.nodeType !== Node.TEXT_NODE) return null

  const fullText = textNode.textContent || ''
  const offset = range.startOffset

  let start = offset
  while (start > 0 && !/\s/.test(fullText[start - 1])) start--

  let end = offset
  while (end < fullText.length && !/\s/.test(fullText[end])) end++

  if (start === end) return null

  return { text: fullText.slice(start, end), startOffset: start, endOffset: end }
}

export function getTextOffsetInParagraph(paragraphEl: HTMLElement, textNode: Text, nodeOffset: number): number {
  let offset = 0
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT, null)
  let node: Text | null = walker.firstChild() as Text | null
  while (node) {
    if (node === textNode) {
      return offset + nodeOffset
    }
    offset += (node.textContent || '').length
    node = walker.nextNode() as Text | null
  }
  return offset + nodeOffset
}

export function findTextNodeAtOffset(paragraphEl: HTMLElement, targetOffset: number): { node: Text; offset: number } | null {
  let accumulated = 0
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT, null)
  let node: Text | null = walker.firstChild() as Text | null
  while (node) {
    const len = (node.textContent || '').length
    if (accumulated + len > targetOffset) {
      return { node, offset: targetOffset - accumulated }
    }
    accumulated += len
    node = walker.nextNode() as Text | null
  }
  return null
}

export function getBoundingRectAtOffset(paragraphEl: HTMLElement, targetOffset: number): DOMRect | null {
  const found = findTextNodeAtOffset(paragraphEl, targetOffset)
  if (!found) return null
  const range = document.createRange()
  range.setStart(found.node, found.offset)
  range.setEnd(found.node, Math.min(found.offset + 1, (found.node.textContent || '').length))
  return range.getBoundingClientRect()
}

export function buildHighlightedNodes(
  text: string,
  highlights: HighlightSpan[],
  key: string,
  onTapHighlight?: (id: string, text: string) => void
): React.ReactNode[] {
  if (highlights.length === 0) return [text]

  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const nodes: React.ReactNode[] = []
  let pos = 0

  for (const h of sorted) {
    if (h.start > pos) {
      nodes.push(text.slice(pos, h.start))
    }
    const frag = text.slice(Math.max(h.start, pos), Math.min(h.end, text.length))
    if (frag) {
      nodes.push(
        <mark
          key={`${key}-hl-${h.id}`}
          className="script-hl"
          data-hl-id={h.id}
          data-hl-text={frag}
          style={{ background: h.color, color: '#000', borderRadius: 2, padding: '0 2px', cursor: 'pointer' }}
          onClick={() => onTapHighlight?.(h.id, frag)}
        >
          {frag}
        </mark>
      )
    }
    pos = Math.max(pos, h.end)
  }
  if (pos < text.length) {
    nodes.push(text.slice(pos))
  }

  return nodes
}
