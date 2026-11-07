import { useEffect, useState } from 'preact/hooks';
import type { Envelope, SessionKey } from '../core/crypto';
import type { InventoryDoc } from '../core/doc';
import { Saver, type SaveMode, type SaveStatus } from '../core/saver';
import { FileError } from '../core/validate';
import { backupFileName, parseSaved } from '../core/fileformat';
import { downloadText } from './download';
import { parseRoute, routeHash, type Route } from './router';

export interface AppState {
  doc: InventoryDoc | null;
  route: Route;
  saveStatus: SaveStatus;
  mode: SaveMode;
  /** Committed changes since the save prompt was last shown or dismissed (see commitEdit). */
  editsSincePrompt: number;
  /** True once the prompt has been dismissed, so it comes back after SAVE_REPROMPT_EVERY edits, not SAVE_PROMPT_AFTER. */
  promptDismissed: boolean;
  /** The version of the inventory that matches a copy outside this page (a file), or that has never been edited. */
  cleanDoc: InventoryDoc | null;
  /** Whether cleanDoc was downloaded or opened as a file, as opposed to never having been edited. */
  hasFile: boolean;
  locked: boolean;
  /** Set when the stored save could not be read. It is left untouched, and nothing is written over it. */
  loadProblem: string | null;
  /** An encrypted save waiting for its password (the unlock screen, Task 11). */
  pendingEnvelope: Envelope | null;
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
    cleanDoc: null,
    hasFile: false,
    locked: false,
    loadProblem: null,
    pendingEnvelope: null,
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
    state = { ...state, mode };
  } catch {
    // Stale: the status already says so, and only an explicit replace can write.
  }
}

/**
 * Chooses how the inventory is kept. `overwriteStale` is for an explicit user action only:
 * it replaces a newer save from another tab.
 */
export async function setSaveMode(mode: SaveMode, options?: { overwriteStale?: boolean }): Promise<void> {
  if (!state.doc) throw new Error('There is no inventory to save');
  await saver.setMode(mode, state.doc, options);
  set({ mode });
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

export function dismissPrompt(): void {
  set({ editsSincePrompt: 0, promptDismissed: true });
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
  if (saveStatus === 'stale') return doc !== savedDoc;
  return saveStatus === 'unsaved' || saveStatus === 'saving' || saveStatus === 'failed';
}

/** In a stale tab, whether this page holds changes that the save does not. */
export function hasStaleEdits(): boolean {
  return state.saveStatus === 'stale' && state.doc !== savedDoc;
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

/**
 * Clears the inventory and the key from memory. The latest changes are written first, and if
 * they cannot be, nothing is cleared and this rejects, so typed text is never dropped silently.
 */
async function lock(options?: { discardStale?: boolean }): Promise<void> {
  if (state.mode.kind !== 'browser-encrypted' || !state.doc) throw new Error('Lock needs a password-protected browser save');
  if (state.saveStatus === 'stale') {
    // Nothing can be written from a stale tab, so the caller must have said the changes may go.
    if (hasStaleEdits() && !options?.discardStale) throw new Error('Changes on this page are not in the save');
  } else {
    flushDraft();
    await saver.flush();
    if (state.saveStatus !== 'saved') throw new Error('The latest changes are not saved');
  }
  saver.lock();
  let pendingEnvelope: Envelope | null = null;
  try {
    const parsed = parseSaved(saver.loadRaw() ?? '');
    if (parsed.kind === 'encrypted') pendingEnvelope = parsed.envelope;
  } catch {
    // The copy is safe in storage; the unlock screen says it could not be read.
  }
  dirty = false;
  set({
    doc: null, locked: true, mode: { kind: 'none' }, pendingEnvelope, cleanDoc: null, hasFile: false,
    editsSincePrompt: 0, promptDismissed: false, route: { name: 'unlock' }, saveStatus: 'unsaved',
  });
}

/** Opens the inventory an unlocked save held, and keeps saving it under the same password. */
export function unlockWith(doc: InventoryDoc, session: SessionKey): void {
  const wanted = parseRoute(window.location.hash);
  const route: Route = wanted.name === 'unlock' ? { name: 'home' } : wanted;
  dirty = false;
  savedDoc = doc;
  set({ doc, pendingEnvelope: null, locked: false, cleanDoc: doc, hasFile: false, editsSincePrompt: 0, promptDismissed: false, route });
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
  dirty = false;
  set({
    doc, pendingEnvelope: null, locked: false, loadProblem: null,
    cleanDoc: doc, hasFile: true, editsSincePrompt: 0, promptDismissed: false,
  });
  go({ name: 'home' });
  if (previous.kind === 'none') return;
  // A readable browser save never receives a password file's contents: the stronger protection wins.
  if (previous.kind === 'browser-plain' && fileSession) await setSaveMode({ kind: 'browser-encrypted', session: fileSession });
  else await setSaveMode(previous);
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
    set({
      doc: null, pendingEnvelope: null, locked: false, loadProblem: null, cleanDoc: null, hasFile: false,
      editsSincePrompt: 0, promptDismissed: false,
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
