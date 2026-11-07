import { useState } from 'preact/hooks';
import { saveCopy } from '../content/copy';
import type { SaveStatus as Status } from '../core/saver';
import { downloadBackup, hasStaleEdits, useApp, type AppState } from './store';

const SAVER_TEXT: Record<Status, string> = {
  unsaved: saveCopy.status.pending,
  saving: saveCopy.status.saving,
  saved: saveCopy.status.saved,
  failed: saveCopy.status.failed,
  stale: saveCopy.status.stale,
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

/**
 * Clears the inventory from memory. Shown only when a password protects the browser save.
 * In a stale tab with changes the save lacks, it asks first, since those changes cannot be kept.
 */
export function LockButton() {
  const { state, lock } = useApp();
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(false);
  if (state.mode.kind !== 'browser-encrypted') return null;
  const session = state.mode.session;
  const go = (discardStale: boolean) => {
    setFailed(false);
    setAsking(false);
    lock({ discardStale }).catch(() => setFailed(true));
  };
  return (
    <>
      <button type="button" onClick={() => (hasStaleEdits() ? setAsking(true) : go(false))}>{saveCopy.labels.lock}</button>
      {failed && <p class="notice alert wide" role="alert">{saveCopy.lockFailed}</p>}
      {error && <p class="notice alert wide" role="alert">{saveCopy.downloadFailed}</p>}
      {asking && (
        <div class="notice alert wide" role="group" aria-label={saveCopy.lockStaleHeading}>
          <p>{saveCopy.lockStaleText}</p>
          <p class="actions">
            <button
              type="button"
              onClick={() => {
                setError(false);
                downloadBackup(session).catch(() => setError(true));
              }}
            >
              {saveCopy.labels.downloadPassword}
            </button>
            <button type="button" class="primary" onClick={() => go(true)}>{saveCopy.lockStaleYes}</button>
            <button type="button" onClick={() => setAsking(false)}>Cancel</button>
          </p>
        </div>
      )}
    </>
  );
}
