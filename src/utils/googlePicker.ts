type PickerCallback = (docUrl: string, docName: string) => void

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
        gapi.load('picker', () => {
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
    tokenClient = google.accounts.oauth2.initTokenClient({
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

export function openGooglePicker(apiKey: string, clientId: string, onPick: PickerCallback) {
  if (!apiKey || !clientId) return
  loadLibraries().then(() => {
    getOAuthToken(clientId, () => {
      const picker = new google.picker.PickerBuilder()
        .addView(google.picker.ViewId.DOCUMENTS)
        .addView(google.picker.ViewId.DOCS_VIDEOS)
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
