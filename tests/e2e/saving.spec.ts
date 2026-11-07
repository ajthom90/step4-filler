import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { PASSWORD_WARNING, PLAIN_WARNING, saveCopy } from '../../src/content/copy'
import { emptyDoc } from '../../src/core/doc'
import { MAX_FILE_BYTES } from '../../src/core/fileformat'
import { expect, test } from './fixtures'

const KEY = 'step4-inventory'
const SENTINEL = 'Sentinel-Zebra-7731'
const PASSWORD = 'correct horse battery'
const LIST = '#/step/resentments/res%3Alist'

const main = (page: Page) => page.locator('main')
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY)
const status = (page: Page) => page.getByRole('status').first()

async function begin(page: Page) {
  await page.goto('/')
  await page.getByRole('radio', { name: 'Food', exact: true }).check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
}

/** Moves to another screen and waits for focus to settle on its heading, so typing is not interrupted by it. */
async function goTo(page: Page, hash: string) {
  const moved = await page.evaluate((h) => {
    const changed = window.location.hash !== h
    window.location.hash = h
    return changed
  }, hash)
  if (moved) await expect(page.locator('main h1')).toBeFocused()
}

async function addName(page: Page, name: string) {
  await page.getByLabel('A person, institution, or principle').fill(name)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(name)
}

/** An inventory in memory only, holding the sentinel. Three committed edits are made on the way. */
async function beginWithSentinel(page: Page) {
  await begin(page)
  await goTo(page, LIST)
  await expect(page.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(page, SENTINEL)
}

async function saveInBrowser(page: Page, how: 'plain' | 'password') {
  await goTo(page, '#/save')
  if (how === 'password') {
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Type it again').fill(PASSWORD)
    await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
    await expect(main(page)).toContainText(saveCopy.savedBrowserEncrypted)
  } else {
    await page.getByRole('button', { name: 'Save in this browser without a password' }).click()
    await expect(main(page)).toContainText(saveCopy.savedBrowserPlain)
  }
}

const leaving = (page: Page) => page.evaluate(() => {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
})

const prompt = (page: Page) => page.getByRole('region', { name: saveCopy.promptHeading })

test('prompts after the third edit, and storage is empty until a choice is made', async ({ page }) => {
  await begin(page)
  await goTo(page, '#/step/resentments')
  await page.getByRole('button', { name: 'Next' }).click() // edit 1: a step left
  await goTo(page, LIST)
  await expect(page.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(page, 'Pat') // edit 2
  await expect(prompt(page)).toHaveCount(0)
  await addName(page, 'Lee') // edit 3
  await expect(prompt(page)).toBeVisible()
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  await page.waitForTimeout(1000)
  expect(await page.evaluate(() => localStorage.length)).toBe(0)

  await prompt(page).getByRole('button', { name: 'Not now' }).click()
  await expect(prompt(page)).toHaveCount(0)
  for (let i = 1; i <= 9; i++) await addName(page, `Name ${i}`)
  await expect(prompt(page)).toHaveCount(0)
  await addName(page, 'Name 10')
  await expect(prompt(page)).toBeVisible()
  expect(await page.evaluate(() => localStorage.length)).toBe(0)

  await prompt(page).getByRole('link', { name: saveCopy.promptChoose }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.title)
  await expect(prompt(page)).toHaveCount(0)
})

test('typing does not count as an edit; a changed field left behind counts once', async ({ page }) => {
  await begin(page)
  await goTo(page, '#/settings')
  // Focus is moved explicitly, because some browsers do not focus a radio when it is clicked.
  const custom = page.getByRole('radio', { name: 'My own word', exact: true })
  await custom.check()
  await custom.focus()
  const word = page.getByLabel('Your word')
  await word.focus() // leaves the changed radio: edit 1
  await word.pressSequentially('Spirit of this place and time, typed slowly')
  await expect(prompt(page)).toHaveCount(0) // forty keystrokes, still one pending change
  const food = page.getByRole('radio', { name: 'Food', exact: true })
  await food.focus() // leaves the changed text field: edit 2
  await expect(prompt(page)).toHaveCount(0)
  const narcotics = page.getByRole('radio', { name: 'Narcotics', exact: true })
  await narcotics.check()
  await narcotics.focus()
  await food.focus() // leaves the changed radio: edit 3
  await expect(prompt(page)).toBeVisible()
})

test('both warnings show the exact wording', async ({ page }) => {
  await begin(page)
  await goTo(page, '#/save')
  await expect(main(page)).toContainText(PASSWORD_WARNING)
  await expect(main(page)).toContainText(PLAIN_WARNING)
  expect(PASSWORD_WARNING).toBe("If you forget it, your inventory can't be recovered. No one can reset it.")
  expect(PLAIN_WARNING).toBe('Saved as readable text. Anyone using this device, or with the file, can read it.')
})

test('save screen recommends a backup file and explains that browser data can be cleared', async ({ page }) => {
  await begin(page)
  await goTo(page, '#/save')
  await expect(main(page).getByRole('heading', { name: saveCopy.backupHeading })).toBeVisible()
  await expect(main(page)).toContainText('Browsers can clear saved site data')
  await expect(main(page)).toContainText('A downloaded file is the safest backup')
  await expect(main(page).getByRole('button', { name: 'Download a file without a password' })).toBeVisible()
})

test('browser save without password is readable, and later edits autosave', async ({ page }) => {
  await beginWithSentinel(page)
  expect(await stored(page)).toBeNull()
  await saveInBrowser(page, 'plain')
  expect(await stored(page)).toContain(SENTINEL)
  await expect(status(page)).toHaveText('Saved on this device')
  await goTo(page, LIST)
  await addName(page, 'Second-Name')
  await expect.poll(() => stored(page)).toContain('Second-Name')
  await expect(status(page)).toHaveText('Saved on this device')
  await page.reload()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL) // back on the same step
})

test('browser save with password hides the text; reload asks for it; a wrong one leaves the save intact', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  const value = await stored(page)
  expect(value).not.toBeNull()
  expect(value).not.toContain(SENTINEL)
  expect(JSON.parse(value as string).format).toBe('step4-inventory-encrypted')
  await expect(status(page)).toHaveText('Saved on this device, with a password')

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await expect(page.locator('body')).not.toContainText(SENTINEL)
  const password = page.getByLabel('Password', { exact: true })
  await expect(password).toHaveAttribute('autocomplete', 'current-password')
  await password.fill('definitely wrong')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText(saveCopy.unlockWrong)
  expect(await stored(page)).toBe(value)

  await password.fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock' }).click()
  // Not the heading "Unlock your inventory" (also a match for "Your inventory"): the inventory is open once Lock is offered.
  await expect(page.getByRole('button', { name: 'Lock', exact: true })).toBeVisible()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  expect(await stored(page)).not.toContain(SENTINEL)
  await expect(status(page)).toHaveText('Saved on this device, with a password')
})

