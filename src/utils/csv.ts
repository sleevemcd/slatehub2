import type { ShotRecord } from '../types'

export function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (const ch of csvText) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else if (ch === '\r' && !inQuotes) {
      continue
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let field = ''
    let q = false
    for (const ch of line) {
      if (ch === '"') {
        q = !q
      } else if (ch === ',' && !q) {
        fields.push(field.trim())
        field = ''
      } else {
        field += ch
      }
    }
    fields.push(field.trim())
    return fields
  }

  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).filter(l => l.trim()).map(parseLine)
  return { headers, rows }
}

export function rowsToShotRecords(headers: string[], rows: string[][]): ShotRecord[] {
  const get = (row: string[], names: string[]): string => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.toLowerCase().trim() === n.toLowerCase().trim())
      if (idx !== -1 && idx < row.length) return row[idx]
    }
    return ''
  }

  return rows.map((row, i) => {
    const doneRaw = get(row, ['done y/n', 'done', 'complete', 'status'])
    return {
      row: i + 2,
      type: get(row, ['type']),
      description: get(row, ['description']),
      subShot: get(row, ['sub shot', 'subshot', 'sub_shot', 'shot']),
      location: get(row, ['location', 'loc']),
      setup: get(row, ['setup', 'camera setup']),
      notes: get(row, ['notes', 'note']),
      referenceLink: get(row, ['reference link', 'reference', 'ref link', 'ref']),
      shootDay: get(row, ['shoot day', 'day', 'day']),
      shootOrder: get(row, ['shoot order', 'order', 'ord']),
      done: ['y', 'yes', 'true', '1', 'done', 'x'].includes(doneRaw.toLowerCase().trim()),
      priority: get(row, ['priority', 'pri']),
      crew: [],
    }
  }).filter(s => s.type || s.description)
}
