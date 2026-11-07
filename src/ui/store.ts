import { useEffect, useState } from 'preact/hooks';
import type { Envelope, SessionKey } from '../core/crypto';
import type { InventoryDoc } from '../core/doc';
import { Saver, STORAGE_KEY, type SaveMode, type SaveStatus } from '../core/saver';
import { FileError } from '../core/validate';
import { saveCopy } from '../content/copy';
import { backupFileName, parseSaved } from '../core/fileformat';
import { downloadText } from './download';
import { parseRoute, routeHash, type Route } from './router';

export type LockedStored = 'nothing' | 'readable' | 'unreadable';

export interface AppState {
  doc: InventoryDoc | null;
  route: Route;
  saveStatus: SaveStatus;
  mode: SaveMode;
  /** Committed changes since the save prompt was last shown or dismissed (see commitEdit). */
  editsSincePrompt: number;
  /** True once the prompt has been dismissed, so it comes back after SAVE_REPROMPT_EVERY edits, not SAVE_PROMPT_AFTER. */
  promptDismissed: boolean;
  /**
   * Set once this inventory has been under a password: any browser save of it must use this session,
   * and a readable save needs the explicit remove-protection choice. Cleared with the inventory.
   */
  requiredSession: SessionKey | null;
  /** The version of the inventory that matches a copy outside this page (a file), or that has never been edited. */
  cleanDoc: InventoryDoc | null;
  /** Whether cleanDoc was downloaded or opened as a file, as opposed to never having been edited. */
  hasFile: boolean;
  locked: boolean;
  /** What browser storage held when Lock was used, unless it was a password-protected save (see pendingEnvelope). */
  lockedStored: LockedStored | null;
  /** Set when the stored save could not be read. It is left untouched, and nothing is written over it. */
  loadProblem: string | null;
  /** An encrypted save waiting for its password (the unlock screen, Task 11). */
  pendingEnvelope: Envelope | null;
  /** A message that stays until dismissed or a later save works (for example, a file opened but not saved here). */
  notice: string | null;
}

const PROBLEMS: Record<string, string> = {
  'too-large': 'The saved inventory in this browser is larger than this site can open.',
  'newer-version': 'The saved inventory in this browser was made by a newer version of this site.',
  'not-inventory': "The saved data in this browser isn't an inventory this site can read.",
  corrupt: 'The saved inventory in this browser is damaged and could not be read.',
};
const GENERIC_PROBLEM = 'The saved inventory in this browser could not be read.';

function readStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    storage.getItem('step4-inventory'); // blocked storage can throw on read, not just on access
    return storage;
  } catch {
    return null;
  }
}

let state: AppState;
/** The inventory as last written to the browser save, to tell what a stale tab would lose. */
let savedDoc: InventoryDoc | null = null;
/** The document changed since the last committed edit was counted. */
let dirty = false;
/** Commits the add-field text of the step on screen, if any. One step at a time registers it. */
let draftCommitter: (() => void) | null = null;

/** The step on screen registers how to commit what is typed but not yet added. Returns how to unregister. */
export function registerDraft(commit: () => void): () => void {
  draftCommitter = commit;
  return () => {
    if (draftCommitter === commit) draftCommitter = null;
  };
}

/** Commits any typed-but-not-added text, before the screen changes or the page is hidden. */
export function flushDraft(): void {
  draftCommitter?.();
}

let saver: Saver;
const listeners = new Set<() => void>();

