import { useEffect, useState } from 'preact/hooks';
import type { Envelope } from '../core/crypto';
import type { InventoryDoc } from '../core/doc';
import { parseSaved } from '../core/fileformat';
import { Saver, type SaveMode, type SaveStatus } from '../core/saver';
import { FileError } from '../core/validate';
import { parseRoute, routeHash, type Route } from './router';

export interface AppState {
  doc: InventoryDoc | null;
  route: Route;
  saveStatus: SaveStatus;
  mode: SaveMode;
  editsSincePrompt: number;
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
  saver = new Saver(readStorage(), (saveStatus) => set({ saveStatus }));
  state = {
    doc: null,
    route: parseRoute(window.location.hash),
    saveStatus: 'unsaved',
    mode: { kind: 'none' },
    editsSincePrompt: 0,
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
        state = { ...state, doc: parsed.doc };
        // loadRaw reset the mode; writing resumes only through setMode.
        setSaveMode({ kind: 'browser-plain' }).catch(() => undefined); // the failure shows through saveStatus
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    flushDraft();
    void saver.flush().catch(() => undefined);
  });
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
  set({ doc, editsSincePrompt: state.editsSincePrompt + 1 });
  saver.edited(doc);
}

function lock(): void {
  saver.lock();
  set({ doc: null, locked: true, mode: { kind: 'none' } });
}

/** Starts an inventory in memory only. Nothing is stored until a save method is chosen. */
export function startInventory(doc: InventoryDoc): void {
  set({ doc, route: { name: 'home' } });
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