test('password fields suggest a new password to password managers', async ({ page }) => {
  await begin(page)
  await goTo(page, '#/save')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
  await expect(page.getByLabel('Type it again')).toHaveAttribute('autocomplete', 'new-password')
})

test('a password under 8 characters is refused, and so is one that does not match', async ({ page }) => {
  await beginWithSentinel(page)
  await goTo(page, '#/save')
  await page.getByLabel('Password', { exact: true }).fill('short')
  await page.getByLabel('Type it again').fill('short')
  await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.tooShort)
  await page.getByRole('button', { name: 'Download a file with a password' }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.tooShort)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(`${PASSWORD}x`)
  await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.mismatch)
  expect(await stored(page)).toBeNull()
  await expect(main(page)).not.toContainText(saveCopy.savedBrowserEncrypted)
})

async function download(page: Page, buttonName: string): Promise<{ name: string; text: string }> {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName }).click()])
  const path = await file.path()
  return { name: file.suggestedFilename(), text: readFileSync(path, 'utf8') }
}

async function openFile(page: Page, file: { name: string; mimeType?: string; buffer: Buffer }) {
  await page.getByLabel('Open a saved file').setInputFiles({ mimeType: 'application/json', ...file })
}

test('download then open round-trips, for a plain file and a password file', async ({ page, context }) => {
  await beginWithSentinel(page)
  await goTo(page, '#/save')

  const plain = await download(page, 'Download a file without a password')
  expect(plain.name).toMatch(/^inventory-backup-\d{4}-\d{2}-\d{2}\.json$/)
  expect(plain.name).not.toContain(SENTINEL)
  expect(plain.text).toContain(SENTINEL)
  expect(await stored(page)).toBeNull() // a download is not a browser save

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(PASSWORD)
  const locked = await download(page, 'Download a file with a password')
  expect(locked.name).toMatch(/^inventory-backup-\d{4}-\d{2}-\d{2}\.json$/)
  expect(locked.text).not.toContain(SENTINEL)
  expect(JSON.parse(locked.text).format).toBe('step4-inventory-encrypted')

  const other = await context.newPage()
  await other.goto('/')
  await openFile(other, { name: plain.name, buffer: Buffer.from(plain.text) })
  await expect(other.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await goTo(other, LIST)
  await expect(other.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await other.close()

  const third = await context.newPage()
  await third.goto('/')
  await openFile(third, { name: locked.name, buffer: Buffer.from(locked.text) })
  const filePassword = third.getByLabel('Password for this file')
  await expect(filePassword).toHaveAttribute('autocomplete', 'current-password')
  await filePassword.fill('not the password')
  await third.getByRole('button', { name: 'Open file' }).click()
  await expect(third.getByRole('alert')).toContainText(saveCopy.fileErrors['wrong-password'])
  await expect(third.getByRole('heading', { name: 'Your inventory' })).toHaveCount(0)
  await filePassword.fill(PASSWORD)
  await third.getByRole('button', { name: 'Open file' }).click()
  await expect(third.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await goTo(third, LIST)
  await expect(third.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await third.close()
})

test('opening over existing data asks first, and cancel leaves it unchanged', async ({ page }) => {
  await beginWithSentinel(page)
  await goTo(page, '#/home')
  const incoming = emptyDoc('food', { kind: 'god', custom: '' })
  incoming.resentments.push({
    id: 'b'.repeat(32), name: 'Incoming-Name', causes: [], prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
  })
  await openFile(page, { name: 'incoming.json', buffer: Buffer.from(JSON.stringify(incoming)) })
  const ask = page.getByRole('alertdialog', { name: saveCopy.replaceHeading })
  await expect(ask).toBeVisible()
  await expect(ask).toContainText(saveCopy.replaceMemory)
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(ask).toHaveCount(0)
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await expect(page.getByRole('list', { name: 'Your list' })).not.toContainText('Incoming-Name')

  await goTo(page, '#/home')
  await openFile(page, { name: 'incoming.json', buffer: Buffer.from(JSON.stringify(incoming)) })
  await page.getByRole('alertdialog', { name: saveCopy.replaceHeading }).getByRole('button', { name: 'Replace and open' }).click()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Incoming-Name')
  await expect(page.getByRole('list', { name: 'Your list' })).not.toContainText(SENTINEL)
})

test('bad files are rejected with a clear message and data is unchanged', async ({ page }) => {
  await beginWithSentinel(page)
  await goTo(page, '#/save')
  const goodPassword = PASSWORD
  await page.getByLabel('Password', { exact: true }).fill(goodPassword)
  await page.getByLabel('Type it again').fill(goodPassword)
  const locked = await download(page, 'Download a file with a password')
  const envelope = JSON.parse(locked.text)
  const flipped = envelope.ciphertext.startsWith('A') ? 'B' : 'A'
  const tampered = { ...envelope, ciphertext: flipped + envelope.ciphertext.slice(1) }
  const newer = { ...emptyDoc('food', { kind: 'god', custom: '' }), version: 99 }

  await goTo(page, '#/home')
  const cases: [string, Buffer, keyof typeof saveCopy.fileErrors][] = [
    ['notes.json', Buffer.from('this is not json'), 'not-inventory'],
    ['other.json', Buffer.from('{"hello":"world"}'), 'not-inventory'],
    ['newer.json', Buffer.from(JSON.stringify(newer)), 'newer-version'],
    ['broken.json', Buffer.from(JSON.stringify({ ...emptyDoc('food', { kind: 'god', custom: '' }), settings: 5 })), 'corrupt'],
    ['big.json', Buffer.alloc(MAX_FILE_BYTES + 1, 0x20), 'too-large'],
  ]
  for (const [name, buffer, code] of cases) {
    await openFile(page, { name, buffer })
    await expect(page.getByRole('alert')).toContainText(saveCopy.fileErrors[code])
    await expect(page.getByRole('alertdialog', { name: saveCopy.replaceHeading })).toHaveCount(0)
  }
  await openFile(page, { name: 'tampered.json', buffer: Buffer.from(JSON.stringify(tampered)) })
  await page.getByLabel('Password for this file').fill(goodPassword)
  await page.getByRole('button', { name: 'Open file' }).click()
  await expect(page.getByRole('alert')).toContainText(saveCopy.fileErrors['wrong-password'])
  await expect(page.getByRole('alertdialog', { name: saveCopy.replaceHeading })).toHaveCount(0)

  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
})

test('file-only use warns before leaving and shows the unsaved indicator', async ({ page }) => {
  await begin(page)
  expect(await leaving(page)).toBe(false) // nothing to lose yet
  await goTo(page, LIST)
  await addName(page, SENTINEL)
  expect(await leaving(page)).toBe(true)
  await expect(status(page)).toContainText('Not saved')
  await goTo(page, '#/save')
  await download(page, 'Download a file without a password')
  await expect(status(page)).toContainText('Matches your file')
  expect(await leaving(page)).toBe(false)
  await goTo(page, LIST)
  await addName(page, 'Changed after download')
  expect(await leaving(page)).toBe(true)
  await expect(status(page)).toContainText('Unsaved changes')
})

test('Lock clears the screen and requires the password again', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await goTo(page, LIST)
  await addName(page, 'Typed just before locking')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await expect(page.locator('body')).not.toContainText(SENTINEL)
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  expect(await stored(page)).not.toContain('Typed just before locking')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Typed just before locking')
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
})

test('Lock warns instead of locking when the latest changes cannot be saved', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await goTo(page, LIST)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  })
  await addName(page, 'Unsaved-Name')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  const ask = page.getByRole('group', { name: saveCopy.lockStaleHeading })
  await expect(ask).toContainText('will be lost')
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Unsaved-Name')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(saveCopy.unlockTitle)
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Unsaved-Name')
})

