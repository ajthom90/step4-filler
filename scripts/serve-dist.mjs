// Static server for dist/ on port 4173. Applies the rules in dist/_headers
// (Cloudflare Pages format) so tests see the same headers production serves.
// Node built-ins only.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const PORT = 4173
const HOST = '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

/** Parse `_headers`: an unindented path pattern, then indented `Name: value` lines. */
function parseHeaders(text) {
  const rules = []
  let current = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (/^\s/.test(line)) {
      const index = line.indexOf(':')
      if (current && index > 0) current.headers.push([line.slice(0, index).trim(), line.slice(index + 1).trim()])
    } else {
      current = { pattern: line.trim(), headers: [] }
      rules.push(current)
    }
  }
  return rules
}

function matches(pattern, pathname) {
  const source = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${source}$`).test(pathname)
}

const headersFile = join(root, '_headers')
const rules = existsSync(headersFile) ? parseHeaders(readFileSync(headersFile, 'utf8')) : []

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://${HOST}`)
  let file = normalize(join(root, decodeURIComponent(pathname)))
  const send = (status, body, type = 'text/plain; charset=utf-8') => {
    res.statusCode = status
    for (const rule of rules) {
      if (matches(rule.pattern, pathname)) for (const [name, value] of rule.headers) res.setHeader(name, value)
    }
    res.setHeader('Content-Type', type)
    res.end(req.method === 'HEAD' ? undefined : body)
  }
  if (file !== root && !file.startsWith(root + sep)) return send(403, 'Forbidden')
  if (pathname.endsWith('/')) file = join(file, 'index.html')
  try {
    send(200, await readFile(file), TYPES[extname(file)] ?? 'application/octet-stream')
  } catch {
    send(404, 'Not found')
  }
}).listen(PORT, HOST, () => console.log(`Serving dist/ at http://${HOST}:${PORT}`))
