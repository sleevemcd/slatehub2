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