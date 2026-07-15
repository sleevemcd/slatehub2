export function sheetUrlToCsvUrl(sheetUrl: string): string | null {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return null
  const sheetId = match[1]
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
}

export async function fetchSheetCsv(csvUrl: string): Promise<string> {
  const res = await fetch(csvUrl, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status} ${res.statusText}`)
  return res.text()
}

export function docUrlToTxtUrl(docUrl: string): string | null {
  const match = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return null
  const docId = match[1]
  return `https://docs.google.com/document/d/${docId}/export?format=txt`
}

export async function fetchDocText(txtUrl: string): Promise<string> {
  const res = await fetch(txtUrl, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Failed to fetch doc: ${res.status} ${res.statusText}`)
  return res.text()
}

export async function fetchTeleprompterState(relayUrl: string, sessionId: string): Promise<{ scrollPosition: number; speed: number; playing: boolean } | null> {
  try {
    const url = `${relayUrl}?action=getTeleprompterState&sessionId=${encodeURIComponent(sessionId)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.success && data.result) {
      return {
        scrollPosition: data.result.scrollPosition ?? 0,
        speed: data.result.speed ?? 5,
        playing: data.result.playing ?? false,
      }
    }
    return null
  } catch {
    return null
  }
}

export async function sendTeleprompterState(
  relayUrl: string,
  sessionId: string,
  state: { scrollPosition?: number; speed?: number; playing?: boolean }
): Promise<boolean> {
  try {
    const res = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateTeleprompterState',
        sessionId,
        ...state,
      }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}