test('change password works and the old password no longer opens the save', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await goTo(page, '#/save')
  const next = 'a different long passphrase'
  await page.getByLabel('New password', { exact: true }).fill(next)
  await page.getByLabel('Type the new password again').fill(next)
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(main(page)).toContainText(saveCopy.passwordChanged)
  await page.reload()
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText(saveCopy.unlockWrong)
  await page.getByLabel('Password', { exact: true }).fill(next)
  await page.getByRole('button', { name: 'Unlock' }).click()
  // Not the heading "Unlock your inventory" (also a match for "Your inventory"): the inventory is open once Lock is offered.
  await expect(page.getByRole('button', { name: 'Lock', exact: true })).toBeVisible()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
})

test('remove password shows the plain warning first', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await goTo(page, '#/save')
  await expect(main(page)).not.toContainText(PLAIN_WARNING)
  await page.getByRole('button', { name: 'Remove the password' }).click()
  const ask = page.getByRole('alertdialog', { name: saveCopy.removeHeading })
  await expect(ask).toContainText(PLAIN_WARNING)
  expect(await stored(page)).not.toContain(SENTINEL)
  await ask.getByRole('button', { name: 'Keep the password' }).click()
  expect(await stored(page)).not.toContain(SENTINEL)
  await page.getByRole('button', { name: 'Remove the password' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.removeHeading }).getByRole('button', { name: 'Remove the password and save as readable text' }).click()
  await expect(main(page)).toContainText(saveCopy.passwordRemoved)
  expect(await stored(page)).toContain(SENTINEL)
  await expect(status(page)).toHaveText('Saved on this device')
})

test('stopping browser saving deletes the saved copy and says so', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await page.getByRole('button', { name: 'Stop saving in this browser' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.stopHeading }).getByRole('button', { name: 'Yes, delete the saved copy' }).click()
  await expect(main(page)).toContainText(saveCopy.stopped)
  expect(await stored(page)).toBeNull()
  await expect(status(page)).toContainText('Not saved')
  await goTo(page, LIST)
  await addName(page, 'After stopping')
  await page.waitForTimeout(1200)
  expect(await stored(page)).toBeNull()
})

test('Erase everything needs confirmation, clears storage, and says it cannot delete other copies', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await goTo(page, '#/settings')
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click()
  const ask = page.getByRole('alertdialog', { name: saveCopy.eraseHeading })
  await expect(ask).toContainText("can't delete files you have already downloaded or printed")
  expect(await stored(page)).toContain(SENTINEL)
  await ask.getByRole('button', { name: 'Keep my inventory' }).click()
  expect(await stored(page)).toContain(SENTINEL)
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click()
  await page.getByRole('alertdialog', { name: saveCopy.eraseHeading }).getByRole('button', { name: 'Yes, erase everything' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you begin')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
  await expect(page.locator('body')).not.toContainText(SENTINEL)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you begin')
})

test('a forgotten password can be left behind by erasing the saved copy', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click()
  await page.getByRole('alertdialog', { name: saveCopy.eraseHeading }).getByRole('button', { name: 'Yes, erase everything' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you begin')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})

test('save failure is visible and never says Saved', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  })
  await beginWithSentinel(page)
  await goTo(page, '#/save')
  await page.getByRole('button', { name: 'Save in this browser without a password' }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.saveFailed)
  await expect(status(page)).toContainText("Couldn't save")
  await expect(status(page)).not.toContainText('Saved')
  await expect(main(page)).not.toContainText(saveCopy.savedBrowserPlain)
  expect(await stored(page)).toBeNull()
  // The work is still here, and a password save fails the same way.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(PASSWORD)
  await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await expect(main(page).getByRole('alert').first()).toContainText(saveCopy.saveFailed)
  await expect(main(page)).not.toContainText(saveCopy.savedBrowserEncrypted)
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
})

test('a second tab sees the stale warning and cannot silently overwrite', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')

  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await expect(second.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(second, 'From-Second-Tab')
  await expect.poll(() => stored(second)).toContain('From-Second-Tab')

  await expect(page.getByText('Another tab saved a newer version')).toBeVisible()
  await expect(status(page)).toContainText('Changed in another tab')
  await goTo(page, LIST)
  await addName(page, 'From-First-Tab')
  await page.waitForTimeout(1200)
  expect(await stored(page)).toContain('From-Second-Tab')
  expect(await stored(page)).not.toContain('From-First-Tab')

  await goTo(page, '#/save')
  await expect(main(page)).toContainText(saveCopy.stale)
  await expect(main(page).getByRole('button', { name: 'Reload this page' })).toBeVisible()
  await expect(main(page).getByRole('button', { name: 'Save in this browser without a password' })).toHaveCount(0)
  expect(await stored(page)).toContain('From-Second-Tab')

  // Overwriting is a separate, explicit step.
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await expect(main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading })).toContainText(saveCopy.staleReplaceWarning)
  expect(await stored(page)).not.toContain('From-First-Tab')
  await main(page).getByRole('button', { name: 'Cancel' }).click()
  await main(page).getByRole('button', { name: 'Reload this page' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.title)
  await expect(page.locator('.notice.alert')).toHaveCount(0) // the newer save is what is open now
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('From-Second-Tab')
  await second.close()
})

