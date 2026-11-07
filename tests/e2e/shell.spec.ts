import type { Page } from '@playwright/test'
import { site } from '../../site.config'
import { DISCLAIMER, PRIVACY_STATEMENT } from '../../src/content/copy'
import { PRESETS } from '../../src/content/presets'
import { emptyDoc, type InventoryDoc } from '../../src/core/doc'
import { expect, test } from './fixtures'

const KEY = 'step4-inventory'

function savedDoc(): InventoryDoc {
  const doc = emptyDoc('alcohol', { kind: 'god', custom: '' })
  doc.resentments.push({
    id: 'a'.repeat(32), name: 'Pat', causes: [], prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
  })
  doc.visited = { 'res:intro': true, 'res:list': true }
  return doc
}

async function seed(page: Page, value: string) {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, value])
}

async function begin(page: Page, preset: string, god = 'God') {
  await page.goto('/')
  await page.getByRole('radio', { name: preset, exact: true }).check()
  await page.getByRole('radio', { name: god, exact: true }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
}

test('first visit shows the disclaimer and creates nothing in storage', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you begin')
  await expect(page.locator('main')).toContainText(DISCLAIMER)
  await page.getByRole('radio', { name: 'Food', exact: true }).check()
  await page.getByRole('radio', { name: 'Higher Power', exact: true }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test('all five presets are offered, with draft labels and feedback links', async ({ page }) => {
  await page.goto('/')
  for (const p of Object.values(PRESETS)) {
    await expect(page.getByRole('radio', { name: p.label, exact: true })).toBeVisible()
  }
  const drafts = page.locator('li', { hasText: 'Draft wording' })
  await expect(drafts).toHaveCount(2)
  await expect(drafts.filter({ hasText: 'Narcotics' })).toHaveCount(1)
  await expect(drafts.filter({ hasText: 'Sex and love' })).toHaveCount(1)
  const feedback = page.getByRole('link', { name: 'Send feedback' })
  if (site.feedbackUrl) {
    await expect(feedback).toHaveCount(2)
    await expect(feedback.first()).toHaveAttribute('href', site.feedbackUrl)
    await expect(feedback.first()).toHaveAttribute('target', '_blank')
    await expect(feedback.first()).toHaveAttribute('rel', /noreferrer/)
  } else {
    await expect(feedback).toHaveCount(0)
  }
})

test('home lists every section with progress', async ({ page }) => {
  await seed(page, JSON.stringify(savedDoc()))
  await page.goto('/')
  const main = page.locator('main')
  for (const name of ['Resentments', 'Fears', 'Sex conduct and harms', 'Flaws and assets checklist', 'Abstinence pledge']) {
    await expect(main.getByRole('heading', { name: new RegExp(name) })).toBeVisible()
  }
  await expect(main.getByRole('heading', { name: /Abstinence pledge/ })).toContainText('(optional)')
  await expect(main).toContainText('Column 2 of 4')
  await expect(main).toContainText('Not started')
  await expect(main).not.toContainText('Column 0')
})

test('a saved plain inventory loads and keeps saving', async ({ page }) => {
  await seed(page, JSON.stringify(savedDoc()))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Saved on this device')
})

test('a corrupt save is explained and left untouched', async ({ page }) => {
  await seed(page, '{not json')
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText("isn't an inventory this site can read")
  await expect(page.getByRole('radio')).toHaveCount(0)
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('{not json')
})

test('blocked storage still lets the site run', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError') } })
  })
  await begin(page, 'Food')
})

test('another tab saving shows a visible stale message and does not overwrite', async ({ page }) => {
  await seed(page, JSON.stringify(savedDoc()))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved on this device')
  const newer = JSON.stringify({ ...savedDoc(), settings: { preset: 'food', godWord: { kind: 'god', custom: '' } } })
  await page.evaluate(([k, v]) => {
    window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: v }))
    // The storage event only fires in other tabs, so write the value the same way they would.
    localStorage.setItem(k, v)
  }, [KEY, newer])
  await expect(page.getByRole('alert')).toContainText('Reload')
  await page.goto('/#/settings')
  await page.getByRole('radio', { name: 'Narcotics', exact: true }).check()
  await page.waitForTimeout(1200)
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(newer)
})

