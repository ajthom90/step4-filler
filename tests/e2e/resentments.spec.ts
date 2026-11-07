import type { Page } from '@playwright/test'
import { site } from '../../site.config'
import { DEFECT_DEFINITIONS } from '../../src/content/resentments'
import { emptyDoc, type InventoryDoc, type ResentmentEntry } from '../../src/core/doc'
import { expect, startWithBrowserSave, test } from './fixtures'

const PAT = 'a'.repeat(32)
const PAT_CAUSE = 'c'.repeat(32)
const PAT_CAUSE_2 = 'd'.repeat(32)
const NO_AFFECTS = { selfEsteem: false, security: false, ambitions: false, personalRelations: false, sexRelations: false, fear: false }

function pat(extra: Partial<ResentmentEntry> = {}): ResentmentEntry {
  return {
    id: PAT, name: 'Pat', prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
    causes: [{ id: PAT_CAUSE, text: 'Lied to me', affects: { ...NO_AFFECTS } }],
    ...extra,
  }
}

/** A saved inventory with Pat, as far through the resentment steps as `upTo` says. */
function docAt(upTo: 'causes' | 'affects' | 'study' | 'prayer', overrides: Partial<InventoryDoc> = {}, entry: ResentmentEntry = pat()): Partial<InventoryDoc> {
  const visited: Record<string, true> = { 'res:intro': true, 'res:list': true }
  const order = ['causes', 'affects', 'study', 'prayer'] as const
  const reach = order.indexOf(upTo)
  if (reach >= 0) visited[`res:causes:${entry.id}`] = true
  if (reach >= 1) for (const c of entry.causes) visited[`res:affects:${entry.id}:${c.id}`] = true
  if (reach >= 2) visited['res:study'] = true
  if (reach >= 3) visited[`res:prayer:${entry.id}`] = true
  return { resentments: [entry], visited, ...overrides }
}