test('a tab whose save another tab erased says that what is open is the only copy', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')

  const second = await context.newPage()
  await second.goto('/#/save')
  await second.getByRole('button', { name: 'Stop saving in this browser' }).click()
  await second.getByRole('button', { name: 'Yes, delete the saved copy' }).click()
  await expect.poll(() => stored(second)).toBeNull()

  await expect(page.getByRole('alert').filter({ hasText: saveCopy.staleBannerRemoved })).toBeVisible()
  await expect(page.getByText(saveCopy.staleBanner)).toHaveCount(0)
  await goTo(page, '#/save')
  await expect(main(page)).toContainText(saveCopy.staleBannerRemoved)
  await expect(main(page)).not.toContainText(saveCopy.stale)
  await second.close()
})

test('the save and unlock screens fit at 320px with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await beginWithSentinel(page)
  await goTo(page, '#/save')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.title)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await saveInBrowser(page, 'password')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

/** Two tabs on one saved password inventory; the second has unlocked and the first has not been touched. */
async function twoTabsWithPassword(page: Page, context: import('@playwright/test').BrowserContext) {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await second.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await second.getByRole('button', { name: 'Unlock' }).click()
  await expect(second.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  return second
}

test('review 1: stopping browser saving after a reload still warns before leaving', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await page.reload()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await goTo(page, '#/save')
  await page.getByRole('button', { name: 'Stop saving in this browser' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.stopHeading }).getByRole('button', { name: 'Yes, delete the saved copy' }).click()
  await expect(main(page)).toContainText(saveCopy.stopped)
  expect(await leaving(page)).toBe(true) // the only copy was just deleted
})

test('review 2, 6: a stale tab warns that its changes are lost, warns on leaving, and cannot stop saving', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await expect(second.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(second, 'From-Second-Tab')
  await expect(status(page)).toContainText('Changed in another tab')
  expect(await leaving(page)).toBe(false) // nothing here that the save lacks
  await goTo(page, LIST)
  await addName(page, 'Only-In-This-Tab')
  expect(await leaving(page)).toBe(true)
  await goTo(page, '#/save')
  await expect(main(page)).toContainText('will be lost')
  await expect(main(page).getByRole('button', { name: 'Stop saving in this browser' })).toHaveCount(0)
  await second.close()
})

test('review 3: replacing a newer save really writes this tab\'s inventory, once', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await expect(second.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(second, 'From-Second-Tab')
  await expect(status(page)).toContainText('Changed in another tab')
  await goTo(page, '#/save')
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page)).toContainText(saveCopy.savedBrowserPlain)
  expect(await stored(page)).toContain(SENTINEL)
  expect(await stored(page)).not.toContain('From-Second-Tab')
  await expect(status(page)).toHaveText('Saved on this device')
  await second.close()
})

test('review 3, 4, 7: after an unlock goes stale, replacing is a one-time, explicit choice', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await second.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await second.getByRole('button', { name: 'Unlock' }).click()
  await expect(second.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  const before = await stored(second)
  await addName(second, 'From-Second-Tab')
  await expect.poll(() => stored(second)).not.toBe(before)
  const theirs = await stored(second)

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(status(page)).toContainText('Changed in another tab')
  expect(await stored(page)).toBe(theirs) // unlocking wrote nothing over it
  await goTo(page, '#/save')
  await expect(main(page).getByRole('button', { name: 'Save in this browser without a password' })).toHaveCount(0)

  // The password is still held, so replacing writes a password-protected save, never readable text.
  // The first attempt fails; nothing more may be written without a new confirmation.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    let failed = false
    Storage.prototype.setItem = function (k: string, v: string) {
      if (!failed) { failed = true; throw new DOMException('full', 'QuotaExceededError') }
      return original.call(this, k, v)
    }
  })
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page).getByRole('alert')).toBeVisible()
  expect(await stored(page)).toBe(theirs)
  await page.waitForTimeout(1200)
  expect(await stored(page)).toBe(theirs)
  await expect(main(page).getByRole('button', { name: saveCopy.staleReplace })).toBeVisible()

  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page)).toContainText(saveCopy.savedBrowserEncrypted)
  expect(await stored(page)).not.toContain(SENTINEL)
  expect(JSON.parse((await stored(page)) as string).format).toBe('step4-inventory-encrypted')
  await second.close()
})