function set(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function start(): void {
  saver = new Saver(readStorage(), (saveStatus) => {
    if (saveStatus === 'saved') savedDoc = state.doc;
    set({ saveStatus });
  });
  state = {
    doc: null,
    route: parseRoute(window.location.hash),
    saveStatus: 'unsaved',
    mode: { kind: 'none' },
    editsSincePrompt: 0,
    promptDismissed: false,
    requiredSession: null,
    cleanDoc: null,
    hasFile: false,
    locked: false,
    lockedStored: null,
    loadProblem: null,
    pendingEnvelope: null,
    notice: null,
  };
  const raw = saver.loadRaw();
  if (raw !== null) {
    try {
      const parsed = parseSaved(raw);
      if (parsed.kind === 'encrypted') {
        state = { ...state, pendingEnvelope: parsed.envelope, route: { name: 'unlock' } };
      } else {
        state = { ...state, doc: parsed.doc, cleanDoc: parsed.doc };
        // loadRaw reset the mode. Resuming writes nothing, so another tab on the same save stays current.
        resumeSaving({ kind: 'browser-plain' });
      }
    } catch (err) {
      const code = err instanceof FileError ? err.code : '';
      state = { ...state, loadProblem: PROBLEMS[code] ?? GENERIC_PROBLEM };
    }
  }
  window.addEventListener('hashchange', () => {
    flushDraft();
    set({ route: parseRoute(window.location.hash) });
  });
  // The draft is committed first, so the flush below writes it.
  window.addEventListener('pagehide', () => {
    flushDraft();
    void saver.flush().catch(() => undefined);
  });
  // A page with work that exists nowhere else asks before it is closed.
  window.addEventListener('beforeunload', (e) => {
    if (!hasUnsavedWork()) return;
    e.preventDefault();
    e.returnValue = ''; // some browsers need this to show the question
  });
  // Leaving a field that was changed is a committed change.
  document.addEventListener('focusout', () => {
    if (dirty) commitEdit();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    flushDraft();
    void saver.flush().catch(() => undefined);
  });
}

/** Starts autosaving to the save that was just read, without rewriting it. A stale save stays unwritten and says so. */
function resumeSaving(mode: SaveMode): void {
  try {
    saver.resume(mode);
    state = { ...state, mode, requiredSession: mode.kind === 'browser-encrypted' ? mode.session : state.requiredSession };
  } catch {
    // Stale: the status already says so, and only an explicit replace can write. The password is
    // kept so that Lock, a protected download and a protected replace remain possible.
    if (mode.kind === 'browser-encrypted') state = { ...state, requiredSession: mode.session };
  }
}

/**
 * Chooses how the inventory is kept. `overwriteStale` is for an explicit user action only:
 * it replaces a newer save from another tab.
 */
export async function setSaveMode(
  mode: SaveMode,
  options?: { overwriteStale?: boolean; removeProtection?: boolean },
): Promise<void> {
  if (!state.doc) throw new Error('There is no inventory to save');
  if (mode.kind === 'browser-plain' && state.requiredSession && !options?.removeProtection) {
    throw new Error('This inventory was under a password; saving it as readable text needs an explicit choice');
  }
  // Checked now, not when the choice was offered: another tab may have set a password since.
  if (mode.kind === 'browser-plain' && options?.overwriteStale && !storedSaveIsReplaceableByReadable()) throw new ReplaceRefused();
  await saver.setMode(mode, state.doc, { overwriteStale: options?.overwriteStale });
  set({
    notice: null,
    mode,
    requiredSession: mode.kind === 'browser-encrypted' ? mode.session : mode.kind === 'browser-plain' ? null : state.requiredSession,
  });
}

function go(route: Route): void {
  flushDraft();
  const hash = routeHash(route);
  if (window.location.hash === hash) set({ route });
  else window.location.hash = hash; // hashchange updates the state
}

function update(fn: (d: InventoryDoc) => InventoryDoc): void {
  if (!state.doc) return;
  const doc = fn(state.doc);
  dirty = true; // update runs on every keystroke, so it never counts edits itself
  set({ doc });
  saver.edited(doc);
}

/**
 * Counts one committed change: an entry or cause added, a step left, or a changed field left.
 * Never called per keystroke.
 */
export function commitEdit(): void {
  dirty = false;
  if (!state.doc) return;
  set({ editsSincePrompt: state.editsSincePrompt + 1 });
}

export function dismissNotice(): void {
  set({ notice: null });
}

export function dismissPrompt(): void {
  set({ editsSincePrompt: 0, promptDismissed: true });
}

/**
 * Whether the save now in browser storage is empty or a readable inventory this site understands. Anything
 * else (password-protected, from a newer version, damaged) is not ours to replace with readable text.
 */
export function storedSaveIsReplaceableByReadable(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null || parseSaved(raw).kind === 'plain';
  } catch {
    return false; // fail closed
  }
}

