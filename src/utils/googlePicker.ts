type PickerCallback = (docUrl: string, docName: string) => void

let pickerLoaded = false
let loadCallbacks: (() => void)[] = []

function loadPickerApi(): Promise<void> {
  return new Promise((resolve) => {
    if (pickerLoaded) { resolve(); return }
    loadCallbacks.push(() => resolve())
    if (loadCallbacks.length > 1) return
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      gapi.load('picker', () => {
        pickerLoaded = true
        loadCallbacks.forEach(cb => cb())
        loadCallbacks = []
      })
    }
    document.head.appendChild(script)
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
  loadPickerApi().then(() => {
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