test('review 5: opening a password file over a readable browser save never writes readable text', async ({ page, browser }) => {
  const SECRET = 'Secret-B-9921'
  const other = await browser.newContext()
  const pageB = await other.newPage()
  await begin(pageB)
  await goTo(pageB, LIST)
  await addName(pageB, SECRET)
  await goTo(pageB, '#/save')
  await pageB.getByLabel('Password', { exact: true }).fill('another long passphrase')
  await pageB.getByLabel('Type it again').fill('another long passphrase')
  const file = await download(pageB, 'Download a file with a password')
  await other.close()

  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await page.evaluate(() => {
    const writes: string[] = []
    ;(window as unknown as { __writes: string[] }).__writes = writes
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) { writes.push(v); return original.call(this, k, v) }
  })
  await goTo(page, '#/home')
  await openFile(page, { name: file.name, buffer: Buffer.from(file.text) })
  await page.getByLabel('Password for this file').fill('another long passphrase')
  await page.getByRole('button', { name: 'Open file' }).click()
  const ask = page.getByRole('alertdialog', { name: saveCopy.replaceHeading })
  await expect(ask).toContainText(saveCopy.replaceBrowserEncrypted)
  await ask.getByRole('button', { name: 'Replace and open' }).click()
  await expect(status(page)).toHaveText('Saved on this device, with a password')
  expect(JSON.parse((await stored(page)) as string).format).toBe('step4-inventory-encrypted')
  const writes = await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)
  expect(writes.length).toBeGreaterThan(0)
  expect(writes.filter((w) => w.includes(SECRET))).toEqual([])
})

test('review 7: a second tab unlocking does not make the first stale, and Lock still works', async ({ page, context }) => {
  const second = await twoTabsWithPassword(page, context)
  await page.waitForTimeout(500)
  await expect(status(page)).toHaveText('Saved on this device, with a password')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await second.close()
})

test('review 7: Lock in a stale tab locks at once without edits, and warns first with edits', async ({ page, context }) => {
  const second = await twoTabsWithPassword(page, context)
  await addName(second, 'From-Second-Tab')
  await expect(status(page)).toContainText('Changed in another tab')
  const theirs = await stored(second)
  await goTo(page, LIST)
  await addName(page, 'Lost-Edit')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  const ask = page.getByRole('group', { name: saveCopy.lockStaleHeading })
  await expect(ask).toContainText('will be lost')
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Lost-Edit')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await page.getByRole('group', { name: saveCopy.lockStaleHeading }).getByRole('button', { name: saveCopy.lockStaleYes }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await expect(page.locator('body')).not.toContainText('Lost-Edit')
  expect(await stored(page)).toBe(theirs)

  // With nothing unsaved, a stale tab locks at once.
  const third = await context.newPage()
  await third.goto(`/${LIST}`)
  await third.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await third.getByRole('button', { name: 'Unlock' }).click()
  await expect(third.getByRole('list', { name: 'Your list' })).toContainText('From-Second-Tab')
  await addName(third, 'Third-Tab-Name')
  await expect(status(second)).toContainText('Changed in another tab')
  await second.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(second.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await third.close()
})

const SECRET = 'Secret-C-4417'
const FILE_PASSWORD = 'file passphrase here'

/** An encrypted file holding SECRET, made in a separate browser context so no storage is shared. */
async function secretFile(browser: import('@playwright/test').Browser) {
  const other = await browser.newContext()
  const pageB = await other.newPage()
  await begin(pageB)
  await goTo(pageB, LIST)
  await addName(pageB, SECRET)
  await goTo(pageB, '#/save')
  await pageB.getByLabel('Password', { exact: true }).fill(FILE_PASSWORD)
  await pageB.getByLabel('Type it again').fill(FILE_PASSWORD)
  const file = await download(pageB, 'Download a file with a password')
  await other.close()
  return file
}

/** Records every value written to storage, and fails writes while window.__fail is true. */
async function spyOnWrites(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __writes: string[]; __fail: boolean }
    w.__writes = []
    w.__fail = false
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) {
      w.__writes.push(v)
      if (w.__fail) throw new DOMException('full', 'QuotaExceededError')
      return original.call(this, k, v)
    }
  })
}
const writes = (page: Page) => page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)
const failWrites = (page: Page, on: boolean) => page.evaluate((v) => { (window as unknown as { __fail: boolean }).__fail = v }, on)

async function openSecretOverPlain(page: Page, file: { name: string; text: string }) {
  await goTo(page, '#/home')
  await openFile(page, { name: file.name, buffer: Buffer.from(file.text) })
  await page.getByLabel('Password for this file').fill(FILE_PASSWORD)
  await page.getByRole('button', { name: 'Open file' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.replaceHeading }).getByRole('button', { name: 'Replace and open' }).click()
}

test('S1: a failed upgrade to the file password leaves the old save alone and never writes readable text', async ({ page, browser }) => {
  const file = await secretFile(browser)
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const old = await stored(page)
  await spyOnWrites(page)
  await failWrites(page, true)
  await openSecretOverPlain(page, file)
  await expect(page.getByRole('alert')).toContainText(saveCopy.openedNotSaved)
  await expect(status(page)).not.toContainText('Saved')
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SECRET)
  await addName(page, 'Later-Edit')
  await failWrites(page, false) // storage recovers
  await page.waitForTimeout(1500)
  expect(await stored(page)).toBe(old)
  expect((await writes(page)).filter((w) => w.includes(SECRET) || w.includes('Later-Edit'))).toEqual([])
  // Saving it as readable text is only possible as an explicit choice that shows the warning.
  await goTo(page, '#/save')
  await page.getByRole('button', { name: 'Save in this browser without a password' }).click()
  await expect(page.getByRole('alertdialog', { name: saveCopy.removeHeading })).toContainText(PLAIN_WARNING)
  await page.getByRole('button', { name: saveCopy.removeKeep }).click()
  await page.waitForTimeout(300)
  expect((await writes(page)).filter((w) => w.includes(SECRET))).toEqual([])
  expect(await stored(page)).toBe(old)
})

test('S1: a stale save during the upgrade, then replacing the newer save, still never writes readable text', async ({ page, browser, context }) => {
  const file = await secretFile(browser)
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await expect(second.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(second, 'From-Second-Tab')
  await expect(status(page)).toContainText('Changed in another tab')
  await spyOnWrites(page)
  await openSecretOverPlain(page, file)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await goTo(page, LIST)
  await addName(page, 'Later-Edit')
  await page.waitForTimeout(1500)
  expect(await stored(page)).toContain('From-Second-Tab')
  expect((await writes(page)).filter((w) => w.includes(SECRET) || w.includes('Later-Edit'))).toEqual([])

  await goTo(page, '#/save')
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page)).toContainText(saveCopy.savedBrowserEncrypted)
  expect(JSON.parse((await stored(page)) as string).format).toBe('step4-inventory-encrypted')
  expect((await writes(page)).filter((w) => w.includes(SECRET) || w.includes('Later-Edit'))).toEqual([])
  await second.close()
})