const ADVANCE = /^(Next|Skip for now|That's everyone for now)$/
const advance = (page: Page) => page.getByRole('button', { name: ADVANCE }).click()
const h1 = (page: Page) => page.getByRole('heading', { level: 1 })
const openResentments = (page: Page) => page.getByRole('link', { name: 'Resentments' }).click()

test('complete flow in column order', async ({ page }) => {
  await startWithBrowserSave(page)
  await openResentments(page)

  const seen: string[] = []
  const note = async () => seen.push((await h1(page).innerText()).trim())

  await expect(h1(page)).toHaveText('Before you start the resentment inventory')
  await note()
  await advance(page)

  await expect(h1(page)).toHaveText("I'm resentful at:")
  await note()
  for (const name of ['Pat', 'Lee']) {
    await page.getByLabel('A person, institution, or principle').fill(name)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await expect(page.getByRole('list', { name: 'Your list' }).getByRole('listitem')).toHaveCount(2)
  await advance(page)

  for (const [name, cause] of [['Pat', 'Lied to me'], ['Lee', 'Ignored me']]) {
    await expect(h1(page)).toHaveText(`What is your resentment at ${name} about?`)
    await note()
    await page.getByLabel('A cause').fill(cause)
    await page.getByRole('button', { name: 'Add cause' }).click()
    await advance(page)
  }

  for (const cause of ['Lied to me', 'Ignored me']) {
    await expect(h1(page)).toHaveText('What did this affect?')
    await expect(page.getByTestId('cause')).toHaveText(cause)
    await note()
    await page.getByRole('checkbox', { name: 'Security (Pocketbooks)' }).check()
    await advance(page)
  }

  await expect(h1(page)).toHaveText('Before column 4: study and prayer')
  await note()
  await advance(page)

  for (const name of ['Pat', 'Lee']) {
    await expect(h1(page)).toHaveText(`Say the Resentment Prayer for ${name}`)
    await note()
    await advance(page)
  }

  for (const name of ['Pat', 'Lee']) {
    for (const defect of ['selfish', 'dishonest', 'self-seeking', 'frightened']) {
      await expect(h1(page)).toHaveText(`Where was I ${defect}?`)
      await expect(page.getByTestId('who')).toHaveText(name)
      await note()
      await page.getByRole('textbox').fill(`${name} ${defect}`)
      await advance(page)
    }
  }

  await expect(h1(page)).toHaveText("You've been through every resentment step")
  expect(seen).toEqual([
    'Before you start the resentment inventory',
    "I'm resentful at:",
    'What is your resentment at Pat about?',
    'What is your resentment at Lee about?',
    'What did this affect?',
    'What did this affect?',
    'Before column 4: study and prayer',
    'Say the Resentment Prayer for Pat',
    'Say the Resentment Prayer for Lee',
    ...['Pat', 'Lee'].flatMap(() => ['Where was I selfish?', 'Where was I dishonest?', 'Where was I self-seeking?', 'Where was I frightened?']),
  ])
  await expect(page.getByText('Nothing is blank.')).toBeVisible()
})

test("the progress line never says column 0", async ({ page }) => {
  await startWithBrowserSave(page)
  await openResentments(page)
  await expect(h1(page)).toHaveText('Before you start the resentment inventory')
  await expect(page.getByTestId('eyebrow')).not.toContainText('Column 0')
  await expect(page.getByTestId('eyebrow')).toHaveText('Resentments · Before you begin')
  await advance(page)
  await expect(page.getByTestId('eyebrow')).toHaveText('Column 1 of 4 · Who or what')
})

test("prayer includes the person's name and the chosen word, and can be passed without marking it done", async ({ page }) => {
  await startWithBrowserSave(page, docAt('study', { settings: { preset: 'alcohol', godWord: { kind: 'custom', custom: 'Creator' } } }))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Say the Resentment Prayer for Pat')
  await expect(page.getByTestId('prayer')).toHaveText(
    'Creator, please help me show Pat the same tolerance, pity and patience I would cheerfully grant a sick friend',
  )
  const done = page.getByRole('checkbox', { name: "I've said this prayer" })
  await expect(done).not.toBeChecked()
  await advance(page)
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(done).not.toBeChecked()
  await done.check()
  await expect(done).toBeChecked()
})

test('move past a blank, then find it again from home', async ({ page }) => {
  await startWithBrowserSave(page, docAt('prayer'))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await expect(h1(page)).toHaveText('Where was I dishonest?')

  await page.getByRole('link', { name: site.name }).click()
  await expect(h1(page)).toHaveText('Your inventory')
  await page.getByText('1 step still blank').click()
  await page.getByRole('link', { name: 'Pat: Where was I selfish?' }).click()
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await expect(page.getByTestId('who')).toHaveText('Pat')
})

test('add a name during column 3', async ({ page }) => {
  const entry = pat({
    causes: [
      { id: PAT_CAUSE, text: 'Lied to me', affects: { ...NO_AFFECTS } },
      { id: PAT_CAUSE_2, text: 'Forgot my birthday', affects: { ...NO_AFFECTS } },
    ],
  })
  const base = docAt('causes', {}, entry)
  base.visited = { ...base.visited, [`res:affects:${PAT}:${PAT_CAUSE}`]: true }
  await startWithBrowserSave(page, base)
  await openResentments(page)

  await expect(h1(page)).toHaveText('What did this affect?')
  await expect(page.getByTestId('cause')).toHaveText('Forgot my birthday')

  await page.getByRole('link', { name: 'Add another name' }).click()
  await expect(h1(page)).toHaveText("I'm resentful at:")
  await page.getByLabel('A person, institution, or principle').fill('Dana')
  await page.getByRole('button', { name: "That's everyone for now" }).click()

  await expect(h1(page)).toHaveText('What is your resentment at Dana about?')
  await page.getByLabel('A cause').fill('Spread a rumor')
  await advance(page)

  await expect(h1(page)).toHaveText('What did this affect?')
  await expect(page.getByTestId('who')).toHaveText('Pat')
  await expect(page.getByTestId('cause')).toHaveText('Forgot my birthday')
})

test('study instruction screen shows the page range and a link that opens only on click', async ({ page, context }) => {
  await startWithBrowserSave(page, docAt('affects'))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Before column 4: study and prayer')
  await expect(page.getByTestId('hint')).toContainText('bottom of page 65 to the end of the 3rd paragraph on page 67')

  const link = page.getByRole('link', { name: /Read the Big Book online/ })
  await expect(link).toHaveAttribute('href', site.bigBookUrl)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noreferrer noopener')

  // Nothing is fetched until the click, and the click leaves this page where it is.
  await context.route(`${new URL(site.bigBookUrl).origin}/**`, (route) => route.abort())
  const popup = page.waitForEvent('popup')
  await link.click()
  await popup
  await expect(h1(page)).toHaveText('Before column 4: study and prayer')
})

test('help sheet opens and closes without losing typed text', async ({ page }) => {
  await startWithBrowserSave(page, docAt('prayer'))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Where was I selfish?')
  const box = page.getByRole('textbox')
  await box.fill('I wanted it my way')

  await page.getByRole('button', { name: 'What do these words mean?' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet).toContainText(DEFECT_DEFINITIONS.selfish)
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(sheet).toBeHidden()
  await expect(box).toHaveValue('I wanted it my way')

  await page.getByRole('button', { name: 'What do these words mean?' }).click()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(box).toHaveValue('I wanted it my way')
})

test('list suggestions can be added from the help sheet', async ({ page }) => {
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page)
  await expect(h1(page)).toHaveText("I'm resentful at:")
  await page.getByRole('button', { name: 'Show suggestions' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Add God' }).click() // {god} is filled in
  await expect(sheet.getByRole('button', { name: 'Added: God' })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('God')
})

test('typing is flushed when the page is hidden', async ({ page }) => {
  await startWithBrowserSave(page, docAt('prayer'))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await page.getByRole('textbox').fill('typed but never submitted')
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
  })
  await expect
    // Well inside the 800 ms save delay, so only the page-hide flush can have written it.
    .poll(() => page.evaluate(() => localStorage.getItem('step4-inventory')), { timeout: 500 })
    .toContain('typed but never submitted')
  await page.reload()
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await expect(page.getByRole('textbox')).toHaveValue('typed but never submitted')
})

test('reload resumes at the same step', async ({ page }) => {
  await startWithBrowserSave(page, docAt('study'))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Say the Resentment Prayer for Pat')
  await advance(page)
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await page.reload()
  await expect(h1(page)).toHaveText('Where was I selfish?')
  // Leaving and coming back through home lands on the first step not yet passed.
  await page.getByRole('link', { name: site.name }).click()
  await openResentments(page)
  await expect(h1(page)).toHaveText('Where was I selfish?')
})

test('hostile text shows literally', async ({ page }) => {
  const hostile = '<img src=x onerror=alert(1)>'
  const dialogs: string[] = []
  page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss() })
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page)
  await page.getByLabel('A person, institution, or principle').fill(hostile)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(hostile)
  await advance(page)
  await expect(h1(page)).toHaveText(`What is your resentment at ${hostile} about?`)
  await expect(page.locator('main img')).toHaveCount(0)
  expect(dialogs).toEqual([])
})

