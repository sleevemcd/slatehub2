type PickerCallback = (docUrl: string, docName: string) => void

declare global {
  interface Window {
    gapi?: any
    google?: any
  }
}

let loaded = false
let loadQueue: (() => void)[] = []

function loadLibraries(): Promise<void> {
  return new Promise((resolve) => {
    if (loaded) { resolve(); return }
    loadQueue.push(() => resolve())
    if (loadQueue.length > 1) return

    const gsi = document.createElement('script')
    gsi.src = 'https://accounts.google.com/gsi/client'
    gsi.onload = () => {
      const api = document.createElement('script')
      api.src = 'https://apis.google.com/js/api.js'
      api.onload = () => {
        window.gapi.load('picker', () => {
          loaded = true
          loadQueue.forEach(cb => cb())
          loadQueue = []
        })
      }
      document.head.appendChild(api)
    }
    document.head.appendChild(gsi)
  })
}

let tokenClient: any = null
let accessToken = ''

function getOAuthToken(clientId: string, callback: () => void) {
  if (accessToken) { callback(); return }
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp: any) => {
        if (resp.access_token) {
          accessToken = resp.access_token
          callback()
        }
      },
    })
  }
  tokenClient.requestAccessToken()
}

export function getAccessToken(): string {
  return accessToken
}

export async function fetchDocViaDriveApi(docUrl: string): Promise<{ html?: string; error?: string }> {
  const token = accessToken
  if (!token) return { error: 'No access token. Try opening the Browse picker again.' }
  const match = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return { error: 'Invalid Google Doc URL' }
  const fileId = match[1]
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/html`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return { error: `Drive API error (${res.status}). Make sure the doc is accessible.` }
    const html = await res.text()
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const body = bodyMatch ? bodyMatch[1] : html
    return { html: body }
  } catch (e) {
    return { error: `Network error fetching doc: ${e}` }
  }
}

export function openGooglePicker(apiKey: string, clientId: string, onPick: PickerCallback) {
  if (!apiKey || !clientId) return
  loadLibraries().then(() => {
    getOAuthToken(clientId, () => {
      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.DOCUMENTS)
        .addView(window.google.picker.ViewId.DOCS_VIDEOS)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: any) => {
          if (data.action === 'selected' && data.docs?.[0]) {
            const doc = data.docs[0]
            const docUrl = `https://docs.google.com/document/d/${doc.id}/edit`
            onPick(docUrl, doc.name || 'Untitled')
          }
        })
        .build()
      picker.setVisible(true)
    })
  })
}