test('S2: nothing readable stays in the page heap after Lock', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses a Chrome DevTools heap snapshot')
  const HEAP = 'Heap-Sentinel-5521'
  await begin(page)
  await goTo(page, LIST)
  await addName(page, HEAP)
  await saveInBrowser(page, 'password')
  await page.waitForTimeout(1200) // saved, so the last written copy is the one on record
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await page.getByLabel('Password', { exact: true }).fill('x') // later renders, as any real use has
  await page.getByLabel('Password', { exact: true }).fill('xy')
  await page.waitForTimeout(200)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
  let snapshot = ''
  cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => { snapshot += e.chunk })
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  expect(snapshot.includes(`"${HEAP}"`)).toBe(false) // as a string of its own, the way an entry's name is held
})

test('R7b: unlocking into a stale save keeps Lock and a password-protected download', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await page.reload()
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await second.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await second.getByRole('button', { name: 'Unlock' }).click()
  await expect(second.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  const before = await stored(second)
  await addName(second, 'From-Second-Tab')
  await expect.poll(() => stored(second)).not.toBe(before)

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(status(page)).toContainText('Changed in another tab')
  await expect(page.getByRole('button', { name: 'Lock', exact: true })).toBeVisible()
  await goTo(page, '#/save')
  const file = await download(page, saveCopy.labels.downloadPassword)
  expect(JSON.parse(file.text).format).toBe('step4-inventory-encrypted')
  expect(file.text).not.toContain(SENTINEL)
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await second.close()
})

test('R7b: after a failed replace the tab is still known to be stale, and Lock works', async ({ page, context }) => {
  const second = await twoTabsWithPassword(page, context)
  const before = await stored(second)
  await addName(second, 'From-Second-Tab')
  await expect.poll(() => stored(second)).not.toBe(before)
  await expect(status(page)).toContainText('Changed in another tab')
  await goTo(page, '#/save')
  await spyOnWrites(page)
  await failWrites(page, true)
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.stale) // still stale, not just "failed"
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await second.close()
})

test('N1: a stale readable tab cannot replace a password-protected save', async ({ page, context }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const second = await context.newPage()
  await second.goto('/#/save')
  await second.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await second.getByLabel('Type it again').fill(PASSWORD)
  await second.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await expect(second.locator('main')).toContainText(saveCopy.savedBrowserEncrypted)
  await expect(status(page)).toContainText('Changed in another tab')
  const theirs = await stored(page)
  expect(JSON.parse(theirs as string).format).toBe('step4-inventory-encrypted')
  await goTo(page, '#/save')
  await expect(main(page)).toContainText(saveCopy.staleNoReplace)
  await expect(main(page).getByRole('button', { name: saveCopy.staleReplace })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: 'Save in this browser without a password' })).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: 'Reload this page' })).toBeVisible()
  await page.waitForTimeout(300)
  expect(await stored(page)).toBe(theirs)
  await second.close()
})

test('N3: Lock in a stale tab counts text typed but not yet added', async ({ page, context }) => {
  const second = await twoTabsWithPassword(page, context)
  const before = await stored(second)
  await addName(second, 'From-Second-Tab')
  await expect.poll(() => stored(second)).not.toBe(before)
  await expect(status(page)).toContainText('Changed in another tab')
  await goTo(page, LIST)
  await page.getByLabel('A person, institution, or principle').fill('Typed-Draft')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  const ask = page.getByRole('group', { name: saveCopy.lockStaleHeading })
  await expect(ask).toContainText('will be lost')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(saveCopy.unlockTitle)
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Typed-Draft')
  await second.close()
})

const KEY_NAME = 'step4-inventory'
const setStored = (page: Page, value: string) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY_NAME, value])
const plainDoc = () => JSON.stringify(emptyDoc('food', { kind: 'god', custom: '' }))

async function staleAgainstPlain(page: Page, context: import('@playwright/test').BrowserContext) {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const second = await context.newPage()
  await second.goto(`/${LIST}`)
  await expect(second.getByLabel('A person, institution, or principle')).toBeVisible()
  await addName(second, 'From-Second-Tab')
  await expect(status(page)).toContainText('Changed in another tab')
  return second
}

test('N1 route a: a replace confirmation left open cannot write readable text after a password is set elsewhere', async ({ page, context }) => {
  const second = await staleAgainstPlain(page, context)
  await goTo(page, '#/save')
  await spyOnWrites(page)
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await goTo(second, '#/save')
  await second.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await second.getByLabel('Type it again').fill(PASSWORD)
  await second.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await expect(second.locator('main')).toContainText(saveCopy.savedBrowserEncrypted)
  const theirs = await stored(page)
  expect(JSON.parse(theirs as string).format).toBe('step4-inventory-encrypted')
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.staleNoReplace)
  expect(await stored(page)).toBe(theirs)
  expect((await writes(page)).filter((w) => w.includes(SENTINEL))).toEqual([])
  await second.close()
})

test('N1 route b: a choice armed before another tab sets a password cannot write readable text', async ({ page, context }) => {
  const file = await secretFile(context.browser() as import('@playwright/test').Browser)
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await page.getByRole('button', { name: 'Stop saving in this browser' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.stopHeading }).getByRole('button', { name: 'Yes, delete the saved copy' }).click()
  await expect(main(page)).toContainText(saveCopy.stopped)
  const second = await context.newPage()
  await second.goto('/')
  await setStored(second, plainDoc())
  await expect(status(page)).toContainText('Changed in another tab')
  await spyOnWrites(page)
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYesChoose }).click()
  await setStored(second, file.text) // another tab now holds a password-protected save
  await page.getByRole('button', { name: 'Save in this browser without a password' }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.staleNoReplace)
  expect(await stored(page)).toBe(file.text)
  expect((await writes(page)).filter((w) => w.includes(SENTINEL))).toEqual([])
  await second.close()
})

