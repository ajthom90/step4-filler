import type { Page } from '@playwright/test'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { FLAWS } from '../../src/content/checklist'
import { DISCLAIMER } from '../../src/content/copy'
import { EARNEST_PRAYERS } from '../../src/content/harms'
import type { Affects, Cause, FearEntry, HarmEntry, InventoryDoc, ResentmentEntry } from '../../src/core/doc'
import { expect, startWithBrowserSave, test } from './fixtures'

test.skip(({ browserName }) => browserName !== 'chromium', 'page.pdf() is Chromium only')

interface Item { str: string; x: number; y: number }
interface PdfPage { width: number; height: number; text: string; items: Item[] }

/** Prints the page to PDF the way the browser would, and reads back each page's text and positions. */
async function readPdf(page: Page): Promise<PdfPage[]> {
  const bytes = await page.pdf({ preferCSSPageSize: true })
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise
  const pages: PdfPage[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const p = await pdf.getPage(n)
    const view = p.getViewport({ scale: 1 })
    const content = await p.getTextContent()
    const items = content.items
      .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && i.str.trim() !== '')
      .map((i) => ({ str: i.str, x: i.transform[4], y: view.height - i.transform[5] }))
    pages.push({ width: view.width, height: view.height, items, text: items.map((i) => i.str).join(' ').replace(/\s+/g, ' ') })
  }
  return pages
}
/** A column heading: text matching `match`, in the header band under the anchor heading. */
function heading(p: PdfPage, anchor: string, match: RegExp): Item {
  const y = p.items.find((i) => i.str.startsWith(anchor))!.y
  const found = p.items.find((i) => i.y > y - 4 && i.y < y + 30 && match.test(i.str))
  expect(found, `heading ${match}`).toBeTruthy()
  return found!
}
const all = (pages: PdfPage[]) => pages.map((p) => p.text).join(' ')
/** The text with every space removed, for words the browser may split into runs. */
const squash = (s: string) => s.replace(/\s+/g, '')

const id = (c: string) => c.repeat(32)
const none = (): Affects => ({ selfEsteem: false, security: false, ambitions: false, personalRelations: false, sexRelations: false, fear: false })
let causes = 0
const cause = (_c: string, text: string, on: Partial<Affects> = {}): Cause => ({ id: `c${(++causes).toString(16).padStart(31, '0')}`, text, affects: { ...none(), ...on } })
const resentment = (c: string, name: string, causes: Cause[] = [], extra: Partial<ResentmentEntry> = {}): ResentmentEntry => ({
  id: id(c), name, causes, prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '', ...extra,
})
const fear = (c: string, text: string, extra: Partial<FearEntry> = {}): FearEntry => ({
  id: id(c), fear: text, why: '', trust: null, selfRelianceWorked: null, prayerDone: false, beWhat: '', ...extra,
})
const harm = (c: string, who: string, extra: Partial<HarmEntry> = {}): HarmEntry => ({
  id: id(c), who, selfish: '', dishonest: '', inconsiderate: '', jealousy: false, suspicion: false, bitterness: false,
  fault: '', wasSelfish: null, sexPrayerDone: false, sexMeditationDone: false, ...extra,
})
const god = (custom: string) => ({ settings: { preset: 'alcohol' as const, godWord: { kind: 'custom' as const, custom } } })

const SECTION = { resentments: 'Resentments', fears: 'Fears', harms: 'Sex conduct and harms', checklist: 'Flaws and assets checklist', pledge: 'Abstinence pledge' }
type Section = keyof typeof SECTION

async function openPrint(page: Page, doc: Partial<InventoryDoc> = {}) {
  await startWithBrowserSave(page, doc)
  await page.goto('/#/print')
  await expect(page.getByRole('heading', { level: 1, name: 'Print your inventory' })).toBeVisible()
}
/** Ticks exactly these sections on the print screen. */
async function choose(page: Page, ...sections: Section[]) {
  const group = page.getByRole('group', { name: 'What to print' })
  for (const key of Object.keys(SECTION) as Section[]) {
    const box = group.getByRole('checkbox', { name: SECTION[key] })
    if (sections.includes(key)) await box.check()
    else await box.uncheck()
  }
}

const words = (n: number, last: string) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ') + ` ${last}`
const LONG = (last: string) => words(3300, last).slice(0, 20_000 - last.length - 1) + ` ${last}`

