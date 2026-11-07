import { useState } from 'preact/hooks';
import { saveCopy } from '../content/copy';
import type { SaveStatus as Status } from '../core/saver';
import { useApp, type AppState } from './store';

const SAVER_TEXT: Record<Status, string> = {
  unsaved: saveCopy.status.pending,
  saving: 'Saving…',
  saved: 'Saved on this device',
  failed: "Couldn't save. Your work is still open here.",
  stale: 'Changed in another tab',
};

/** What the header says about where the work is. It never says "saved" before a save has happened. */
export function statusText(state: AppState): string {
  const { mode, saveStatus, doc, cleanDoc, hasFile } = state;
  if (saveStatus === 'failed' || saveStatus === 'stale') return SAVER_TEXT[saveStatus];
  if (mode.kind === 'none') {
    const changed = doc !== cleanDoc;
    if (!hasFile) return saveCopy.status.none;
    return changed ? saveCopy.status.changedSinceDownload : saveCopy.status.matchesFile;
  }
  if (saveStatus === 'saved' && mode.kind === 'browser-encrypted') return saveCopy.status.encrypted;
  return SAVER_TEXT[saveStatus];
}

export function SaveStatus() {
  const { state } = useApp();
  return <p class="status" role="status">{statusText(state)}</p>;
}

/** Clears the inventory from memory. Shown only when a password protects the browser save. */
export function LockButton() {
  const { state, lock } = useApp();
  const [failed, setFailed] = useState(false);
  if (state.mode.kind !== 'browser-encrypted') return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          lock().catch(() => setFailed(true));
        }}
      >
        Lock
      </button>
      {failed && <p class="notice alert wide" role="alert">{saveCopy.lockFailed}</p>}
    </>
  );
}