/** A readable write over another tab's newer save was refused at the last moment. */
export class ReplaceRefused extends Error {
  constructor() {
    super('The newer save is not a readable inventory this page may replace');
    this.name = 'ReplaceRefused';
  }
}

/** Whether another tab's newer save is unseen. Unlike the status, a failed attempt does not hide it. */
export function isStale(): boolean {
  return saver.isStale;
}

export function currentState(): AppState {
  return state;
}

/** Work that exists only on this page: nothing saved, nothing downloaded since the last change. */
function hasUnsavedWork(): boolean {
  const { doc, mode, saveStatus, cleanDoc } = state;
  if (!doc) return false;
  if (mode.kind === 'none') return doc !== cleanDoc;
  // A stale tab never writes, so anything changed here since the last save is lost on leaving.
  if (saver.isStale) return doc !== savedDoc;
  return saveStatus === 'unsaved' || saveStatus === 'saving' || saveStatus === 'failed';
}

/** Downloads the inventory as a file, under `session` if given, and returns the file name. */
export async function downloadBackup(session?: SessionKey): Promise<string> {
  const doc = state.doc;
  if (!doc) throw new Error('There is no inventory to download');
  const text = await saver.fileContents(doc, session);
  const name = backupFileName(new Date());
  downloadText(name, text);
  markDownloaded(doc);
  return name;
}

/** A downloaded file now matches this version of the inventory. */
export function markDownloaded(doc: InventoryDoc): void {
  set({ cleanDoc: doc, hasFile: true });
}

/** Lock is offered whenever a password is held for the inventory in memory: saved under it, or opened from it. */
export function canLock(): boolean {
  const { doc, mode, requiredSession } = state;
  return doc !== null && (mode.kind === 'browser-encrypted' || requiredSession !== null);
}

/**
 * What is in browser storage right now, for the locked screen. A read that fails says nothing about what is
 * there, so it counts as unreadable, never as nothing stored. Never throws.
 */
function readStoredForLock(): { lockedStored: LockedStored | null; pendingEnvelope: Envelope | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { lockedStored: 'nothing', pendingEnvelope: null };
    const parsed = parseSaved(raw);
    return parsed.kind === 'encrypted'
      ? { lockedStored: null, pendingEnvelope: parsed.envelope }
      : { lockedStored: 'readable', pendingEnvelope: null };
  } catch {
    return { lockedStored: 'unreadable', pendingEnvelope: null };
  }
}

/**
 * Clears the inventory and the key from memory. Returns 'confirm', clearing nothing, when this browser does
 * not hold the latest changes under the password (saving failed, another tab got there first, or nothing is
 * being saved); the caller asks, and calls again with `discard` to lock anyway.
 */
async function lock(options?: { discard?: boolean }): Promise<'locked' | 'confirm'> {
  if (!state.doc || !canLock()) throw new Error('Lock needs a password to protect the inventory');
  flushDraft(); // text typed but not yet added counts as part of the inventory on every path
  if (state.mode.kind === 'browser-encrypted' && !saver.isStale) await saver.flush();
  const held = state.doc === savedDoc && (state.mode.kind !== 'none' || saver.isStale);
  if (!held && !options?.discard) return 'confirm';
  saver.lock();
  savedDoc = null; // nothing readable is kept once the screen is cleared
  saver.loadRaw(); // what is stored is the saver's new baseline, and is left as it is
  dirty = false;
  set({
    doc: null, locked: true, ...readStoredForLock(), mode: { kind: 'none' }, cleanDoc: null, hasFile: false, requiredSession: null,
    editsSincePrompt: 0, promptDismissed: false, route: { name: 'unlock' }, saveStatus: 'unsaved', notice: null,
  });
  return 'locked';
}

