import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { saveCopy } from '../../src/content/copy'
import { emptyDoc, type InventoryDoc } from '../../src/core/doc'
import { stepsFor, type InventoryId } from '../../src/core/flow'
import { expect, startWithBrowserSave, test } from './fixtures'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const PASSWORD = 'correct horse battery'

const id = (c: string) => c.repeat(32)
const ticks = { selfEsteem: true, security: false, ambitions: true, personalRelations: false, sexRelations: false, fear: true }

/** One entry of every kind, so every step has something on it. */
const FULL: Partial<InventoryDoc> = {
  resentments: [{
    id: id('a'), name: 'Pat', prayerDone: true, selfish: 'I wanted credit', dishonest: '', selfSeeking: '', frightened: '',
    causes: [{ id: id('b'), text: 'Took credit for my work', affects: ticks }],
  }],
  fears: [{ id: id('c'), fear: 'Losing my job', why: 'Money', trust: 'god', selfRelianceWorked: 'no', prayerDone: false, beWhat: '' }],
  harms: [{
    id: id('d'), who: 'Lee', selfish: 'I only thought of myself', dishonest: '', inconsiderate: '',
    jealousy: true, suspicion: false, bitterness: false, fault: '', wasSelfish: 'yes', sexPrayerDone: false, sexMeditationDone: false,
  }],
  checklist: { selected: ['Anger'], other: '' },
  pledge: { listA: ['One thing'], listB: ['Another'], name: 'Sam', date: 'today' },
}

async function scan(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  expect(
    violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`),
    label,
  ).toEqual([])
}

/** Moves to another screen without reloading, and waits for focus to settle on its heading. */
async function visit(page: Page, hash: string) {
  const moved = await page.evaluate((h) => {
    const changed = (window.location.hash || '#/home') !== h
    window.location.hash = h
    return changed
  }, hash)
  if (moved) await expect(page.locator('main h1').first()).toBeFocused()
}

async function begin(page: Page) {
  await page.goto('/')
  await page.getByRole('radio', { name: 'Food', exact: true }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
}

/** A saved, password-protected inventory, reached by the screens a person would use. */
async function savedWithPassword(page: Page) {
  await begin(page)
  await page.getByRole('link', { name: 'Choose how to save it' }).click()
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(PASSWORD)
  await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await expect(page.locator('main')).toContainText(saveCopy.savedBrowserEncrypted)
}

const INVENTORIES: InventoryId[] = ['resentments', 'fears', 'harms']
function allStepHashes(): { label: string; hash: string }[] {
  const doc = { ...emptyDoc('alcohol', { kind: 'god', custom: '' }), ...FULL }
  return INVENTORIES.flatMap((inv) =>
    stepsFor(doc, inv).map((s) => ({ label: `${s.key} (${s.kind})`, hash: `#/step/${inv}/${encodeURIComponent(s.key)}` })),
  )
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme })

    test('first-visit, privacy, and support screens have no violations', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible()
      await scan(page, 'welcome')
      await page.getByRole('radio', { name: 'Food', exact: true }).check()
      await scan(page, 'welcome with a choice made')
      await visit(page, '#/privacy')
      await scan(page, 'privacy')
      await visit(page, '#/support')
      await scan(page, 'support')
    })

    test('every step screen of every inventory has no violations', async ({ page }) => {
      await startWithBrowserSave(page, FULL)
      for (const { label, hash } of allStepHashes()) {
        await visit(page, hash)
        await scan(page, label)
      }
      await visit(page, '#/step/resentments/res%3Aprayer-gone') // a key that matches nothing falls through to the next step
      await scan(page, 'unknown step key')
    })

    test('home, settings, checklist, pledge and print have no violations', async ({ page }) => {
      await startWithBrowserSave(page, FULL)
      for (const hash of ['#/home', '#/settings', '#/checklist', '#/pledge']) {
        await visit(page, hash)
        await scan(page, hash)
      }
      await visit(page, '#/settings')
      await page.getByRole('button', { name: 'Erase everything' }).click()
      await scan(page, 'settings, erase question open')
    })

    test('print preview has no violations, with every section chosen', async ({ page }) => {
      await startWithBrowserSave(page, FULL)
      await visit(page, '#/print')
      for (const box of await page.getByRole('group', { name: 'What to print' }).getByRole('checkbox').all()) await box.check()
      await scan(page, 'print preview')
    })

    test('print warning dialog has no violations', async ({ page }) => {
      await startWithBrowserSave(page, FULL)
      await visit(page, '#/print')
      await page.getByRole('button', { name: 'Print or save as PDF' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await scan(page, 'print warning dialog')
    })

    test('save screen has no violations in each state', async ({ page }) => {
      await begin(page)
      await page.getByRole('link', { name: 'Choose how to save it' }).click()
      await scan(page, 'save, nothing saved yet')
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
      await page.getByLabel('Type it again').fill(PASSWORD)
      await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
      await expect(page.locator('main')).toContainText(saveCopy.savedBrowserEncrypted)
      await scan(page, 'save, protected')
      await page.getByRole('button', { name: 'Remove the password' }).click()
      await scan(page, 'save, remove-password question open')
    })

    test('save screen with a readable browser save has no violations', async ({ page }) => {
      await startWithBrowserSave(page, FULL)
      await visit(page, '#/save')
      await scan(page, 'save, readable browser save')
    })

    test('locked screen has no violations', async ({ page }) => {
      await savedWithPassword(page)
      await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/locked|password|Unlock/i)
      await scan(page, 'locked')
    })
  })
}