test('disclaimer appears on every page', async ({ page }) => {
  const many = Array.from({ length: 14 }, (_, i) => resentment('abcdef'[i % 6], `Person ${i}`, [cause('1', 'a cause'), cause('2', 'another cause')]))
    .map((r, i) => ({ ...r, id: `${String(i).padStart(2, '0')}`.repeat(16) }))
  await openPrint(page, {
    resentments: many,
    fears: [fear('f', 'Fear of dentists')],
    harms: [harm('9', 'Pat')],
    pledge: { listA: ['x'], listB: ['y'], name: 'Sam', date: 'today' },
  })
  await choose(page, 'resentments', 'fears', 'harms', 'checklist', 'pledge')
  const pages = await readPdf(page)
  expect(pages.length).toBeGreaterThanOrEqual(5)
  for (const [i, p] of pages.entries()) expect(p.text, `page ${i + 1}`).toContain(DISCLAIMER)
})

test('resentment form matches the paper layout', async ({ page }) => {
  await openPrint(page, {
    resentments: [
      resentment('a', 'Pat', [
        cause('1', 'Took credit for my work', { selfEsteem: true, fear: true }),
        cause('2', 'Never called me back', { personalRelations: true }),
      ]),
      resentment('b', 'The bank', [cause('3', 'Fees I did not expect', { security: true, ambitions: true, sexRelations: true })]),
    ],
  })
  await choose(page, 'resentments')
  const [p] = await readPdf(page)
  const at = (s: string) => p.items.find((i) => i.str.includes(s))!
  expect(at("I'm resentful at")).toBeTruthy()
  expect(at('The causes')).toBeTruthy()
  expect(at('Core Character Defects')).toBeTruthy()
  expect(at('Affects my')).toBeTruthy()
  const headings = ['Self-Esteem', 'Security', 'Ambitions', 'Personal Relations', 'Sex Relations', 'Is any fear involved?']
  const found = headings.map((h) => p.items.filter((i) => squash(i.str).includes(squash(h))))
  found.forEach((f, i) => expect(f.length, headings[i]).toBeGreaterThan(0))
  // Columns run left to right in the paper's order.
  const xs = [at("I'm resentful at"), at('The causes'), ...found.map((f) => f[0]), at('Core Character Defects')].map((i) => i.x)
  expect(xs).toEqual([...xs].sort((a, b) => a - b))
  for (const d of ['Selfish', 'Dishonest', 'Self-Seeking', 'Frightened']) expect(p.text).toContain(d)
  // Each tick sits on its cause's row, under its own heading.
  const columnX = found.map((f) => f[0].x)
  const ticks = p.items.filter((i) => i.str === 'X')
  const expected: [string, number[]][] = [
    ['Took credit for my work', [0, 5]],
    ['Never called me back', [3]],
    ['Fees I did not expect', [1, 2, 4]],
  ]
  for (const [text, columns] of expected) {
    const row = at(text)
    const mine = ticks.filter((t) => Math.abs(t.y - row.y) < 6)
    const nearest = mine.map((t) => columnX.reduce((best, x, i) => (Math.abs(x - t.x) < Math.abs(columnX[best] - t.x) ? i : best), 0))
    expect(nearest.sort(), text).toEqual(columns)
  }
  expect(ticks).toHaveLength(6)
})