/** Opens the inventory an unlocked save held, and keeps saving it under the same password. */
export function unlockWith(doc: InventoryDoc, session: SessionKey): void {
  const wanted = parseRoute(window.location.hash);
  const route: Route = wanted.name === 'unlock' ? { name: 'home' } : wanted;
  dirty = false;
  savedDoc = doc;
  set({ doc, pendingEnvelope: null, locked: false, lockedStored: null, cleanDoc: doc, hasFile: false, editsSincePrompt: 0, promptDismissed: false, route });
  if (wanted.name === 'unlock') go(route);
  // The save was just read; resuming leaves its bytes untouched, and a stale one stays unwritten.
  resumeSaving({ kind: 'browser-encrypted', session });
  set({ mode: state.mode });
}

/**
 * Replaces what is open with an inventory read from a file. A browser save already in use
 * keeps saving, now holding the opened inventory; otherwise the file is the only copy.
 */
export async function openDocument(doc: InventoryDoc, fileSession?: SessionKey): Promise<void> {
  const previous = state.mode;
  // A readable browser save never receives a password file's contents: the stronger protection wins.
  const target: SaveMode = previous.kind === 'browser-plain' && fileSession
    ? { kind: 'browser-encrypted', session: fileSession }
    : previous;
  // Saving stops before the new inventory is swapped in, and resumes only through a write that works.
  // If that write fails or is refused, nothing is being saved here and the old browser save is untouched.
  if (previous.kind !== 'none') saver.lock();
  dirty = false;
  set({
    doc, pendingEnvelope: null, locked: false, lockedStored: null, loadProblem: null, mode: { kind: 'none' }, saveStatus: 'unsaved', notice: null,
    requiredSession: fileSession ?? null, cleanDoc: doc, hasFile: true, editsSincePrompt: 0, promptDismissed: false,
  });
  go({ name: 'home' });
  if (target.kind === 'none') return;
  try {
    await setSaveMode(target);
  } catch {
    // The file is open but nothing is being saved here; this stays on screen until dismissed.
    set({ notice: saveCopy.openedNotSaved });
  }
}

/**
 * Deletes the browser save. Returns false, changing nothing on screen, when it is still there.
 * With `keepOpen` the inventory stays on this page, unsaved; otherwise the page starts over.
 */
export function eraseBrowserData(keepOpen: boolean): boolean {
  saver.eraseAll();
  const stillThere = saver.loadRaw() !== null;
  // The saver stopped saving either way, so the screen must say so.
  set({ mode: { kind: 'none' }, saveStatus: 'unsaved' });
  if (stillThere) return false;
  // With no file copy, the deleted save was the only one: leaving must warn.
  if (keepOpen && !state.hasFile) set({ cleanDoc: null });
  if (!keepOpen) {
    dirty = false;
    savedDoc = null;
    set({
      doc: null, pendingEnvelope: null, locked: false, lockedStored: null, loadProblem: null, cleanDoc: null, hasFile: false, requiredSession: null,
      editsSincePrompt: 0, promptDismissed: false, notice: null,
    });
    go({ name: 'welcome' });
  }
  return true;
}

/** Starts an inventory in memory only. Nothing is stored until a save method is chosen. */
export function startInventory(doc: InventoryDoc): void {
  dirty = false;
  set({ doc, cleanDoc: doc, hasFile: false, route: { name: 'home' } });
  go({ name: 'home' });
}

export function useApp(): { state: AppState; update: typeof update; go: typeof go; saver: Saver; lock: typeof lock; setSaveMode: typeof setSaveMode } {
  if (!state) start();
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    l(); // the state may have changed between the first render and now
    return () => void listeners.delete(l);
  }, []);
  return { state, update, go, saver, lock, setSaveMode };
}