test('a name containing a token is shown as typed', async ({ page }) => {
  await startWithBrowserSave(page, docAt('study', {}, pat({ name: '{god}' })))
  await openResentments(page)
  await expect(h1(page)).toHaveText('Say the Resentment Prayer for {god}')
  await expect(page.getByTestId('prayer')).toHaveText(
    'God, please help me show {god} the same tolerance, pity and patience I would cheerfully grant a sick friend',
  )
})

test('spellcheck and autocomplete are off in every text field', async ({ page }) => {
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page)
  const check = async () => {
    const fields = page.locator('main textarea, main input[type="text"]')
    await expect(fields.first()).toBeVisible()
    for (const f of await fields.all()) {
      await expect(f).toHaveAttribute('spellcheck', 'false')
      await expect(f).toHaveAttribute('autocomplete', 'off')
    }
  }
  await check() // the list
  await page.getByLabel('A person, institution, or principle').fill('Pat')
  await advance(page)
  await check() // the causes
  await page.getByLabel('A cause').fill('Lied')
  for (let i = 0; i < 4; i++) await advance(page) // affects, study, prayer, then the first defect
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await check() // a text step
})

test('nothing scrolls sideways at 320px, even with a very long unbroken name', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page)
  await page.getByLabel('A person, institution, or principle').fill('W'.repeat(300))
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await advance(page)
  await expect(h1(page)).toContainText('WWWW')
  expect(await overflow()).toBeLessThanOrEqual(0)
})

function finishedDoc(): Partial<InventoryDoc> {
  const entry = pat({ selfish: 'saved selfish' })
  const base = docAt('prayer', {}, entry)
  for (const f of ['selfish', 'dishonest', 'selfSeeking', 'frightened']) base.visited![`res:defect:${PAT}:${f}`] = true
  return base
}

