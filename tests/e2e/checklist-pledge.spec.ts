import { FLAW_FOOTNOTES, FLAWS } from '../../src/content/checklist'
import type { InventoryDoc } from '../../src/core/doc'
import { expect, startWithBrowserSave, test } from './fixtures'

const stored = async (page: import('@playwright/test').Page) =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('step4-inventory'))) as string) as InventoryDoc
const settings = (preset: InventoryDoc['settings']['preset']) => ({ settings: { preset, godWord: { kind: 'god' as const, custom: '' } } })

async function openChecklist(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Flaws and assets checklist' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flaws and assets checklist')
}
async function openPledge(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Abstinence pledge' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Abstinence pledge')
}

test('each flaw shows its opposite aspect, and tapping selects it', async ({ page }) => {
  await startWithBrowserSave(page)
  await openChecklist(page)
  await expect(page.getByRole('checkbox')).toHaveCount(FLAWS.length)
  const jealous = page.getByRole('checkbox', { name: /^jealous\b/ })
  await expect(page.locator('label', { has: jealous })).toContainText('trusting, generous, admiring')
  await expect(jealous).not.toBeChecked()
  await jealous.check()
  await expect(jealous).toBeChecked()
  await expect.poll(async () => (await stored(page)).checklist.selected).toEqual(['jealous'])
  await jealous.uncheck()
  await expect.poll(async () => (await stored(page)).checklist.selected).toEqual([])
})

test('selections and the other field persist across reload, and the footnote sources are readable', async ({ page }) => {
  await startWithBrowserSave(page)
  await openChecklist(page)
  await page.getByRole('checkbox', { name: /^jealous\b/ }).check()
  await page.getByRole('checkbox', { name: /^angry\b/ }).check()
  await page.getByLabel(/^Other dysfunctional ways/).fill('Sulking <b>loudly</b>')
  // No Next or blur: the other field is committed on each keystroke.
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /^jealous\b/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /^angry\b/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /^cynical\b/ })).not.toBeChecked()
  await expect(page.getByLabel(/^Other dysfunctional ways/)).toHaveValue('Sulking <b>loudly</b>')
  for (const text of Object.values(FLAW_FOOTNOTES)) await expect(page.locator('main')).toContainText(text)
  await expect(page.getByLabel(/^Other dysfunctional ways/)).toHaveAttribute('spellcheck', 'false')
})

test('checklist has no horizontal scroll at 320px and is searchable by typing a word', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await startWithBrowserSave(page)
  await openChecklist(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const search = page.getByLabel('Search the list')
  await expect(search).toHaveAttribute('spellcheck', 'false')
  await search.fill('jealous')
  await expect(page.getByRole('checkbox')).toHaveCount(1)
  await page.getByRole('checkbox', { name: /^jealous\b/ }).check()
  // A selection stays when it is filtered out of view.
  await search.fill('zzzz')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByText('Nothing matches')).toBeVisible()
  await search.fill('')
  await expect(page.getByRole('checkbox', { name: /^jealous\b/ })).toBeChecked()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('food pledge uses Binge foods and Compulsive food behaviors; narcotics uses What I\'m abstaining from', async ({ page }) => {
  await startWithBrowserSave(page, settings('food'))
  await openPledge(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Binge foods' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Compulsive food behaviors' })).toBeVisible()
  await expect(page.locator('main')).toContainText('I pledge to abstain absolutely from the above binge foods and compulsive food behaviors.')
})

test("narcotics pledge uses What I'm abstaining from", async ({ page }) => {
  await startWithBrowserSave(page, settings('narcotics'))
  await openPledge(page)
  await expect(page.getByRole('heading', { level: 2, name: "What I'm abstaining from" })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: "Behaviors I'm abstaining from" })).toBeVisible()
  await expect(page.locator('main')).toContainText('I pledge to abstain absolutely from the above.')
})

test('pledge lists add, edit and remove items without losing the others', async ({ page }) => {
  await startWithBrowserSave(page)
  await openPledge(page)
  const addA = page.getByLabel("Add to What I'm abstaining from")
  for (const t of ['Wine', 'Beer', 'Gin']) {
    await addA.fill(t)
    await page.getByRole('button', { name: "Add to list: What I'm abstaining from" }).click()
  }
  await expect(addA).toHaveAttribute('autocomplete', 'off')
  await page.getByRole('button', { name: 'Edit Beer' }).click()
  await page.getByLabel('Change Beer').fill('Lager')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Remove Wine' }).click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect.poll(async () => (await stored(page)).pledge.listA).toEqual(['Lager', 'Gin'])
})

test('a half-typed pledge item is kept when leaving the screen', async ({ page }) => {
  await startWithBrowserSave(page)
  await openPledge(page)
  await page.getByLabel("Add to Behaviors I'm abstaining from").fill('Late-night driving')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Support' }).click()
  await expect.poll(async () => (await stored(page)).pledge.listB).toEqual(['Late-night driving'])
})

test('pledge can be skipped: home does not count it toward any required progress', async ({ page }) => {
  await startWithBrowserSave(page)
  const pledge = page.locator('li.section', { has: page.getByRole('link', { name: 'Abstinence pledge' }) })
  await expect(pledge).toContainText('optional')
  await expect(pledge).toContainText('Not started')
  await expect(pledge.getByText('still blank')).toHaveCount(0)
  await expect(page.locator('details', { hasText: 'pledge' })).toHaveCount(0)
  await openPledge(page)
  await expect(page.locator('main')).toContainText('The pledge is optional. Skip it if it is not part of your program.')
  await page.getByRole('link', { name: 'Back to your inventory' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
})

test('typed name and date are kept', async ({ page }) => {
  await startWithBrowserSave(page)
  await openPledge(page)
  await page.getByLabel('Signature').fill('Pat <i>Q</i> {god}')
  await page.getByLabel('Date').fill('7 Nov 2026')
  await page.reload()
  await expect(page.getByLabel('Signature')).toHaveValue('Pat <i>Q</i> {god}')
  await expect(page.getByLabel('Date')).toHaveValue('7 Nov 2026')
})
