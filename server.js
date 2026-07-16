import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || '/data'
const DATA_FILE = path.join(DATA_DIR, 'slatehub-data.json')
const PORT = 80

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
        const data = JSON.parse(body)
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
