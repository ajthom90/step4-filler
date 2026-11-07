/** Shared site copy. The owner reviews these in docs/content-review.md. */

export const DISCLAIMER = 'Not affiliated with Alcoholics Anonymous, Overeaters Anonymous, or any 12-step program.';
export const PASSWORD_WARNING = "If you forget it, your inventory can't be recovered. No one can reset it.";
export const PLAIN_WARNING = 'Saved as readable text. Anyone using this device, or with the file, can read it.';

export const PRIVACY_STATEMENT =
  "Your inventory never leaves your browser. This site has no accounts, no analytics, and no database, and it never receives what you write. " +
  "Like any website, it's delivered by a hosting provider (Cloudflare), which handles your IP address to deliver the page. " +
  "We don't collect that information or use it. For the most privacy on a computer, you can download the offline version.";

/** What the site cannot protect against, for the privacy page. Drafted from the design spec. */
export const PRIVACY_LIMITS =
  "This site can't protect you from browser extensions that can read pages, from a device that someone else can open, " +
  'or from downloaded or printed copies that end up in cloud backups or your Downloads folder.';

export const NOT_A_SUBSTITUTE = 'This site does not replace a sponsor or professional help.';

export const SUPPORT_HEADING = 'Need support now?';
export const SUPPORT_TEXT =
  'If things feel like too much, reach out to your sponsor or someone you trust. ' +
  'In the US, you can call or text 988, the Suicide & Crisis Lifeline, at any hour. ' +
  'Elsewhere, please use your local emergency or crisis services.';

