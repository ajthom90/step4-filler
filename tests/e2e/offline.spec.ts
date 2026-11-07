import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import { offlineCopy, saveCopy } from '../../src/content/copy'
import { site } from '../../site.config'
import { expect, test } from './fixtures'

const OFFLINE_PATH = resolve('dist/step4-inventory-offline.html')
const OFFLINE_URL = pathToFileURL(OFFLINE_PATH).href
const SENTINEL = 'Sentinel-Zebra-7731'
const PASSWORD = 'correct horse battery'

const main = (page: Page) => page.locator('main')
const html = () => readFileSync(OFFLINE_PATH, 'utf8')

/** The first-visit choice, then the home screen, in the offline file. */
async function begin(page: Page) {
  await page.goto(OFFLINE_URL)
  await page.getByRole('radio', { name: 'Food', exact: true }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
}

async function goTo(page: Page, hash: string) {
  const moved = await page.evaluate((h) => {
    const changed = window.location.hash !== h
    window.location.hash = h
    return changed
  }, hash)
  if (moved) await expect(page.locator('main h1')).toBeFocused()
}

/** A resentment through its list and cause columns, with the sentinel as the name. */
async function enterResentment(page: Page) {
  await goTo(page, '#/step/resentments/res%3Alist')
  await page.getByLabel('A person, institution, or principle').fill(SENTINEL)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await page.getByRole('button', { name: /^(Next|That's everyone for now)$/ }).click()
  await page.getByLabel('A cause').fill('Lied to me')
  await page.getByRole('button', { name: 'Add cause' }).click()
  await expect(main(page)).toContainText('Lied to me')
}

async function download(page: Page, buttonName: string): Promise<{ name: string; text: string }> {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()])
  return { name: file.suggestedFilename(), text: readFileSync(await file.path(), 'utf8') }
}

test('the offline file exists after a build', () => {
  expect(existsSync(OFFLINE_PATH), 'run the build first: dist/step4-inventory-offline.html').toBe(true)
})

test('has its own policy', async ({ page }) => {
  const text = html()
  const meta = text.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)
  expect(meta, 'a meta CSP').not.toBeNull()
  const policy = new Map(
    meta![1].split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/)
      return [name, values] as const
    }),
  )
  expect(policy.get('default-src')).toEqual(["'none'"])
  expect(policy.get('connect-src')).toEqual(["'none'"])
  expect(policy.get('form-action')).toEqual(["'none'"])
  expect(policy.get('base-uri')).toEqual(["'none'"])
  expect(policy.has('frame-ancestors'), 'ignored in a meta tag, so left out').toBe(false)
  expect(meta![1]).not.toContain('unsafe-inline')

  const scripts = [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  expect(scripts).toHaveLength(1)
  expect(styles).toHaveLength(1)
  const hash = (body: string) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`
  expect(policy.get('script-src')).toEqual([hash(scripts[0][1])])
  expect(policy.get('style-src')).toEqual([hash(styles[0][1])])

  // The hashes are right: the app renders, and the fixture reports no CSP violation when the test ends.
  await page.goto(OFFLINE_URL)
  await expect(page.getByRole('radio', { name: 'Food', exact: true })).toBeVisible()
})

test('makes zero network requests through a full resentment entry and download', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (!/^(data|blob|about):/.test(request.url())) requests.push(request.url())
  })
  await begin(page)
  await enterResentment(page)
  await goTo(page, '#/save')
  const file = await download(page, 'Download a file without a password')
  expect(file.text).toContain(SENTINEL)
  // Nothing but the page itself (Firefox does not report that navigation at all).
  expect(requests.filter((url) => url !== OFFLINE_URL)).toEqual([])
})

test('download then reopen restores progress, without a password', async ({ page, browser }) => {
  await begin(page)
  await enterResentment(page)
  await goTo(page, '#/save')
  const file = await download(page, 'Download a file without a password')

  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(OFFLINE_URL)
  await fresh.getByLabel('Open a saved file').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) })
  await expect(fresh.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await goTo(fresh, '#/step/resentments/res%3Alist')
  await expect(fresh.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await fresh.context().close()
})

test('download then reopen restores progress, with a password', async ({ page, browser }) => {
  await begin(page)
  await enterResentment(page)
  await goTo(page, '#/save')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(PASSWORD)
  const file = await download(page, 'Download a file with a password')
  expect(file.text).not.toContain(SENTINEL)

  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(OFFLINE_URL)
  await fresh.getByLabel('Open a saved file').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) })
  await fresh.getByLabel(saveCopy.labels.filePassword).fill(PASSWORD)
  await fresh.getByRole('button', { name: saveCopy.labels.openFileButton }).click()
  await expect(fresh.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await goTo(fresh, '#/step/resentments/res%3Alist')
  await expect(fresh.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await fresh.context().close()
})

test("when local storage isn't available, it says so and uses files", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
  })
  await begin(page)
  await goTo(page, '#/save')
  await expect(main(page)).toContainText(offlineCopy.storageUnavailable)
  await expect(page.getByRole('button', { name: saveCopy.labels.saveBrowserPlain })).toHaveCount(0)
  await expect(page.getByRole('button', { name: saveCopy.labels.saveBrowserPassword })).toHaveCount(0)
  await expect(page.getByRole('button', { name: saveCopy.labels.downloadPlain })).toBeEnabled()
})

test('no reference to an external asset', () => {
  const text = html()
  expect(text).not.toMatch(/<link\b/i)
  expect(text).not.toMatch(/<script[^>]*\ssrc=/i)
  expect(text).not.toMatch(/\burl\(/i)
  expect(text).not.toMatch(/@import/i)
  // Every http string is a link the person clicks, or an XML namespace name that is never fetched.
  const namespaces = ['http://www.w3.org/1998/Math/MathML', 'http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg']
  const urls = [...new Set(text.match(/https?:\/\/[A-Za-z0-9./_-]*/g) ?? [])].filter((u) => !namespaces.includes(u))
  expect(urls.sort()).toEqual([site.bigBookUrl, 'https://findahelpline.com'].sort())
})

test('hosted privacy page links to it, described as a computer option', async ({ page }) => {
  await page.goto('/#/privacy')
  const link = page.getByRole('link', { name: offlineCopy.linkLabel })
  await expect(link).toHaveAttribute('href', '/step4-inventory-offline.html')
  await expect(link).toHaveAttribute('download', 'step4-inventory-offline.html')
  await expect(main(page)).toContainText(offlineCopy.computerOption)
  const [file] = await Promise.all([page.waitForEvent('download'), link.click()])
  expect(file.suggestedFilename()).toBe('step4-inventory-offline.html')
  expect(readFileSync(await file.path(), 'utf8')).toBe(html())
})

test('the offline file itself does not offer to download itself', async ({ page }) => {
  await page.goto(`${OFFLINE_URL}#/privacy`)
  await expect(page.getByRole('link', { name: offlineCopy.linkLabel })).toHaveCount(0)
  await expect(main(page)).toContainText(offlineCopy.usingOffline)
})

test('the offline file never uses browser storage, even when it works', async ({ page }) => {
  const key = 'step4-inventory'
  const existing = JSON.stringify({ planted: 'by another local file', note: SENTINEL })
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v) } catch { /* the page's own storage may be unavailable on file: */ }
    ;(window as unknown as { __writes: string[] }).__writes = []
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      ;(window as unknown as { __writes: string[] }).__writes.push(name)
      return original.call(this, name, value)
    }
  }, [key, existing])
  await page.goto(OFFLINE_URL)
  // The planted value is not loaded: the first-visit screen shows, not an unlock or a problem screen.
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible()
  await begin(page)
  await enterResentment(page)
  await goTo(page, '#/save')
  await expect(main(page)).toContainText(offlineCopy.storageUnavailable)
  await expect(page.getByRole('button', { name: saveCopy.labels.saveBrowserPlain })).toHaveCount(0)
  await expect(page.getByRole('button', { name: saveCopy.labels.saveBrowserPassword })).toHaveCount(0)
  await page.waitForTimeout(1200) // longer than the save delay
  const writes = await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)
  // Only the init script's own plant may have touched storage, and it ran before the page.
  expect(writes.filter((w) => w === key)).toEqual([])
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(existing)
})