test('a finished inventory can be reviewed from the start and from the back', async ({ page }) => {
  await startWithBrowserSave(page, finishedDoc())
  await openResentments(page)
  await expect(h1(page)).toHaveText("You've been through every resentment step")
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(h1(page)).toHaveText('Where was I frightened?')
  await page.getByRole('link', { name: site.name }).click()
  await openResentments(page)

  await page.getByRole('link', { name: 'Go through it from the start' }).click()
  await expect(h1(page)).toHaveText('Before you start the resentment inventory')
  for (const heading of [
    'Before you start the resentment inventory',
    "I'm resentful at:",
    'What is your resentment at Pat about?',
    'What did this affect?',
    'Before column 4: study and prayer',
    'Say the Resentment Prayer for Pat',
  ]) {
    await expect(h1(page)).toHaveText(heading)
    await advance(page)
  }
  await expect(h1(page)).toHaveText('Where was I selfish?')
  const box = page.getByRole('textbox')
  await expect(box).toHaveValue('saved selfish')
  await box.fill('saved selfish, changed')
  await expect(box).toHaveValue('saved selfish, changed')
})

test('a name can be renamed without losing its answers', async ({ page }) => {
  await startWithBrowserSave(page, finishedDoc())
  await openResentments(page)
  await page.getByRole('link', { name: 'Add another name' }).first().click()
  await page.getByRole('button', { name: 'Edit Pat' }).click()
  await page.getByLabel('Change Pat').fill('Patricia')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Patricia')
  const stored = await page.evaluate(() => localStorage.getItem('step4-inventory'))
  await expect.poll(() => page.evaluate(() => localStorage.getItem('step4-inventory'))).toContain('Patricia')
  expect(stored).toContain('saved selfish')
})

test('a cause can be edited without losing what was ticked', async ({ page }) => {
  const entry = pat()
  entry.causes[0].affects.security = true
  await startWithBrowserSave(page, docAt('causes', {}, entry))
  await page.goto('/#/step/resentments/' + encodeURIComponent(`res:causes:${PAT}`))
  await page.getByRole('button', { name: 'Edit Lied to me' }).click()
  await page.getByLabel('Change Lied to me').fill('Lied to my face')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('list', { name: 'Causes so far' })).toContainText('Lied to my face')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('step4-inventory'))).toContain('Lied to my face')
  const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('step4-inventory'))) as string)
  expect(stored.resentments[0].causes[0].affects.security).toBe(true)
})

const stored = (page: Page) => page.evaluate(() => localStorage.getItem('step4-inventory'))

test('a name typed but not added is kept when going Back', async ({ page }) => {
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page)
  await page.getByLabel('A person, institution, or principle').fill('Dana')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(h1(page)).toHaveText('Before you start the resentment inventory')
  await expect.poll(() => stored(page)).toContain('Dana')
  await advance(page)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Dana')
  await expect(page.getByLabel('A person, institution, or principle')).toHaveValue('')
})

test('a cause typed but not added is kept when adding another name', async ({ page }) => {
  await startWithBrowserSave(page, { ...docAt('causes'), visited: { 'res:intro': true, 'res:list': true } })
  await page.goto('/#/step/resentments/' + encodeURIComponent(`res:causes:${PAT}`))
  await page.getByLabel('A cause').fill('Late again')
  await page.getByRole('link', { name: 'Add another name' }).click()
  await expect(h1(page)).toHaveText("I'm resentful at:")
  await expect.poll(() => stored(page)).toContain('Late again')
})

test('a name typed but not added is kept when the page is hidden, and after reload', async ({ page }) => {
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page)
  await page.getByLabel('A person, institution, or principle').fill('Dana')
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
  })
  await expect.poll(() => stored(page), { timeout: 500 }).toContain('Dana')
  await page.reload()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Dana')
})

test('Next with a name typed goes straight to that name, with no correcting redirect', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { hashChanges: number }).hashChanges = 0
    window.addEventListener('hashchange', () => { (window as unknown as { hashChanges: number }).hashChanges++ })
  })
  await startWithBrowserSave(page, { visited: { 'res:intro': true } })
  await openResentments(page) // opening redirects once to the step's own address; count from after that
  await expect(page).toHaveURL(/res%3Alist$/)
  await expect(h1(page)).toHaveText("I'm resentful at:")
  await page.evaluate(() => { (window as unknown as { hashChanges: number }).hashChanges = 0 })
  await page.getByLabel('A person, institution, or principle').fill('Dana')
  await advance(page)
  await expect(h1(page)).toHaveText('What is your resentment at Dana about?')
  await expect.poll(() => stored(page)).toContain('Dana')
  const id = JSON.parse((await stored(page)) as string).resentments[0].id as string
  expect(page.url()).toContain(`res%3Acauses%3A${id}`)
  expect(await page.evaluate(() => (window as unknown as { hashChanges: number }).hashChanges)).toBe(1)
})
