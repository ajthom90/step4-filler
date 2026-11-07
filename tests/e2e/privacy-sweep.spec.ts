import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Page, Request } from '@playwright/test'
import { site } from '../../site.config'
import { saveCopy } from '../../src/content/copy'
import { expect, test } from './fixtures'

const SENTINEL = 'Sentinel-Zebra-7731-privacy'
const PASSWORD = 'correct horse battery'
const KEY = 'step4-inventory'

type Seen = { url: string; headers: Record<string, string>; body: string }

/** Records every request the page makes, with its headers and body, for the sentinel search. */
function recordRequests(page: Page): { seen: Seen[]; settle: () => Promise<void> } {
  const seen: Seen[] = []
  const pending: Promise<void>[] = []
  page.context().on('request', (request: Request) => {
    pending.push(
      (async () => {
        const headers = await request.allHeaders().catch(() => ({}))
        const body = request.postDataBuffer()?.toString('latin1') ?? ''
        seen.push({ url: request.url(), headers, body })
      })(),
    )
  })
  return { seen, settle: async () => void (await Promise.all(pending)) }
}

/** Moves to another screen without reloading, and waits for focus to settle on its heading. A reload would lose an unsaved inventory. */
async function goTo(page: Page, hash: string) {
  const moved = await page.evaluate((h) => {
    const changed = (window.location.hash || '#/home') !== h
    window.location.hash = h
    return changed
  }, hash)
  if (moved) await expect(page.locator('main h1')).toBeFocused()
}

/** Fills in whatever each screen of one inventory asks for, with the sentinel, until the inventory says it is finished. */
async function walk(page: Page, inventory: 'resentments' | 'fears' | 'harms') {
  await goTo(page, '#/home')
  await page.getByRole('link', { name: { resentments: 'Resentments', fears: 'Fears', harms: 'Sex conduct and harms' }[inventory], exact: true }).click()
  const h1 = page.getByRole('heading', { level: 1 })
  for (let screens = 0; screens < 60; screens++) {
    if (/^You've been through every/.test((await h1.innerText()).trim())) return
    const add = page.locator('main form.add input[type=text]').first()
    if (await add.count()) {
      await add.fill(SENTINEL)
      await add.press('Enter')
    }
    for (const area of await page.locator('main textarea').all()) await area.fill(SENTINEL)
    const choice = page.locator('main input[type=radio], main input[type=checkbox]').first()
    if (await choice.count()) await choice.check()
    const before = page.url()
    await page.locator('.stepnav button.primary').click()
    await page.waitForFunction((was) => window.location.href !== was, before)
    await expect(h1).toBeFocused() // the new screen has drawn
  }
  throw new Error(`${inventory} never finished`)
}

async function download(page: Page, buttonName: string): Promise<{ name: string; text: string }> {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()])
  return { name: file.suggestedFilename(), text: readFileSync((await file.path())!, 'utf8') }
}

