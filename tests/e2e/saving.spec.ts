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
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
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
  const ask = page.getByRole('group', { name: saveCopy.replaceHeading })
  await expect(ask).toBeVisible()
  await expect(ask).toContainText(saveCopy.replaceMemory)
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(ask).toHaveCount(0)
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
  await expect(page.getByRole('list', { name: 'Your list' })).not.toContainText('Incoming-Name')

  await goTo(page, '#/home')
  await openFile(page, { name: 'incoming.json', buffer: Buffer.from(JSON.stringify(incoming)) })
  await page.getByRole('group', { name: saveCopy.replaceHeading }).getByRole('button', { name: 'Replace and open' }).click()
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
    await expect(page.getByRole('group', { name: saveCopy.replaceHeading })).toHaveCount(0)
  }
  await openFile(page, { name: 'tampered.json', buffer: Buffer.from(JSON.stringify(tampered)) })
  await page.getByLabel('Password for this file').fill(goodPassword)
  await page.getByRole('button', { name: 'Open file' }).click()
  await expect(page.getByRole('alert')).toContainText(saveCopy.fileErrors['wrong-password'])
  await expect(page.getByRole('group', { name: saveCopy.replaceHeading })).toHaveCount(0)

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

test('Lock does not lock when the latest changes cannot be saved', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await goTo(page, LIST)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  })
  await addName(page, 'Unsaved-Name')
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(saveCopy.lockFailed)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('Unsaved-Name')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(saveCopy.unlockTitle)
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
  await expect(page.getByRole('heading', { name: 'Your inventory' })).toBeVisible()
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText(SENTINEL)
})

test('remove password shows the plain warning first', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'password')
  await goTo(page, '#/save')
  await expect(main(page)).not.toContainText(PLAIN_WARNING)
  await page.getByRole('button', { name: 'Remove the password' }).click()
  const ask = page.getByRole('group', { name: saveCopy.removeHeading })
  await expect(ask).toContainText(PLAIN_WARNING)
  expect(await stored(page)).not.toContain(SENTINEL)
  await ask.getByRole('button', { name: 'Keep the password' }).click()
  expect(await stored(page)).not.toContain(SENTINEL)
  await page.getByRole('button', { name: 'Remove the password' }).click()
  await page.getByRole('group', { name: saveCopy.removeHeading }).getByRole('button', { name: 'Remove the password and save as readable text' }).click()
  await expect(main(page)).toContainText(saveCopy.passwordRemoved)
  expect(await stored(page)).toContain(SENTINEL)
  await expect(status(page)).toHaveText('Saved on this device')
})

test('stopping browser saving deletes the saved copy and says so', async ({ page }) => {
  await beginWithSentinel(page)
  await saveInBrowser(page, 'plain')
  await page.getByRole('button', { name: 'Stop saving in this browser' }).click()
  await page.getByRole('group', { name: saveCopy.stopHeading }).getByRole('button', { name: 'Yes, delete the saved copy' }).click()
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
  const ask = page.getByRole('group', { name: saveCopy.eraseHeading })
  await expect(ask).toContainText("can't delete files you have already downloaded or printed")
  expect(await stored(page)).toContain(SENTINEL)
  await ask.getByRole('button', { name: 'Keep my inventory' }).click()
  expect(await stored(page)).toContain(SENTINEL)
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click()
  await page.getByRole('group', { name: saveCopy.eraseHeading }).getByRole('button', { name: 'Yes, erase everything' }).click()
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
  await page.getByRole('group', { name: saveCopy.eraseHeading }).getByRole('button', { name: 'Yes, erase everything' }).click()
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
  await expect(main(page).getByRole('group', { name: saveCopy.staleReplaceHeading })).toContainText(saveCopy.staleReplaceWarning)
  expect(await stored(page)).not.toContain('From-First-Tab')
  await main(page).getByRole('button', { name: 'Cancel' }).click()
  await main(page).getByRole('button', { name: 'Reload this page' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(saveCopy.title)
  await expect(page.locator('.notice.alert')).toHaveCount(0) // the newer save is what is open now
  await goTo(page, LIST)
  await expect(page.getByRole('list', { name: 'Your list' })).toContainText('From-Second-Tab')
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
  await page.getByRole('group', { name: saveCopy.stopHeading }).getByRole('button', { name: 'Yes, delete the saved copy' }).click()
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
  await main(page).getByRole('group', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYes }).click()
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

  // The first attempt after confirming fails; a second attempt must need a new confirmation.
  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('group', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYesChoose }).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    let failed = false
    Storage.prototype.setItem = function (k: string, v: string) {
      if (!failed) { failed = true; throw new DOMException('full', 'QuotaExceededError') }
      return original.call(this, k, v)
    }
  })
  await page.getByRole('button', { name: 'Save in this browser without a password' }).click()
  await expect(main(page).getByRole('alert')).toBeVisible()
  expect(await stored(page)).toBe(theirs)
  await expect(main(page).getByRole('button', { name: 'Save in this browser without a password' })).toHaveCount(0)
  expect(await stored(page)).toBe(theirs)

  await main(page).getByRole('button', { name: saveCopy.staleReplace }).click()
  await main(page).getByRole('group', { name: saveCopy.staleReplaceHeading }).getByRole('button', { name: saveCopy.staleReplaceYesChoose }).click()
  await page.getByRole('button', { name: 'Save in this browser without a password' }).click()
  await expect(main(page)).toContainText(saveCopy.savedBrowserPlain)
  expect(await stored(page)).toContain(SENTINEL)
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
  const ask = page.getByRole('group', { name: saveCopy.replaceHeading })
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
