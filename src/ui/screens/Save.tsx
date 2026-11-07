import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { PASSWORD_WARNING, PLAIN_WARNING, saveCopy } from '../../content/copy';
import { createKey, decrypt, type Envelope, type SessionKey } from '../../core/crypto';
import type { InventoryDoc } from '../../core/doc';
import { backupFileName, MAX_FILE_BYTES, parseSaved } from '../../core/fileformat';
import { FileError } from '../../core/validate';
import { downloadText } from '../download';
import { currentState, eraseBrowserData, markDownloaded, openDocument, useApp } from '../store';

const MIN_PASSWORD = 8;

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** Why a save or download did not happen, in words for the person. */
function failureText(err: unknown): string {
  if (err instanceof FileError && err.code === 'too-large') return saveCopy.tooLarge;
  if (currentState().saveStatus === 'stale') return saveCopy.stale;
  return saveCopy.saveFailed;
}

function passwordProblem(password: string, again: string): string | null {
  if (password.length < MIN_PASSWORD) return saveCopy.tooShort;
  if (password !== again) return saveCopy.mismatch;
  return null;
}

/** Two password fields. A password manager is asked for a new password, not an existing one. */
function PasswordFields({ label, againLabel, password, again, onPassword, onAgain, hint }: {
  label: string; againLabel: string; password: string; again: string;
  onPassword: (v: string) => void; onAgain: (v: string) => void; hint?: string;
}) {
  return (
    <>
      <label class="field">
        <span>{label}</span>
        <input type="password" value={password} autocomplete="new-password" onInput={(e) => onPassword((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {hint && <p class="note">{hint}</p>}
      <label class="field">
        <span>{againLabel}</span>
        <input type="password" value={again} autocomplete="new-password" onInput={(e) => onAgain((e.currentTarget as HTMLInputElement).value)} />
      </label>
    </>
  );
}

/** A question with two answers, announced as a group so it is not missed. */
function Confirm({ title, children, yes, no, onYes, onNo }: {
  title: string; children: ComponentChildren; yes: string; no: string; onYes: () => void; onNo: () => void;
}) {
  return (
    <div class="notice" role="group" aria-label={title}>
      <p>{children}</p>
      <p class="actions">
        <button type="button" class="primary" onClick={onYes}>{yes}</button>
        <button type="button" onClick={onNo}>{no}</button>
      </p>
    </div>
  );
}

/** Deletes the browser save, and with it the inventory on this page. Used where the inventory is not open too. */
export function EraseEverything() {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <section>
      <h2>{saveCopy.eraseHeading}</h2>
      {failed && <p class="notice alert" role="alert">{saveCopy.eraseFailed}</p>}
      {asking ? (
        <Confirm
          title={saveCopy.eraseHeading}
          yes={saveCopy.eraseYes}
          no={saveCopy.eraseKeep}
          onYes={() => {
            if (!eraseBrowserData(false)) {
              setFailed(true);
              setAsking(false);
            }
          }}
          onNo={() => setAsking(false)}
        >
          {saveCopy.eraseText}
        </Confirm>
      ) : (
        <button type="button" onClick={() => { setFailed(false); setAsking(true); }}>Erase everything</button>
      )}
    </section>
  );
}

type Opened = { doc: InventoryDoc };
type Step = { name: 'idle' } | { name: 'password'; envelope: Envelope } | { name: 'confirm'; opened: Opened };

function openErrorText(err: unknown): string {
  return err instanceof FileError ? saveCopy.fileErrors[err.code] : saveCopy.fileErrorOther;
}

/**
 * Opens a downloaded file. Every file is untrusted: its size is checked before it is read,
 * it is validated before anything else happens, and what is open here is replaced only after
 * an explicit yes. Any failure leaves the current inventory untouched.
 */
export function OpenFile() {
  const { state } = useApp();
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const existing = state.doc !== null || state.pendingEnvelope !== null;
  const finish = async (doc: InventoryDoc) => {
    if (!existing) return apply(doc);
    setStep({ name: 'confirm', opened: { doc } });
  };
  const apply = async (doc: InventoryDoc) => {
    setStep({ name: 'idle' });
    setPassword('');
    try {
      await openDocument(doc);
    } catch {
      // The file is open; only keeping it saved in this browser failed, and the header says so.
      setError(saveCopy.openedNotSaved);
    }
  };

  const onFile = async (file: File | undefined) => {
    setError(null);
    setStep({ name: 'idle' });
    setPassword('');
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new FileError('too-large');
      const parsed = parseSaved(await file.text());
      if (parsed.kind === 'plain') await finish(parsed.doc);
      else setStep({ name: 'password', envelope: parsed.envelope });
    } catch (err) {
      setError(openErrorText(err));
    }
  };

  const unlockFile = async (envelope: Envelope) => {
    setError(null);
    setBusy(true);
    try {
      const { doc } = await decrypt(envelope, password);
      await finish(doc);
    } catch (err) {
      setError(openErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const replaceText = state.pendingEnvelope
    ? saveCopy.replaceLocked
    : state.mode.kind === 'none' ? saveCopy.replaceMemory : saveCopy.replaceBrowser;

  return (
    <section>
      <h2>{saveCopy.openHeading}</h2>
      <p class="note">{saveCopy.openNote2}</p>
      <label class="field">
        <span>Open a saved file</span>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const el = e.currentTarget as HTMLInputElement;
            const file = el.files?.[0];
            el.value = ''; // choosing the same file again must still fire
            void onFile(file);
          }}
        />
      </label>
      {error && <p class="notice alert" role="alert">{error}</p>}
      {step.name === 'password' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlockFile(step.envelope);
          }}
        >
          <p>{saveCopy.filePasswordText}</p>
          <label class="field">
            <span>Password for this file</span>
            <input type="password" value={password} autocomplete="current-password" onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <p>
            <button type="submit" class="primary" disabled={busy}>{busy ? saveCopy.working : 'Open file'}</button>
          </p>
        </form>
      )}
      {step.name === 'confirm' && (
        <Confirm
          title={saveCopy.replaceHeading}
          yes={saveCopy.replaceYes}
          no="Cancel"
          onYes={() => void apply(step.opened.doc)}
          onNo={() => setStep({ name: 'idle' })}
        >
          {replaceText}
        </Confirm>
      )}
    </section>
  );
}