test('typed text never appears in any request URL, header, or body', async ({ page }) => {
  const { seen, settle } = recordRequests(page)

  // Start from the first-visit screen and go through every section.
  await page.goto('/')
  await page.getByRole('radio', { name: 'Food', exact: true }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  for (const inventory of ['resentments', 'fears', 'harms'] as const) await walk(page, inventory)

  await goTo(page, '#/checklist')
  await page.getByRole('checkbox').first().check()
  await page.locator('main textarea').fill(SENTINEL)
  await goTo(page, '#/pledge')
  await page.locator('main input[type=text]').nth(0).fill(SENTINEL)
  await page.locator('main input[type=text]').nth(0).press('Enter')
  await page.locator('main input[type=text]').nth(2).fill(SENTINEL)
  await page.locator('main input[type=text]').nth(3).fill(SENTINEL)

  // Saving, in the browser with a password, and downloads of both kinds.
  await goTo(page, '#/save')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(PASSWORD)
  await page.getByRole('button', { name: saveCopy.labels.saveBrowserPassword }).click()
  await expect(page.locator('main')).toContainText(saveCopy.savedBrowserEncrypted, { timeout: 30_000 }) // key derivation is slow under load
  const locked = await download(page, saveCopy.labels.downloadPassword)
  expect(locked.text).not.toContain(SENTINEL)
  await page.getByRole('button', { name: 'Remove the password' }).click()
  await page.getByRole('button', { name: saveCopy.removeYes }).click()
  await expect(page.locator('main')).toContainText(saveCopy.passwordRemoved)
  const plain = await download(page, saveCopy.labels.downloadPlain)
  expect(plain.text).toContain(SENTINEL) // the readable file really does hold what was typed

  // Printing, then opening each file again.
  await goTo(page, '#/print')
  await expect(page.getByRole('heading', { level: 1, name: 'Print your inventory' })).toBeVisible()
  await goTo(page, '#/save')
  await page.getByLabel('Open a saved file').setInputFiles({ name: plain.name, mimeType: 'application/json', buffer: Buffer.from(plain.text) })
  await page.getByRole('button', { name: saveCopy.replaceYes }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeFocused() // opening a file ends on home
  await goTo(page, '#/save')
  await page.getByLabel('Open a saved file').setInputFiles({ name: locked.name, mimeType: 'application/json', buffer: Buffer.from(locked.text) })
  await page.getByLabel(saveCopy.labels.filePassword).fill(PASSWORD)
  await page.getByRole('button', { name: saveCopy.labels.openFileButton }).click()
  await page.getByRole('button', { name: saveCopy.replaceYes }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeFocused()
  await page.reload()

  expect(await page.evaluate((k) => localStorage.getItem(k), KEY), 'the sentinel was really entered and saved').not.toBeNull()
  await settle()
  expect(seen.length, 'requests were recorded').toBeGreaterThan(0)
  const needles = [SENTINEL, encodeURIComponent(SENTINEL), SENTINEL.toLowerCase(), Buffer.from(SENTINEL).toString('base64').replace(/=+$/, '')]
  const exposed = seen.filter((r) => {
    const haystack = `${r.url}\n${JSON.stringify(r.headers)}\n${r.body}`
    return needles.some((n) => haystack.includes(n))
  })
  expect(exposed.map((r) => r.url)).toEqual([])
})

// ---------------------------------------------------------------------------------------------------------
// Scans of the build output. They read files, not a browser, so they run once.
// ---------------------------------------------------------------------------------------------------------

const dist = join(process.cwd(), 'dist')

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

/** What the build must contain and nothing more, so a new outside reference is a visible decision. */
const ALLOWED_URLS = new Set(
  [
    site.bigBookUrl,
    'https://findahelpline.com',
    'tel:988',
    'sms:988',
    site.feedbackUrl,
    // XML namespace names used by the Preact runtime to make SVG, MathML and HTML elements, and by the icon.
    // They name a vocabulary and are never fetched.
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/1999/xhtml',
    'http://www.w3.org/1998/Math/MathML',
  ].filter((u) => u !== ''),
)

/** Anything that looks like an address to somewhere else, in any file of the build. */
const URL_LIKE = /\b(?:https?|wss?|ftp|file|mailto|data|javascript):[^\s"'`<>)\\]+|\b(?:tel|sms):[^\s"'`<>)\\]*|(?<![:\w])\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'`<>)\\]*/gi

test.describe('build output', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'static scan of dist, run once')
  })

  const files = () => filesUnder(dist).filter((f) => !/\.(png|ico|woff2?)$/.test(f))
  const text = (f: string) => readFileSync(f, 'utf8')

  test('dist has the hosted bundle and the offline file', () => {
    expect(existsSync(join(dist, 'index.html'))).toBe(true)
    expect(existsSync(join(dist, 'step4-inventory-offline.html'))).toBe(true)
    expect(filesUnder(dist).length).toBeGreaterThan(4)
  })

  test('no off-origin script, style, font, image, or other reference; only the configured plain links', () => {
    const found: string[] = []
    for (const f of files()) {
      if (/_headers$/.test(f)) continue
      for (const m of text(f).matchAll(URL_LIKE)) {
        const url = m[0].replace(/[,;.]+$/, '')
        // `data:` in the Content-Security-Policy keyword list or an inline data URI would show up here and fail.
        if (!ALLOWED_URLS.has(url)) found.push(`${relative(dist, f)}: ${url}`)
      }
    }
    expect(found).toEqual([])
  })

  test('the configured links are present, and every page reference is to a file in the build', () => {
    const bundle = files().filter((f) => /\.(js|html)$/.test(f)).map(text).join('\n')
    for (const url of ['https://findahelpline.com', 'tel:988', 'sms:988', site.bigBookUrl]) expect(bundle, url).toContain(url)

    for (const page of ['index.html', 'step4-inventory-offline.html']) {
      const html = text(join(dist, page))
      for (const m of html.matchAll(/<(script|link|img|iframe|source|video|audio|object|embed|form)\b[^>]*>/gi)) {
        const tag = m[0]
        expect(tag, `${page}: ${tag}`).not.toMatch(/\s(?:src|href|action|data)\s*=\s*["']?(?:[a-z][a-z0-9+.-]*:|\/\/)/i)
        const target = /\s(?:src|href)\s*=\s*["']?(\/[^"'\s>]*)/i.exec(tag)?.[1]
        if (target) expect(existsSync(join(dist, target.split(/[?#]/)[0])), `${page} references ${target}`).toBe(true)
      }
      expect(html, `${page} has no @import`).not.toMatch(/@import/i)
      expect(html, `${page} has no inline style attribute`).not.toMatch(/<[a-z][^>]*\sstyle\s*=/i)
    }
    for (const f of files().filter((f) => f.endsWith('.css'))) {
      expect(text(f), relative(dist, f)).not.toMatch(/@import|url\(\s*["']?(?!data:image\/svg|#)/i)
    }
  })

  test('pdfjs-dist, a test-only tool, is not in the build', () => {
    for (const f of filesUnder(dist)) {
      expect(relative(dist, f)).not.toMatch(/pdf/i)
      if (!/\.(png|ico|woff2?)$/.test(f)) expect(text(f), relative(dist, f)).not.toMatch(/pdfjs/i)
    }
  })

  test('package.json has preact as its only runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['preact'])
    expect(pkg.optionalDependencies ?? {}).toEqual({})
    expect(pkg.peerDependencies ?? {}).toEqual({})
  })

  // Every exact line from the Preact or Vite runtime that is allowed to match is listed here, with the file it
  // is allowed in. An empty list means the bundle has no match at all.
  const ALLOWED_NETWORK_CODE: string[] = []
  const NETWORK_API = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|\bWebSocket\b|\bEventSource\b|serviceWorker|importScripts\s*\(|new\s+(?:Shared)?Worker\b|navigator\.connection|\bimport\s*\(/g

  test('the bundles use no fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource, or worker', () => {
    const found: string[] = []
    for (const f of files().filter((f) => /\.(js|html)$/.test(f))) {
      const code = text(f)
      for (const m of code.matchAll(NETWORK_API)) {
        const around = code.slice(Math.max(0, m.index! - 60), m.index! + 60).replace(/\s+/g, ' ')
        if (!ALLOWED_NETWORK_CODE.includes(around)) found.push(`${relative(dist, f)}: ...${around}...`)
      }
    }
    expect(found).toEqual([])
  })
})