test('footer disclaimer appears on every screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('footer')).toContainText(DISCLAIMER)
  await seed(page, JSON.stringify(savedDoc()))
  for (const hash of ['home', 'privacy', 'support', 'settings', 'checklist', 'pledge', 'print', 'save', 'step/resentments']) {
    await page.goto(`/#/${hash}`)
    await page.reload()
    await expect(page.locator('footer')).toContainText(DISCLAIMER)
  }
})

test('privacy page says the required things', async ({ page }) => {
  await page.goto('/#/privacy')
  const main = page.locator('main')
  await expect(main).toContainText(PRIVACY_STATEMENT)
  await expect(main).toContainText('extensions')
  await expect(main).toContainText('backups')
})

test('no screen claims there are no IP logs', async ({ page }) => {
  await seed(page, JSON.stringify(savedDoc()))
  for (const hash of ['', 'privacy', 'support', 'settings', 'checklist', 'pledge', 'print', 'save', 'step/fears']) {
    await page.goto(`/#/${hash}`)
    await page.reload()
    expect(await page.locator('body').innerText()).not.toContain('no IP')
  }
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  expect(await page.locator('body').innerText()).not.toContain('no IP')
})

test('settings change preset and word without losing entries', async ({ page }) => {
  await seed(page, JSON.stringify(savedDoc()))
  await page.goto('/#/settings')
  await page.getByRole('radio', { name: 'Food', exact: true }).check()
  await page.getByRole('radio', { name: 'My own word', exact: true }).check()
  await page.getByLabel('Your word').fill('Spirit')
  await expect(page.getByRole('status')).toHaveText('Saved on this device')
  const stored = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) as string)
  expect(stored.settings).toEqual({ preset: 'food', godWord: { kind: 'custom', custom: 'Spirit' } })
  expect(stored.resentments).toHaveLength(1)
  expect(stored.resentments[0].name).toBe('Pat')
})

test('support page offers a sponsor or trusted person, 988, and local services', async ({ page }) => {
  await page.goto('/#/support')
  const main = page.locator('main')
  await expect(main.getByRole('link', { name: /sponsor or someone you trust/ })).toHaveAttribute('href', /^sms:/)
  await expect(main.getByRole('link', { name: /988/ }).first()).toHaveAttribute('href', 'tel:988')
  await expect(main.getByRole('link', { name: /local crisis services/ })).toHaveAttribute('href', /^https:\/\//)
  await expect(main.getByRole('link', { name: /local crisis services/ })).toHaveAttribute('target', '_blank')
  await expect(main.getByRole('link', { name: /local crisis services/ })).toHaveAttribute('rel', /noreferrer/)
  await expect(main).toContainText('does not replace a sponsor or professional help')
})

test('first-visit choices are not saved', async ({ page }) => {
  await begin(page, 'Alcohol')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you begin')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test('moving to a new screen moves focus to its heading', async ({ page }) => {
  await begin(page, 'Food')
  await page.getByRole('link', { name: 'Support' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})

test.describe('theme', () => {
  test('follows the system', async ({ browser }) => {
    const colors: string[] = []
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({ colorScheme })
      const page = await context.newPage()
      await page.goto('/')
      colors.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      await context.close()
    }
    expect(colors[0]).not.toBe(colors[1])
  })
})

test('no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await seed(page, JSON.stringify(savedDoc()))
  for (const hash of ['home', 'privacy', 'support', 'settings', 'checklist', 'pledge', 'print', 'save', 'step/resentments']) {
    await page.goto(`/#/${hash}`)
    await page.reload()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, hash).toBeLessThanOrEqual(0)
  }
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  const welcome = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(welcome).toBeLessThanOrEqual(0)
})