export function Save() {
  const { state, saver, setSaveMode } = useApp();
  const doc = state.doc!;
  const mode = state.mode;
  const encrypted = mode.kind === 'browser-encrypted';
  const stale = state.saveStatus === 'stale';

  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAgain, setNewAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [asking, setAsking] = useState<'remove' | 'stop' | 'replace' | null>(null);
  // Set only by the explicit "replace the other tab's save" step.
  const [overwrite, setOverwrite] = useState(false);

  const run = async (task: () => Promise<string>) => {
    setMessage(null);
    setBusy(true);
    try {
      setMessage({ kind: 'ok', text: await task() });
    } catch (err) {
      setMessage({ kind: 'error', text: failureText(err) });
    } finally {
      setBusy(false);
    }
  };
  const refuse = (text: string) => setMessage({ kind: 'error', text });

  const saveInBrowser = (withPassword: boolean) => {
    if (withPassword) {
      const problem = passwordProblem(password, again);
      if (problem) return refuse(problem);
    }
    const first = mode.kind === 'none';
    void run(async () => {
      const next = withPassword
        ? { kind: 'browser-encrypted' as const, session: await createKey(password) }
        : { kind: 'browser-plain' as const };
      await setSaveMode(next, { overwriteStale: overwrite });
      if (first) void saver.requestPersistence();
      setPassword('');
      setAgain('');
      return withPassword ? saveCopy.savedBrowserEncrypted : saveCopy.savedBrowserPlain;
    });
  };

  const downloadFile = (withPassword: boolean) => {
    if (withPassword && !encrypted) {
      const problem = passwordProblem(password, again);
      if (problem) return refuse(problem);
    }
    void run(async () => {
      let session: SessionKey | undefined;
      if (encrypted) session = mode.session;
      else if (withPassword) session = await createKey(password);
      const current = currentState().doc ?? doc;
      const text = await saver.fileContents(current, session);
      const name = backupFileName(new Date());
      downloadText(name, text);
      markDownloaded(current);
      return saveCopy.downloaded(name);
    });
  };

  const changePassword = () => {
    const problem = passwordProblem(newPassword, newAgain);
    if (problem) return refuse(problem);
    void run(async () => {
      await setSaveMode({ kind: 'browser-encrypted', session: await createKey(newPassword) }, { overwriteStale: overwrite });
      setNewPassword('');
      setNewAgain('');
      return saveCopy.passwordChanged;
    });
  };

  const removePassword = () => {
    setAsking(null);
    void run(async () => {
      await setSaveMode({ kind: 'browser-plain' }, { overwriteStale: overwrite });
      return saveCopy.passwordRemoved;
    });
  };

  const stopSaving = () => {
    setAsking(null);
    setMessage(eraseBrowserData(true) ? { kind: 'ok', text: saveCopy.stopped } : { kind: 'error', text: saveCopy.stopFailed });
  };

  const browserOk = saver.browserSaveAvailable;
  const where = mode.kind === 'none' ? saveCopy.rightNow.none : encrypted ? saveCopy.rightNow.encrypted : saveCopy.rightNow.plain;

  return (
    <>
      <h1 tabIndex={-1}>{saveCopy.title}</h1>
      <p>{saveCopy.intro}</p>
      <p class="note">{where}</p>
      {!browserOk && <p class="notice">{saveCopy.rightNow.unavailable}</p>}
      {message?.kind === 'error' && <p class="notice alert" role="alert">{message.text}</p>}
      <div aria-live="polite">{message?.kind === 'ok' && <p class="notice">{message.text}</p>}</div>

      {stale && !overwrite && (
        <section class="notice alert" aria-labelledby="stale-title">
          <h2 id="stale-title">{saveCopy.staleReplaceHeading}</h2>
          <p>{saveCopy.stale}</p>
          <p class="actions">
            <button type="button" class="primary" onClick={() => window.location.reload()}>{saveCopy.staleReload}</button>
            {asking !== 'replace' && <button type="button" onClick={() => setAsking('replace')}>{saveCopy.staleReplace}</button>}
          </p>
          {asking === 'replace' && (
            <Confirm
              title={saveCopy.staleReplaceHeading}
              yes={saveCopy.staleReplaceYes}
              no="Cancel"
              onYes={() => { setOverwrite(true); setAsking(null); }}
              onNo={() => setAsking(null)}
            >
              {saveCopy.staleReplaceWarning}
            </Confirm>
          )}
        </section>
      )}

      {!(stale && !overwrite) && (encrypted ? (
        <>
          <section>
            <h2>{saveCopy.passwordHeading}</h2>
            <p>{PASSWORD_WARNING}</p>
            <p class="actions">
              <button type="button" disabled={busy} onClick={() => downloadFile(true)}>Download a file with a password</button>
            </p>
            <p class="note">{saveCopy.encryptedFileNote}</p>
          </section>
          <section>
            <h2>{saveCopy.changeHeading}</h2>
            <p>{PASSWORD_WARNING}</p>
            <PasswordFields
              label="New password" againLabel="Type the new password again" hint={saveCopy.passwordHint}
              password={newPassword} again={newAgain} onPassword={setNewPassword} onAgain={setNewAgain}
            />
            <p><button type="button" disabled={busy} onClick={changePassword}>{busy ? saveCopy.working : saveCopy.changeButton}</button></p>
          </section>
          <section>
            <h2>{saveCopy.removeHeading}</h2>
            {asking === 'remove' ? (
              <Confirm title={saveCopy.removeHeading} yes={saveCopy.removeYes} no={saveCopy.removeKeep} onYes={removePassword} onNo={() => setAsking(null)}>
                {PLAIN_WARNING}
              </Confirm>
            ) : (
              <button type="button" disabled={busy} onClick={() => setAsking('remove')}>{saveCopy.removeButton}</button>
            )}
          </section>
        </>
      ) : (
        <>
          <section>
            <h2>{saveCopy.passwordHeading}</h2>
            <PasswordFields
              label="Password" againLabel="Type it again" hint={saveCopy.passwordHint}
              password={password} again={again} onPassword={setPassword} onAgain={setAgain}
            />
            <p>{PASSWORD_WARNING}</p>
            <p class="actions">
              <button type="button" class="primary" disabled={busy || !browserOk} onClick={() => saveInBrowser(true)}>
                Save in this browser with a password
              </button>
              <button type="button" disabled={busy} onClick={() => downloadFile(true)}>Download a file with a password</button>
            </p>
          </section>
          <section>
            <h2>{saveCopy.plainHeading}</h2>
            <p>{PLAIN_WARNING}</p>
            <p class="actions">
              <button type="button" disabled={busy || !browserOk} onClick={() => saveInBrowser(false)}>Save in this browser without a password</button>
              <button type="button" disabled={busy} onClick={() => downloadFile(false)}>Download a file without a password</button>
            </p>
          </section>
        </>
      ))}

      <section>
        <h2>{saveCopy.backupHeading}</h2>
        <p>{saveCopy.backup}</p>
        <p class="note">{saveCopy.openNote}</p>
        {stale && !overwrite && (
          <>
            {!encrypted && <p>{PLAIN_WARNING}</p>}
            <p class="actions">
              <button type="button" disabled={busy} onClick={() => downloadFile(encrypted)}>
                {encrypted ? 'Download a file with a password' : 'Download a file without a password'}
              </button>
            </p>
          </>
        )}
      </section>

      {mode.kind !== 'none' && (
        <section>
          <h2>{saveCopy.stopHeading}</h2>
          {asking === 'stop' ? (
            <Confirm title={saveCopy.stopHeading} yes={saveCopy.stopYes} no={saveCopy.stopKeep} onYes={stopSaving} onNo={() => setAsking(null)}>
              {saveCopy.stopText}
            </Confirm>
          ) : (
            <button type="button" disabled={busy} onClick={() => setAsking('stop')}>{saveCopy.stopHeading}</button>
          )}
        </section>
      )}
      <OpenFile />
      <p><a href="#/home">Back to your inventory</a></p>
    </>
  );
}