test('N1 route c: a save this site cannot read is never replaced', async ({ page, context }) => {
  const second = await staleAgainstPlain(page, context)
  await goTo(page, '#/save')
  await spyOnWrites(page)
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  const newer = JSON.stringify({ ...JSON.parse(plainDoc()), version: 99 })
  await setStored(second, newer)
  await main(page).getByRole('alertdialog', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
  await expect(main(page).getByRole('alert')).toContainText(saveCopy.staleNoReplace)
  expect(await stored(page)).toBe(newer)
  expect((await writes(page)).filter((w) => w.includes(SENTINEL))).toEqual([])
  // And it is not even offered once the page can see it.
  await page.reload()
  await expect(page.locator('main')).not.toContainText(SENTINEL)
  await second.close()
})

test('S1 message: a file opened from the Save screen with writes failing still tells the person where it stands', async ({ page }) => {
  const incoming = emptyDoc('food', { kind: 'god', custom: '' })
  incoming.resentments.push({
    id: 'b'.repeat(32), name: 'Incoming-Name', causes: [], prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
  })
  const buffer = Buffer.from(JSON.stringify(incoming))
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const old = await stored(page)
  await spyOnWrites(page)
  await failWrites(page, true)
  await goTo(page, '#/save')
  await openFile(page, { name: 'incoming.json', buffer })
  await page.getByRole('alertdialog', { name: saveCopy.replaceHeading }).getByRole('button', { name: 'Replace and open' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  const notice = page.getByRole('alert').filter({ hasText: saveCopy.openedNotSaved })
  await expect(notice).toBeVisible()
  expect(await stored(page)).toBe(old)
  await notice.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toHaveCount(0)

  // The same from Home.
  await failWrites(page, false)
  await saveInBrowser(page, 'plain')
  await failWrites(page, true)
  await goTo(page, '#/home')
  await openFile(page, { name: 'incoming.json', buffer })
  await page.getByRole('alertdialog', { name: saveCopy.replaceHeading }).getByRole('button', { name: 'Replace and open' }).click()
  await expect(page.getByRole('alert').filter({ hasText: saveCopy.openedNotSaved })).toBeVisible()
  // A later successful save clears it.
  await failWrites(page, false)
  await saveInBrowser(page, 'plain')
  await expect(page.getByRole('alert').filter({ hasText: saveCopy.openedNotSaved })).toHaveCount(0)
})

test('S1 message: opening a file on the first-visit screen has nothing to fail and shows no warning', async ({ page }) => {
  await page.goto('/')
  await openFile(page, { name: 'incoming.json', buffer: Buffer.from(plainDoc()) })
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: saveCopy.openedNotSaved })).toHaveCount(0)
})

test('R7b revised: after a failed upgrade from Home, Lock shows, warns, clears the screen, and the old copy is untouched', async ({ page, browser }) => {
  const file = await secretFile(browser)
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  const old = await stored(page)
  await spyOnWrites(page)
  await failWrites(page, true)
  await openSecretOverPlain(page, file)
  await expect(page.getByRole('alert').filter({ hasText: saveCopy.openedNotSaved })).toBeVisible()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SECRET)
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  const ask = page.getByRole('group', { name: saveCopy.lockStaleHeading })
  await expect(ask).toContainText('will be lost')
  await expect(ask.getByRole('button', { name: saveCopy.labels.downloadPassword })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SECRET) // nothing cleared yet
  await ask.getByRole('button', { name: saveCopy.lockStaleYes }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await expect(page.locator('body')).not.toContainText(SECRET)
  await expect(page.locator('body')).not.toContainText(SENTINEL)
  await expect(main(page)).toContainText(saveCopy.lockedReadableCopy)
  await expect(forgotHeading(page)).toHaveCount(0)
  expect(await stored(page)).toBe(old)
  await failWrites(page, false)
  await page.reload()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL) // the old copy, as it was
  await expect(page.locator('body')).not.toContainText(SECRET)
})

test('R7b revised: a tab that chose a readable save has no Lock', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await expect(page.getByRole('button', { name: 'Lock', exact: true })).toHaveCount(0)
})

const forgotHeading = (page: Page) => page.getByRole('heading', { name: saveCopy.forgotHeading })

/** Opens the password file on the first-visit screen, so nothing is in browser storage unless a test puts it there. */
async function openSecretFromWelcome(page: Page, file: { name: string; text: string }) {
  await page.goto('/')
  await openFile(page, { name: file.name, buffer: Buffer.from(file.text) })
  await page.getByLabel('Password for this file').fill(FILE_PASSWORD)
  await page.getByRole('button', { name: 'Open file' }).click()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
}

/** Locks an inventory this browser does not hold, which asks first. */
async function lockAndDiscard(page: Page) {
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await page.getByRole('group', { name: saveCopy.lockStaleHeading }).getByRole('button', { name: saveCopy.lockStaleYes }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await expect(page.locator('body')).not.toContainText(SECRET)
}

const putInStorage = (page: Page, value: string) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value])

test('locked screen, nothing stored: a password file opened on the first-visit screen', async ({ page, browser }) => {
  const file = await secretFile(browser)
  await openSecretFromWelcome(page, file)
  await lockAndDiscard(page)
  expect(await stored(page)).toBeNull()
  await expect(main(page)).toContainText(saveCopy.lockedNothingSaved)
  await expect(main(page)).not.toContainText('Reload')
  await expect(forgotHeading(page)).toHaveCount(0)
  await expect(main(page)).not.toContainText(saveCopy.forgotText)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you begin') // nothing to open, as it said
})

test('locked screen, nothing stored: Lock after stopping browser saving', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await page.getByRole('button', { name: 'Stop saving in this browser' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.stopHeading }).getByRole('button', { name: 'Yes, delete the saved copy' }).click()
  await expect(main(page)).toContainText(saveCopy.stopped)
  await lockAndDiscard(page)
  expect(await stored(page)).toBeNull()
  await expect(main(page)).toContainText(saveCopy.lockedNothingSaved)
  await expect(forgotHeading(page)).toHaveCount(0)
})