test('fear form matches the paper layout', async ({ page }) => {
  await openPrint(page, {
    fears: [
      fear('f', 'Fear of dentists', { why: 'Pain', trust: 'god', selfRelianceWorked: 'no', prayerDone: true, beWhat: 'Calm' }),
      fear('b', 'Fear of heights', { trust: 'self', selfRelianceWorked: 'yes' }),
    ],
  })
  await choose(page, 'fears')
  const [p] = await readPdf(page)
  const at = (s: string) => p.items.find((i) => i.str.includes(s))!
  const order = [/^I'm fearful of/, /^Why do I have/, /^Where was my/, /^Did self/, /^Fear Prayer/, /^What would God/].map((h) => heading(p, "I'm fearful of", h))
  const xs = order.map((h) => h.x)
  expect(xs).toEqual([...xs].sort((a, b) => a - b))
  for (const t of ['Infinite God', 'My Finite Self', 'Yes', 'No', 'Completed fear prayer?']) expect(p.text, t).toContain(t)
  const ticks = p.items.filter((i) => i.str === 'X')
  // Dentists: Infinite God, No, prayer done. Heights: My Finite Self, Yes, no prayer.
  expect(ticks).toHaveLength(5)
  const boundary = at('Fear of heights').y - 4
  const [first, second] = [ticks.filter((t) => t.y < boundary), ticks.filter((t) => t.y >= boundary)]
  expect(first).toHaveLength(3)
  expect(second).toHaveLength(2)
  const trustX = (at('Infinite').x + at('Finite').x) / 2
  const yesNoX = order[3].x - 2
  expect(first.filter((t) => t.x < yesNoX).map((t) => t.x < trustX)).toEqual([true])
  expect(second.filter((t) => t.x < yesNoX).map((t) => t.x > trustX)).toEqual([true])
})

test('harms form matches the paper layout', async ({ page }) => {
  await openPrint(page, {
    harms: [
      harm('9', 'Dave', { selfish: 'Skipped the wedding', jealousy: true, bitterness: true, fault: 'Could have been honest', wasSelfish: 'yes', sexPrayerDone: true }),
      harm('b', 'Ex-partner', { wasSelfish: 'no', sexMeditationDone: true }),
    ],
  })
  await choose(page, 'harms')
  const [p] = await readPdf(page)
  const at = (s: string) => p.items.find((i) => i.str.includes(s))!
  const order = [/^Whom did I/, /^Where was I \(2\)/, /^Did I/, /^Where was I at/, /^Was each/, /Prayer$|Prayer /, /Meditation/, /Earnest/].map((h) => heading(p, 'Whom did I', h))
  const xs = order.map((h) => h.x)
  expect(xs).toEqual([...xs].sort((a, b) => a - b))
  for (const t of ['Selfish', 'Dishonest', 'Inconsiderate', 'Jealousy?', 'Suspicion?', 'Bitterness?', 'Yes', 'No']) expect(p.text, t).toContain(t)
  expect(p.text).toContain(EARNEST_PRAYERS.intro)
  for (const item of EARNEST_PRAYERS.items) expect(squash(p.text)).toContain(squash(item))
  for (const line of EARNEST_PRAYERS.closing) expect(squash(p.text)).toContain(squash(line))
  const ticks = p.items.filter((i) => i.str === 'X')
  // Dave: jealousy, bitterness, selfish yes, prayer. Ex-partner: selfish no, meditation.
  expect(ticks).toHaveLength(6)
  const boundary = at('Ex-partner').y - 4
  expect(ticks.filter((t) => t.y < boundary)).toHaveLength(4)
  expect(ticks.filter((t) => t.y >= boundary)).toHaveLength(2)
})

test('checklist and pledge print like the handout', async ({ page }) => {
  await openPrint(page, { checklist: { selected: ['jealous', 'angry'], other: 'Sulking' }, pledge: { listA: ['Cake'], listB: ['Late night eating'], name: 'Sam', date: '1 Jan' }, ...god('God') })
  await choose(page, 'checklist', 'pledge')
  const pages = await readPdf(page)
  const text = all(pages)
  expect(text).toContain('Checklist of Flaws and Assets')
  expect(text).toContain('Character Defect')
  expect(text).toContain('Opposite Aspect')
  expect(text).toContain('Sulking')
  for (const f of FLAWS) expect(squash(text), f.defect).toContain(squash(f.defect))
  const ticks = pages.flatMap((p) => p.items).filter((i) => i.str === 'X')
  expect(ticks).toHaveLength(2)
  expect(text).toContain('Cake')
  expect(text).toContain('I pledge to abstain absolutely from the above.')
  expect(text).toContain('Signature')
  expect(text).toContain('Sam')
})

test('a 20,000-character entry prints in full', async ({ page }) => {
  const cases: { section: Section; doc: Partial<InventoryDoc>; last: string }[] = [
    { section: 'resentments', last: 'ENDCAUSE', doc: { resentments: [resentment('a', 'Pat', [cause('1', LONG('ENDCAUSE'))])] } },
    { section: 'resentments', last: 'ENDNAME', doc: { resentments: [resentment('a', LONG('ENDNAME'), [cause('1', 'x')])] } },
    { section: 'resentments', last: 'ENDDEFECT', doc: { resentments: [resentment('a', 'Pat', [cause('1', 'x')], { selfish: LONG('ENDDEFECT') })] } },
    { section: 'fears', last: 'ENDWHY', doc: { fears: [fear('f', 'Dentists', { why: LONG('ENDWHY') })] } },
    { section: 'fears', last: 'ENDFEAR', doc: { fears: [fear('f', LONG('ENDFEAR'))] } },
    { section: 'harms', last: 'ENDFAULT', doc: { harms: [harm('9', 'Dave', { fault: LONG('ENDFAULT') })] } },
    { section: 'harms', last: 'ENDWHERE', doc: { harms: [harm('9', 'Dave', { dishonest: LONG('ENDWHERE') })] } },
    { section: 'checklist', last: 'ENDOTHER', doc: { checklist: { selected: [], other: LONG('ENDOTHER') } } },
    { section: 'pledge', last: 'ENDPLEDGE', doc: { pledge: { listA: [LONG('ENDPLEDGE')], listB: [], name: '', date: '' } } },
  ]
  test.setTimeout(180_000)
  for (const c of cases) {
    await page.addInitScript(() => localStorage.clear())
    await openPrint(page, c.doc)
    await choose(page, c.section)
    const text = squash(all(await readPdf(page)))
    expect(text, `${c.section} ${c.last}`).toContain(c.last)
    expect(text, `${c.section} ${c.last} start`).toContain('w10w11')
  }
})

test('hostile text prints literally', async ({ page }) => {
  const evil = '<img src=x onerror="window.__pwned=1">'
  await openPrint(page, {
    resentments: [resentment('a', '{god}', [cause('1', evil), cause('2', '$& and $1 \u{1F600} שלום')], { selfish: '<b>bold</b>' })],
    fears: [fear('f', '<script>window.__pwned=2</script>')],
    harms: [harm('9', '{name} ‮evil')],
    ...god('Spirit'),
  })
  await choose(page, 'resentments', 'fears', 'harms')
  const text = squash(all(await readPdf(page)))
  for (const literal of [evil, '{god}', '$&and$1', '<b>bold</b>', '<script>window.__pwned=2</script>', '{name}'])
    expect(text, literal).toContain(squash(literal))
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  expect(await page.locator('main img, main script, main b').count()).toBe(0)
})

test('landscape pages for landscape forms', async ({ page }) => {
  await openPrint(page, { pledge: { listA: ['x'], listB: [], name: '', date: '' } })
  for (const s of ['resentments', 'fears', 'harms'] as const) {
    await choose(page, s)
    const pages = await readPdf(page)
    for (const p of pages) expect(p.width, s).toBeGreaterThan(p.height)
  }
  await choose(page, 'pledge')
  const pledge = await readPdf(page)
  for (const p of pledge) expect(p.height).toBeGreaterThan(p.width)
  // Together, each keeps its own orientation.
  await choose(page, 'resentments', 'pledge')
  const mixed = await readPdf(page)
  expect(mixed.some((p) => p.width > p.height)).toBe(true)
  expect(mixed.some((p) => p.height > p.width)).toBe(true)
})

test('can print one section or all of them', async ({ page }) => {
  await openPrint(page, { resentments: [resentment('a', 'Pat')], fears: [fear('f', 'Heights')], harms: [harm('9', 'Dave')] })
  const titles: Record<Section, string> = {
    resentments: 'Way to Be Rid of Resentment',
    fears: 'WAY OF REMOVING FEARS',
    harms: 'OVERHAUL',
    checklist: 'Checklist of Flaws and Assets',
    pledge: 'I pledge',
  }
  for (const only of ['resentments', 'fears', 'harms', 'checklist'] as const) {
    await choose(page, only)
    const text = all(await readPdf(page))
    for (const [key, title] of Object.entries(titles)) {
      if (key === only) expect(text, `${only} prints ${key}`).toContain(title)
      else expect(text, `${only} leaves out ${key}`).not.toContain(title)
    }
  }
  await choose(page, 'resentments', 'fears', 'harms', 'checklist')
  const everything = all(await readPdf(page))
  for (const key of ['resentments', 'fears', 'harms', 'checklist'] as const) expect(everything).toContain(titles[key])
  // The optional pledge is left out unless it is chosen or started.
  expect(everything).not.toContain('I pledge')
})

test('the pledge is chosen by default only when it has been started', async ({ page }) => {
  await openPrint(page)
  const box = page.getByRole('group', { name: 'What to print' }).getByRole('checkbox', { name: 'Abstinence pledge' })
  await expect(box).not.toBeChecked()
  await page.addInitScript(() => localStorage.clear())
  await openPrint(page, { pledge: { listA: ['Cake'], listB: [], name: '', date: '' } })
  await expect(box).toBeChecked()
})

test('empty answers still print as empty rows', async ({ page }) => {
  await openPrint(page)
  await choose(page, 'resentments', 'fears', 'harms')
  const pages = await readPdf(page)
  const text = all(pages)
  for (const t of ["I'm resentful at", "I'm fearful of", 'Whom did I hurt?', 'Core Character Defects']) expect(text).toContain(t)
  expect(pages.every((p) => p.text.includes(DISCLAIMER))).toBe(true)
  // A blank form has a bordered row for people to write in, not just a heading.
  const rows = await page.locator('main .print-form tbody tr').count()
  expect(rows).toBeGreaterThan(10)
})

test('the chosen word appears in headings and prayers', async ({ page }) => {
  await openPrint(page, { resentments: [resentment('a', 'Pat', [cause('1', 'x')])], fears: [fear('f', 'Heights')], harms: [harm('9', 'Dave')], ...god('Spirit') })
  await choose(page, 'resentments', 'fears', 'harms')
  const text = all(await readPdf(page))
  for (const t of ['What would Spirit have you be?', 'Infinite Spirit', 'Spirit, please remove my fear', 'Spirit, please mold my ideals', 'Spirit, please show me what to do', 'Spirit, please help me show'])
    expect(text, t).toContain(t)
  expect(text).not.toContain('What would God have you be?')
  expect(text).not.toContain('Infinite God')
  expect(text).not.toContain('{god}')
})

test('warns before printing', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __prints: number }).__prints = 0
    window.print = () => {
      ;(window as unknown as { __prints: number }).__prints++
    }
  })
  await openPrint(page, { resentments: [resentment('a', 'Pat')] })
  const prints = () => page.evaluate(() => (window as unknown as { __prints: number }).__prints)
  await page.getByRole('button', { name: 'Print or save as PDF' }).click()
  const warning = page.getByRole('dialog')
  await expect(warning).toContainText('A saved PDF is readable by anyone who has it')
  expect(await prints()).toBe(0)
  // Cancelling prints nothing.
  await warning.getByRole('button', { name: 'Cancel' }).click()
  await expect(warning).toBeHidden()
  expect(await prints()).toBe(0)
  await page.getByRole('button', { name: 'Print or save as PDF' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Continue to print' }).click()
  await expect.poll(prints).toBe(1)
})