/** Wording for saving, opening, locking and erasing. The owner reviews it in docs/content-review.md (section 5c). */
export const saveCopy = {
  title: 'Save your progress',
  intro: 'Nothing is ever sent to a server.',
  rightNow: {
    none: 'Right now: not saved in this browser. Your work is only on this page.',
    plain: 'Right now: saved in this browser as readable text.',
    encrypted: 'Right now: saved in this browser with a password.',
    unavailable: "This browser isn't letting the site store anything, so saving in this browser isn't available. You can still download a file.",
  },
  passwordHeading: 'With a password (safer)',
  passwordHint: 'At least 8 characters. A short sentence you will remember works well.',
  plainHeading: 'Without a password',
  backupHeading: 'Keep a backup file',
  backup:
    'Browsers can clear saved site data. Safari can delete it after about a week without a visit, and other browsers can do the same when storage runs low. ' +
    'A downloaded file is the safest backup. Open it on this site later, on any device, to carry on where you left off.',
  openNote: 'Open a downloaded file here later to continue where you left off.',
  tooShort: 'Use at least 8 characters.',
  mismatch: "The two passwords don't match.",
  working: 'Working…',
  labels: {
    saveBrowserPassword: 'Save in this browser with a password',
    saveBrowserPlain: 'Save in this browser without a password',
    downloadPassword: 'Download a file with a password',
    downloadPlain: 'Download a file without a password',
    password: 'Password',
    typeAgain: 'Type it again',
    newPassword: 'New password',
    typeNewAgain: 'Type the new password again',
    filePassword: 'Password for this file',
    openFile: 'Open a saved file',
    openFileButton: 'Open file',
    unlock: 'Unlock',
    lock: 'Lock',
    eraseButton: 'Erase everything',
    settingsSaveLink: 'Choose how this inventory is saved',
  },
  savedBrowserPlain: 'Saved in this browser as readable text. Changes you make from now on save here by themselves.',
  savedBrowserEncrypted:
    'Saved in this browser with your password. Changes you make from now on save here by themselves. You will need the password each time you open the site.',
  downloaded: (name: string) =>
    `Downloaded as ${name}. Your browser decides where it goes, so check your Downloads folder. Keep it somewhere you trust.`,
  saveFailed:
    "Couldn't save in this browser. Its storage may be full or turned off. Nothing was changed, and your work is still open on this page. Downloading a file may still work.",
  tooLarge:
    "Your inventory is bigger than this site can save or open again (5 MB). It can't be saved in this browser, and it can't be downloaded either. Shorten the longest entries, then try again.",
  downloadFailed: "Couldn't make the file. Your work is still open on this page.",
  stale:
    'Another tab changed the save in this browser. Reload this page to see the newer version. ' +
    'Anything you changed on this page since will be lost, so download a file first if you want to keep it.',
  staleNoReplace:
    'The newer save in this browser is protected with a password, and this page would save readable text, so replacing it is not offered. Reload to see it, or download a file to keep what is open here.',
  staleBanner:
    'Another tab saved a newer version of this inventory. Reload this page to see it. This page will not overwrite it. ' +
    'Changes made on this page since then are not saved.',
  staleReload: 'Reload this page',
  staleReplace: 'Replace the other tab’s save with what is open here',
  staleReplaceHeading: 'Replace the newer save?',
  staleReplaceWarning: 'This permanently overwrites what the other tab saved. Only do it if what is open here is the version you want.',
  staleReplaceYes: 'Yes, replace it',
  staleReplaceYesChoose: 'Yes, let me choose a new save',
  staleReplaceChooseWarning:
    'Your next save will permanently overwrite what the other tab saved. This only lasts for one save; if it fails, you will be asked again.',
  changeHeading: 'Change your password',
  changeButton: 'Change password',
  passwordChanged:
    'Password changed. The old password no longer opens the copy saved in this browser. Files you downloaded earlier still need the password they were made with.',
  removeHeading: 'Remove the password',
  removeButton: 'Remove the password',
  removeYes: 'Remove the password and save as readable text',
  removeKeep: 'Keep the password',
  passwordRemoved: 'The password is removed. The copy saved in this browser is now readable text.',
  encryptedFileNote: 'The file uses the same password as your browser save.',
  stopHeading: 'Stop saving in this browser',
  stopText: 'This deletes the copy saved in this browser. Your work stays open on this page, and you can still download a file.',
  stopYes: 'Yes, delete the saved copy',
  stopKeep: 'Keep saving',
  stopped: 'The saved copy in this browser is deleted. Your work is still open on this page, but it is not saved anywhere.',
  stopFailed: "Couldn't delete the saved copy. Close other tabs of this site and try again.",
  promptHeading: 'Save your work',
  promptText:
    'Your work is only on this page right now. Closing it, or switching apps on a phone, can lose it.',
  promptChoose: 'Choose how to save',
  promptLater: 'Not now',
  unlockTitle: 'Unlock your inventory',
  unlockText: 'Your inventory is locked. Enter your password to open it.',
  unlockWrong: "That password didn't open it. Check it and try again. The saved copy has not been changed.",
  unlockProblem: 'The saved copy could not be read. It has not been changed.',
  forgotHeading: 'Forgot your password?',
  forgotText:
    "No one can reset it, and the saved copy can't be read without it. If you have a downloaded file, you can open that instead. Otherwise you can erase the saved copy and start over.",
  lockStaleHeading: 'Lock and lose your latest changes?',
  lockStaleText:
    "The latest changes on this page aren't saved in this browser under your password (saving failed, another tab saved a newer version, or nothing is being saved here), so they will be lost if you lock. Download a file first if you want to keep them.",
  lockedNothingSaved:
    'Locked. Nothing from your inventory is kept on this page now, and nothing is saved in this browser. To carry on, open a downloaded file.',
  lockedReadableCopy:
    'Locked. Nothing from your inventory is kept on this page now. The copy saved in this browser has not been changed. Reload this page to open it, or open a downloaded file.',
  lockedUnreadableCopy:
    "Locked. Nothing from your inventory is kept on this page now. What is saved in this browser can't be read here, and it has not been changed. To carry on, open a downloaded file.",
  lockStaleYes: 'Lock and discard those changes',
  lockFailed:
    "Couldn't lock, because the latest changes couldn't be saved. Nothing was cleared. Download a file to keep your work, then try again.",
  lockUnavailable: 'Lock is only available when the inventory is saved in this browser with a password.',
  openHeading: 'Open a saved file',
  openNote2: 'The file is checked on this device. Nothing is uploaded.',
  filePasswordText: 'This file is protected with a password.',
  fileErrors: {
    'too-large': 'This file is larger than 5 MB, which is more than this site can open. Nothing was changed.',
    'not-inventory': "This isn't an inventory file from this site. Nothing was changed.",
    'newer-version': 'This file was made by a newer version of this site. Nothing was changed. Try again on the newest version.',
    corrupt: 'This file looks damaged or incomplete, so it was not opened. Nothing was changed.',
    'wrong-password': "That password didn't open the file, or the file has been changed. Nothing was changed.",
  },
  fileErrorOther: 'This file could not be opened. Nothing was changed.',
  replaceHeading: 'Replace what is open here?',
  replaceMemory:
    'Opening this file replaces your current inventory. It has not been saved in this browser. Download a file first if you want to keep it.',
  replaceBrowser:
    'Opening this file replaces your current inventory and the copy saved in this browser. Download a file first if you want to keep it.',
  replaceLocked:
    'The password-protected copy saved in this browser stays as it is until you choose how to save the opened inventory. Choosing replaces it.',
  replaceBrowserEncrypted:
    "Opening this file replaces your current inventory and the copy saved in this browser. The browser copy will then be protected with this file's password, not saved as readable text. Download a file first if you want to keep your current work.",
  replaceYes: 'Replace and open',
  openedNotSaved:
    "The file is open, but it wasn't saved in this browser. The file is still your copy, and the copy saved in this browser is unchanged. Nothing is saved here until you choose how.",
  eraseHeading: 'Erase everything',
  eraseText:
    "This deletes your inventory from this browser and closes it on this page. It can't delete files you have already downloaded or printed, or copies in your device's backups. " +
    'Download a file first if you want to keep your work.',
  eraseYes: 'Yes, erase everything',
  eraseKeep: 'Keep my inventory',
  eraseFailed: "Couldn't delete the saved copy. Close other tabs of this site and try again, or clear this site's data in your browser's settings.",
  status: {
    none: 'Not saved. Your work is only on this page.',
    matchesFile: 'Matches your file. No changes since.',
    changedSinceDownload: 'Unsaved changes since your file',
    pending: 'Changes not saved yet',
    saving: 'Saving…',
    saved: 'Saved on this device',
    failed: "Couldn't save. Your work is still open here.",
    stale: 'Changed in another tab',
    encrypted: 'Saved on this device, with a password',
  },
};
