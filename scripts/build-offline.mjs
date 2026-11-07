// Runs after `vite build`. Folds dist/index.html and its one script and one stylesheet into a
// single self-contained file, dist/step4-inventory-offline.html, with its own policy in a meta tag.
// The policy lists the SHA-256 of the inline script and style instead of allowing inline code.
// Node built-ins only.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const read = (relative) => readFileSync(resolve(dist, relative.replace(/^\//, '')), 'utf8')
const hash = (body) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`

const page = read('index.html')
const scripts = [...page.matchAll(/<script\b[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g)]
const styles = [...page.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>/g)]
if (scripts.length !== 1 || styles.length !== 1) {
  throw new Error(`Expected one script and one stylesheet in dist/index.html, found ${scripts.length} and ${styles.length}`)
}

// The text between the tags is what the browser hashes, so the same string is hashed and written.
// "</script" would end the element early, and "<!--" can switch the parser into a state that hides it.
const script = read(scripts[0][1]).replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--')
const style = read(styles[0][1])
if (/<\/style/i.test(style)) throw new Error('The stylesheet contains "</style", which cannot be inlined safely')

const policy = [
  "default-src 'none'",
  `script-src ${hash(script)}`,
  `style-src ${hash(style)}`,
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

const head = (page.match(/<head>([\s\S]*?)<\/head>/) ?? [])[1]
const body = (page.match(/<body>([\s\S]*?)<\/body>/) ?? [])[1]
if (!head || !body) throw new Error('dist/index.html has no head or body')

// Keep charset, viewport, color-scheme and title; drop everything that would cause a request.
const kept = head
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^<(meta|title)\b/.test(line))
const bodyWithoutScripts = body.replace(/<script\b[^>]*><\/script>/g, '').trim()

const out = `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Security-Policy" content="${policy}" />
    ${kept.join('\n    ')}
    <style>${style}</style>
  </head>
  <body>
    ${bodyWithoutScripts}
    <script type="module">${script}</script>
  </body>
</html>
`

if (/<link\b|\ssrc=|manifest/i.test(out.replace(script, '').replace(style, ''))) {
  throw new Error('The offline file would reference an outside file')
}
writeFileSync(resolve(dist, 'step4-inventory-offline.html'), out)
console.log(`Wrote dist/step4-inventory-offline.html (${(out.length / 1024).toFixed(1)} kB)`)