test('screen controls do not print', async ({ page }) => {
  await openPrint(page, { resentments: [resentment('a', 'Pat')] })
  await choose(page, 'resentments')
  const pages = await readPdf(page)
  const text = all(pages)
  for (const t of ['Print or save as PDF', 'What to print', 'Settings', 'Support', 'Privacy', 'Not saved', 'Lock', 'Back to your inventory', 'Your inventory'])
    expect(text, t).not.toContain(t)
  // Once per page, from the form's own footer, and not again from the site footer.
  expect(text.split(DISCLAIMER).length - 1).toBe(pages.length)
})

test('the preview scrolls inside its own region, not the page, at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openPrint(page, { resentments: [resentment('a', 'Pat', [cause('1', 'x')])], fears: [fear('f', 'Heights')], harms: [harm('9', 'Dave')] })
  await choose(page, 'resentments', 'fears', 'harms', 'checklist')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  const regions = page.locator('main [role="region"][tabindex="0"]')
  await expect(regions).toHaveCount(4)
  for (const r of await regions.all()) {
    await expect(r).toHaveAttribute('aria-label', /\S/)
    expect(await r.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  }
  await regions.first().focus()
  await expect(regions.first()).toBeFocused()
})

test('printing uses no inline style attributes', async ({ page }) => {
  await openPrint(page, { resentments: [resentment('a', 'Pat', [cause('1', 'x', { fear: true })])], fears: [fear('f', 'Heights', { trust: 'god' })], harms: [harm('9', 'Dave')] })
  await choose(page, 'resentments', 'fears', 'harms', 'checklist', 'pledge')
  expect(await page.locator('[style]').count()).toBe(0)
})
