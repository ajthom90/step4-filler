import type { Page } from '@playwright/test'
import { EARNEST_PRAYERS } from '../../src/content/harms'
import type { FearEntry, HarmEntry, InventoryDoc } from '../../src/core/doc'
import { expect, startWithBrowserSave, test } from './fixtures'

const ADVANCE = /^(Next|Skip for now|That's everyone for now)$/
const advance = (page: Page) => page.getByRole('button', { name: ADVANCE }).click()
const h1 = (page: Page) => page.getByRole('heading', { level: 1 })
/** Opens an inventory from home, and waits for the address to settle on the step it redirects to. */
async function open(page: Page, name: 'Resentments' | 'Fears' | 'Sex conduct and harms') {
  await page.getByRole('link', { name }).click()
  await expect(page).toHaveURL(/#\/step\/[a-z]+\/.+/)
}
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('step4-inventory'))
const storedDoc = async (page: Page) => JSON.parse((await stored(page)) as string) as InventoryDoc

const FEAR = 'f'.repeat(32)
const HARM = 'h'.repeat(32)
const fear = (extra: Partial<FearEntry> = {}): FearEntry => ({
  id: FEAR, fear: 'Fear of dentists', why: '', trust: null, selfRelianceWorked: null, prayerDone: false, beWhat: '', ...extra,
})
const harm = (extra: Partial<HarmEntry> = {}): HarmEntry => ({
  id: HARM, who: 'Pat', selfish: '', dishonest: '', inconsiderate: '', jealousy: false, suspicion: false, bitterness: false,
  fault: '', wasSelfish: null, sexPrayerDone: false, sexMeditationDone: false, ...extra,
})

async function addNames(page: Page, label: string, names: string[]) {
  for (const n of names) {
    await page.getByLabel(label).fill(n)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await expect(page.getByRole('list', { name: 'Your list' }).getByRole('listitem')).toHaveCount(names.length)
}

test('fear flow follows column order', async ({ page }) => {
  await startWithBrowserSave(page, { settings: { preset: 'alcohol', godWord: { kind: 'higherPower', custom: '' } } })
  await open(page, 'Fears')
  const seen: string[] = []
  const note = async () => seen.push((await h1(page).innerText()).trim())

  await expect(h1(page)).toHaveText('Before you start the fear inventory')
  await note()
  await advance(page)
  await expect(h1(page)).toHaveText("I'm fearful of:")
  await expect(page.getByTestId('eyebrow')).toHaveText('Column 1 of 6 · Whom or what')
  await note()
  await addNames(page, 'A fear', ['Fear of dentists', 'Fear of heights'])
  await advance(page)

  const names = ['Fear of dentists', 'Fear of heights']
  for (const n of names) {
    await expect(h1(page)).toHaveText('Why do I have the fear?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await note()
    await page.getByRole('textbox').fill(`because ${n}`)
    await advance(page)
  }
  for (const n of names) {
    await expect(h1(page)).toHaveText('Where was my trust & reliance?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await expect(page.getByRole('radio')).toHaveCount(2)
    await expect(page.getByRole('radio', { name: 'Infinite Higher Power' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'My Finite Self' })).toBeVisible()
    await note()
    await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible()
    await page.getByRole('radio', { name: 'My Finite Self' }).check()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible()
    await advance(page)
  }
  for (const n of names) {
    await expect(h1(page)).toHaveText('Did self reliance work?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await note()
    await page.getByRole('radio', { name: 'No' }).check()
    await advance(page)
  }
  for (const n of names) {
    await expect(h1(page)).toHaveText('Say the Fear Prayer')
    await expect(page.getByTestId('who')).toHaveText(n)
    await note()
    await advance(page)
  }
  for (const n of names) {
    await expect(h1(page)).toHaveText('What would Higher Power have you be?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await note()
    await page.getByRole('textbox').fill(`patient, about ${n}`)
    await advance(page)
  }
  await expect(h1(page)).toHaveText("You've been through every fear step")
  await expect(page.getByText('Nothing is blank.')).toBeVisible()
  expect(seen).toEqual([
    'Before you start the fear inventory',
    "I'm fearful of:",
    ...names.map(() => 'Why do I have the fear?'),
    ...names.map(() => 'Where was my trust & reliance?'),
    ...names.map(() => 'Did self reliance work?'),
    ...names.map(() => 'Say the Fear Prayer'),
    ...names.map(() => 'What would Higher Power have you be?'),
  ])

  await expect.poll(async () => (await storedDoc(page)).fears[0]?.beWhat).toBe('patient, about Fear of dentists')
  const doc = await storedDoc(page)
  expect(doc.fears.map((f) => [f.trust, f.selfRelianceWorked, f.prayerDone])).toEqual([['self', 'no', false], ['self', 'no', false]])
})

test('the trust choice reads from the chosen word, and works from the keyboard', async ({ page }) => {
  await startWithBrowserSave(page, {
    settings: { preset: 'alcohol', godWord: { kind: 'custom', custom: 'Creator' } },
    fears: [fear()],
    visited: { 'fear:intro': true, 'fear:list': true, [`fear:why:${FEAR}`]: true },
  })
  await open(page, 'Fears')
  await expect(h1(page)).toHaveText('Where was my trust & reliance?')
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'My Finite Self' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).not.toBeChecked()
  await expect(page.getByRole('radio', { name: 'My Finite Self' })).not.toBeChecked()

  // Keyboard only: Tab from the heading into the group, arrow to choose, Space to choose again.
  await h1(page).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', { name: 'My Finite Self' })).toBeChecked()
  await expect.poll(async () => (await storedDoc(page)).fears[0]?.trust).toBe('self')
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).toBeChecked()
  await expect.poll(async () => (await storedDoc(page)).fears[0]?.trust).toBe('god')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Space')
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).toBeChecked()

  // The choice survives going away and coming back.
  await advance(page)
  await expect(h1(page)).toHaveText('Did self reliance work?')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Infinite Creator' })).toBeChecked()
})

test('the entry name is read with the heading and the field', async ({ page }) => {
  await startWithBrowserSave(page, {
    fears: [fear()],
    visited: { 'fear:intro': true, 'fear:list': true },
  })
  await open(page, 'Fears')
  await expect(h1(page)).toHaveText('Why do I have the fear?')
  await expect(h1(page)).toHaveAccessibleDescription('Fear of dentists')
  await expect(page.getByRole('textbox')).toHaveAccessibleDescription('Fear of dentists')
  await page.getByRole('textbox').fill('x')
  await advance(page)
  await expect(page.getByRole('group', { name: 'Choose one' })).toHaveAccessibleDescription('Fear of dentists')
})

test('the resentment screens name the person to assistive technology too', async ({ page }) => {
  const id = 'a'.repeat(32)
  await startWithBrowserSave(page, {
    resentments: [{ id, name: 'Pat', prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '', causes: [] }],
    visited: { 'res:intro': true, 'res:list': true, [`res:causes:${id}`]: true, 'res:study': true, [`res:prayer:${id}`]: true },
  })
  await open(page, 'Resentments')
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await expect(h1(page)).toHaveAccessibleDescription('Pat')
  await expect(page.getByRole('textbox')).toHaveAccessibleDescription('Pat')
})

test('fear prayer text matches, and marking is optional', async ({ page }) => {
  await startWithBrowserSave(page, {
    settings: { preset: 'alcohol', godWord: { kind: 'custom', custom: 'Creator' } },
    fears: [fear()],
    visited: { 'fear:intro': true, 'fear:list': true, [`fear:why:${FEAR}`]: true, [`fear:trust:${FEAR}`]: true, [`fear:worked:${FEAR}`]: true },
  })
  await open(page, 'Fears')
  await expect(h1(page)).toHaveText('Say the Fear Prayer')
  await expect(page.getByTestId('prayer')).toHaveText('Creator, please remove my fear and direct my attention to what you would have me be')
  const done = page.getByRole('checkbox', { name: "I've said this prayer" })
  await expect(done).not.toBeChecked()
  await advance(page)
  await expect(h1(page)).toHaveText('What would Creator have you be?')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(done).not.toBeChecked()
  await done.check()
  await expect.poll(async () => (await storedDoc(page)).fears[0].prayerDone).toBe(true)
})

test('a fear containing a token is shown as typed', async ({ page }) => {
  await startWithBrowserSave(page, {
    fears: [fear({ fear: '{god}' })],
    visited: { 'fear:intro': true, 'fear:list': true },
  })
  await open(page, 'Fears')
  await expect(page.getByTestId('who')).toHaveText('{god}')
  await expect(h1(page)).toHaveAccessibleDescription('{god}')
})

test('the fear prompts come from p. 10, adapted to the preset', async ({ page }) => {
  await startWithBrowserSave(page, { visited: { 'fear:intro': true } })
  await open(page, 'Fears')
  await page.getByRole('button', { name: 'Show suggestions' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('button', { name: 'Add Fear of insanity' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of BEING CAUGHT at ANYTHING' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of drinking' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of AA' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of God' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of gaining weight' })).toHaveCount(0)
  await expect(sheet).not.toContainText('{')
  await sheet.getByRole('button', { name: 'Add Fear of insanity' }).click()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Fear of insanity')
})

test('the fear prompts follow the food preset', async ({ page }) => {
  await startWithBrowserSave(page, { settings: { preset: 'food', godWord: { kind: 'god', custom: '' } }, visited: { 'fear:intro': true } })
  await open(page, 'Fears')
  await page.getByRole('button', { name: 'Show suggestions' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('button', { name: 'Add Fear of compulsive eating' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of OA' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of gaining weight' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add Fear of withdrawal' })).toHaveCount(0)
})

test('harms flow follows column order', async ({ page }) => {
  await startWithBrowserSave(page)
  await open(page, 'Sex conduct and harms')
  const seen: string[] = []
  const note = async () => seen.push((await h1(page).innerText()).trim())

  await expect(h1(page)).toHaveText('Before you start the sex conduct and harms inventory')
  await note()
  await advance(page)
  await expect(h1(page)).toHaveText('Whom did I hurt?')
  await expect(page.getByTestId('eyebrow')).toHaveText('Column 1 of 7 · Whom I hurt')
  await note()
  await addNames(page, 'A person or place', ['Pat', 'Lee'])
  await advance(page)

  // Column 2 groups the three questions per entry.
  for (const n of ['Pat', 'Lee']) {
    for (const d of ['selfish', 'dishonest', 'inconsiderate']) {
      await expect(h1(page)).toHaveText(`Where was I ${d}?`)
      await expect(page.getByTestId('who')).toHaveText(n)
      await expect(page.getByTestId('eyebrow')).toHaveText('Column 2 of 7 · Selfish, dishonest, inconsiderate')
      await note()
      await page.getByRole('textbox').fill(`${n} ${d}`)
      await advance(page)
    }
  }
  for (const n of ['Pat', 'Lee']) {
    await expect(h1(page)).toHaveText('Did I arouse jealousy, suspicion, or bitterness?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await expect(page.getByRole('checkbox')).toHaveCount(3)
    for (const t of ['Jealousy', 'Suspicion', 'Bitterness']) await expect(page.getByRole('checkbox', { name: t })).not.toBeChecked()
    await note()
    await page.getByRole('checkbox', { name: n === 'Pat' ? 'Suspicion' : 'Bitterness' }).check()
    await advance(page)
  }
  for (const n of ['Pat', 'Lee']) {
    await expect(h1(page)).toHaveText('Where was I at fault, what should I have done instead?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await note()
    await page.getByRole('textbox').fill(`${n} fault`)
    await advance(page)
  }
  for (const n of ['Pat', 'Lee']) {
    await expect(h1(page)).toHaveText('Was each relation selfish?')
    await expect(page.getByTestId('who')).toHaveText(n)
    await note()
    await page.getByRole('radio', { name: n === 'Pat' ? 'Yes' : 'No' }).check()
    await advance(page)
  }
  for (const n of ['Pat', 'Lee']) {
    await expect(h1(page)).toHaveText('Say the Sex Prayer')
    await expect(page.getByTestId('who')).toHaveText(n)
    await expect(page.getByTestId('prayer')).toHaveText('God, please mold my ideals and help me to live up to them')
    await note()
    await advance(page)
  }
  for (const n of ['Pat', 'Lee']) {
    await expect(h1(page)).toHaveText('Say the Sex Meditation')
    await expect(page.getByTestId('who')).toHaveText(n)
    await expect(page.getByTestId('prayer')).toHaveText('God, please show me what to do about this [each] specific matter')
    await note()
    if (n === 'Pat') await page.getByRole('checkbox', { name: "I've said this meditation" }).check()
    await advance(page)
  }
  await expect(h1(page)).toHaveText("You've been through every sex conduct and harms step")
  await expect(page.getByText('Nothing is blank.')).toBeVisible()
  expect(seen).toEqual([
    'Before you start the sex conduct and harms inventory',
    'Whom did I hurt?',
    ...['Pat', 'Lee'].flatMap(() => ['Where was I selfish?', 'Where was I dishonest?', 'Where was I inconsiderate?']),
    ...['Pat', 'Lee'].map(() => 'Did I arouse jealousy, suspicion, or bitterness?'),
    ...['Pat', 'Lee'].map(() => 'Where was I at fault, what should I have done instead?'),
    ...['Pat', 'Lee'].map(() => 'Was each relation selfish?'),
    ...['Pat', 'Lee'].map(() => 'Say the Sex Prayer'),
    ...['Pat', 'Lee'].map(() => 'Say the Sex Meditation'),
  ])

  await expect.poll(async () => (await storedDoc(page)).harms[0]?.sexMeditationDone).toBe(true)
  const doc = await storedDoc(page)
  expect(doc.harms.map((h) => [h.who, h.selfish, h.dishonest, h.inconsiderate, h.jealousy, h.suspicion, h.bitterness, h.fault, h.wasSelfish, h.sexPrayerDone, h.sexMeditationDone])).toEqual([
    ['Pat', 'Pat selfish', 'Pat dishonest', 'Pat inconsiderate', false, true, false, 'Pat fault', 'yes', false, true],
    ['Lee', 'Lee selfish', 'Lee dishonest', 'Lee inconsiderate', false, false, true, 'Lee fault', 'no', false, false],
  ])
})

test('the Suspicion definition is available on the arouse step', async ({ page }) => {
  await startWithBrowserSave(page, {
    harms: [harm()],
    visited: {
      'harm:intro': true, 'harm:list': true,
      [`harm:where:${HARM}:selfish`]: true, [`harm:where:${HARM}:dishonest`]: true, [`harm:where:${HARM}:inconsiderate`]: true,
    },
  })
  await open(page, 'Sex conduct and harms')
  await expect(h1(page)).toHaveText('Did I arouse jealousy, suspicion, or bitterness?')
  await page.getByRole('button', { name: 'What do these words mean?' }).click()
  await expect(page.getByRole('dialog')).toContainText('Doubt or mistrust based on little or no evidence')
})

test('earnest prayers stay available from the help sheet on every harms step', async ({ page }) => {
  await startWithBrowserSave(page)
  await open(page, 'Sex conduct and harms')
  const seen: string[] = []
  const check = async () => {
    seen.push((await h1(page).innerText()).trim())
    const button = page.getByRole('button', { name: 'Earnest prayers (page 70)' })
    await button.click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('heading', { name: 'Earnest prayers' })).toBeVisible()
    await expect(sheet).toContainText(EARNEST_PRAYERS.intro)
    for (const item of EARNEST_PRAYERS.items) await expect(sheet.getByRole('listitem').filter({ hasText: item })).toBeVisible()
    for (const line of EARNEST_PRAYERS.closing) await expect(sheet).toContainText(line)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(button).toBeFocused()
  }
  await check() // intro
  await advance(page)
  await check() // list
  await addNames(page, 'A person or place', ['Pat'])
  await advance(page)
  for (let i = 0; i < 8; i++) {
    await check() // 3 defects, arouse, fault, relation, prayer, meditation
    await advance(page)
  }
  expect(seen).toHaveLength(10)
  await expect(h1(page)).toHaveText("You've been through every sex conduct and harms step")
})

test('earnest prayers sheet keeps what was typed, and does not clash with the words sheet', async ({ page }) => {
  await startWithBrowserSave(page, {
    harms: [harm()],
    visited: { 'harm:intro': true, 'harm:list': true },
  })
  await open(page, 'Sex conduct and harms')
  await expect(h1(page)).toHaveText('Where was I selfish?')
  await page.getByRole('textbox').fill('kept')
  await page.getByRole('button', { name: 'Earnest prayers (page 70)' }).click()
  await expect(page.getByRole('dialog', { name: 'Earnest prayers' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'What do these words mean?' }).click()
  await expect(page.getByRole('dialog', { name: 'What these words mean' })).toContainText(
    'Lack of consideration about how another person felt',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox')).toHaveValue('kept')
})

test('the harms prompts come from p. 13', async ({ page }) => {
  await startWithBrowserSave(page, { visited: { 'harm:intro': true } })
  await open(page, 'Sex conduct and harms')
  await expect(h1(page)).toHaveText('Whom did I hurt?')
  await page.getByRole('button', { name: 'Show suggestions' }).click()
  const sheet = page.getByRole('dialog')
  for (const p of ['Teachers', 'Current Spouse/Domestic Partner', 'Drivers of other cars', 'People I lied to about drinking', 'Your grocery store/local bakery/bar']) {
    await expect(sheet.getByRole('button', { name: `Add ${p}` })).toBeVisible()
  }
  await expect(sheet.getByRole('button', { name: 'Add Your grocery store/local bakery', exact: true })).toHaveCount(0)
  await expect(sheet).not.toContainText('{')
  await sheet.getByRole('button', { name: 'Add Teachers' }).click()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Teachers')
})

test('each inventory intro names its pages', async ({ page }) => {
  await startWithBrowserSave(page)
  await open(page, 'Resentments')
  await expect(page.getByTestId('hint')).toContainText('pages 63 to 67')
  await page.goto('/#/home')
  await open(page, 'Fears')
  await expect(page.getByTestId('hint')).toContainText('pages 67 and 68')
  await page.goto('/#/home')
  await open(page, 'Sex conduct and harms')
  await expect(page.getByTestId('hint')).toContainText('pages 68 to 70')
})

test('still-blank links name the right fear and harm', async ({ page }) => {
  await startWithBrowserSave(page, {
    fears: [fear()],
    harms: [harm()],
    visited: { 'fear:intro': true, 'fear:list': true, [`fear:why:${FEAR}`]: true, 'harm:intro': true, 'harm:list': true, [`harm:where:${HARM}:selfish`]: true },
  })
  await page.getByText('1 step still blank').first().click()
  await page.getByRole('link', { name: 'Fear of dentists: Why do I have the fear?' }).click()
  await expect(h1(page)).toHaveText('Why do I have the fear?')
  await expect(page.getByTestId('who')).toHaveText('Fear of dentists')
  await page.goto('/#/home')
  await page.getByText('1 step still blank').last().click()
  await page.getByRole('link', { name: 'Pat: Where was I selfish?' }).click()
  await expect(h1(page)).toHaveText('Where was I selfish?')
})

test('hostile text in a harm is shown literally', async ({ page }) => {
  const hostile = '<img src=x onerror=alert(1)>'
  const dialogs: string[] = []
  page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss() })
  await startWithBrowserSave(page, { visited: { 'harm:intro': true } })
  await open(page, 'Sex conduct and harms')
  await addNames(page, 'A person or place', [hostile])
  await advance(page)
  await expect(page.getByTestId('who')).toHaveText(hostile)
  await expect(page.locator('main img')).toHaveCount(0)
  expect(dialogs).toEqual([])
})

test('nothing scrolls sideways at 320px on the new screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await startWithBrowserSave(page, {
    harms: [harm({ who: 'W'.repeat(300) })],
    fears: [fear({ fear: 'F'.repeat(300) })],
    visited: { 'harm:intro': true, 'harm:list': true, 'fear:intro': true, 'fear:list': true, [`fear:why:${FEAR}`]: true },
  })
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await open(page, 'Fears')
  await expect(h1(page)).toHaveText('Where was my trust & reliance?')
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.goto('/#/home')
  await open(page, 'Sex conduct and harms')
  await expect(h1(page)).toHaveText('Where was I selfish?')
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Earnest prayers (page 70)' }).click()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