/** Names the focused element the way a person hears it. */
async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return ''
    const labelled = el.getAttribute('aria-labelledby')
    const byIds = labelled ? labelled.split(/\s+/).map((i) => document.getElementById(i)?.innerText ?? '').join(' ') : ''
    const label = (el as HTMLInputElement).labels?.[0]?.innerText ?? ''
    return [el.getAttribute('aria-label'), byIds, label, el.innerText, (el as HTMLInputElement).placeholder].filter(Boolean).join(' ').trim()
  })
}

/** Presses Tab until the focused element's name matches, and fails if it never does. */
async function tabTo(page: Page, name: RegExp | string, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const got = await focusedName(page)
    if (typeof name === 'string' ? got === name : name.test(got)) return
  }
  throw new Error(`Tab never reached ${name}; last focus: "${await focusedName(page)}"`)
}

test('can complete a whole resentment entry using only the keyboard', async ({ page, browserName }) => {
  // Safari does not Tab to buttons and links unless the setting is on, so there the test would only measure the setting.
  test.skip(browserName === 'webkit', 'Safari skips buttons and links when tabbing by default')
  await startWithBrowserSave(page)
  const h1 = page.getByRole('heading', { level: 1 })
  // The heading takes focus once a screen has drawn. Tabbing before that would be undone by it.
  const arrive = async (heading: string) => {
    await expect(h1).toHaveText(heading)
    await expect(h1).toBeFocused()
    // Two frames more, so a second render of the same screen (the address is rewritten once) has finished refocusing.
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
  }
  const press = async (button: string) => {
    await tabTo(page, new RegExp(`^(${button})$`))
    await page.keyboard.press('Enter')
  }

  // Home to the resentment inventory.
  await tabTo(page, /^Resentments$/)
  await page.keyboard.press('Enter')
  await arrive('Before you start the resentment inventory')
  await expect(page).toHaveURL(/res%3Aintro/) // the address is rewritten to the first step
  await arrive('Before you start the resentment inventory')
  await press('Next')

  // Column 1: a name.
  await arrive("I'm resentful at:")
  await tabTo(page, /A person, institution, or principle/)
  await page.keyboard.type('Pat')
  await page.keyboard.press('Enter') // submits the add form
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Pat')
  await press("That's everyone for now")

  // Column 2: a cause.
  await arrive('What is your resentment at Pat about?')
  await tabTo(page, /A cause/)
  await page.keyboard.type('Lied to me')
  await tabTo(page, /^Add cause$/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: /cause/i })).toContainText('Lied to me')
  await press('Next')

  // Column 3: tick what it affected, with Space.
  await arrive('What did this affect?')
  await tabTo(page, /Security/)
  await page.keyboard.press('Space')
  await expect(page.getByRole('checkbox', { name: /Security/ })).toBeChecked()
  await press('Next')

  // Column 4: study, prayer, then the four defects.
  await arrive('Before column 4: study and prayer')
  await press('Next')
  await arrive('Say the Resentment Prayer for Pat')
  await tabTo(page, /said this prayer/)
  await page.keyboard.press('Space')
  await press('Next')
  for (const defect of ['selfish', 'dishonest', 'self-seeking', 'frightened']) {
    await arrive(`Where was I ${defect}?`)
    await tabTo(page, /Where was I/)
    await page.keyboard.type(`Pat ${defect}`)
    await press('Next|Skip for now')
  }
  await arrive("You've been through every resentment step")
  await expect(page.getByText('Nothing is blank.')).toBeVisible()
})

const FIELD_SCREENS = [
  '#/step/resentments/res%3Alist',
  `#/step/resentments/${encodeURIComponent(`res:causes:${id('a')}`)}`,
  `#/step/resentments/${encodeURIComponent(`res:defect:${id('a')}:selfish`)}`,
  `#/step/fears/${encodeURIComponent(`fear:why:${id('c')}`)}`,
  `#/step/harms/${encodeURIComponent(`harm:fault:${id('d')}`)}`,
  '#/checklist',
  '#/pledge',
  '#/settings',
  '#/save',
]

test('input font size is at least 16px', async ({ page }) => {
  await startWithBrowserSave(page, FULL)
  const small: string[] = []
  for (const hash of [...FIELD_SCREENS, '#/support']) {
    await visit(page, hash)
    const found = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('input, textarea, select')]
        .filter((el) => !['checkbox', 'radio', 'hidden'].includes((el as HTMLInputElement).type))
        .map((el) => ({ name: `${el.tagName.toLowerCase()}[type=${(el as HTMLInputElement).type}]`, size: parseFloat(getComputedStyle(el).fontSize) })),
    )
    for (const f of found) if (f.size < 16) small.push(`${hash} ${f.name} ${f.size}px`)
    if (hash === '#/step/resentments/res%3Alist') expect(found.length, 'the list screen has a field').toBeGreaterThan(0)
  }
  await visit(page, '#/settings')
  await page.getByRole('radio', { name: 'My own word' }).check()
  const custom = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('input[type=text], input[type=password]')].map((el) => parseFloat(getComputedStyle(el).fontSize)),
  )
  for (const size of custom) if (size < 16) small.push(`settings text field ${size}px`)
  expect(small).toEqual([])
})

test('tap targets are at least 44px on the bottom buttons', async ({ page }) => {
  await startWithBrowserSave(page, FULL)
  const small: string[] = []
  for (const { label, hash } of allStepHashes()) {
    await visit(page, hash)
    const buttons = page.locator('.stepnav button')
    expect(await buttons.count(), label).toBeGreaterThan(0)
    for (const button of await buttons.all()) {
      const box = await button.boundingBox()
      if (!box || box.height < 44 || box.width < 44) small.push(`${label} "${await button.innerText()}" ${box?.width}x${box?.height}`)
    }
  }
  expect(small).toEqual([])
})