test('locked screen, readable copy: says a reload opens it, and it does', async ({ page, browser }) => {
  const file = await secretFile(browser)
  await openSecretFromWelcome(page, file)
  const copy = plainDoc()
  await putInStorage(page, copy)
  await lockAndDiscard(page)
  await expect(main(page)).toContainText(saveCopy.lockedReadableCopy)
  await expect(forgotHeading(page)).toHaveCount(0)
  expect(await stored(page)).toBe(copy)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
})

for (const [what, value] of [
  ['not JSON', 'not an inventory'],
  ['from a newer version', JSON.stringify({ ...JSON.parse(plainDoc()), version: 99 })],
  ['a damaged password save', JSON.stringify({ format: 'step4-inventory-encrypted' })],
] as const) {
  test(`locked screen, unreadable copy: ${what}`, async ({ page, browser }) => {
    const file = await secretFile(browser)
    await openSecretFromWelcome(page, file)
    await putInStorage(page, value)
    await lockAndDiscard(page)
    await expect(main(page)).toContainText(saveCopy.lockedUnreadableCopy)
    await expect(main(page)).not.toContainText('Reload')
    await expect(forgotHeading(page)).toHaveCount(0)
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
    expect(await stored(page)).toBe(value)
  })
}

test('locked screen, password-protected copy: asks for the password and offers the forgot text', async ({ page, browser }) => {
  const file = await secretFile(browser)
  await openSecretFromWelcome(page, file)
  await putInStorage(page, file.text)
  await lockAndDiscard(page)
  await expect(forgotHeading(page)).toBeVisible()
  await expect(main(page)).toContainText(saveCopy.forgotText)
  await expect(main(page)).toContainText(saveCopy.unlockText)
  for (const text of [saveCopy.lockedNothingSaved, saveCopy.lockedReadableCopy, saveCopy.lockedUnreadableCopy]) {
    await expect(main(page)).not.toContainText(text)
  }
  await page.getByLabel('Password', { exact: true }).fill(FILE_PASSWORD)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SECRET)
})

test('locked screen: a storage read that throws at lock time is not reported as nothing stored', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await page.evaluate(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
  })
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.unlockTitle)
  await expect(main(page)).toContainText(saveCopy.lockedUnreadableCopy)
  await expect(main(page)).not.toContainText(saveCopy.lockedNothingSaved)
  await expect(forgotHeading(page)).toHaveCount(0)
})

test('locked screen: storage blocked from the start is not reported as nothing stored', async ({ page, browser }) => {
  const file = await secretFile(browser)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError') } })
  })
  await openSecretFromWelcome(page, file)
  await lockAndDiscard(page)
  await expect(main(page)).toContainText(saveCopy.lockedUnreadableCopy)
  await expect(main(page)).not.toContainText(saveCopy.lockedNothingSaved)
  await expect(forgotHeading(page)).toHaveCount(0)
})

/** Puts a save this site cannot read into browser storage, and loads the page over it. */
async function damagedSave(page: Page, value = '{not json') {
  await page.goto('/')
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value])
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.problemHeading)
}

test('a save that cannot be read offers opening a file and erasing, and changes nothing by itself', async ({ page }) => {
  await damagedSave(page)
  await expect(page.getByRole('alert')).toContainText(saveCopy.loadProblems['not-inventory'])
  await expect(main(page)).toContainText(saveCopy.problemText)
  await expect(page.getByLabel(saveCopy.labels.openFile)).toBeVisible()
  await expect(page.getByRole('button', { name: saveCopy.labels.eraseButton })).toBeVisible()
  expect(await stored(page)).toBe('{not json')

  // Erasing asks first, and keeping it changes nothing.
  await page.getByRole('button', { name: saveCopy.labels.eraseButton }).click()
  await page.getByRole('alertdialog', { name: saveCopy.eraseHeading }).getByRole('button', { name: saveCopy.eraseKeep }).click()
  expect(await stored(page)).toBe('{not json')
  await page.getByRole('button', { name: saveCopy.labels.eraseButton }).click()
  await page.getByRole('alertdialog', { name: saveCopy.eraseHeading }).getByRole('button', { name: saveCopy.eraseYes }).click()
  await expect(page.getByRole('radio', { name: 'Food', exact: true })).toBeVisible() // the first-visit screen
  expect(await stored(page)).toBeNull()
})

test('a file opened over a save that cannot be read asks before the first browser save replaces it', async ({ page }) => {
  await damagedSave(page)
  const doc = emptyDoc('food', { kind: 'god', custom: '' })
  doc.resentments.push({
    id: 'e'.repeat(32), name: SENTINEL, causes: [], prayerDone: false, selfish: '', dishonest: '', selfSeeking: '', frightened: '',
  })
  await openFile(page, { name: 'mine.json', buffer: Buffer.from(JSON.stringify(doc)) })
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  expect(await stored(page)).toBe('{not json')

  await goTo(page, '#/save')
  const button = page.getByRole('button', { name: 'Save in this browser without a password' })
  await button.click()
  const ask = page.getByRole('alertdialog', { name: saveCopy.replaceDamagedHeading })
  await expect(ask).toContainText(saveCopy.replaceDamagedText)
  await page.waitForTimeout(1200)
  expect(await stored(page)).toBe('{not json')
  await ask.getByRole('button', { name: saveCopy.replaceDamagedKeep }).click()
  await expect(ask).toHaveCount(0)
  await expect(button).toBeFocused()
  expect(await stored(page)).toBe('{not json')

  // The password path asks too.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Type it again').fill(PASSWORD)
  await page.getByRole('button', { name: 'Save in this browser with a password' }).click()
  await page.getByRole('alertdialog', { name: saveCopy.replaceDamagedHeading }).getByRole('button', { name: saveCopy.replaceDamagedKeep }).click()
  expect(await stored(page)).toBe('{not json')

  await button.click()
  await page.getByRole('alertdialog', { name: saveCopy.replaceDamagedHeading }).getByRole('button', { name: saveCopy.replaceDamagedYes }).click()
  await expect(main(page)).toContainText(saveCopy.savedBrowserPlain)
  expect(await stored(page)).toContain(SENTINEL)
  // Once replaced, later saves do not ask again.
  await expect(page.getByRole('alertdialog', { name: saveCopy.replaceDamagedHeading })).toHaveCount(0)
})
