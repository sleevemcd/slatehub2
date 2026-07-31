import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || '/data'
const DATA_FILE = path.join(DATA_DIR, 'slatehub-data.json')
const PORT = 80

// In-memory relay state by session ID
const relayStore = new Map()

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {}
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch { return {} }
}

function writeData(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const headers = { 'Access-Control-Allow-Origin': '*' }

  if (req.url === '/api/data' && req.method === 'GET') {
    const data = readData()
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
    return
  }

  if (req.url === '/api/data' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const existing = readData()
        const incoming = JSON.parse(body)
        const mergeBy = (a, b, key) => {
          const map = new Map()
          for (const item of a || []) map.set(item[key], item)
          for (const item of b || []) map.set(item[key], item)
          return [...map.values()]
        }
        const data = {
          ...existing,
          ...incoming,
          projects: mergeBy(existing.projects, incoming.projects, 'id'),
          crewMembers: mergeBy(existing.crewMembers, incoming.crewMembers, 'name'),
          savedUsers: mergeBy(existing.savedUsers, incoming.savedUsers, 'email'),
          quickMessages: mergeBy(existing.quickMessages, incoming.quickMessages, 'id'),
          projectsData: {
            ...(existing.projectsData || {}),
            ...(incoming.projectsData || {}),
          },
        }
        writeData(data)
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { ...headers, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }

  if (req.url === '/api/relay' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        const sessionId = parsed.sessionId
        if (sessionId) {
          relayStore.set(sessionId, {
            scrollPosition: parsed.scrollPosition ?? 0,
            speed: parsed.speed ?? 5,
            playing: parsed.playing ?? false,
            updatedAt: Date.now(),
          })
        }
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(400, { ...headers, 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
      }
    })
    return
  }

  if (req.url?.startsWith('/api/relay') && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId && relayStore.has(sessionId)) {
      const state = relayStore.get(sessionId)
      const age = Date.now() - state.updatedAt
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, result: { ...state, age } }))
    } else {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, result: { scrollPosition: 0, speed: 5, playing: false, age: null } }))
    }
    return
  }

  const filePath = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url)
  const ext = path.extname(filePath)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath)
    res.writeHead(200, { ...headers, 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(content)
  } else {
    const fallback = path.join(__dirname, 'dist', 'index.html')
    const content = fs.readFileSync(fallback)
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html' })
    res.end(content)
  }
})

server.listen(PORT, () => {
  console.log(`SlateHub server running on port ${PORT}, data dir: ${DATA_DIR}`)
})
